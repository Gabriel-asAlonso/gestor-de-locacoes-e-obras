/**
 * Derived financial state for cobranças (API contract §7). Every monetary figure the
 * client sees — total, recebido, saldo operacional, status, saldos por item/parcela — is
 * computed here from the immutable movements, never stored. Shared by the cobranças,
 * recebimentos and negociações services so all three agree on the same truth.
 */
import { eq, inArray, isNull } from 'drizzle-orm';
import { cobranca_itens, negociacao_parcelas, negociacoes, recebimento_alocacoes, recebimentos } from '../../db/schema.ts';
import { fromHundredths, toHundredths } from '../../db/fixed-point.ts';
import type { ReadDb, WriteDb } from '../database/connection.ts';

type Db = ReadDb | WriteDb;

export const cents = (value: string) => Number(toHundredths(value));
export const money = (value: number) => fromHundredths(value);
export const today = () => new Date().toISOString().slice(0, 10);

const UPCOMING_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ItemState {
  id: string; ordem: number; nome: string; natureza: string; vencimento: string;
  valorCents: number; recebidoCents: number; contratoEncargoId: string | null; referencia: string | null;
}
export interface ParcelaState { id: string; numero: number; vencimento: string; valorCents: number; recebidoCents: number }
export interface NegotiationState {
  id: string; versao: number; saldoBaseCents: number; descontoCents: number; acrescimoCents: number;
  entradaPrevistaCents: number; totalNegociadoCents: number; quantidadeParcelas: number; primeiroVencimento: string;
  dataAcordo: string; motivo: string; motivoOutro: string | null; formaPagamentoPrevista: string | null;
  multaCents: number; jurosCents: number; correcaoCents: number; contatoNome: string | null; contatoCanal: string | null;
  documentoNome: string | null; observacoes: string | null; substituidaEm: string | null; parcelas: ParcelaState[];
}
export interface ReceiptState {
  id: string; codigo: string; dataRecebimento: string; dataCredito: string | null; valorCents: number; valorRecebidoCents: number;
  descontoCents: number; acrescimoCents: number; formaPagamento: string | null; contaFinanceiraId: string | null;
  contaDescricao: string | null; referencia: string | null; pagadorDescricao: string | null; comprovanteNome: string | null;
  observacoes: string | null; estornoDeId: string | null; motivoEstorno: string | null;
  alocacoes: Array<{ id: string; cobrancaItemId: string | null; negociacaoParcelaId: string | null; valorCents: number }>;
}
export interface ChargeState {
  itens: ItemState[]; totalCents: number; recebidoCents: number; saldoOperacionalCents: number;
  status: string; activeNegotiation: NegotiationState | null; negotiations: NegotiationState[]; recebimentos: ReceiptState[];
}

function dueStatus(earliestDue: string | undefined, reference: string): string {
  if (!earliestDue) return 'Em aberto';
  if (earliestDue < reference) return 'Vencida';
  const diff = Date.parse(`${earliestDue}T00:00:00Z`) - Date.parse(`${reference}T00:00:00Z`);
  return diff <= UPCOMING_WINDOW_DAYS * DAY_MS ? 'Próxima' : 'Em aberto';
}

/** Loads the derived state of every charge in `ids` in a fixed number of queries. */
export async function loadChargeStates(db: Db, ids: string[]): Promise<Map<string, ChargeState>> {
  const states = new Map<string, ChargeState>();
  if (!ids.length) return states;

  const itemRows = await db.select().from(cobranca_itens).where(inArray(cobranca_itens.cobranca_id, ids)).orderBy(cobranca_itens.ordem);
  const negociacaoRows = await db.select().from(negociacoes).where(inArray(negociacoes.cobranca_id, ids)).orderBy(negociacoes.versao);
  const negociacaoIds = negociacaoRows.map((row) => row.id);
  const parcelaRows = negociacaoIds.length
    ? await db.select().from(negociacao_parcelas).where(inArray(negociacao_parcelas.negociacao_id, negociacaoIds)).orderBy(negociacao_parcelas.numero)
    : [];
  const receiptRows = await db.select().from(recebimentos).where(inArray(recebimentos.cobranca_id, ids)).orderBy(recebimentos.data_recebimento);
  const receiptIds = receiptRows.map((row) => row.id);
  const allocationRows = receiptIds.length
    ? await db.select().from(recebimento_alocacoes).where(inArray(recebimento_alocacoes.recebimento_id, receiptIds))
    : [];

  // Signed net allocation per target (a reversal receipt subtracts, mirroring the DB integrity rules).
  const reversalById = new Map(receiptRows.map((row) => [row.id, Boolean(row.estorno_de_id)]));
  const netByItem = new Map<string, number>();
  const netByParcela = new Map<string, number>();
  for (const alloc of allocationRows) {
    const sign = reversalById.get(alloc.recebimento_id) ? -1 : 1;
    const value = sign * cents(alloc.valor as unknown as string);
    if (alloc.cobranca_item_id) netByItem.set(alloc.cobranca_item_id, (netByItem.get(alloc.cobranca_item_id) ?? 0) + value);
    if (alloc.negociacao_parcela_id) netByParcela.set(alloc.negociacao_parcela_id, (netByParcela.get(alloc.negociacao_parcela_id) ?? 0) + value);
  }

  const parcelasByNegotiation = new Map<string, ParcelaState[]>();
  for (const row of parcelaRows) {
    const list = parcelasByNegotiation.get(row.negociacao_id) ?? [];
    list.push({ id: row.id, numero: row.numero, vencimento: row.vencimento, valorCents: cents(row.valor as unknown as string), recebidoCents: netByParcela.get(row.id) ?? 0 });
    parcelasByNegotiation.set(row.negociacao_id, list);
  }

  const negotiationsByCharge = new Map<string, NegotiationState[]>();
  for (const row of negociacaoRows) {
    const saldoBaseCents = cents(row.saldo_base as unknown as string);
    const descontoCents = cents(row.desconto as unknown as string);
    const acrescimoCents = cents(row.acrescimo as unknown as string);
    const state: NegotiationState = {
      id: row.id, versao: row.versao, saldoBaseCents, descontoCents, acrescimoCents,
      entradaPrevistaCents: cents(row.entrada_prevista as unknown as string),
      totalNegociadoCents: saldoBaseCents - descontoCents + acrescimoCents,
      quantidadeParcelas: row.quantidade_parcelas, primeiroVencimento: row.primeiro_vencimento, dataAcordo: row.data_acordo,
      motivo: row.motivo as string, motivoOutro: row.motivo_outro ?? null, formaPagamentoPrevista: (row.forma_pagamento_prevista as string | null) ?? null,
      multaCents: cents(row.multa as unknown as string), jurosCents: cents(row.juros as unknown as string), correcaoCents: cents(row.correcao as unknown as string),
      contatoNome: row.contato_nome ?? null, contatoCanal: row.contato_canal ?? null, documentoNome: row.documento_nome ?? null,
      observacoes: row.observacoes ?? null,
      substituidaEm: (row.substituida_em as string | null) ?? null, parcelas: parcelasByNegotiation.get(row.id) ?? [],
    };
    const list = negotiationsByCharge.get(row.cobranca_id) ?? [];
    list.push(state);
    negotiationsByCharge.set(row.cobranca_id, list);
  }

  const receiptsByCharge = new Map<string, ReceiptState[]>();
  const allocationsByReceipt = new Map<string, ReceiptState['alocacoes']>();
  for (const alloc of allocationRows) {
    const list = allocationsByReceipt.get(alloc.recebimento_id) ?? [];
    list.push({ id: alloc.id, cobrancaItemId: alloc.cobranca_item_id ?? null, negociacaoParcelaId: alloc.negociacao_parcela_id ?? null, valorCents: cents(alloc.valor as unknown as string) });
    allocationsByReceipt.set(alloc.recebimento_id, list);
  }
  for (const row of receiptRows) {
    const list = receiptsByCharge.get(row.cobranca_id) ?? [];
    list.push({
      id: row.id, codigo: row.codigo as string, dataRecebimento: row.data_recebimento, dataCredito: row.data_credito ?? null,
      valorCents: cents(row.valor as unknown as string), valorRecebidoCents: row.valor_recebido == null || cents(row.valor_recebido as unknown as string) === 0 ? cents(row.valor as unknown as string) : cents(row.valor_recebido as unknown as string),
      descontoCents: cents(row.desconto as unknown as string), acrescimoCents: cents(row.acrescimo as unknown as string),
      formaPagamento: (row.forma_pagamento as string | null) ?? null, contaFinanceiraId: (row.conta_financeira_id as string | null) ?? null,
      contaDescricao: row.conta_descricao ?? null, referencia: (row.referencia as string | null) ?? null,
      pagadorDescricao: row.pagador_descricao ?? null, comprovanteNome: row.comprovante_nome ?? null, observacoes: row.observacoes ?? null,
      estornoDeId: (row.estorno_de_id as string | null) ?? null,
      motivoEstorno: (row.motivo_estorno as string | null) ?? null, alocacoes: allocationsByReceipt.get(row.id) ?? [],
    });
    receiptsByCharge.set(row.cobranca_id, list);
  }

  const itemsByCharge = new Map<string, ItemState[]>();
  for (const row of itemRows) {
    const list = itemsByCharge.get(row.cobranca_id) ?? [];
    list.push({
      id: row.id, ordem: row.ordem, nome: row.nome_emissao, natureza: row.natureza as string, vencimento: row.vencimento,
      valorCents: cents(row.valor as unknown as string), recebidoCents: netByItem.get(row.id) ?? 0,
      contratoEncargoId: row.contrato_encargo_id ?? null, referencia: (row.referencia as string | null) ?? null,
    });
    itemsByCharge.set(row.cobranca_id, list);
  }

  const reference = today();
  for (const id of ids) {
    const itens = itemsByCharge.get(id) ?? [];
    const receipts = receiptsByCharge.get(id) ?? [];
    const negotiations = negotiationsByCharge.get(id) ?? [];
    const active = negotiations.find((item) => item.substituidaEm === null) ?? null;
    const totalCents = itens.reduce((sum, item) => sum + item.valorCents, 0);
    const recebidoCents = receipts.reduce((sum, receipt) => sum + (receipt.estornoDeId ? -receipt.valorCents : receipt.valorCents), 0);
    const saldoOperacionalCents = active
      ? active.totalNegociadoCents - active.parcelas.reduce((sum, parcela) => sum + parcela.recebidoCents, 0)
      : totalCents - itens.reduce((sum, item) => sum + item.recebidoCents, 0);
    const earliestDue = [...itens].map((item) => item.vencimento).sort()[0];
    const status = active ? 'Negociada'
      : recebidoCents > 0 && saldoOperacionalCents <= 0 ? 'Recebida'
      : recebidoCents > 0 ? 'Parcial'
      : dueStatus(earliestDue, reference);
    states.set(id, { itens, totalCents, recebidoCents, saldoOperacionalCents, status, activeNegotiation: active, negotiations, recebimentos: receipts });
  }
  return states;
}

export async function loadChargeState(db: Db, id: string): Promise<ChargeState | null> {
  return (await loadChargeStates(db, [id])).get(id) ?? null;
}
