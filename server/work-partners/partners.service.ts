import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { aporte_cotas, aporte_pagamentos, aportes, obra_socios, obras, socios } from '../../db/schema.ts';
import { fromHundredths, toHundredths } from '../../db/fixed-point.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { AppError, BusinessRuleError, ConflictError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type ReadDb, type WriteContext } from '../database/connection.ts';
import type { ContributionCreateDto, ContributionPaymentDto, ParticipationPatchDto, PartnerCreateDto } from './dto.ts';

const HUNDRED = 10000n; // 100,00% em pontos-base (o modelo guarda percentual ×100).

async function loadWork(obraId: string) {
  const [row] = await withRead((db) => db.select({ id: obras.id }).from(obras).where(eq(obras.id, obraId)).limit(1));
  if (!row) throw new NotFoundError('Obra não encontrada.');
  return row;
}

/** Participações correntes (fim_vigencia nulo), na ordem estável de vigência. */
function currentParticipations(db: ReadDb, obraId: string) {
  return db.select({ id: obra_socios.id, socioId: obra_socios.socio_id, nome: socios.nome, percentual: obra_socios.percentual })
    .from(obra_socios).innerJoin(socios, eq(socios.id, obra_socios.socio_id))
    .where(and(eq(obra_socios.obra_id, obraId), isNull(obra_socios.fim_vigencia)))
    .orderBy(asc(obra_socios.inicio_vigencia), asc(obra_socios.id));
}

export async function listPartners(obraId: string) {
  await loadWork(obraId);
  const rows = await withRead((db) => currentParticipations(db, obraId));
  return { data: rows.map((row, index) => ({ id: row.socioId, code: `SOC-${String(index + 1).padStart(3, '0')}`, name: row.nome, participationPercent: Number(row.percentual) })) };
}

export async function addPartner(obraId: string, input: PartnerCreateDto, context: WriteContext) {
  await loadWork(obraId);
  const current = await withRead((db) => currentParticipations(db, obraId));
  const newPct = toHundredths(input.percentual);
  const othersTotal = current.reduce((sum, row) => sum + toHundredths(row.percentual), 0n);
  if (othersTotal + newPct > HUNDRED) throw new BusinessRuleError(`A participação total não pode ultrapassar 100%. Restam ${fromHundredths(HUNDRED - othersTotal)}% disponíveis.`);
  try {
    await withTransaction(context, async (db, audit) => {
      // Sócio é cadastro global buscar-ou-criar por nome exato ativo (§4.16, como fornecedores/profissionais).
      let socio = (await db.select({ id: socios.id }).from(socios).where(and(eq(socios.nome, input.nome), eq(socios.ativo, true))).limit(1))[0];
      if (!socio) socio = (await db.insert(socios).values({ nome: input.nome, created_by: audit.created_by, updated_by: audit.updated_by }).returning({ id: socios.id }))[0]!;
      const [existing] = await db.select({ id: obra_socios.id }).from(obra_socios).where(and(eq(obra_socios.obra_id, obraId), eq(obra_socios.socio_id, socio.id), isNull(obra_socios.fim_vigencia))).limit(1);
      if (existing) throw new ConflictError('Este sócio já participa da obra. Edite a participação existente.');
      await db.insert(obra_socios).values({ obra_id: obraId, socio_id: socio.id, percentual: input.percentual, inicio_vigencia: audit.updated_at, created_by: audit.created_by });
    });
  } catch (error) { if (error instanceof AppError) throw error; rethrowConflict(error, 'Conflito ao vincular o sócio.'); }
  return listPartners(obraId);
}

export async function editParticipation(obraId: string, socioId: string, input: ParticipationPatchDto, context: WriteContext) {
  await loadWork(obraId);
  const current = await withRead((db) => currentParticipations(db, obraId));
  const target = current.find((row) => row.socioId === socioId);
  if (!target) throw new NotFoundError('Sócio não encontrado na distribuição atual desta obra.');
  const newPct = toHundredths(input.percentual);
  if (newPct === toHundredths(target.percentual)) return listPartners(obraId);
  const othersTotal = current.filter((row) => row.socioId !== socioId).reduce((sum, row) => sum + toHundredths(row.percentual), 0n);
  if (othersTotal + newPct > HUNDRED) throw new BusinessRuleError(`A participação total não pode ultrapassar 100%. Restam ${fromHundredths(HUNDRED - othersTotal)}% disponíveis.`);
  // Nova versão preservando o histórico: fecha a vigência atual e abre a nova no mesmo instante.
  await withTransaction(context, async (db, audit) => {
    await db.update(obra_socios).set({ fim_vigencia: audit.updated_at }).where(eq(obra_socios.id, target.id));
    await db.insert(obra_socios).values({ obra_id: obraId, socio_id: socioId, percentual: input.percentual, inicio_vigencia: audit.updated_at, created_by: audit.created_by });
  });
  return listPartners(obraId);
}

export async function removePartner(obraId: string, socioId: string, context: WriteContext) {
  await loadWork(obraId);
  const [target] = await withRead((db) => db.select({ id: obra_socios.id }).from(obra_socios)
    .where(and(eq(obra_socios.obra_id, obraId), eq(obra_socios.socio_id, socioId), isNull(obra_socios.fim_vigencia))).limit(1));
  if (!target) throw new NotFoundError('Sócio não encontrado na distribuição atual desta obra.');
  // Remoção lógica: fecha a vigência (não participa de novos aportes); histórico e cotas preservados.
  await withTransaction(context, async (db, audit) => {
    await db.update(obra_socios).set({ fim_vigencia: audit.updated_at }).where(eq(obra_socios.id, target.id));
  });
  return listPartners(obraId);
}

async function contributionsOf(db: ReadDb, obraId: string) {
  const aporteRows = await db.select({ id: aportes.id, codigo: aportes.codigo, data: aportes.data_solicitacao, descricao: aportes.descricao, valor: aportes.valor_solicitado })
    .from(aportes).where(eq(aportes.obra_id, obraId)).orderBy(desc(aportes.data_solicitacao), desc(aportes.codigo));
  if (!aporteRows.length) return [];
  const aporteIds = aporteRows.map((row) => row.id);
  const cotaRows = await db.select({ id: aporte_cotas.id, aporteId: aporte_cotas.aporte_id, socioId: obra_socios.socio_id, ordem: aporte_cotas.ordem_rateio, nome: aporte_cotas.nome_socio_pactuado, percentual: obra_socios.percentual, valorDevido: aporte_cotas.valor_devido })
    .from(aporte_cotas).innerJoin(obra_socios, eq(obra_socios.id, aporte_cotas.obra_socio_id))
    .where(inArray(aporte_cotas.aporte_id, aporteIds)).orderBy(asc(aporte_cotas.aporte_id), asc(aporte_cotas.ordem_rateio));
  const cotaIds = cotaRows.map((row) => row.id);
  const payRows = cotaIds.length ? await db.select({ id: aporte_pagamentos.id, cotaId: aporte_pagamentos.cota_id, codigo: aporte_pagamentos.codigo, data: aporte_pagamentos.data_pagamento, valor: aporte_pagamentos.valor, obs: aporte_pagamentos.observacoes })
    .from(aporte_pagamentos).where(and(inArray(aporte_pagamentos.cota_id, cotaIds), isNull(aporte_pagamentos.estorno_de_id))).orderBy(asc(aporte_pagamentos.data_pagamento), asc(aporte_pagamentos.id)) : [];
  return aporteRows.map((aporte) => ({
    databaseId: aporte.id, id: aporte.codigo, dateIso: aporte.data, description: aporte.descricao, amount: Number(aporte.valor),
    shares: cotaRows.filter((cota) => cota.aporteId === aporte.id).map((cota) => ({
      cotaId: cota.id, partnerId: cota.socioId, partnerName: cota.nome, participationPercent: Number(cota.percentual), amountDue: Number(cota.valorDevido),
      payments: payRows.filter((pay) => pay.cotaId === cota.id).map((pay) => ({ id: pay.codigo ?? pay.id, amount: Number(pay.valor), dateIso: pay.data, note: pay.obs ?? undefined })),
    })),
  }));
}

export async function listContributions(obraId: string) {
  await loadWork(obraId);
  return { data: await withRead((db) => contributionsOf(db, obraId)) };
}

export async function createContribution(obraId: string, input: ContributionCreateDto, context: WriteContext) {
  await loadWork(obraId);
  const parts = await withRead((db) => currentParticipations(db, obraId));
  if (!parts.length) throw new BusinessRuleError('Cadastre os sócios e distribua 100% antes de solicitar um aporte.');
  const total = parts.reduce((sum, row) => sum + toHundredths(row.percentual), 0n);
  if (total !== HUNDRED) throw new BusinessRuleError('A participação dos sócios deve totalizar 100% para solicitar um aporte.');
  // Rateio por maior resto: cada cota fica em floor/ceil do exato (≤ 1 centavo), somando o total.
  const value = toHundredths(input.valorSolicitado);
  const exact = parts.map((row) => value * toHundredths(row.percentual));
  const due = exact.map((amount) => amount / HUNDRED);
  const remainder = exact.map((amount) => amount % HUNDRED);
  const leftover = Number(value - due.reduce((sum, amount) => sum + amount, 0n));
  const order = parts.map((_, index) => index).sort((a, b) => (remainder[b]! === remainder[a]! ? a - b : remainder[b]! > remainder[a]! ? 1 : -1));
  for (let k = 0; k < leftover; k++) due[order[k]!]! += 1n;
  try {
    await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: aportes.codigo }).from(aportes).where(eq(aportes.obra_id, obraId));
      const [aporte] = await db.insert(aportes).values({ obra_id: obraId, codigo: nextCode('APT', codes.map((row) => row.codigo)), data_solicitacao: input.dataSolicitacao, descricao: input.descricao, valor_solicitado: input.valorSolicitado, created_by: audit.created_by }).returning({ id: aportes.id });
      for (let index = 0; index < parts.length; index++) {
        await db.insert(aporte_cotas).values({ aporte_id: aporte!.id, obra_socio_id: parts[index]!.id, ordem_rateio: index + 1, nome_socio_pactuado: parts[index]!.nome, valor_devido: fromHundredths(due[index]!), created_by: audit.created_by });
      }
    });
  } catch (error) { if (error instanceof AppError) throw error; rethrowConflict(error, 'Conflito ao solicitar o aporte.'); }
  return listContributions(obraId);
}

export async function registerContributionPayment(obraId: string, aporteId: string, cotaId: string, input: ContributionPaymentDto, context: WriteContext) {
  await loadWork(obraId);
  const [aporte] = await withRead((db) => db.select({ id: aportes.id }).from(aportes).where(and(eq(aportes.id, aporteId), eq(aportes.obra_id, obraId))).limit(1));
  if (!aporte) throw new NotFoundError('Aporte não encontrado nesta obra.');
  const [cota] = await withRead((db) => db.select({ id: aporte_cotas.id, valorDevido: aporte_cotas.valor_devido }).from(aporte_cotas).where(and(eq(aporte_cotas.id, cotaId), eq(aporte_cotas.aporte_id, aporteId))).limit(1));
  if (!cota) throw new NotFoundError('Cota não encontrada neste aporte.');
  const paidRows = await withRead((db) => db.select({ valor: aporte_pagamentos.valor }).from(aporte_pagamentos).where(and(eq(aporte_pagamentos.cota_id, cotaId), isNull(aporte_pagamentos.estorno_de_id))));
  const remaining = toHundredths(cota.valorDevido) - paidRows.reduce((sum, row) => sum + toHundredths(row.valor), 0n);
  if (toHundredths(input.valor) > remaining) throw new BusinessRuleError(`O pagamento excede o saldo devido da cota (R$ ${fromHundredths(remaining)}).`);
  try {
    await withTransaction(context, async (db, audit) => {
      const existing = await db.select({ codigo: aporte_pagamentos.codigo }).from(aporte_pagamentos)
        .innerJoin(aporte_cotas, eq(aporte_cotas.id, aporte_pagamentos.cota_id)).innerJoin(aportes, eq(aportes.id, aporte_cotas.aporte_id))
        .where(eq(aportes.obra_id, obraId));
      await db.insert(aporte_pagamentos).values({ cota_id: cotaId, codigo: nextCode('APG', existing.map((row) => row.codigo).filter((codigo): codigo is string => Boolean(codigo))), data_pagamento: input.dataPagamento, valor: input.valor, observacoes: input.observacoes, created_by: audit.created_by });
    });
  } catch (error) { if (error instanceof AppError) throw error; rethrowConflict(error, 'Conflito ao registrar o pagamento.'); }
  return listContributions(obraId);
}
