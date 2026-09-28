import { and, asc, eq, gte, inArray, like, lte, or } from 'drizzle-orm';
import { categorias_despesa, despesas, fornecedores, pagamentos_despesa } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type Audit, type ReadDb, type WriteContext, type WriteDb } from '../database/connection.ts';
import { cents, money, today } from '../charges/derive.ts';
import type { ExpenseCreateDto, ExpenseListQuery, PaymentCreateDto } from './dto.ts';

const selection = {
  id: despesas.id, codigo: despesas.codigo, origem: despesas.origem, fornecedorId: despesas.fornecedor_id, fornecedorNome: fornecedores.nome,
  categoriaId: despesas.categoria_id, categoriaNome: categorias_despesa.nome, descricao: despesas.descricao, valor: despesas.valor,
  competencia: despesas.competencia, vencimento: despesas.vencimento, previsaoPagamento: despesas.previsao_pagamento,
  alocacaoTipo: despesas.alocacao_tipo, alocacaoReferencia: despesas.alocacao_referencia,
  tipoLancamento: despesas.tipo_lancamento, recorrencia: despesas.recorrencia, tipoDocumento: despesas.tipo_documento,
  numeroDocumento: despesas.numero_documento, dataEmissao: despesas.data_emissao, anexoNome: despesas.anexo_nome,
  formaPagamentoPrevista: despesas.forma_pagamento_prevista, contaFinanceiraPrevistaId: despesas.conta_financeira_prevista_id,
  contaDescricaoPrevista: despesas.conta_descricao_prevista, observacoes: despesas.observacoes,
};

export type ExpenseRow = { id: string; valor: string; vencimento: string } & Record<string, unknown>;
export interface PaymentState { id: string; dataPagamento: string; valorCents: number; formaPagamento: string | null; contaFinanceiraId: string | null; observacoes: string | null; estornoDeId: string | null; motivoEstorno: string | null }
export interface ExpenseState { pagoCents: number; saldoCents: number; status: string; dataPagamento: string | null; pagamentos: PaymentState[] }

const STATUS_RANK: Record<string, number> = { Vencido: 0, Pendente: 1, Pago: 2 };

export async function loadPaymentStates(db: ReadDb, expenses: ExpenseRow[]): Promise<Map<string, ExpenseState>> {
  const states = new Map<string, ExpenseState>();
  const ids = expenses.map((row) => row.id);
  const paymentRows = ids.length ? await db.select().from(pagamentos_despesa).where(inArray(pagamentos_despesa.despesa_id, ids)).orderBy(asc(pagamentos_despesa.data_pagamento)) : [];
  const byExpense = new Map<string, PaymentState[]>();
  for (const row of paymentRows) {
    const list = byExpense.get(row.despesa_id) ?? [];
    list.push({
      id: row.id, dataPagamento: row.data_pagamento, valorCents: cents(row.valor as unknown as string), formaPagamento: (row.forma_pagamento as string | null) ?? null,
      contaFinanceiraId: (row.conta_financeira_id as string | null) ?? null, observacoes: (row.observacoes as string | null) ?? null,
      estornoDeId: (row.estorno_de_id as string | null) ?? null, motivoEstorno: (row.motivo_estorno as string | null) ?? null,
    });
    byExpense.set(row.despesa_id, list);
  }
  const reference = today();
  for (const expense of expenses) {
    const pagamentos = byExpense.get(expense.id) ?? [];
    const valorCents = cents(expense.valor);
    const pagoCents = pagamentos.reduce((sum, payment) => sum + (payment.estornoDeId ? -payment.valorCents : payment.valorCents), 0);
    const saldoCents = valorCents - pagoCents;
    const status = pagoCents >= valorCents && valorCents > 0 ? 'Pago' : expense.vencimento < reference ? 'Vencido' : 'Pendente';
    // Última baixa efetiva (ignora estornos e pagamentos revertidos).
    const reversedIds = new Set(pagamentos.filter((p) => p.estornoDeId).map((p) => p.estornoDeId));
    const settled = pagamentos.filter((p) => !p.estornoDeId && !reversedIds.has(p.id));
    const dataPagamento = status === 'Pago' && settled.length ? settled[settled.length - 1]!.dataPagamento : null;
    states.set(expense.id, { pagoCents, saldoCents, status, dataPagamento, pagamentos });
  }
  return states;
}

function present(row: ExpenseRow, state: ExpenseState) {
  return {
    id: row.id, codigo: row.codigo, origem: row.origem, fornecedorId: row.fornecedorId, fornecedorNome: row.fornecedorNome,
    categoriaId: row.categoriaId ?? null, categoriaNome: row.categoriaNome ?? null, descricao: row.descricao, valor: row.valor,
    competencia: row.competencia ?? null, vencimento: row.vencimento, previsaoPagamento: row.previsaoPagamento ?? null,
    alocacaoTipo: row.alocacaoTipo ?? null, alocacaoReferencia: row.alocacaoReferencia ?? null,
    tipoLancamento: row.tipoLancamento ?? null, recorrencia: row.recorrencia ?? null, tipoDocumento: row.tipoDocumento ?? null,
    numeroDocumento: row.numeroDocumento ?? null, dataEmissao: row.dataEmissao ?? null, anexoNome: row.anexoNome ?? null,
    formaPagamentoPrevista: row.formaPagamentoPrevista ?? null, contaFinanceiraPrevistaId: row.contaFinanceiraPrevistaId ?? null,
    contaDescricaoPrevista: row.contaDescricaoPrevista ?? null, observacoes: row.observacoes ?? null,
    pago: money(state.pagoCents), saldo: money(state.saldoCents), statusDerivado: state.status, dataPagamento: state.dataPagamento,
    pagamentos: state.pagamentos.map((payment) => ({
      id: payment.id, dataPagamento: payment.dataPagamento, valor: money(payment.valorCents), formaPagamento: payment.formaPagamento,
      contaFinanceiraId: payment.contaFinanceiraId, observacoes: payment.observacoes, estornoDeId: payment.estornoDeId, motivoEstorno: payment.motivoEstorno,
    })),
  };
}

export async function listExpenses(query: ExpenseListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const result = await withRead(async (db) => {
    const rows = await db.select(selection).from(despesas)
      .innerJoin(fornecedores, eq(fornecedores.id, despesas.fornecedor_id))
      .leftJoin(categorias_despesa, eq(categorias_despesa.id, despesas.categoria_id))
      .where(and(
        eq(despesas.origem, 'operacao'),
        query.categoriaId ? eq(despesas.categoria_id, query.categoriaId) : undefined,
        query.fornecedorId ? eq(despesas.fornecedor_id, query.fornecedorId) : undefined,
        query.dataInicio ? gte(despesas.vencimento, query.dataInicio) : undefined,
        query.dataFim ? lte(despesas.vencimento, query.dataFim) : undefined,
        term ? or(like(despesas.codigo, term), like(fornecedores.nome, term), like(despesas.descricao, term)) : undefined,
      )) as ExpenseRow[];
    const states = await loadPaymentStates(db, rows);
    return rows.map((row) => present(row, states.get(row.id)!));
  });
  // Status é derivado: filtra e ordena a projeção (crítico→pago, depois vencimento asc) para casar com o detalhe.
  const filtered = query.status ? result.filter((expense) => expense.statusDerivado === query.status) : result;
  filtered.sort((a, b) => (STATUS_RANK[a.statusDerivado]! - STATUS_RANK[b.statusDerivado]!) || a.vencimento.localeCompare(b.vencimento));
  const total = filtered.length;
  if (!query.page || !query.limit) return { data: filtered };
  const start = (query.page - 1) * query.limit;
  return { data: filtered.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findExpense(id: string) {
  return withRead(async (db) => {
    const [row] = await db.select(selection).from(despesas)
      .innerJoin(fornecedores, eq(fornecedores.id, despesas.fornecedor_id))
      .leftJoin(categorias_despesa, eq(categorias_despesa.id, despesas.categoria_id)).where(eq(despesas.id, id)).limit(1) as ExpenseRow[];
    if (!row) return null;
    const states = await loadPaymentStates(db, [row]);
    return present(row, states.get(row.id)!);
  });
}

export async function createExpense(input: ExpenseCreateDto, context: WriteContext) {
  const [supplier] = await withRead((db) => db.select({ id: fornecedores.id }).from(fornecedores).where(and(eq(fornecedores.id, input.fornecedorId), eq(fornecedores.ativo, true))).limit(1));
  if (!supplier) throw new NotFoundError('Fornecedor não encontrado ou inativo.');
  const [category] = await withRead((db) => db.select({ id: categorias_despesa.id }).from(categorias_despesa).where(and(eq(categorias_despesa.id, input.categoriaId), eq(categorias_despesa.ativo, true))).limit(1));
  if (!category) throw new NotFoundError('Categoria de despesa não encontrada.');

  try {
    const id = await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: despesas.codigo }).from(despesas);
      const [row] = await db.insert(despesas).values({
        codigo: nextCode('PAG', codes.map((item) => item.codigo), 4), fornecedor_id: input.fornecedorId, origem: 'operacao', categoria_id: input.categoriaId,
        descricao: input.descricao, valor: input.valor, competencia: input.competencia, vencimento: input.vencimento,
        previsao_pagamento: input.previsaoPagamento, alocacao_tipo: input.alocacaoTipo, alocacao_referencia: input.alocacaoReferencia,
        tipo_lancamento: input.tipoLancamento, recorrencia: input.recorrencia, tipo_documento: input.tipoDocumento,
        numero_documento: input.numeroDocumento, data_emissao: input.dataEmissao, anexo_nome: input.anexoNome,
        forma_pagamento_prevista: input.formaPagamentoPrevista ?? null, conta_financeira_prevista_id: input.contaFinanceiraPrevistaId,
        conta_descricao_prevista: input.contaDescricaoPrevista, observacoes: input.observacoes,
        created_by: audit.created_by, updated_by: audit.updated_by,
      }).returning({ id: despesas.id });
      return row!.id;
    });
    return (await findExpense(id))!;
  } catch (error) { rethrowConflict(error, 'Conflito ao cadastrar a despesa (código duplicado).'); }
}

export async function registerPayment(despesaId: string, input: PaymentCreateDto, context: WriteContext,
  afterInsert?: (db: WriteDb, audit: Audit, paymentId: string) => Promise<void>) {
  const [expense] = await withRead((db) => db.select({ id: despesas.id, valor: despesas.valor, vencimento: despesas.vencimento }).from(despesas).where(eq(despesas.id, despesaId)).limit(1));
  if (!expense) throw new NotFoundError('Despesa não encontrada.');

  const valorCents = cents(input.valor);
  if (valorCents <= 0) throw new BusinessRuleError('O valor do pagamento deve ser maior que zero.');

  const id = await withTransaction(context, async (db, audit) => {
    const states = await loadPaymentStates(db, [expense as ExpenseRow]);
    const saldoCents = states.get(despesaId)!.saldoCents;
    if (valorCents > saldoCents) throw new BusinessRuleError(`O pagamento não pode superar o saldo em aberto de R$ ${money(saldoCents)}.`);
    const [row] = await db.insert(pagamentos_despesa).values({
      despesa_id: despesaId, data_pagamento: input.dataPagamento, valor: input.valor, forma_pagamento: input.formaPagamento ?? null,
      conta_financeira_id: input.contaFinanceiraId, observacoes: input.observacoes, created_by: audit.created_by,
    }).returning({ id: pagamentos_despesa.id });
    await afterInsert?.(db, audit, row!.id);
    return row!.id;
  });
  return { expense: (await findExpense(despesaId))!, pagamentoId: id };
}

export async function reversePayment(despesaId: string, pagamentoId: string, motivo: string, context: WriteContext,
  afterInsert?: (db: WriteDb, audit: Audit) => Promise<void>) {
  const [payment] = await withRead((db) => db.select({ id: pagamentos_despesa.id, despesaId: pagamentos_despesa.despesa_id, valor: pagamentos_despesa.valor, estornoDeId: pagamentos_despesa.estorno_de_id })
    .from(pagamentos_despesa).where(eq(pagamentos_despesa.id, pagamentoId)).limit(1));
  if (!payment || payment.despesaId !== despesaId) throw new NotFoundError('Pagamento não encontrado para esta despesa.');
  if (payment.estornoDeId) throw new BusinessRuleError('Não é possível estornar um estorno.');

  try {
    await withTransaction(context, async (db, audit) => {
      const [expenseRow] = await db.select({ id: despesas.id, valor: despesas.valor, vencimento: despesas.vencimento }).from(despesas).where(eq(despesas.id, despesaId)).limit(1);
      const state = (await loadPaymentStates(db, [expenseRow as ExpenseRow])).get(despesaId)!;
      const original = state.pagamentos.find((item) => item.id === pagamentoId)!;
      if (state.pagamentos.some((item) => item.estornoDeId === pagamentoId)) throw new BusinessRuleError('Este pagamento já foi estornado.');
      // O estorno espelha o pagamento original (mesma despesa, mesmo valor e data — regra 'pagamentos_despesa_estorno').
      await db.insert(pagamentos_despesa).values({
        despesa_id: despesaId, data_pagamento: original.dataPagamento, valor: payment.valor, estorno_de_id: pagamentoId, motivo_estorno: motivo, created_by: audit.created_by,
      });
      await afterInsert?.(db, audit);
    });
    return (await findExpense(despesaId))!;
  } catch (error) { rethrowConflict(error, 'Conflito ao estornar o pagamento.'); }
}
