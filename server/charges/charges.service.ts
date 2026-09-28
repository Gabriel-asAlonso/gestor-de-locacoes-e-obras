import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm';
import {
  carteiras, cobranca_itens, cobrancas, contrato_encargos, contrato_unidades, contratos, imoveis, locatarios, unidades,
} from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type ReadDb, type WriteContext } from '../database/connection.ts';
import { loadChargeStates, money, type ChargeState, type NegotiationState } from './derive.ts';
import type { ChargeCreateDto, ChargeListQuery } from './dto.ts';

const selection = {
  id: cobrancas.id, codigo: cobrancas.codigo, contratoId: cobrancas.contrato_id, contratoCodigo: contratos.codigo,
  competencia: cobrancas.competencia, formaPagamentoPrevista: cobrancas.forma_pagamento_prevista, observacoes: cobrancas.observacoes,
  imovelId: imoveis.id, imovelNome: imoveis.nome, carteiraId: carteiras.id, carteiraNome: carteiras.nome,
  locatarioId: locatarios.id, locatarioNome: locatarios.nome, contratoEstado: contratos.estado,
  createdAt: cobrancas.created_at,
};

type ChargeRow = { id: string } & Record<string, unknown>;

function presentNegotiation(state: NegotiationState) {
  return {
    id: state.id, versao: state.versao, saldoBase: money(state.saldoBaseCents), desconto: money(state.descontoCents),
    acrescimo: money(state.acrescimoCents), entradaPrevista: money(state.entradaPrevistaCents),
    totalNegociado: money(state.totalNegociadoCents), totalFinanciado: money(state.totalNegociadoCents - state.entradaPrevistaCents),
    quantidadeParcelas: state.quantidadeParcelas, primeiroVencimento: state.primeiroVencimento, dataAcordo: state.dataAcordo,
    motivo: state.motivo, motivoOutro: state.motivoOutro, formaPagamentoPrevista: state.formaPagamentoPrevista,
    multa: money(state.multaCents), juros: money(state.jurosCents), correcao: money(state.correcaoCents),
    contatoNome: state.contatoNome, contatoCanal: state.contatoCanal, documentoNome: state.documentoNome,
    observacoes: state.observacoes, substituidaEm: state.substituidaEm,
    parcelas: state.parcelas.map((parcela) => ({
      id: parcela.id, numero: parcela.numero, vencimento: parcela.vencimento,
      valor: money(parcela.valorCents), recebido: money(parcela.recebidoCents), saldo: money(parcela.valorCents - parcela.recebidoCents),
    })),
  };
}

function present(row: ChargeRow, state: ChargeState, units: Array<{ nome: string }>) {
  return {
    id: row.id, codigo: row.codigo, contratoId: row.contratoId, contratoCodigo: row.contratoCodigo,
    carteiraId: row.carteiraId, carteiraNome: row.carteiraNome, imovelId: row.imovelId, imovelNome: row.imovelNome,
    locatarioId: row.locatarioId, locatarioNome: row.locatarioNome, competencia: row.competencia,
    formaPagamentoPrevista: row.formaPagamentoPrevista ?? null, observacoes: row.observacoes ?? null,
    unidades: units,
    itens: state.itens.map((item) => ({
      id: item.id, ordem: item.ordem, nome: item.nome, natureza: item.natureza, vencimento: item.vencimento,
      valor: money(item.valorCents), recebido: money(item.recebidoCents), saldo: money(item.valorCents - item.recebidoCents),
      contratoEncargoId: item.contratoEncargoId, referencia: item.referencia,
    })),
    total: money(state.totalCents), recebido: money(state.recebidoCents), saldoOperacional: money(state.saldoOperacionalCents),
    statusDerivado: state.status,
    negociacaoVigente: state.activeNegotiation ? presentNegotiation(state.activeNegotiation) : null,
    recebimentos: state.recebimentos.map((receipt) => ({
      id: receipt.id, codigo: receipt.codigo, dataRecebimento: receipt.dataRecebimento, dataCredito: receipt.dataCredito,
      valor: money(receipt.valorCents), valorRecebido: money(receipt.valorRecebidoCents),
      desconto: money(receipt.descontoCents), acrescimo: money(receipt.acrescimoCents),
      formaPagamento: receipt.formaPagamento, contaFinanceiraId: receipt.contaFinanceiraId, contaDescricao: receipt.contaDescricao,
      referencia: receipt.referencia, pagadorDescricao: receipt.pagadorDescricao, comprovanteNome: receipt.comprovanteNome,
      observacoes: receipt.observacoes,
      estornoDeId: receipt.estornoDeId, motivoEstorno: receipt.motivoEstorno,
      alocacoes: receipt.alocacoes.map((alloc) => ({ cobrancaItemId: alloc.cobrancaItemId, negociacaoParcelaId: alloc.negociacaoParcelaId, valor: money(alloc.valorCents) })),
    })),
  };
}

async function unitsByCharge(db: ReadDb, chargeRows: ChargeRow[]) {
  const contractIds = [...new Set(chargeRows.map((row) => row.contratoId as string))];
  if (!contractIds.length) return new Map<string, Array<{ nome: string }>>();
  const rows = await db.select({ contratoId: contrato_unidades.contrato_id, nome: unidades.nome })
    .from(contrato_unidades).innerJoin(unidades, eq(unidades.id, contrato_unidades.unidade_id))
    .where(inArray(contrato_unidades.contrato_id, contractIds));
  const map = new Map<string, Array<{ nome: string }>>();
  for (const row of rows) {
    const list = map.get(row.contratoId) ?? [];
    list.push({ nome: row.nome });
    map.set(row.contratoId, list);
  }
  return map;
}

function order(query: ChargeListQuery) {
  const column = query.sortBy === 'codigo' ? cobrancas.codigo : query.sortBy === 'createdAt' ? cobrancas.created_at : cobrancas.competencia;
  return query.sortOrder === 'asc' ? asc(column) : desc(column);
}

export async function listCharges(query: ChargeListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const result = await withRead(async (db) => {
    const rows = await db.select(selection).from(cobrancas)
      .innerJoin(contratos, eq(contratos.id, cobrancas.contrato_id))
      .innerJoin(imoveis, eq(imoveis.id, contratos.imovel_id)).innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id))
      .innerJoin(locatarios, eq(locatarios.id, contratos.locatario_id))
      .where(and(
        query.contratoId ? eq(cobrancas.contrato_id, query.contratoId) : undefined,
        query.carteiraId ? eq(imoveis.carteira_id, query.carteiraId) : undefined,
        query.imovelId ? eq(contratos.imovel_id, query.imovelId) : undefined,
        query.locatarioId ? eq(contratos.locatario_id, query.locatarioId) : undefined,
        query.competencia ? eq(cobrancas.competencia, query.competencia) : undefined,
        term ? or(like(cobrancas.codigo, term), like(contratos.codigo, term), like(locatarios.nome, term), like(imoveis.nome, term)) : undefined,
      )).orderBy(order(query)) as ChargeRow[];
    const states = await loadChargeStates(db, rows.map((row) => row.id));
    const units = await unitsByCharge(db, rows);
    return rows.map((row) => present(row, states.get(row.id)!, units.get(row.contratoId as string) ?? []));
  });
  // Status is derived, so filter the projection in memory to keep it consistent with the detail.
  const filtered = query.status ? result.filter((charge) => charge.statusDerivado === query.status) : result;
  const total = filtered.length;
  if (!query.page || !query.limit) return { data: filtered };
  const start = (query.page - 1) * query.limit;
  return { data: filtered.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findCharge(id: string) {
  return withRead(async (db) => {
    const [row] = await db.select(selection).from(cobrancas)
      .innerJoin(contratos, eq(contratos.id, cobrancas.contrato_id))
      .innerJoin(imoveis, eq(imoveis.id, contratos.imovel_id)).innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id))
      .innerJoin(locatarios, eq(locatarios.id, contratos.locatario_id)).where(eq(cobrancas.id, id)).limit(1) as ChargeRow[];
    if (!row) return null;
    const states = await loadChargeStates(db, [row.id]);
    const units = await unitsByCharge(db, [row]);
    return present(row, states.get(row.id)!, units.get(row.contratoId as string) ?? []);
  });
}

export async function createCharge(input: ChargeCreateDto, context: WriteContext) {
  // Validate relations up front so the client gets clear 404/422 instead of a raw constraint error.
  const [contract] = await withRead((db) => db.select({ id: contratos.id, estado: contratos.estado }).from(contratos).where(eq(contratos.id, input.contratoId)).limit(1));
  if (!contract) throw new NotFoundError('Contrato não encontrado.');
  if (contract.estado !== 'ativo') throw new BusinessRuleError('A cobrança só pode ser emitida para um contrato ativo.');
  const referencedEncargoIds = input.itens.map((item) => item.contratoEncargoId).filter((value): value is string => Boolean(value));
  if (referencedEncargoIds.length) {
    const owned = await withRead((db) => db.select({ id: contrato_encargos.id }).from(contrato_encargos)
      .where(and(eq(contrato_encargos.contrato_id, input.contratoId), inArray(contrato_encargos.id, referencedEncargoIds))));
    if (owned.length !== new Set(referencedEncargoIds).size) throw new BusinessRuleError('Um ou mais encargos não pertencem ao contrato da cobrança.');
  }

  try {
    const id = await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: cobrancas.codigo }).from(cobrancas);
      const [row] = await db.insert(cobrancas).values({
        codigo: nextCode('COB', codes.map((item) => item.codigo), 4), contrato_id: input.contratoId, competencia: input.competencia,
        forma_pagamento_prevista: input.formaPagamentoPrevista ?? 'boleto', observacoes: input.observacoes,
        created_by: audit.created_by,
      }).returning({ id: cobrancas.id });
      const cobrancaId = row!.id;
      for (const item of input.itens) {
        await db.insert(cobranca_itens).values({
          cobranca_id: cobrancaId, contrato_encargo_id: item.contratoEncargoId, ordem: item.ordem, nome_emissao: item.nome,
          natureza: item.natureza, vencimento: item.vencimento, valor: item.valor, referencia: item.referencia, created_by: audit.created_by,
        });
      }
      return cobrancaId;
    });
    return (await findCharge(id))!;
  } catch (error) { rethrowConflict(error, 'Já existe uma cobrança para este contrato nesta competência.'); }
}
