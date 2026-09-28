import { and, asc, eq } from 'drizzle-orm';
import { obra_atividades, obras, profissionais } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type ReadDb, type WriteContext, type WriteDb, type Audit } from '../database/connection.ts';
import { findWork } from '../works/works.service.ts';
import type { ActivityCreateDto, ActivityReprogramDto } from './dto.ts';
import { appendWorkJournal } from '../work-journal/journal.writer.ts';

const selection = {
  id: obra_atividades.id, codigo: obra_atividades.codigo, obraId: obra_atividades.obra_id, etapa: obra_atividades.etapa, titulo: obra_atividades.titulo,
  responsavelProfissionalId: obra_atividades.responsavel_profissional_id, responsavelNome: profissionais.nome,
  inicio: obra_atividades.inicio, termino: obra_atividades.termino, estado: obra_atividades.estado, motivoBloqueio: obra_atividades.motivo_bloqueio,
};

async function assertWork(obraId: string): Promise<{ estado: string }> {
  const [row] = await withRead((db) => db.select({ id: obras.id, estado: obras.estado }).from(obras).where(eq(obras.id, obraId)).limit(1));
  if (!row) throw new NotFoundError('Obra não encontrada.');
  return { estado: row.estado as string };
}

function activitiesQuery(db: ReadDb, obraId: string) {
  return db.select(selection).from(obra_atividades)
    .innerJoin(profissionais, eq(profissionais.id, obra_atividades.responsavel_profissional_id))
    .where(eq(obra_atividades.obra_id, obraId)).orderBy(asc(obra_atividades.inicio), asc(obra_atividades.codigo));
}

export async function listActivities(obraId: string) {
  await assertWork(obraId);
  return { data: await withRead((db) => activitiesQuery(db, obraId)) };
}

/** After a mutation, return the full activities list + the (possibly recalculated) obra in one payload. */
async function bundle(obraId: string) {
  const [atividades, obra] = await Promise.all([withRead((db) => activitiesQuery(db, obraId)), findWork(obraId)]);
  return { atividades, obra };
}

// Concluir recalcula o progresso da obra pela proporção de concluídas e define a próxima (contrato §4.19).
async function recalcWork(db: WriteDb, audit: Audit, obraId: string, obraEstado: string) {
  if (obraEstado === 'concluida' || obraEstado === 'cancelada') return;   // não mexe em obra terminal (protege a CHECK de 100%)
  const rows = await db.select({ estado: obra_atividades.estado, titulo: obra_atividades.titulo, inicio: obra_atividades.inicio, codigo: obra_atividades.codigo })
    .from(obra_atividades).where(eq(obra_atividades.obra_id, obraId)).orderBy(asc(obra_atividades.inicio), asc(obra_atividades.codigo));
  const total = rows.length;
  const concluidas = rows.filter((row) => row.estado === 'concluida').length;
  const progresso = total ? Math.round((concluidas / total) * 100) : 0;
  const proxima = rows.find((row) => row.estado !== 'concluida')?.titulo ?? null;
  await db.update(obras).set({ progresso_percentual: `${progresso}.00`, proxima_atividade_descricao: proxima, updated_at: audit.updated_at, updated_by: audit.updated_by }).where(eq(obras.id, obraId));
}

export async function createActivity(obraId: string, input: ActivityCreateDto, context: WriteContext) {
  await assertWork(obraId);
  const [prof] = await withRead((db) => db.select({ id: profissionais.id }).from(profissionais).where(and(eq(profissionais.id, input.responsavelProfissionalId), eq(profissionais.ativo, true))).limit(1));
  if (!prof) throw new NotFoundError('Responsável da atividade não encontrado ou inativo.');
  try {
    await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: obra_atividades.codigo }).from(obra_atividades).where(eq(obra_atividades.obra_id, obraId));
      await db.insert(obra_atividades).values({
        obra_id: obraId, codigo: nextCode('ATV', codes.map((item) => item.codigo)), etapa: input.etapa ?? 'execucao', titulo: input.titulo,
        responsavel_profissional_id: input.responsavelProfissionalId, inicio: input.inicio, termino: input.termino, estado: 'nao_iniciada',
        created_by: audit.created_by, updated_by: audit.updated_by,
      });
    });
    return bundle(obraId);
  } catch (error) { rethrowConflict(error, 'Conflito ao criar a atividade.'); }
}

async function loadActivity(db: ReadDb, obraId: string, id: string) {
  const [row] = await db.select({ id: obra_atividades.id, titulo: obra_atividades.titulo, estado: obra_atividades.estado, inicio: obra_atividades.inicio, termino: obra_atividades.termino })
    .from(obra_atividades).where(and(eq(obra_atividades.id, id), eq(obra_atividades.obra_id, obraId))).limit(1);
  return row ?? null;
}

export async function completeActivity(obraId: string, id: string, context: WriteContext) {
  const { estado: obraEstado } = await assertWork(obraId);
  await withTransaction(context, async (db, audit) => {
    const activity = await loadActivity(db, obraId, id);
    if (!activity) throw new NotFoundError('Atividade não encontrada nesta obra.');
    // Concluir remove o bloqueio.
    await db.update(obra_atividades).set({ estado: 'concluida', motivo_bloqueio: null, updated_at: audit.updated_at, updated_by: audit.updated_by }).where(eq(obra_atividades.id, id));
    await recalcWork(db, audit, obraId, obraEstado);
    await appendWorkJournal(db, audit, obraId, { titulo: 'Atividade concluída', descricao: activity.titulo });
  });
  return bundle(obraId);
}

export async function blockActivity(obraId: string, id: string, motivo: string, context: WriteContext) {
  await assertWork(obraId);
  await withTransaction({ ...context, reason: motivo }, async (db, audit) => {
    const activity = await loadActivity(db, obraId, id);
    if (!activity) throw new NotFoundError('Atividade não encontrada nesta obra.');
    if (activity.estado === 'concluida') throw new BusinessRuleError('Atividade concluída não pode ser bloqueada.');
    await db.update(obra_atividades).set({ estado: 'bloqueada', motivo_bloqueio: motivo, updated_at: audit.updated_at, updated_by: audit.updated_by }).where(eq(obra_atividades.id, id));
    await appendWorkJournal(db, audit, obraId, { tipo: 'pendencia', titulo: 'Atividade bloqueada',
      descricao: `${activity.titulo} · ${motivo}` });
  });
  return bundle(obraId);
}

export async function reprogramActivity(obraId: string, id: string, input: ActivityReprogramDto, context: WriteContext) {
  await assertWork(obraId);
  await withTransaction({ ...context, reason: input.justificativa }, async (db, audit) => {
    const activity = await loadActivity(db, obraId, id);
    if (!activity) throw new NotFoundError('Atividade não encontrada nesta obra.');
    const inicio = input.novoInicio ?? (activity.inicio as string);
    if (input.novoTermino < inicio) throw new BusinessRuleError('O término não pode ser anterior ao início.');
    await db.update(obra_atividades).set({ inicio, termino: input.novoTermino, updated_at: audit.updated_at, updated_by: audit.updated_by }).where(eq(obra_atividades.id, id));
    await appendWorkJournal(db, audit, obraId, { titulo: 'Atividade reprogramada',
      descricao: `${activity.titulo} · prazo ${activity.termino} → ${input.novoTermino}. Motivo: ${input.justificativa}` });
  });
  return bundle(obraId);
}
