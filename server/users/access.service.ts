import { and, eq, inArray, sql } from 'drizzle-orm';
import { usuario_permissoes, usuarios } from '../../db/schema.ts';
import type { AuthenticatedUser } from '../common/types.ts';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction } from '../database/connection.ts';
import { ALL_PERMISSION_SET } from '../permissions/permissions.ts';
import { permissionsFor, isMasterRole } from '../roles/roles.ts';
import type { UsuarioRow } from './users.service.ts';

const uniqueSorted = (codes: Iterable<string>) => [...new Set(codes)].sort();

function ensureKnownPermissions(codes: readonly string[]): void {
  if (codes.some(code => !ALL_PERMISSION_SET.has(code))) throw new BusinessRuleError('A solicitação contém uma permissão desconhecida.');
}

function ensureCanManageTarget(actor: AuthenticatedUser, target: UsuarioRow): void {
  if (actor.id === target.id) throw new ForbiddenError('Você não pode alterar as permissões ou o status da própria conta.');
  if (isMasterRole(target.papel_codigo)) throw new ForbiddenError('Contas Master não podem ser alteradas por esta operação.');
}

function ensureDelegable(actor: AuthenticatedUser, actorPermissions: readonly string[], requested: readonly string[]): void {
  ensureKnownPermissions(requested);
  if (isMasterRole(actor.perfilCodigo)) return;
  const allowed = new Set(actorPermissions);
  if (requested.some(code => !allowed.has(code))) throw new ForbiddenError('Você tentou conceder uma permissão que não possui.');
}

async function targetOrFail(id: string): Promise<UsuarioRow> {
  const rows = await withRead(db => db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1));
  if (!rows[0]) throw new NotFoundError('Usuário não encontrado.');
  return rows[0];
}

export async function userAccess(id: string): Promise<{ perfilCodigo: string; permissoes: string[] }> {
  const target = await targetOrFail(id);
  if (isMasterRole(target.papel_codigo)) return { perfilCodigo: 'master', permissoes: permissionsFor('master') };
  const rows = await withRead(db => db.select({ code: usuario_permissoes.permissao_codigo })
    .from(usuario_permissoes).where(eq(usuario_permissoes.usuario_id, id)));
  return { perfilCodigo: target.papel_codigo, permissoes: permissionsFor(target.papel_codigo, rows.map(row => row.code)) };
}

export async function replaceUserPermissions(
  id: string,
  requestedCodes: readonly string[],
  actor: AuthenticatedUser,
  actorPermissions: readonly string[],
): Promise<{ perfilCodigo: string; permissoes: string[] }> {
  const target = await targetOrFail(id);
  ensureCanManageTarget(actor, target);
  ensureDelegable(actor, actorPermissions, requestedCodes);
  const requested = uniqueSorted(requestedCodes);

  const final = await withTransaction({ actorId: actor.id, reason: 'Alteração de permissões do usuário', eventCode: 'USER_PERMISSIONS_CHANGED', category: 'audit', module: 'usuarios' }, async (db, audit) => {
    const existingRows = await db.select({ code: usuario_permissoes.permissao_codigo })
      .from(usuario_permissoes).where(eq(usuario_permissoes.usuario_id, id));
    const existing = existingRows.map(row => row.code);
    const manageable = isMasterRole(actor.perfilCodigo) ? new Set(existing.concat(requested)) : new Set(actorPermissions);
    const preserved = existing.filter(code => !manageable.has(code));
    const next = uniqueSorted([...preserved, ...requested]);
    const nextSet = new Set(next);
    const existingSet = new Set(existing);
    const removed = existing.filter(code => !nextSet.has(code));
    const added = next.filter(code => !existingSet.has(code));
    if (removed.length) await db.delete(usuario_permissoes).where(and(eq(usuario_permissoes.usuario_id, id), inArray(usuario_permissoes.permissao_codigo, removed)));
    if (added.length) await db.insert(usuario_permissoes).values(added.map(code => ({ usuario_id: id, permissao_codigo: code, concedida_por: actor.id })));
    if (removed.length || added.length) await db.update(usuarios).set({
      autorizacao_versao: sql`${usuarios.autorizacao_versao} + 1`, updated_at: audit.updated_at, updated_by: audit.updated_by,
    }).where(eq(usuarios.id, id));
    return next;
  });
  return { perfilCodigo: target.papel_codigo, permissoes: permissionsFor(target.papel_codigo, final) };
}

export async function approveUser(id: string, codes: readonly string[], actor: AuthenticatedUser, actorPermissions: readonly string[]): Promise<UsuarioRow> {
  const target = await targetOrFail(id);
  ensureCanManageTarget(actor, target);
  ensureDelegable(actor, actorPermissions, codes);
  if (target.status !== 'pendente') throw new BusinessRuleError('Somente solicitações pendentes podem ser aprovadas.');
  const permissions = uniqueSorted(codes);
  return withTransaction({ actorId: actor.id, reason: 'Aprovação de solicitação de acesso', eventCode: 'USER_APPROVED', category: 'audit', module: 'usuarios' }, async (db, audit) => {
    const rows = await db.update(usuarios).set({
      status: 'ativo', ativo: true, perfil_codigo: 'administrador', papel_codigo: 'usuario',
      autorizacao_versao: sql`${usuarios.autorizacao_versao} + 1`, updated_at: audit.updated_at, updated_by: audit.updated_by,
    }).where(and(eq(usuarios.id, id), eq(usuarios.status, 'pendente'))).returning();
    if (!rows[0]) throw new BusinessRuleError('A solicitação não está mais pendente.');
    if (permissions.length) await db.insert(usuario_permissoes).values(permissions.map(code => ({ usuario_id: id, permissao_codigo: code, concedida_por: actor.id })));
    return rows[0];
  });
}

export async function rejectUser(id: string, actor: AuthenticatedUser): Promise<UsuarioRow> {
  const target = await targetOrFail(id);
  ensureCanManageTarget(actor, target);
  if (target.status !== 'pendente') throw new BusinessRuleError('Somente solicitações pendentes podem ser rejeitadas.');
  return withTransaction({ actorId: actor.id, reason: 'Rejeição de solicitação de acesso', eventCode: 'USER_REJECTED', category: 'audit', module: 'usuarios' }, async (db, audit) => {
    const rows = await db.update(usuarios).set({ status: 'rejeitado', ativo: false,
      autorizacao_versao: sql`${usuarios.autorizacao_versao} + 1`, updated_at: audit.updated_at, updated_by: audit.updated_by,
    }).where(and(eq(usuarios.id, id), eq(usuarios.status, 'pendente'))).returning();
    if (!rows[0]) throw new BusinessRuleError('A solicitação não está mais pendente.');
    return rows[0];
  });
}

export async function deactivateUser(id: string, actor: AuthenticatedUser): Promise<UsuarioRow> {
  const target = await targetOrFail(id);
  ensureCanManageTarget(actor, target);
  if (target.status !== 'ativo') throw new BusinessRuleError('Somente usuários ativos podem ser inativados.');
  return withTransaction({ actorId: actor.id, reason: 'Inativação de usuário', eventCode: 'USER_DEACTIVATED', category: 'audit', module: 'usuarios' }, async (db, audit) => {
    const rows = await db.update(usuarios).set({ status: 'inativo', ativo: false,
      autorizacao_versao: sql`${usuarios.autorizacao_versao} + 1`, updated_at: audit.updated_at, updated_by: audit.updated_by,
    }).where(and(eq(usuarios.id, id), eq(usuarios.status, 'ativo'))).returning();
    if (!rows[0]) throw new BusinessRuleError('O usuário não está mais ativo.');
    return rows[0];
  });
}

export async function activateUser(id: string, actor: AuthenticatedUser): Promise<UsuarioRow> {
  const target = await targetOrFail(id);
  ensureCanManageTarget(actor, target);
  if (target.status !== 'inativo') throw new BusinessRuleError('Somente usuários inativos podem ser reativados.');
  return withTransaction({ actorId: actor.id, reason: 'Reativação de usuário', eventCode: 'USER_ACTIVATED', category: 'audit', module: 'usuarios' }, async (db, audit) => {
    const rows = await db.update(usuarios).set({ status: 'ativo', ativo: true, perfil_codigo: 'administrador', papel_codigo: 'usuario',
      autorizacao_versao: sql`${usuarios.autorizacao_versao} + 1`, updated_at: audit.updated_at, updated_by: audit.updated_by,
    }).where(and(eq(usuarios.id, id), eq(usuarios.status, 'inativo'))).returning();
    if (!rows[0]) throw new BusinessRuleError('O usuário não está mais inativo.');
    return rows[0];
  });
}
