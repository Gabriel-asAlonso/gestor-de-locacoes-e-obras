import { and, asc, eq } from 'drizzle-orm';
import { despesas, fornecedores, obra_contratacoes, obras } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type ReadDb, type WriteContext } from '../database/connection.ts';
import { money, today } from '../charges/derive.ts';
import { loadPaymentStates, registerPayment, reversePayment, type ExpenseRow } from '../expenses/expenses.service.ts';
import type { ContractCreateDto, ContractPaymentDto } from './dto.ts';
import { appendWorkJournal } from '../work-journal/journal.writer.ts';

const selection = {
  id: obra_contratacoes.despesa_id, codigo: obra_contratacoes.codigo, obraId: obra_contratacoes.obra_id, tipoFornecimento: obra_contratacoes.tipo_fornecimento,
  dataContratacao: obra_contratacoes.data_contratacao, fornecedorId: despesas.fornecedor_id, fornecedorNome: fornecedores.nome,
  descricao: despesas.descricao, valorContratado: despesas.valor, vencimento: despesas.vencimento, observacoes: despesas.observacoes,
};

type ContractRow = { id: string; valorContratado: string; vencimento: string } & Record<string, unknown>;

function supplierStatus(pagoCents: number, valorCents: number, vencimento: string, reference: string): string {
  if (pagoCents >= valorCents && valorCents > 0) return 'Quitado';
  if (vencimento < reference) return 'Vencido';
  return pagoCents > 0 ? 'Parcialmente pago' : 'Pendente';
}

async function loadWork(obraId: string) {
  const [row] = await withRead((db) => db.select({ id: obras.id }).from(obras).where(eq(obras.id, obraId)).limit(1));
  if (!row) throw new NotFoundError('Obra não encontrada.');
  return row;
}

function contractsQuery(db: ReadDb, obraId: string) {
  return db.select(selection).from(obra_contratacoes)
    .innerJoin(despesas, eq(despesas.id, obra_contratacoes.despesa_id))
    .innerJoin(fornecedores, eq(fornecedores.id, despesas.fornecedor_id))
    .where(eq(obra_contratacoes.obra_id, obraId)).orderBy(asc(obra_contratacoes.codigo));
}

async function presentAll(obraId: string) {
  return withRead(async (db) => {
    const rows = await contractsQuery(db, obraId) as ContractRow[];
    const states = await loadPaymentStates(db, rows.map((row) => ({ id: row.id, valor: row.valorContratado, vencimento: row.vencimento })) as ExpenseRow[]);
    const reference = today();
    return rows.map((row) => {
      const state = states.get(row.id)!;
      return {
        id: row.id, codigo: row.codigo, obraId: row.obraId, tipoFornecimento: row.tipoFornecimento, dataContratacao: row.dataContratacao,
        fornecedorId: row.fornecedorId, fornecedorNome: row.fornecedorNome, descricao: row.descricao, valorContratado: row.valorContratado,
        vencimento: row.vencimento, observacoes: row.observacoes ?? null,
        pago: money(state.pagoCents), saldo: money(state.saldoCents), statusDerivado: supplierStatus(state.pagoCents, Math.round(Number(row.valorContratado) * 100), row.vencimento, reference),
        dataUltimoPagamento: state.dataPagamento,
        pagamentos: state.pagamentos.map((payment) => ({
          id: payment.id, dataPagamento: payment.dataPagamento, valor: money(payment.valorCents), observacoes: payment.observacoes,
          estornoDeId: payment.estornoDeId, motivoEstorno: payment.motivoEstorno,
        })),
      };
    });
  });
}

export async function listContracts(obraId: string) {
  await loadWork(obraId);
  return { data: await presentAll(obraId) };
}

async function assertContract(obraId: string, contratacaoId: string) {
  const [row] = await withRead((db) => db.select({ id: obra_contratacoes.despesa_id }).from(obra_contratacoes)
    .where(and(eq(obra_contratacoes.despesa_id, contratacaoId), eq(obra_contratacoes.obra_id, obraId))).limit(1));
  if (!row) throw new NotFoundError('Contratação não encontrada nesta obra.');
}

export async function createContract(obraId: string, input: ContractCreateDto, context: WriteContext) {
  await loadWork(obraId);
  if (input.fornecedorId) {
    const [supplier] = await withRead((db) => db.select({ id: fornecedores.id }).from(fornecedores).where(and(eq(fornecedores.id, input.fornecedorId!), eq(fornecedores.ativo, true))).limit(1));
    if (!supplier) throw new NotFoundError('Fornecedor não encontrado ou inativo.');
  }

  try {
    await withTransaction(context, async (db, audit) => {
      // Fornecedor: id informado, ou buscar-ou-criar pelo nome (cadastro global — D08).
      let fornecedorId = input.fornecedorId;
      if (!fornecedorId) {
        const nome = input.fornecedorNome!;
        const [existing] = await db.select({ id: fornecedores.id }).from(fornecedores).where(and(eq(fornecedores.ativo, true), eq(fornecedores.nome, nome))).limit(1);
        fornecedorId = existing?.id ?? (await db.insert(fornecedores).values({ nome, created_by: audit.created_by, updated_by: audit.updated_by }).returning({ id: fornecedores.id }))[0]!.id;
      }
      // Despesa da obra (origem=contratacao_obra; sem categoria) + especialização, atomicamente (regra despesa_especializacao).
      const [expense] = await db.insert(despesas).values({
        codigo: null, fornecedor_id: fornecedorId, origem: 'contratacao_obra', categoria_id: null, descricao: input.descricao, valor: input.valorContratado,
        vencimento: input.vencimento, forma_pagamento_prevista: null, conta_financeira_prevista_id: null, observacoes: input.observacoes,
        created_by: audit.created_by, updated_by: audit.updated_by,
      }).returning({ id: despesas.id });
      const codes = await db.select({ codigo: obra_contratacoes.codigo }).from(obra_contratacoes).where(eq(obra_contratacoes.obra_id, obraId));
      await db.insert(obra_contratacoes).values({
        despesa_id: expense!.id, obra_id: obraId, codigo: nextCode('OC', codes.map((item) => item.codigo)), tipo_fornecimento: input.tipoFornecimento ?? 'servico', data_contratacao: input.dataContratacao,
      });
    });
    return { data: await presentAll(obraId) };
  } catch (error) { rethrowConflict(error, 'Conflito ao registrar a contratação.'); }
}

export async function registerContractPayment(obraId: string, contratacaoId: string, input: ContractPaymentDto, context: WriteContext) {
  await assertContract(obraId, contratacaoId);
  // Contratação é uma despesa: reutiliza o mecanismo de pagamentos/estorno (§4.21).
  await registerPayment(contratacaoId, { dataPagamento: input.dataPagamento, valor: input.valor, formaPagamento: null, contaFinanceiraId: null, observacoes: input.observacoes }, context,
    async (db, audit) => { await appendWorkJournal(db, audit, obraId, { titulo: 'Pagamento de fornecedor registrado',
      descricao: `Contratação ${contratacaoId} · ${input.valor}` }); });
  return { data: await presentAll(obraId) };
}

export async function reverseContractPayment(obraId: string, contratacaoId: string, pagamentoId: string, motivo: string, context: WriteContext) {
  await assertContract(obraId, contratacaoId);
  await reversePayment(contratacaoId, pagamentoId, motivo, context,
    async (db, audit) => { await appendWorkJournal(db, audit, obraId, { titulo: 'Pagamento de fornecedor estornado',
      descricao: `Contratação ${contratacaoId} · ${motivo}` }); });
  return { data: await presentAll(obraId) };
}
