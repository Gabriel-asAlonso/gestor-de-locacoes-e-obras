import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { documento_vinculos, documentos, obra_diario, obra_pendencias, obras, usuarios } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';
import { persistLinkedFile } from '../documents/documents.service.ts';
import { appendWorkJournal } from './journal.writer.ts';
import type { JournalCreateDto, PendingCreateDto } from './dto.ts';

async function assertWork(obraId: string) {
  const [row] = await withRead((db) => db.select({ id: obras.id, estado: obras.estado }).from(obras)
    .where(eq(obras.id, obraId)).limit(1));
  if (!row) throw new NotFoundError('Obra não encontrada.');
  return row;
}

export async function listJournal(obraId: string, query: { tipo?: typeof obra_diario.$inferSelect.tipo; dataInicio?: string; dataFim?: string } = {}) {
  await assertWork(obraId);
  const rows = await withRead((db) => db.select({ id: obra_diario.id, codigo: obra_diario.codigo,
    tipo: obra_diario.tipo, titulo: obra_diario.titulo, descricao: obra_diario.descricao,
    ocorridoEm: obra_diario.ocorrido_em, progressoRegistrado: obra_diario.progresso_registrado,
    autorNome: usuarios.nome,
  }).from(obra_diario).leftJoin(usuarios, eq(usuarios.id, obra_diario.autor_usuario_id))
    .where(and(eq(obra_diario.obra_id, obraId), query.tipo ? eq(obra_diario.tipo, query.tipo) : undefined,
      query.dataInicio ? gte(obra_diario.ocorrido_em, `${query.dataInicio}T00:00:00.000Z`) : undefined,
      query.dataFim ? lte(obra_diario.ocorrido_em, `${query.dataFim}T23:59:59.999Z`) : undefined))
    .orderBy(desc(obra_diario.ocorrido_em), desc(obra_diario.id)));
  const files = await withRead((db) => db.select({ diarioId: documento_vinculos.diario_id,
    id: documentos.id, nome: documentos.nome_original, tamanho: documentos.tamanho_bytes, mimeType: documentos.mime_type,
  }).from(documento_vinculos).innerJoin(documentos, eq(documentos.id, documento_vinculos.documento_id))
    .innerJoin(obra_diario, eq(obra_diario.id, documento_vinculos.diario_id))
    .where(and(eq(obra_diario.obra_id, obraId), eq(documentos.estado, 'disponivel'))));
  return { data: rows.map((row) => ({ ...row, autorNome: row.autorNome ?? 'Sistema',
    arquivos: files.filter((file) => file.diarioId === row.id).map(({ diarioId: _diarioId, ...file }) => file) })) };
}

export async function findJournalEntry(obraId: string, id: string) {
  const { data } = await listJournal(obraId);
  const row = data.find((item) => item.id === id);
  if (!row) throw new NotFoundError('Registro do diário não encontrado nesta obra.');
  return row;
}

export async function createJournalEntry(obraId: string, input: JournalCreateDto, context: WriteContext) {
  const work = await assertWork(obraId);
  let id = '';
  await withTransaction(context, async (db, audit) => {
    id = await appendWorkJournal(db, audit, obraId, { tipo: input.tipo, titulo: input.titulo,
      descricao: input.descricao, progresso: input.progressoRegistrado ?? null });
    if (input.progressoRegistrado != null || input.proximaAtividadeDescricao != null) {
      if (work.estado === 'concluida' || work.estado === 'cancelada') throw new BusinessRuleError('Obra terminal não pode receber atualização de progresso.');
      await db.update(obras).set({
        ...(input.progressoRegistrado != null ? { progresso_percentual: input.progressoRegistrado } : {}),
        ...(input.proximaAtividadeDescricao != null ? { proxima_atividade_descricao: input.proximaAtividadeDescricao } : {}),
        updated_at: audit.updated_at, updated_by: audit.updated_by,
      }).where(eq(obras.id, obraId));
    }
    if (input.tipo === 'pendencia') {
      const codes = await db.select({ codigo: obra_pendencias.codigo }).from(obra_pendencias).where(eq(obra_pendencias.obra_id, obraId));
      await db.insert(obra_pendencias).values({ obra_id: obraId,
        codigo: nextCode('PEN', codes.map((row) => row.codigo)), titulo: input.titulo,
        descricao: input.descricao, severidade: 'atencao', created_by: audit.created_by, updated_by: audit.updated_by });
    }
  });
  return findJournalEntry(obraId, id);
}

export async function addJournalFile(obraId: string, diarioId: string, file: File, context: WriteContext) {
  await findJournalEntry(obraId, diarioId);
  await persistLinkedFile(file, context, async (db, audit, documentId) => {
    await db.insert(documento_vinculos).values({ documento_id: documentId,
      diario_id: diarioId, created_by: audit.created_by });
  });
  return findJournalEntry(obraId, diarioId);
}

export async function listPending(obraId: string) {
  await assertWork(obraId);
  return { data: await withRead((db) => db.select({ id: obra_pendencias.id, codigo: obra_pendencias.codigo,
    titulo: obra_pendencias.titulo, descricao: obra_pendencias.descricao,
    severidade: obra_pendencias.severidade, resolvidaEm: obra_pendencias.resolvida_em,
  }).from(obra_pendencias).where(and(eq(obra_pendencias.obra_id, obraId), isNull(obra_pendencias.resolvida_em)))
    .orderBy(desc(obra_pendencias.created_at))) };
}

export async function createPending(obraId: string, input: PendingCreateDto, context: WriteContext) {
  await assertWork(obraId);
  await withTransaction(context, async (db, audit) => {
    const codes = await db.select({ codigo: obra_pendencias.codigo }).from(obra_pendencias).where(eq(obra_pendencias.obra_id, obraId));
    await db.insert(obra_pendencias).values({ obra_id: obraId, codigo: nextCode('PEN', codes.map((row) => row.codigo)),
      titulo: input.titulo, descricao: input.descricao, severidade: input.severidade,
      created_by: audit.created_by, updated_by: audit.updated_by });
    await appendWorkJournal(db, audit, obraId, { tipo: 'pendencia', titulo: input.titulo, descricao: input.descricao });
  });
  return listPending(obraId);
}

export async function resolvePending(obraId: string, id: string, context: WriteContext) {
  await assertWork(obraId);
  await withTransaction(context, async (db, audit) => {
    const [row] = await db.select({ id: obra_pendencias.id, titulo: obra_pendencias.titulo,
      resolvidaEm: obra_pendencias.resolvida_em }).from(obra_pendencias)
      .where(and(eq(obra_pendencias.id, id), eq(obra_pendencias.obra_id, obraId))).limit(1);
    if (!row) throw new NotFoundError('Pendência não encontrada nesta obra.');
    if (row.resolvidaEm) throw new BusinessRuleError('Esta pendência já foi resolvida.');
    await db.update(obra_pendencias).set({ resolvida_em: audit.updated_at, resolvida_por: audit.updated_by,
      updated_at: audit.updated_at, updated_by: audit.updated_by }).where(eq(obra_pendencias.id, id));
    await appendWorkJournal(db, audit, obraId, { titulo: 'Pendência resolvida', descricao: row.titulo });
  });
  return listPending(obraId);
}
