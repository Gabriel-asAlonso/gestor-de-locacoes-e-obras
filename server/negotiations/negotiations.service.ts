import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { cobrancas, negociacao_parcelas, negociacoes } from '../../db/schema.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { BusinessRuleError, ConflictError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type WriteContext, type WriteDb, type Audit } from '../database/connection.ts';
import { cents, loadChargeState, money, type NegotiationState } from '../charges/derive.ts';
import { distributeInstallments, installmentDue } from './schedule.ts';
import type { NegotiationCreateDto, NegotiationListQuery, NegotiationSubstituteDto } from './dto.ts';

function present(state: NegotiationState, cobrancaId: string) {
  return {
    id: state.id, cobrancaId, versao: state.versao, saldoBase: money(state.saldoBaseCents), desconto: money(state.descontoCents),
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

interface Terms {
  descontoCents: number; acrescimoCents: number; entradaCents: number; entradaVencimento: string | null;
  quantidadeParcelas: number; primeiroVencimento: string; dataAcordo: string; motivo: string; formaPagamentoPrevista: string | null;
  motivoOutro: string | null; multaCents: number; jurosCents: number; correcaoCents: number;
  contatoNome: string | null; contatoCanal: string | null; documentoNome: string | null; observacoes: string | null;
}

/** Validates the terms against the photographed base and writes the negotiation + parcelas atomically. */
async function writeNegotiation(db: WriteDb, audit: Audit, params: {
  cobrancaId: string; saldoBaseCents: number; versao: number; anteriorId: string | null; terms: Terms;
}): Promise<string> {
  const { saldoBaseCents, terms } = params;
  if (saldoBaseCents <= 0) throw new BusinessRuleError('A cobrança precisa ter saldo positivo para ser negociada.');
  if (terms.descontoCents > saldoBaseCents) throw new BusinessRuleError('O desconto não pode superar o saldo da cobrança.');
  if (terms.multaCents + terms.jurosCents + terms.correcaoCents !== terms.acrescimoCents) {
    throw new BusinessRuleError('A soma de multa, juros e correção deve ser igual ao total de acréscimos.');
  }
  const totalCents = saldoBaseCents - terms.descontoCents + terms.acrescimoCents;
  if (totalCents <= 0) throw new BusinessRuleError('O total negociado precisa ser maior que zero.');
  if (terms.entradaCents >= totalCents) throw new BusinessRuleError('A entrada deve ser menor que o total negociado. Para quitação integral, registre um recebimento.');
  const financedCents = totalCents - terms.entradaCents;
  if (financedCents < terms.quantidadeParcelas) throw new BusinessRuleError('Cada parcela precisa ter ao menos um centavo; reduza o número de parcelas.');

  const [row] = await db.insert(negociacoes).values({
    cobranca_id: params.cobrancaId, versao: params.versao, negociacao_anterior_id: params.anteriorId,
    saldo_base: money(saldoBaseCents), desconto: money(terms.descontoCents), acrescimo: money(terms.acrescimoCents),
    entrada_prevista: money(terms.entradaCents), quantidade_parcelas: terms.quantidadeParcelas,
    primeiro_vencimento: terms.primeiroVencimento, data_acordo: terms.dataAcordo, motivo: terms.motivo as never,
    motivo_outro: terms.motivoOutro, forma_pagamento_prevista: terms.formaPagamentoPrevista as never,
    multa: money(terms.multaCents), juros: money(terms.jurosCents), correcao: money(terms.correcaoCents),
    contato_nome: terms.contatoNome, contato_canal: terms.contatoCanal, documento_nome: terms.documentoNome,
    observacoes: terms.observacoes, created_by: audit.created_by,
  }).returning({ id: negociacoes.id });
  const negociacaoId = row!.id;

  if (terms.entradaCents > 0) {
    await db.insert(negociacao_parcelas).values({
      negociacao_id: negociacaoId, numero: 0, vencimento: terms.entradaVencimento!, valor: money(terms.entradaCents), created_by: audit.created_by,
    });
  }
  const parcelas = distributeInstallments(financedCents, terms.quantidadeParcelas);
  for (let index = 0; index < parcelas.length; index += 1) {
    await db.insert(negociacao_parcelas).values({
      negociacao_id: negociacaoId, numero: index + 1, vencimento: installmentDue(terms.primeiroVencimento, index + 1),
      valor: money(parcelas[index]!), created_by: audit.created_by,
    });
  }
  return negociacaoId;
}

function termsFrom(input: NegotiationCreateDto | NegotiationSubstituteDto): Terms {
  return {
    descontoCents: cents(input.desconto), acrescimoCents: cents(input.acrescimo), entradaCents: cents(input.entradaPrevista),
    entradaVencimento: input.entradaVencimento, quantidadeParcelas: input.quantidadeParcelas, primeiroVencimento: input.primeiroVencimento,
    dataAcordo: input.dataAcordo, motivo: input.motivo, motivoOutro: input.motivoOutro,
    formaPagamentoPrevista: input.formaPagamentoPrevista ?? null,
    multaCents: cents(input.multa), jurosCents: cents(input.juros), correcaoCents: cents(input.correcao),
    contatoNome: input.contatoNome, contatoCanal: input.contatoCanal, documentoNome: input.documentoNome,
    observacoes: input.observacoes,
  };
}

export async function createNegotiation(input: NegotiationCreateDto, context: WriteContext) {
  const [charge] = await withRead((db) => db.select({ id: cobrancas.id }).from(cobrancas).where(eq(cobrancas.id, input.cobrancaId)).limit(1));
  if (!charge) throw new NotFoundError('Cobrança não encontrada.');

  try {
    const id = await withTransaction(context, async (db, audit) => {
      const state = (await loadChargeState(db, input.cobrancaId))!;
      if (state.activeNegotiation) throw new ConflictError('Já existe um acordo vigente para esta cobrança; use a substituição.');
      // Base = valor ainda devido na cobrança (total menos o líquido já recebido).
      const saldoBaseCents = state.totalCents - state.recebidoCents;
      return writeNegotiation(db, audit, { cobrancaId: input.cobrancaId, saldoBaseCents, versao: 1, anteriorId: null, terms: termsFrom(input) });
    });
    return (await findActiveNegotiation(input.cobrancaId))!;
  } catch (error) { rethrowConflict(error, 'Conflito ao registrar a negociação.'); }
}

export async function substituteNegotiation(previousId: string, input: NegotiationSubstituteDto, context: WriteContext) {
  const [previous] = await withRead((db) => db.select({ id: negociacoes.id, cobrancaId: negociacoes.cobranca_id, versao: negociacoes.versao, substituidaEm: negociacoes.substituida_em }).from(negociacoes).where(eq(negociacoes.id, previousId)).limit(1));
  if (!previous) throw new NotFoundError('Negociação não encontrada.');
  if (previous.substituidaEm) throw new BusinessRuleError('Esta versão da negociação já foi substituída.');

  try {
    await withTransaction(context, async (db, audit) => {
      const state = (await loadChargeState(db, previous.cobrancaId))!;
      const active = state.activeNegotiation;
      if (!active || active.id !== previousId) throw new ConflictError('A negociação foi alterada; recarregue e tente novamente.');
      // Encerra a vigência da versão anterior antes de inserir a nova (índice de vigência única).
      await db.update(negociacoes).set({ substituida_em: audit.updated_at }).where(eq(negociacoes.id, previousId));
      // Re-base sobre o saldo remanescente da versão vigente, incluindo seus descontos,
      // acréscimos e pagamentos já alocados às parcelas (contrato da API §4.11).
      const saldoBaseCents = state.saldoOperacionalCents;
      await writeNegotiation(db, audit, { cobrancaId: previous.cobrancaId, saldoBaseCents, versao: previous.versao + 1, anteriorId: previousId, terms: termsFrom(input) });
    });
    return (await findActiveNegotiation(previous.cobrancaId))!;
  } catch (error) { rethrowConflict(error, 'Conflito ao substituir a negociação.'); }
}

async function findActiveNegotiation(cobrancaId: string) {
  return withRead(async (db) => {
    const state = await loadChargeState(db, cobrancaId);
    return state?.activeNegotiation ? present(state.activeNegotiation, cobrancaId) : null;
  });
}

export async function listNegotiations(query: NegotiationListQuery) {
  const result = await withRead(async (db) => {
    const rows = await db.select({ cobrancaId: negociacoes.cobranca_id }).from(negociacoes)
      .where(and(
        query.cobrancaId ? eq(negociacoes.cobranca_id, query.cobrancaId) : undefined,
        query.vigente === 'true' ? isNull(negociacoes.substituida_em) : undefined,
      )).orderBy(query.sortOrder === 'asc' ? asc(negociacoes.versao) : desc(negociacoes.versao));
    const chargeIds = [...new Set(rows.map((row) => row.cobrancaId))];
    const presented: Array<ReturnType<typeof present>> = [];
    for (const cobrancaId of chargeIds) {
      const state = await loadChargeState(db, cobrancaId);
      for (const negotiation of state?.negotiations ?? []) {
        if (query.vigente === 'true' && negotiation.substituidaEm !== null) continue;
        if (query.vigente === 'false' && negotiation.substituidaEm === null) continue;
        presented.push(present(negotiation, cobrancaId));
      }
    }
    return presented;
  });
  const total = result.length;
  if (!query.page || !query.limit) return { data: result };
  const start = (query.page - 1) * query.limit;
  return { data: result.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findNegotiation(id: string) {
  return withRead(async (db) => {
    const [row] = await db.select({ cobrancaId: negociacoes.cobranca_id }).from(negociacoes).where(eq(negociacoes.id, id)).limit(1);
    if (!row) return null;
    const state = await loadChargeState(db, row.cobrancaId);
    const negotiation = state?.negotiations.find((item) => item.id === id);
    return negotiation ? present(negotiation, row.cobrancaId) : null;
  });
}
