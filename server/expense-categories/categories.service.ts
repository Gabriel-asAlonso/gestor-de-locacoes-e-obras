import { and, asc, eq, like } from 'drizzle-orm';
import { categorias_despesa } from '../../db/schema.ts';
import { withRead } from '../database/connection.ts';

const selection = { id: categorias_despesa.id, codigo: categorias_despesa.codigo, nome: categorias_despesa.nome, ativo: categorias_despesa.ativo };

/** Catálogo semeado (Condomínio, Manutenção, Seguros, Telecom, Tributos, Utilidades, Outros). Somente leitura hoje. */
export async function listExpenseCategories(search?: string) {
  const term = search ? `%${search}%` : null;
  const data = await withRead((db) => db.select(selection).from(categorias_despesa)
    .where(and(eq(categorias_despesa.ativo, true), term ? like(categorias_despesa.nome, term) : undefined))
    .orderBy(asc(categorias_despesa.nome)));
  return { data };
}
