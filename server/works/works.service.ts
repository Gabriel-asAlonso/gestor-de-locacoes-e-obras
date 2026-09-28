import { and, asc, desc, eq, like, or } from 'drizzle-orm';
import { carteiras, imoveis, obras, profissionais, unidades } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';
import type { WorkCreateDto, WorkListQuery, WorkProgressDto, WorkStateDto, WorkUpdateDto } from './dto.ts';
import { appendWorkJournal } from '../work-journal/journal.writer.ts';

const selection = {
  id: obras.id, codigo: obras.codigo, titulo: obras.titulo, imovelId: obras.imovel_id, imovelNome: imoveis.nome,
  carteiraNome: carteiras.nome, unidadeId: obras.unidade_id, unidadeNome: unidades.nome,
  responsavelProfissionalId: obras.responsavel_profissional_id, responsavelNome: profissionais.nome,
  tipoIntervencao: obras.tipo_intervencao, descricao: obras.descricao, prioridade: obras.prioridade, estado: obras.estado,
  riscoInformado: obras.risco_informado, progressoPercentual: obras.progresso_percentual, inicioPrevisto: obras.inicio_previsto,
  terminoPrevisto: obras.termino_previsto, orcamento: obras.orcamento, reserva: obras.reserva, realizadoInformado: obras.realizado_informado,
  proximaAtividadeDescricao: obras.proxima_atividade_descricao, observacoes: obras.observacoes, createdAt: obras.created_at, updatedAt: obras.updated_at,
};

// Transições permitidas (D04). Concluir exige progresso 100 (a service seta 100 no concluir); terminais são finais.
const TRANSITIONS: Record<string, string[]> = {
  planejada: ['em_andamento', 'cancelada'], em_andamento: ['pausada', 'concluida', 'cancelada'],
  pausada: ['em_andamento', 'cancelada'], concluida: [], cancelada: [],
};

async function assertProperty(imovelId: string) {
  const [row] = await withRead((db) => db.select({ id: imoveis.id }).from(imoveis).where(and(eq(imoveis.id, imovelId), eq(imoveis.ativo, true))).limit(1));
  if (!row) throw new NotFoundError('Imóvel não encontrado ou inativo.');
}
async function assertProfessional(id: string) {
  const [row] = await withRead((db) => db.select({ id: profissionais.id }).from(profissionais).where(and(eq(profissionais.id, id), eq(profissionais.ativo, true))).limit(1));
  if (!row) throw new NotFoundError('Profissional responsável não encontrado ou inativo.');
}
async function assertUnitBelongs(unidadeId: string, imovelId: string) {
  const [row] = await withRead((db) => db.select({ imovelId: unidades.imovel_id }).from(unidades).where(eq(unidades.id, unidadeId)).limit(1));
  if (!row) throw new NotFoundError('Unidade não encontrada.');
  if (row.imovelId !== imovelId) throw new BusinessRuleError('A unidade deve pertencer ao imóvel da obra.');
}

export async function listWorks(query: WorkListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const result = await withRead((db) => db.select(selection).from(obras)
    .innerJoin(imoveis, eq(imoveis.id, obras.imovel_id)).innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id))
    .innerJoin(profissionais, eq(profissionais.id, obras.responsavel_profissional_id))
    .leftJoin(unidades, eq(unidades.id, obras.unidade_id))
    .where(and(
      query.estado ? eq(obras.estado, query.estado) : undefined,
      query.riscoInformado ? eq(obras.risco_informado, query.riscoInformado) : undefined,
      query.imovelId ? eq(obras.imovel_id, query.imovelId) : undefined,
      query.responsavelProfissionalId ? eq(obras.responsavel_profissional_id, query.responsavelProfissionalId) : undefined,
      term ? or(like(obras.codigo, term), like(obras.titulo, term), like(imoveis.nome, term), like(profissionais.nome, term)) : undefined,
    )).orderBy(desc(obras.created_at)));
  const total = result.length;
  if (!query.page || !query.limit) return { data: result };
  const start = (query.page - 1) * query.limit;
  return { data: result.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findWork(id: string) {
  const [row] = await withRead((db) => db.select(selection).from(obras)
    .innerJoin(imoveis, eq(imoveis.id, obras.imovel_id)).innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id))
    .innerJoin(profissionais, eq(profissionais.id, obras.responsavel_profissional_id))
    .leftJoin(unidades, eq(unidades.id, obras.unidade_id)).where(eq(obras.id, id)).limit(1));
  return row ?? null;
}

export async function createWork(input: WorkCreateDto, context: WriteContext) {
  await assertProperty(input.imovelId);
  await assertProfessional(input.responsavelProfissionalId);
  if (input.unidadeId) await assertUnitBelongs(input.unidadeId, input.imovelId);

  try {
    const id = await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: obras.codigo }).from(obras);
      const [row] = await db.insert(obras).values({
        codigo: nextCode('OBR', codes.map((item) => item.codigo)), titulo: input.titulo, imovel_id: input.imovelId, unidade_id: input.unidadeId,
        responsavel_profissional_id: input.responsavelProfissionalId, tipo_intervencao: input.tipoIntervencao ?? 'obra', descricao: input.descricao,
        prioridade: input.prioridade ?? 'media', estado: input.estado ?? 'planejada', risco_informado: input.riscoInformado ?? 'dentro_prazo',
        progresso_percentual: '0.00', inicio_previsto: input.inicioPrevisto, termino_previsto: input.terminoPrevisto, orcamento: input.orcamento,
        reserva: input.reserva ?? '0.00', realizado_informado: input.realizadoInformado ?? '0.00', proxima_atividade_descricao: input.proximaAtividadeDescricao,
        observacoes: input.observacoes, created_by: audit.created_by, updated_by: audit.updated_by,
      }).returning({ id: obras.id });
      return row!.id;
    });
    return (await findWork(id))!;
  } catch (error) { rethrowConflict(error, 'Conflito ao cadastrar a obra (código duplicado).'); }
}

export async function updateWork(id: string, input: WorkUpdateDto, context: WriteContext) {
  const current = await findWork(id);
  if (!current) throw new NotFoundError('Obra não encontrada.');
  const imovelId = input.imovelId ?? (current.imovelId as string);
  if (input.imovelId) await assertProperty(input.imovelId);
  if (input.responsavelProfissionalId) await assertProfessional(input.responsavelProfissionalId);
  if (input.unidadeId) await assertUnitBelongs(input.unidadeId, imovelId);
  const inicio = input.inicioPrevisto ?? (current.inicioPrevisto as string);
  const termino = input.terminoPrevisto ?? (current.terminoPrevisto as string);
  if (termino < inicio) throw new BusinessRuleError('O término deve ser posterior ao início.');

  const patch: Record<string, unknown> = {};
  if (input.titulo !== undefined) patch['titulo'] = input.titulo;
  if (input.imovelId !== undefined) patch['imovel_id'] = input.imovelId;
  if (input.unidadeId !== undefined) patch['unidade_id'] = input.unidadeId;
  if (input.responsavelProfissionalId !== undefined) patch['responsavel_profissional_id'] = input.responsavelProfissionalId;
  if (input.descricao !== undefined) patch['descricao'] = input.descricao;
  if (input.inicioPrevisto !== undefined) patch['inicio_previsto'] = input.inicioPrevisto;
  if (input.terminoPrevisto !== undefined) patch['termino_previsto'] = input.terminoPrevisto;
  if (input.orcamento !== undefined) patch['orcamento'] = input.orcamento;
  if (input.reserva !== undefined) patch['reserva'] = input.reserva;
  if (input.realizadoInformado !== undefined) patch['realizado_informado'] = input.realizadoInformado;
  if (input.tipoIntervencao !== undefined) patch['tipo_intervencao'] = input.tipoIntervencao;
  if (input.prioridade !== undefined) patch['prioridade'] = input.prioridade;
  if (input.riscoInformado !== undefined) patch['risco_informado'] = input.riscoInformado;
  if (input.proximaAtividadeDescricao !== undefined) patch['proxima_atividade_descricao'] = input.proximaAtividadeDescricao;
  if (input.observacoes !== undefined) patch['observacoes'] = input.observacoes;

  await withTransaction(context, async (db, audit) => {
    await db.update(obras).set({ ...patch, updated_at: audit.updated_at, updated_by: audit.updated_by }).where(eq(obras.id, id));
  });
  return (await findWork(id))!;
}

export async function updateProgress(id: string, input: WorkProgressDto, context: WriteContext) {
  const current = await findWork(id);
  if (!current) throw new NotFoundError('Obra não encontrada.');
  if (current.estado === 'concluida' || current.estado === 'cancelada') throw new BusinessRuleError('Obra concluída ou cancelada não recebe atualização de progresso.');
  await withTransaction(context, async (db, audit) => {
    await db.update(obras).set({
      progresso_percentual: input.progressoPercentual,
      proxima_atividade_descricao: input.proximaAtividadeDescricao ?? (current.proximaAtividadeDescricao as string | null),
      updated_at: audit.updated_at, updated_by: audit.updated_by,
    }).where(eq(obras.id, id));
    await appendWorkJournal(db, audit, id, { titulo: 'Progresso da obra atualizado',
      descricao: input.proximaAtividadeDescricao ?? 'Atualização manual de progresso.',
      progresso: input.progressoPercentual });
  });
  return (await findWork(id))!;
}

export async function transitionState(id: string, input: WorkStateDto, context: WriteContext) {
  const current = await findWork(id);
  if (!current) throw new NotFoundError('Obra não encontrada.');
  const from = current.estado as string;
  if (from === input.estado) return current;
  if (!TRANSITIONS[from]?.includes(input.estado)) throw new BusinessRuleError(`Transição de "${from}" para "${input.estado}" não é permitida.`);

  await withTransaction({ ...context, reason: input.motivo ?? undefined }, async (db, audit) => {
    // Concluir marca 100% (a CHECK do banco exige progresso=100 para 'concluida').
    const progress = input.estado === 'concluida' ? { progresso_percentual: '100.00' } : {};
    await db.update(obras).set({ estado: input.estado, ...progress, updated_at: audit.updated_at, updated_by: audit.updated_by }).where(eq(obras.id, id));
    await appendWorkJournal(db, audit, id, { titulo: `Situação da obra: ${input.estado}`,
      descricao: input.motivo ?? `Transição de ${from} para ${input.estado}.`,
      progresso: input.estado === 'concluida' ? '100.00' : null });
  });
  return (await findWork(id))!;
}
