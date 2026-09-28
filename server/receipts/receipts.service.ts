import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { cobrancas, recebimento_alocacoes, recebimentos } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type ReadDb, type WriteContext } from '../database/connection.ts';
import { cents, loadChargeState, money, type ChargeState } from '../charges/derive.ts';
import type { ReceiptCreateDto, ReceiptListQuery } from './dto.ts';

function present(receipt: ChargeState['recebimentos'][number], cobrancaId: string) {
  return {
    id: receipt.id, codigo: receipt.codigo, cobrancaId, dataRecebimento: receipt.dataRecebimento, dataCredito: receipt.dataCredito,
    valor: money(receipt.valorCents), valorRecebido: money(receipt.valorRecebidoCents),
    desconto: money(receipt.descontoCents), acrescimo: money(receipt.acrescimoCents),
    formaPagamento: receipt.formaPagamento, contaFinanceiraId: receipt.contaFinanceiraId, contaDescricao: receipt.contaDescricao,
    referencia: receipt.referencia, pagadorDescricao: receipt.pagadorDescricao, comprovanteNome: receipt.comprovanteNome,
    observacoes: receipt.observacoes,
    estornoDeId: receipt.estornoDeId, motivoEstorno: receipt.motivoEstorno,
    alocacoes: receipt.alocacoes.map((alloc) => ({ cobrancaItemId: alloc.cobrancaItemId, negociacaoParcelaId: alloc.negociacaoParcelaId, valor: money(alloc.valorCents) })),
  };
}

async function findReceiptState(db: ReadDb, cobrancaId: string, receiptId: string) {
  const state = await loadChargeState(db, cobrancaId);
  return state?.recebimentos.find((receipt) => receipt.id === receiptId) ?? null;
}

export async function listReceipts(query: ReceiptListQuery) {
  const result = await withRead(async (db) => {
    const rows = await db.select({ id: recebimentos.id, cobrancaId: recebimentos.cobranca_id }).from(recebimentos)
      .where(and(
        query.cobrancaId ? eq(recebimentos.cobranca_id, query.cobrancaId) : undefined,
        query.contaFinanceiraId ? eq(recebimentos.conta_financeira_id, query.contaFinanceiraId) : undefined,
        query.dataInicio ? gte(recebimentos.data_recebimento, query.dataInicio) : undefined,
        query.dataFim ? lte(recebimentos.data_recebimento, query.dataFim) : undefined,
      )).orderBy(query.sortOrder === 'asc' ? asc(recebimentos.data_recebimento) : desc(recebimentos.data_recebimento));
    const byCharge = new Map<string, string[]>();
    for (const row of rows) byCharge.set(row.cobrancaId, [...(byCharge.get(row.cobrancaId) ?? []), row.id]);
    const presented = new Map<string, ReturnType<typeof present>>();
    for (const [cobrancaId] of byCharge) {
      const state = await loadChargeState(db, cobrancaId);
      for (const receipt of state?.recebimentos ?? []) presented.set(receipt.id, present(receipt, cobrancaId));
    }
    return rows.map((row) => presented.get(row.id)!).filter(Boolean);
  });
  const total = result.length;
  if (!query.page || !query.limit) return { data: result };
  const start = (query.page - 1) * query.limit;
  return { data: result.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findReceipt(id: string) {
  return withRead(async (db) => {
    const [row] = await db.select({ cobrancaId: recebimentos.cobranca_id }).from(recebimentos).where(eq(recebimentos.id, id)).limit(1);
    if (!row) return null;
    const receipt = await findReceiptState(db, row.cobrancaId, id);
    return receipt ? present(receipt, row.cobrancaId) : null;
  });
}

export async function createReceipt(input: ReceiptCreateDto, context: WriteContext) {
  const [charge] = await withRead((db) => db.select({ id: cobrancas.id }).from(cobrancas).where(eq(cobrancas.id, input.cobrancaId)).limit(1));
  if (!charge) throw new NotFoundError('Cobrança não encontrada.');

  const valorCents = cents(input.valor);
  const valorRecebidoCents = cents(input.valorRecebido ?? input.valor);
  const descontoCents = cents(input.desconto);
  const acrescimoCents = cents(input.acrescimo);
  if (valorCents <= 0) throw new BusinessRuleError('O valor liquidado deve ser maior que zero.');
  if (valorRecebidoCents <= 0) throw new BusinessRuleError('O valor recebido deve ser maior que zero.');
  if (valorCents !== valorRecebidoCents + descontoCents - acrescimoCents) {
    throw new BusinessRuleError('O valor liquidado deve ser igual ao valor recebido, somado ao desconto e deduzido o acréscimo.');
  }
  const allocationTotal = input.alocacoes.reduce((sum, alloc) => sum + cents(alloc.valor), 0);
  if (allocationTotal !== valorCents) throw new BusinessRuleError('A soma das alocações deve ser exatamente igual ao valor recebido.');

  const id = await withTransaction(context, async (db, audit) => {
    const state = (await loadChargeState(db, input.cobrancaId))!;
    if (valorCents > state.saldoOperacionalCents) throw new BusinessRuleError(`O valor recebido não pode superar o saldo operacional de R$ ${money(state.saldoOperacionalCents)}.`);

    // With an active agreement the money settles the agreement's parcelas; otherwise the charge's items (D07).
    const active = state.activeNegotiation;
    const targetsAreParcelas = input.alocacoes.every((alloc) => alloc.negociacaoParcelaId);
    const targetsAreItens = input.alocacoes.every((alloc) => alloc.cobrancaItemId);
    if (active && !targetsAreParcelas) throw new BusinessRuleError('Com um acordo vigente, as alocações devem apontar para as parcelas do acordo.');
    if (!active && !targetsAreItens) throw new BusinessRuleError('Sem acordo vigente, as alocações devem apontar para os itens da cobrança.');

    const itemBalance = new Map(state.itens.map((item) => [item.id, item.valorCents - item.recebidoCents]));
    const parcelaBalance = new Map((active?.parcelas ?? []).map((parcela) => [parcela.id, parcela.valorCents - parcela.recebidoCents]));
    const pending = new Map<string, number>();
    for (const alloc of input.alocacoes) {
      const target = alloc.cobrancaItemId ?? alloc.negociacaoParcelaId!;
      const balance = alloc.cobrancaItemId ? itemBalance.get(alloc.cobrancaItemId) : parcelaBalance.get(alloc.negociacaoParcelaId!);
      if (balance === undefined) throw new BusinessRuleError('Uma alocação aponta para um alvo que não pertence a esta cobrança.');
      const used = (pending.get(target) ?? 0) + cents(alloc.valor);
      if (used > balance) throw new BusinessRuleError('Uma alocação supera o saldo do item ou parcela de destino.');
      pending.set(target, used);
    }

    const codes = await db.select({ codigo: recebimentos.codigo }).from(recebimentos);
    const [row] = await db.insert(recebimentos).values({
      codigo: nextCode('REC', codes.map((item) => item.codigo), 4), cobranca_id: input.cobrancaId, data_recebimento: input.dataRecebimento,
      data_credito: input.dataCredito, valor: input.valor, valor_recebido: money(valorRecebidoCents),
      desconto: money(descontoCents), acrescimo: money(acrescimoCents),
      forma_pagamento: input.formaPagamento ?? null, conta_financeira_id: input.contaFinanceiraId,
      conta_descricao: input.contaDescricao, referencia: input.referencia, pagador_descricao: input.pagadorDescricao,
      comprovante_nome: input.comprovanteNome, observacoes: input.observacoes,
      created_by: audit.created_by,
    }).returning({ id: recebimentos.id });
    const recebimentoId = row!.id;
    for (const alloc of input.alocacoes) {
      await db.insert(recebimento_alocacoes).values({
        recebimento_id: recebimentoId, cobranca_item_id: alloc.cobrancaItemId, negociacao_parcela_id: alloc.negociacaoParcelaId,
        valor: alloc.valor, created_by: audit.created_by,
      });
    }
    return recebimentoId;
  });
  return (await findReceipt(id))!;
}

export async function reverseReceipt(id: string, motivo: string, context: WriteContext) {
  const [row] = await withRead((db) => db.select({ cobrancaId: recebimentos.cobranca_id, estornoDeId: recebimentos.estorno_de_id }).from(recebimentos).where(eq(recebimentos.id, id)).limit(1));
  if (!row) throw new NotFoundError('Recebimento não encontrado.');
  if (row.estornoDeId) throw new BusinessRuleError('Não é possível estornar um estorno.');

  try {
    const reversalId = await withTransaction(context, async (db, audit) => {
      const state = (await loadChargeState(db, row.cobrancaId))!;
      const original = state.recebimentos.find((receipt) => receipt.id === id);
      if (!original) throw new NotFoundError('Recebimento não encontrado.');
      if (state.recebimentos.some((receipt) => receipt.estornoDeId === id)) throw new BusinessRuleError('Este recebimento já foi estornado.');

      const codes = await db.select({ codigo: recebimentos.codigo }).from(recebimentos);
      const [reversal] = await db.insert(recebimentos).values({
        codigo: nextCode('REC', codes.map((item) => item.codigo), 4), cobranca_id: row.cobrancaId, data_recebimento: original.dataRecebimento,
        data_credito: original.dataCredito, valor: money(original.valorCents), valor_recebido: money(original.valorRecebidoCents),
        desconto: money(original.descontoCents), acrescimo: money(original.acrescimoCents),
        forma_pagamento: original.formaPagamento as never, conta_financeira_id: original.contaFinanceiraId,
        conta_descricao: original.contaDescricao, referencia: original.referencia, pagador_descricao: original.pagadorDescricao,
        comprovante_nome: original.comprovanteNome, observacoes: original.observacoes,
        estorno_de_id: id, motivo_estorno: motivo, created_by: audit.created_by,
      }).returning({ id: recebimentos.id });
      const reversalReceiptId = reversal!.id;
      // The reversal mirrors the original composition exactly (DB rule 'estorno_alocacoes').
      for (const alloc of original.alocacoes) {
        await db.insert(recebimento_alocacoes).values({
          recebimento_id: reversalReceiptId, cobranca_item_id: alloc.cobrancaItemId, negociacao_parcela_id: alloc.negociacaoParcelaId,
          valor: money(alloc.valorCents), created_by: audit.created_by,
        });
      }
      return reversalReceiptId;
    });
    return (await findReceipt(reversalId))!;
  } catch (error) { rethrowConflict(error, 'Conflito ao estornar o recebimento.'); }
}
