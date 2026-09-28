import { and, asc, desc, eq, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { imobiliarias } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);
const optionalEmail = z.string().trim().max(254).nullish().transform((value) => value?.trim() || null)
  .refine((value) => value === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), { message: 'E-mail inválido.' });

export const agencyListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(['razaoSocial', 'codigo', 'createdAt']).default('razaoSocial'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });
export const agencyCreateSchema = z.object({
  razaoSocial: z.string().trim().min(1).max(200),
  nomeFantasia: optionalText(200),
  documento: z.string().trim().min(1).max(32),
  creci: z.string().trim().min(1).max(40),
  contatoNome: z.string().trim().min(1).max(200),
  telefone: optionalText(32),
  email: optionalEmail,
  observacoes: optionalText(5000),
}).strict();
export const agencyIdSchema = z.object({ id: z.string().uuid() }).strict();
export type AgencyListQuery = z.infer<typeof agencyListQuerySchema>;
export type AgencyCreateDto = z.infer<typeof agencyCreateSchema>;

const selection = {
  id: imobiliarias.id, codigo: imobiliarias.codigo, razaoSocial: imobiliarias.razao_social, nomeFantasia: imobiliarias.nome_fantasia,
  documento: imobiliarias.documento, creci: imobiliarias.creci, contatoNome: imobiliarias.contato_nome,
  telefone: imobiliarias.telefone, email: imobiliarias.email, observacoes: imobiliarias.observacoes, ativo: imobiliarias.ativo,
  createdAt: imobiliarias.created_at, updatedAt: imobiliarias.updated_at,
};

function order(query: AgencyListQuery) {
  const column = query.sortBy === 'codigo' ? imobiliarias.codigo : query.sortBy === 'createdAt' ? imobiliarias.created_at : imobiliarias.razao_social;
  return query.sortOrder === 'desc' ? desc(column) : asc(column);
}

export async function listAgencies(query: AgencyListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const rows = await withRead((db) => db.select(selection).from(imobiliarias)
    .where(and(eq(imobiliarias.ativo, true),
      term ? or(like(imobiliarias.razao_social, term), like(imobiliarias.nome_fantasia, term), like(imobiliarias.documento, term), like(imobiliarias.creci, term), like(imobiliarias.codigo, term)) : undefined))
    .orderBy(order(query)));
  const total = rows.length;
  if (!query.page || !query.limit) return { data: rows };
  const start = (query.page - 1) * query.limit;
  return { data: rows.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findAgency(id: string) {
  const rows = await withRead((db) => db.select(selection).from(imobiliarias).where(and(eq(imobiliarias.id, id), eq(imobiliarias.ativo, true))).limit(1));
  return rows[0] ?? null;
}

export async function createAgency(input: AgencyCreateDto, context: WriteContext) {
  try {
    const id = await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: imobiliarias.codigo }).from(imobiliarias);
      const [row] = await db.insert(imobiliarias).values({
        codigo: nextCode('IMB', codes.map((item) => item.codigo)), razao_social: input.razaoSocial, nome_fantasia: input.nomeFantasia,
        documento: input.documento, creci: input.creci, contato_nome: input.contatoNome, telefone: input.telefone, email: input.email,
        observacoes: input.observacoes,
        created_by: audit.created_by, updated_by: audit.updated_by,
      }).returning({ id: imobiliarias.id });
      return row!.id;
    });
    return (await findAgency(id))!;
  } catch (error) { rethrowConflict(error, 'Já existe uma imobiliária com este documento.'); }
}
