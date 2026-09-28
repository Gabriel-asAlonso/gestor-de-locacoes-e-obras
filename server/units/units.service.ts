import { and, asc, desc, eq, like, or } from 'drizzle-orm';
import { carteiras, imoveis, unidades } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';
import type { UnitCreateDto, UnitListQuery, UnitPatchDto } from './dto.ts';

const selection = {
  id: unidades.id, codigo: unidades.codigo, imovelId: unidades.imovel_id, imovelNome: imoveis.nome,
  carteiraId: imoveis.carteira_id, carteiraNome: carteiras.nome, nome: unidades.nome, tipo: unidades.tipo,
  areaPrivativa: unidades.area_privativa, ocupada: unidades.ocupada_informada, codigoComercial: unidades.codigo_comercial,
  bloco: unidades.bloco, andar: unidades.andar, areaTotal: unidades.area_total, inscricaoMunicipal: unidades.inscricao_municipal,
  observacoes: unidades.observacoes, ativo: unidades.ativo, createdAt: unidades.created_at, updatedAt: unidades.updated_at,
};

function order(query: UnitListQuery) {
  const column = query.sortBy === 'codigo' ? unidades.codigo : query.sortBy === 'createdAt' ? unidades.created_at : unidades.nome;
  return query.sortOrder === 'desc' ? desc(column) : asc(column);
}

export async function listUnits(query: UnitListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const rows = await withRead((db) => db.select(selection).from(unidades)
    .innerJoin(imoveis, eq(imoveis.id, unidades.imovel_id)).innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id))
    .where(and(eq(unidades.ativo, true), eq(imoveis.ativo, true), eq(carteiras.ativo, true),
      query.imovelId ? eq(unidades.imovel_id, query.imovelId) : undefined,
      query.carteiraId ? eq(imoveis.carteira_id, query.carteiraId) : undefined,
      query.ocupada ? eq(unidades.ocupada_informada, query.ocupada === 'true') : undefined,
      term ? or(like(unidades.nome, term), like(unidades.codigo, term), like(unidades.codigo_comercial, term), like(imoveis.nome, term), like(carteiras.nome, term)) : undefined))
    .orderBy(order(query)));
  const total = rows.length;
  if (!query.page || !query.limit) return { data: rows };
  const start = (query.page - 1) * query.limit;
  return { data: rows.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findUnit(id: string) {
  const rows = await withRead((db) => db.select(selection).from(unidades)
    .innerJoin(imoveis, eq(imoveis.id, unidades.imovel_id)).innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id))
    .where(and(eq(unidades.id, id), eq(unidades.ativo, true))).limit(1));
  return rows[0] ?? null;
}

async function assertActiveProperty(id: string) {
  const rows = await withRead((db) => db.select({ id: imoveis.id }).from(imoveis).where(and(eq(imoveis.id, id), eq(imoveis.ativo, true))).limit(1));
  if (!rows[0]) throw new NotFoundError('Imóvel não encontrado ou inativo.');
}

export async function createUnit(input: UnitCreateDto, context: WriteContext) {
  await assertActiveProperty(input.imovelId);
  try {
    const id = await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: unidades.codigo }).from(unidades);
      const [row] = await db.insert(unidades).values({
        codigo: nextCode('UNI', codes.map((item) => item.codigo)), imovel_id: input.imovelId, nome: input.nome,
        tipo: input.tipo, area_privativa: input.areaPrivativa, codigo_comercial: input.codigoComercial, bloco: input.bloco,
        andar: input.andar, area_total: input.areaTotal, inscricao_municipal: input.inscricaoMunicipal,
        observacoes: input.observacoes, created_by: audit.created_by, updated_by: audit.updated_by,
      }).returning({ id: unidades.id });
      return row!.id;
    });
    return (await findUnit(id))!;
  } catch (error) { rethrowConflict(error, 'Já existe uma unidade com este nome neste imóvel.'); }
}

export async function updateUnit(id: string, input: UnitPatchDto, context: WriteContext) {
  const current = await findUnit(id);
  if (!current) throw new NotFoundError('Unidade não encontrada.');
  if (input.imovelId) await assertActiveProperty(input.imovelId);
  try {
    await withTransaction(context, async (db, audit) => {
      const values: Partial<typeof unidades.$inferInsert> = { updated_at: audit.updated_at, updated_by: audit.updated_by };
      const map: Array<[keyof UnitPatchDto, keyof typeof values]> = [
        ['imovelId', 'imovel_id'], ['nome', 'nome'], ['tipo', 'tipo'], ['areaPrivativa', 'area_privativa'],
        ['codigoComercial', 'codigo_comercial'], ['bloco', 'bloco'], ['andar', 'andar'], ['areaTotal', 'area_total'],
        ['inscricaoMunicipal', 'inscricao_municipal'], ['observacoes', 'observacoes'],
      ];
      for (const [source, target] of map) if (input[source] !== undefined) (values as Record<string, unknown>)[target] = input[source];
      await db.update(unidades).set(values).where(eq(unidades.id, id));
    });
  } catch (error) { rethrowConflict(error, 'Já existe uma unidade com este nome neste imóvel.'); }
  return (await findUnit(id))!;
}
