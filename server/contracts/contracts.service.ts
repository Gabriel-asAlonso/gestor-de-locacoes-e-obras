import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm';
import { carteiras, contratos, contrato_encargos, contrato_unidades, imoveis, locatarios, unidades } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type ReadDb, type WriteContext } from '../database/connection.ts';
import type { ContractCreateDto, ContractListQuery } from './dto.ts';

const selection = {
  id: contratos.id, codigo: contratos.codigo, imovelId: contratos.imovel_id, imovelNome: imoveis.nome,
  carteiraId: imoveis.carteira_id, carteiraNome: carteiras.nome, locatarioId: contratos.locatario_id, locatarioNome: locatarios.nome,
  inicio: contratos.inicio, terminoPrevisto: contratos.termino_previsto, aluguelMensal: contratos.aluguel_mensal,
  diaVencimento: contratos.dia_vencimento, indiceReajuste: contratos.indice_reajuste, mesReajuste: contratos.mes_reajuste,
  formaPagamentoPrevista: contratos.forma_pagamento_prevista, formaPagamentoTexto: contratos.forma_pagamento_texto,
  observacoes: contratos.observacoes, estado: contratos.estado, encerradoEm: contratos.encerrado_em, finalidade: contratos.finalidade,
  dataOcupacao: contratos.data_ocupacao, dataAssinatura: contratos.data_assinatura, referenciaPagamento: contratos.referencia_pagamento,
  periodicidadeReajusteMeses: contratos.periodicidade_reajuste_meses, multaAtrasoPercentual: contratos.multa_atraso_percentual,
  jurosMensalPercentual: contratos.juros_mensal_percentual, canalEnvio: contratos.canal_envio, garantiaTipo: contratos.garantia_tipo,
  garantiaDetalhe: contratos.garantia_detalhe, regraPrimeiraCobranca: contratos.regra_primeira_cobranca, nomeDocumento: contratos.nome_documento,
  createdAt: contratos.created_at, updatedAt: contratos.updated_at,
};

type ContractRow = Record<string, unknown> & { id: string };

async function attachComposition(db: ReadDb, rows: ContractRow[]) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id);
  const unitRows = await db.select({ contratoId: contrato_unidades.contrato_id, unidadeId: unidades.id, unidadeNome: unidades.nome })
    .from(contrato_unidades).innerJoin(unidades, eq(unidades.id, contrato_unidades.unidade_id)).where(inArray(contrato_unidades.contrato_id, ids));
  const encargoRows = await db.select({ contratoId: contrato_encargos.contrato_id, ordem: contrato_encargos.ordem, nome: contrato_encargos.nome, natureza: contrato_encargos.natureza, valorBase: contrato_encargos.valor_base })
    .from(contrato_encargos).where(inArray(contrato_encargos.contrato_id, ids)).orderBy(contrato_encargos.ordem);
  return rows.map((row) => ({
    ...row,
    unidades: unitRows.filter((item) => item.contratoId === row.id).map((item) => ({ id: item.unidadeId, nome: item.unidadeNome })),
    encargos: encargoRows.filter((item) => item.contratoId === row.id).map((item) => ({ nome: item.nome, natureza: item.natureza, valorBase: item.valorBase })),
  }));
}

function order(query: ContractListQuery) {
  const column = query.sortBy === 'codigo' ? contratos.codigo : query.sortBy === 'createdAt' ? contratos.created_at : contratos.inicio;
  return query.sortOrder === 'desc' ? desc(column) : asc(column);
}

export async function listContracts(query: ContractListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const result = await withRead(async (db) => {
    const rows = await db.select(selection).from(contratos)
      .innerJoin(imoveis, eq(imoveis.id, contratos.imovel_id)).innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id))
      .innerJoin(locatarios, eq(locatarios.id, contratos.locatario_id))
      .where(and(
        query.estado ? eq(contratos.estado, query.estado) : undefined,
        query.carteiraId ? eq(imoveis.carteira_id, query.carteiraId) : undefined,
        query.imovelId ? eq(contratos.imovel_id, query.imovelId) : undefined,
        query.locatarioId ? eq(contratos.locatario_id, query.locatarioId) : undefined,
        term ? or(like(contratos.codigo, term), like(locatarios.nome, term), like(imoveis.nome, term), like(carteiras.nome, term)) : undefined,
      )).orderBy(order(query));
    return attachComposition(db, rows as ContractRow[]);
  });
  const total = result.length;
  if (!query.page || !query.limit) return { data: result };
  const start = (query.page - 1) * query.limit;
  return { data: result.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findContract(id: string) {
  return withRead(async (db) => {
    const rows = await db.select(selection).from(contratos)
      .innerJoin(imoveis, eq(imoveis.id, contratos.imovel_id)).innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id))
      .innerJoin(locatarios, eq(locatarios.id, contratos.locatario_id)).where(eq(contratos.id, id)).limit(1);
    const [attached] = await attachComposition(db, rows as ContractRow[]);
    return attached ?? null;
  });
}

export async function createContract(input: ContractCreateDto, context: WriteContext) {
  // Validate relations before writing so the client gets clear 404/422 instead of a constraint error.
  const [property] = await withRead((db) => db.select({ id: imoveis.id }).from(imoveis).where(and(eq(imoveis.id, input.imovelId), eq(imoveis.ativo, true))).limit(1));
  if (!property) throw new NotFoundError('Imóvel não encontrado ou inativo.');
  const [tenant] = await withRead((db) => db.select({ id: locatarios.id }).from(locatarios).where(and(eq(locatarios.id, input.locatarioId), eq(locatarios.ativo, true))).limit(1));
  if (!tenant) throw new NotFoundError('Locatário não encontrado ou inativo.');
  const chosenUnits = await withRead((db) => db.select({ id: unidades.id, imovelId: unidades.imovel_id }).from(unidades).where(inArray(unidades.id, input.unidadeIds)));
  if (chosenUnits.length !== input.unidadeIds.length) throw new NotFoundError('Uma ou mais unidades não foram encontradas.');
  if (chosenUnits.some((unit) => unit.imovelId !== input.imovelId)) throw new BusinessRuleError('Todas as unidades devem pertencer ao imóvel do contrato.');

  try {
    const id = await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: contratos.codigo }).from(contratos);
      const [row] = await db.insert(contratos).values({
        codigo: nextCode('CTR', codes.map((item) => item.codigo)), imovel_id: input.imovelId, locatario_id: input.locatarioId,
        inicio: input.inicio, termino_previsto: input.terminoPrevisto, aluguel_mensal: input.aluguelMensal, dia_vencimento: input.diaVencimento,
        indice_reajuste: input.indiceReajuste, mes_reajuste: input.mesReajuste ?? null,
        forma_pagamento_prevista: input.formaPagamentoPrevista ?? null, forma_pagamento_texto: input.formaPagamentoTexto,
        observacoes: input.observacoes, estado: 'rascunho', finalidade: input.finalidade, data_ocupacao: input.dataOcupacao,
        data_assinatura: input.dataAssinatura, referencia_pagamento: input.referenciaPagamento,
        periodicidade_reajuste_meses: input.periodicidadeReajusteMeses ?? null, multa_atraso_percentual: input.multaAtrasoPercentual,
        juros_mensal_percentual: input.jurosMensalPercentual, canal_envio: input.canalEnvio, garantia_tipo: input.garantiaTipo,
        garantia_detalhe: input.garantiaDetalhe, regra_primeira_cobranca: input.regraPrimeiraCobranca, nome_documento: input.nomeDocumento,
        created_by: audit.created_by, updated_by: audit.updated_by,
      }).returning({ id: contratos.id });
      const contractId = row!.id;
      // Units and charges are only mutable while the contract is a draft (DB trigger enforces this),
      // so the composition is written first and the contract is then activated (rascunho → ativo).
      for (const unidadeId of input.unidadeIds) {
        await db.insert(contrato_unidades).values({ contrato_id: contractId, unidade_id: unidadeId, created_by: audit.created_by });
      }
      let ordem = 0;
      for (const encargo of input.encargos) {
        ordem += 1;
        await db.insert(contrato_encargos).values({
          contrato_id: contractId, ordem, nome: encargo.nome, natureza: encargo.natureza,
          valor_base: encargo.natureza === 'aluguel' ? null : encargo.valorBase,
          created_by: audit.created_by, updated_by: audit.updated_by,
        });
      }
      await db.update(contratos).set({ estado: 'ativo', updated_at: audit.updated_at, updated_by: audit.updated_by }).where(eq(contratos.id, contractId));
      return contractId;
    });
    return (await findContract(id))!;
  } catch (error) { rethrowConflict(error, 'Conflito ao criar o contrato (código ou composição duplicada).'); }
}
