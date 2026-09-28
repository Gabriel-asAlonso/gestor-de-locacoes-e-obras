import { and, asc, desc, eq, isNull, like, or } from 'drizzle-orm';
import { imobiliarias, locatarios } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';
import type { TenantCreateDto, TenantListQuery, TenantPatchDto } from './dto.ts';

const selection = {
  id: locatarios.id, codigo: locatarios.codigo, tipoPessoa: locatarios.tipo_pessoa, nome: locatarios.nome,
  documento: locatarios.documento, nomeFantasia: locatarios.nome_fantasia, contatoNome: locatarios.contato_nome,
  telefone: locatarios.telefone, email: locatarios.email, imobiliariaId: locatarios.imobiliaria_id,
  imobiliariaCodigo: imobiliarias.codigo, imobiliariaNome: imobiliarias.razao_social,
  imobiliariaNomeFantasia: imobiliarias.nome_fantasia, canalPreferido: locatarios.canal_preferido,
  enderecoCobranca: locatarios.endereco_cobranca, inscricaoMunicipal: locatarios.inscricao_municipal,
  observacoes: locatarios.observacoes, ativo: locatarios.ativo, createdAt: locatarios.created_at, updatedAt: locatarios.updated_at,
};

function order(query: TenantListQuery) {
  const column = query.sortBy === 'codigo' ? locatarios.codigo : query.sortBy === 'createdAt' ? locatarios.created_at : locatarios.nome;
  return query.sortOrder === 'desc' ? desc(column) : asc(column);
}

export async function listTenants(query: TenantListQuery) {
  const term = query.search ? `%${query.search}%` : null;
  const rows = await withRead((db) => db.select(selection).from(locatarios)
    .leftJoin(imobiliarias, eq(imobiliarias.id, locatarios.imobiliaria_id))
    .where(and(eq(locatarios.ativo, true),
      query.imobiliariaId ? eq(locatarios.imobiliaria_id, query.imobiliariaId) : undefined,
      query.semImobiliaria === 'true' ? isNull(locatarios.imobiliaria_id) : undefined,
      term ? or(like(locatarios.nome, term), like(locatarios.codigo, term), like(locatarios.documento, term), like(locatarios.nome_fantasia, term)) : undefined))
    .orderBy(order(query)));
  const total = rows.length;
  if (!query.page || !query.limit) return { data: rows };
  const start = (query.page - 1) * query.limit;
  return { data: rows.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function findTenant(id: string) {
  const rows = await withRead((db) => db.select(selection).from(locatarios)
    .leftJoin(imobiliarias, eq(imobiliarias.id, locatarios.imobiliaria_id))
    .where(and(eq(locatarios.id, id), eq(locatarios.ativo, true))).limit(1));
  return rows[0] ?? null;
}

async function assertActiveAgency(id: string) {
  const rows = await withRead((db) => db.select({ id: imobiliarias.id }).from(imobiliarias).where(and(eq(imobiliarias.id, id), eq(imobiliarias.ativo, true))).limit(1));
  if (!rows[0]) throw new NotFoundError('Imobiliária não encontrada ou inativa.');
}

export async function createTenant(input: TenantCreateDto, context: WriteContext) {
  if (input.imobiliariaId) await assertActiveAgency(input.imobiliariaId);
  try {
    const id = await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: locatarios.codigo }).from(locatarios);
      const [row] = await db.insert(locatarios).values({
        codigo: nextCode('LOC', codes.map((item) => item.codigo)), tipo_pessoa: input.tipoPessoa, nome: input.nome,
        documento: input.documento, nome_fantasia: input.nomeFantasia, contato_nome: input.contatoNome, telefone: input.telefone,
        email: input.email, imobiliaria_id: input.imobiliariaId, canal_preferido: input.canalPreferido,
        endereco_cobranca: input.enderecoCobranca, inscricao_municipal: input.inscricaoMunicipal, observacoes: input.observacoes,
        created_by: audit.created_by, updated_by: audit.updated_by,
      }).returning({ id: locatarios.id });
      return row!.id;
    });
    return (await findTenant(id))!;
  } catch (error) { rethrowConflict(error, 'Já existe um locatário com este documento.'); }
}

export async function updateTenant(id: string, input: TenantPatchDto, context: WriteContext) {
  if (!await findTenant(id)) throw new NotFoundError('Locatário não encontrado.');
  if (input.imobiliariaId) await assertActiveAgency(input.imobiliariaId);
  try {
    await withTransaction(context, async (db, audit) => {
      const values: Partial<typeof locatarios.$inferInsert> = { updated_at: audit.updated_at, updated_by: audit.updated_by };
      const map: Array<[keyof TenantPatchDto, keyof typeof values]> = [
        ['tipoPessoa', 'tipo_pessoa'], ['nome', 'nome'], ['documento', 'documento'], ['nomeFantasia', 'nome_fantasia'],
        ['contatoNome', 'contato_nome'], ['telefone', 'telefone'], ['email', 'email'], ['imobiliariaId', 'imobiliaria_id'],
        ['canalPreferido', 'canal_preferido'], ['enderecoCobranca', 'endereco_cobranca'], ['inscricaoMunicipal', 'inscricao_municipal'],
        ['observacoes', 'observacoes'],
      ];
      for (const [source, target] of map) if (input[source] !== undefined) (values as Record<string, unknown>)[target] = input[source];
      await db.update(locatarios).set(values).where(eq(locatarios.id, id));
    });
  } catch (error) { rethrowConflict(error, 'Já existe um locatário com este documento.'); }
  return (await findTenant(id))!;
}
