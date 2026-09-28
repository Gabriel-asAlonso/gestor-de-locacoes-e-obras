import { and, asc, eq, like } from 'drizzle-orm';
import { fornecedores } from '../../db/schema.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';
import type { SupplierCreateDto, SupplierListQuery } from './dto.ts';

const selection = { id: fornecedores.id, nome: fornecedores.nome, ativo: fornecedores.ativo };

export async function listSuppliers(query: SupplierListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const result = await withRead((db) => db.select(selection).from(fornecedores)
    .where(and(eq(fornecedores.ativo, true), term ? like(fornecedores.nome, term) : undefined))
    .orderBy(asc(fornecedores.nome)));
  const total = result.length;
  if (!query.page || !query.limit) return { data: result };
  const start = (query.page - 1) * query.limit;
  return { data: result.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findSupplier(id: string) {
  const [row] = await withRead((db) => db.select(selection).from(fornecedores).where(eq(fornecedores.id, id)).limit(1));
  return row ?? null;
}

export async function createSupplier(input: SupplierCreateDto, context: WriteContext) {
  try {
    const id = await withTransaction(context, async (db, audit) => {
      const [row] = await db.insert(fornecedores).values({ nome: input.nome, created_by: audit.created_by, updated_by: audit.updated_by }).returning({ id: fornecedores.id });
      return row!.id;
    });
    return (await findSupplier(id))!;
  } catch (error) { rethrowConflict(error, 'Conflito ao cadastrar o fornecedor.'); }
}
