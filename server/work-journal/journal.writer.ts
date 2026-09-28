import { eq } from 'drizzle-orm';
import { obra_diario } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import type { Audit, WriteDb } from '../database/connection.ts';

export type JournalKind = 'atualizacao' | 'ocorrencia' | 'pendencia' | 'arquivo';
export async function appendWorkJournal(db: WriteDb, audit: Audit, obraId: string, input: {
  tipo?: JournalKind; titulo: string; descricao: string; progresso?: string | null;
}) {
  const codes = await db.select({ codigo: obra_diario.codigo }).from(obra_diario).where(eq(obra_diario.obra_id, obraId));
  const [row] = await db.insert(obra_diario).values({
    obra_id: obraId, codigo: nextCode('DIA', codes.map((item) => item.codigo)), tipo: input.tipo ?? 'atualizacao',
    titulo: input.titulo, descricao: input.descricao, ocorrido_em: new Date().toISOString(),
    autor_usuario_id: audit.created_by, progresso_registrado: input.progresso ?? null,
    created_by: audit.created_by,
  }).returning({ id: obra_diario.id });
  return row!.id;
}
