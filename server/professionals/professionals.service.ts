import { z } from 'zod';
import { and, asc, eq, like } from 'drizzle-orm';
import { profissionais } from '../../db/schema.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';

// Profissional: identifica responsáveis/alocados sem exigir login; único dado é o nome (§4.16).
export const professionalListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });
export const professionalCreateSchema = z.object({ nome: z.string().trim().min(1).max(200) }).strict();
export const professionalIdSchema = z.object({ id: z.string().uuid() }).strict();
export type ProfessionalListQuery = z.infer<typeof professionalListQuerySchema>;
export type ProfessionalCreateDto = z.infer<typeof professionalCreateSchema>;

const selection = { id: profissionais.id, nome: profissionais.nome, ativo: profissionais.ativo };

export async function listProfessionals(query: ProfessionalListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const result = await withRead((db) => db.select(selection).from(profissionais)
    .where(and(eq(profissionais.ativo, true), term ? like(profissionais.nome, term) : undefined)).orderBy(asc(profissionais.nome)));
  const total = result.length;
  if (!query.page || !query.limit) return { data: result };
  const start = (query.page - 1) * query.limit;
  return { data: result.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findProfessional(id: string) {
  const [row] = await withRead((db) => db.select(selection).from(profissionais).where(eq(profissionais.id, id)).limit(1));
  return row ?? null;
}

export async function createProfessional(input: ProfessionalCreateDto, context: WriteContext) {
  try {
    const id = await withTransaction(context, async (db, audit) => {
      const [row] = await db.insert(profissionais).values({ nome: input.nome, created_by: audit.created_by, updated_by: audit.updated_by }).returning({ id: profissionais.id });
      return row!.id;
    });
    return (await findProfessional(id))!;
  } catch (error) { rethrowConflict(error, 'Conflito ao cadastrar o profissional.'); }
}
