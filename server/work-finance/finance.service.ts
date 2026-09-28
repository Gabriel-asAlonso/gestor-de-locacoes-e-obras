import { and, asc, eq, isNull } from 'drizzle-orm';
import { aporte_cotas, aporte_pagamentos, aportes, despesas, obra_ajustes_caixa, obra_alocacoes_equipe, obra_contratacoes, obras, pagamentos_despesa } from '../../db/schema.ts';
import { fromHundredths, toHundredths } from '../../db/fixed-point.ts';
import { nextCode } from '../common/codes.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';
import { appendWorkJournal } from '../work-journal/journal.writer.ts';
import type { AdjustmentCreateDto } from './dto.ts';

const cents = (value: string | null | undefined) => value ? toHundredths(value) : 0n;
const money = (value: bigint) => fromHundredths(value);
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);

async function assertWork(obraId: string) {
  const [row] = await withRead((db) => db.select({ id: obras.id }).from(obras).where(eq(obras.id, obraId)).limit(1));
  if (!row) throw new NotFoundError('Obra não encontrada.');
}

export async function workFinance(obraId: string) {
  await assertWork(obraId);
  return withRead(async (db) => {
    const [team, contracts, supplierPayments, shares, contributionPayments, adjustments] = await Promise.all([
      db.select({ quantidade: obra_alocacoes_equipe.quantidade, valorUnitario: obra_alocacoes_equipe.valor_unitario }).from(obra_alocacoes_equipe)
        .where(and(eq(obra_alocacoes_equipe.obra_id, obraId), isNull(obra_alocacoes_equipe.removida_em))),
      db.select({ id: despesas.id, valor: despesas.valor }).from(obra_contratacoes).innerJoin(despesas, eq(despesas.id, obra_contratacoes.despesa_id))
        .where(eq(obra_contratacoes.obra_id, obraId)),
      db.select({ valor: pagamentos_despesa.valor, estornoDeId: pagamentos_despesa.estorno_de_id }).from(pagamentos_despesa)
        .innerJoin(obra_contratacoes, eq(obra_contratacoes.despesa_id, pagamentos_despesa.despesa_id))
        .where(eq(obra_contratacoes.obra_id, obraId)),
      db.select({ id: aporte_cotas.id, nome: aporte_cotas.nome_socio_pactuado, descricao: aportes.descricao, aporteCodigo: aportes.codigo })
        .from(aporte_cotas).innerJoin(aportes, eq(aportes.id, aporte_cotas.aporte_id)).where(eq(aportes.obra_id, obraId)),
      db.select({ id: aporte_pagamentos.id, cotaId: aporte_pagamentos.cota_id, codigo: aporte_pagamentos.codigo,
        valor: aporte_pagamentos.valor, data: aporte_pagamentos.data_pagamento, estornoDeId: aporte_pagamentos.estorno_de_id })
        .from(aporte_pagamentos).innerJoin(aporte_cotas, eq(aporte_cotas.id, aporte_pagamentos.cota_id))
        .innerJoin(aportes, eq(aportes.id, aporte_cotas.aporte_id)).where(eq(aportes.obra_id, obraId)),
      db.select({ id: obra_ajustes_caixa.id, codigo: obra_ajustes_caixa.codigo, data: obra_ajustes_caixa.data_movimento,
        descricao: obra_ajustes_caixa.descricao, valor: obra_ajustes_caixa.valor_assinado,
        estornoDeId: obra_ajustes_caixa.estorno_de_id }).from(obra_ajustes_caixa)
        .where(eq(obra_ajustes_caixa.obra_id, obraId)).orderBy(asc(obra_ajustes_caixa.data_movimento)),
    ]);
    const teamCost = sum(team.map((row) => (cents(row.quantidade) * cents(row.valorUnitario) + 50n) / 100n));
    const contracted = sum(contracts.map((row) => cents(row.valor)));
    const supplierPaid = sum(supplierPayments.map((row) => row.estornoDeId ? -cents(row.valor) : cents(row.valor)));
    const contributionNet = sum(contributionPayments.map((row) => row.estornoDeId ? -cents(row.valor) : cents(row.valor)));
    const adjustmentNet = sum(adjustments.map((row) => cents(row.valor)));
    const sharesById = new Map(shares.map((row) => [row.id, row]));
    const entries = [
      ...contributionPayments.map((row) => {
        const share = sharesById.get(row.cotaId);
        return { id: row.id, codigo: row.codigo ?? row.id.slice(0, 8), tipo: 'aporte' as const,
          descricao: `${share?.descricao ?? 'Aporte'} · ${row.estornoDeId ? 'estorno' : 'pagamento recebido'}`,
          parte: share?.nome ?? 'Sócio', valor: money(row.estornoDeId ? -cents(row.valor) : cents(row.valor)),
          data: row.data, origemId: share?.aporteCodigo ?? null, estornoDeId: row.estornoDeId };
      }),
      ...adjustments.map((row) => ({ id: row.id, codigo: row.codigo ?? row.id.slice(0, 8), tipo: 'ajuste' as const,
        descricao: row.descricao, parte: 'Caixa administrativo', valor: row.valor, data: row.data,
        origemId: null, estornoDeId: row.estornoDeId })),
    ].sort((left, right) => right.data.localeCompare(left.data) || right.id.localeCompare(left.id));
    return { obraId, equipeCusto: money(teamCost), fornecedoresContratado: money(contracted),
      fornecedoresPago: money(supplierPaid), fornecedoresPendente: money(contracted - supplierPaid),
      aportesRecebidos: money(contributionNet), ajustesLiquidos: money(adjustmentNet),
      caixaDisponivel: money(contributionNet + adjustmentNet - supplierPaid), entradas: entries };
  });
}

export async function allWorkFinances() {
  const rows = await withRead((db) => db.select({ id: obras.id }).from(obras));
  return { data: await Promise.all(rows.map((row) => workFinance(row.id))) };
}

export async function listAdjustments(obraId: string) {
  const finance = await workFinance(obraId);
  return { data: finance.entradas.filter((entry) => entry.tipo === 'ajuste') };
}

export async function createAdjustment(obraId: string, input: AdjustmentCreateDto, context: WriteContext) {
  await assertWork(obraId);
  await withTransaction(context, async (db, audit) => {
    const codes = await db.select({ codigo: obra_ajustes_caixa.codigo }).from(obra_ajustes_caixa).where(eq(obra_ajustes_caixa.obra_id, obraId));
    const codigo = nextCode('FIN', codes.map((row) => row.codigo));
    await db.insert(obra_ajustes_caixa).values({ obra_id: obraId, codigo, data_movimento: input.dataMovimento,
      descricao: input.descricao, valor_assinado: input.valorAssinado, created_by: audit.created_by });
    await appendWorkJournal(db, audit, obraId, { titulo: 'Ajuste de caixa registrado',
      descricao: `${input.descricao} · ${input.valorAssinado}` });
  });
  return workFinance(obraId);
}

export async function reverseAdjustment(obraId: string, id: string, motivo: string, context: WriteContext) {
  await assertWork(obraId);
  await withTransaction({ ...context, reason: motivo }, async (db, audit) => {
    const [original] = await db.select().from(obra_ajustes_caixa)
      .where(and(eq(obra_ajustes_caixa.id, id), eq(obra_ajustes_caixa.obra_id, obraId))).limit(1);
    if (!original) throw new NotFoundError('Ajuste não encontrado nesta obra.');
    if (original.estorno_de_id) throw new BusinessRuleError('Não é possível estornar um estorno.');
    const [previous] = await db.select({ id: obra_ajustes_caixa.id }).from(obra_ajustes_caixa)
      .where(eq(obra_ajustes_caixa.estorno_de_id, id)).limit(1);
    if (previous) throw new BusinessRuleError('Este ajuste já foi estornado.');
    await db.insert(obra_ajustes_caixa).values({ obra_id: obraId, codigo: null,
      data_movimento: new Date().toISOString().slice(0, 10), descricao: `Estorno: ${original.descricao}`,
      valor_assinado: money(-cents(original.valor_assinado)), estorno_de_id: id,
      motivo_estorno: motivo, created_by: audit.created_by });
    await appendWorkJournal(db, audit, obraId, { titulo: 'Ajuste de caixa estornado',
      descricao: `${original.descricao} · motivo: ${motivo}` });
  });
  return workFinance(obraId);
}
