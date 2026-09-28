import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { carteiras, imoveis, unidades } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';
import type { PortfolioCreateDto, PortfolioListQuery, PortfolioPatchDto } from './dto.ts';

const selection = {
  id: carteiras.id, codigo: carteiras.codigo, nome: carteiras.nome, titularNome: carteiras.titular_nome,
  titularDocumento: carteiras.titular_documento, gestorDescricao: carteiras.gestor_descricao,
  descricao: carteiras.descricao, observacoes: carteiras.observacoes, ativo: carteiras.ativo,
  createdAt: carteiras.created_at, updatedAt: carteiras.updated_at,
  quantidadeImoveis: sql<number>`count(distinct ${imoveis.id})`,
  quantidadeUnidades: sql<number>`count(distinct ${unidades.id})`,
  unidadesOcupadas: sql<number>`count(distinct case when ${unidades.ocupada_informada} = 1 then ${unidades.id} end)`,
};

function order(query: PortfolioListQuery) {
  const column = query.sortBy === 'codigo' ? carteiras.codigo : query.sortBy === 'createdAt' ? carteiras.created_at : carteiras.nome;
  return query.sortOrder === 'desc' ? desc(column) : asc(column);
}

export async function listPortfolios(query: PortfolioListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const rows = await withRead((db) => db.select(selection).from(carteiras)
    .leftJoin(imoveis, and(eq(imoveis.carteira_id, carteiras.id), eq(imoveis.ativo, true)))
    .leftJoin(unidades, eq(unidades.imovel_id, imoveis.id))
    .where(and(eq(carteiras.ativo, true), term ? or(like(carteiras.nome, term), like(carteiras.codigo, term), like(carteiras.titular_nome, term), like(carteiras.titular_documento, term)) : undefined))
    .groupBy(carteiras.id).orderBy(order(query)));
  const total = rows.length;
  if (!query.page || !query.limit) return { data: rows };
  const start = (query.page - 1) * query.limit;
  return { data: rows.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findPortfolio(id: string) {
  const result = await listPortfolios({ sortBy: 'nome', sortOrder: 'asc' });
  return result.data.find((row) => row.id === id) ?? null;
}

export async function createPortfolio(input: PortfolioCreateDto, context: WriteContext) {
  try {
    const id = await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: carteiras.codigo }).from(carteiras);
      const [row] = await db.insert(carteiras).values({
        codigo: nextCode('CAR', codes.map((item) => item.codigo)), nome: input.nome, titular_nome: input.titularNome,
        titular_documento: input.titularDocumento, gestor_descricao: input.gestorDescricao,
        descricao: input.descricao, observacoes: input.observacoes, created_by: audit.created_by, updated_by: audit.updated_by,
      }).returning({ id: carteiras.id });
      return row!.id;
    });
    return (await findPortfolio(id))!;
  } catch (error) { rethrowConflict(error, 'Já existe uma carteira com este código.'); }
}

export async function updatePortfolio(id: string, input: PortfolioPatchDto, context: WriteContext) {
  if (!await findPortfolio(id)) throw new NotFoundError('Carteira não encontrada.');
  await withTransaction(context, async (db, audit) => {
    const values: Partial<typeof carteiras.$inferInsert> = { updated_at: audit.updated_at, updated_by: audit.updated_by };
    if (input.nome !== undefined) values.nome = input.nome;
    if (input.titularNome !== undefined) values.titular_nome = input.titularNome;
    if (input.titularDocumento !== undefined) values.titular_documento = input.titularDocumento;
    if (input.gestorDescricao !== undefined) values.gestor_descricao = input.gestorDescricao;
    if (input.descricao !== undefined) values.descricao = input.descricao;
    if (input.observacoes !== undefined) values.observacoes = input.observacoes;
    await db.update(carteiras).set(values).where(eq(carteiras.id, id));
  });
  return (await findPortfolio(id))!;
}
