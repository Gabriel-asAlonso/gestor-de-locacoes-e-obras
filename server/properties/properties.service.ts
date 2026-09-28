import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { carteiras, imoveis, unidades } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';
import type { PropertyCreateDto, PropertyListQuery, PropertyPatchDto } from './dto.ts';

const selection = {
  id: imoveis.id, codigo: imoveis.codigo, carteiraId: imoveis.carteira_id, carteiraNome: carteiras.nome,
  nome: imoveis.nome, endereco: imoveis.endereco, tipo: imoveis.tipo, cep: imoveis.cep, logradouro: imoveis.logradouro,
  numero: imoveis.numero, complemento: imoveis.complemento, bairro: imoveis.bairro, cidade: imoveis.cidade, uf: imoveis.uf,
  inscricaoMunicipal: imoveis.inscricao_municipal, matricula: imoveis.matricula, cartorioRegistro: imoveis.cartorio_registro,
  gestorDescricao: imoveis.gestor_descricao, observacoes: imoveis.observacoes, ativo: imoveis.ativo,
  createdAt: imoveis.created_at, updatedAt: imoveis.updated_at,
  unidadesTotal: sql<number>`count(distinct ${unidades.id})`,
  unidadesOcupadas: sql<number>`count(distinct case when ${unidades.ocupada_informada} = 1 then ${unidades.id} end)`,
};

function order(query: PropertyListQuery) {
  const column = query.sortBy === 'codigo' ? imoveis.codigo : query.sortBy === 'createdAt' ? imoveis.created_at : imoveis.nome;
  return query.sortOrder === 'desc' ? desc(column) : asc(column);
}

export async function listProperties(query: PropertyListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const rows = await withRead((db) => db.select(selection).from(imoveis)
    .innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id)).leftJoin(unidades, eq(unidades.imovel_id, imoveis.id))
    .where(and(eq(imoveis.ativo, true), eq(carteiras.ativo, true), query.carteiraId ? eq(imoveis.carteira_id, query.carteiraId) : undefined,
      term ? or(like(imoveis.nome, term), like(imoveis.codigo, term), like(imoveis.endereco, term), like(carteiras.nome, term)) : undefined))
    .groupBy(imoveis.id).orderBy(order(query)));
  const total = rows.length;
  if (!query.page || !query.limit) return { data: rows };
  const start = (query.page - 1) * query.limit;
  return { data: rows.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findProperty(id: string) {
  const rows = await withRead((db) => db.select(selection).from(imoveis).innerJoin(carteiras, eq(carteiras.id, imoveis.carteira_id))
    .leftJoin(unidades, eq(unidades.imovel_id, imoveis.id)).where(and(eq(imoveis.id, id), eq(imoveis.ativo, true))).groupBy(imoveis.id).limit(1));
  return rows[0] ?? null;
}

async function assertActivePortfolio(id: string) {
  const rows = await withRead((db) => db.select({ id: carteiras.id }).from(carteiras).where(and(eq(carteiras.id, id), eq(carteiras.ativo, true))).limit(1));
  if (!rows[0]) throw new NotFoundError('Carteira não encontrada ou inativa.');
}

export async function createProperty(input: PropertyCreateDto, context: WriteContext) {
  await assertActivePortfolio(input.carteiraId);
  try {
    const id = await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: imoveis.codigo }).from(imoveis);
      const [row] = await db.insert(imoveis).values({ codigo: nextCode('IMO', codes.map((item) => item.codigo)), carteira_id: input.carteiraId,
        nome: input.nome, endereco: input.endereco, tipo: input.tipo, cep: input.cep, logradouro: input.logradouro, numero: input.numero,
        complemento: input.complemento, bairro: input.bairro, cidade: input.cidade, uf: input.uf, inscricao_municipal: input.inscricaoMunicipal,
        matricula: input.matricula, cartorio_registro: input.cartorioRegistro, gestor_descricao: input.gestorDescricao,
        observacoes: input.observacoes, created_by: audit.created_by, updated_by: audit.updated_by }).returning({ id: imoveis.id });
      return row!.id;
    });
    return (await findProperty(id))!;
  } catch (error) { rethrowConflict(error, 'Já existe um imóvel com este código.'); }
}

export async function updateProperty(id: string, input: PropertyPatchDto, context: WriteContext) {
  if (!await findProperty(id)) throw new NotFoundError('Imóvel não encontrado.');
  if (input.carteiraId) await assertActivePortfolio(input.carteiraId);
  await withTransaction(context, async (db, audit) => {
    const values: Partial<typeof imoveis.$inferInsert> = { updated_at: audit.updated_at, updated_by: audit.updated_by };
    const map: Array<[keyof PropertyPatchDto, keyof typeof values]> = [
      ['carteiraId','carteira_id'],['nome','nome'],['endereco','endereco'],['tipo','tipo'],['cep','cep'],['logradouro','logradouro'],
      ['numero','numero'],['complemento','complemento'],['bairro','bairro'],['cidade','cidade'],['uf','uf'],
      ['inscricaoMunicipal','inscricao_municipal'],['matricula','matricula'],['cartorioRegistro','cartorio_registro'],
      ['gestorDescricao','gestor_descricao'],['observacoes','observacoes'],
    ];
    for (const [source, target] of map) if (input[source] !== undefined) (values as Record<string, unknown>)[target] = input[source];
    await db.update(imoveis).set(values).where(eq(imoveis.id, id));
  });
  return (await findProperty(id))!;
}
