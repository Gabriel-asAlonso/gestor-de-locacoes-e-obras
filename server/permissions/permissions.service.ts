import { asc, eq } from 'drizzle-orm';
import { usuario_permissoes } from '../../db/schema.ts';
import { withRead } from '../database/connection.ts';
import type { UsuarioRow } from '../users/users.service.ts';
import { permissionsFor } from '../roles/roles.ts';

export async function grantedPermissionsForUser(userId: string): Promise<string[]> {
  const rows = await withRead((db) => db
    .select({ code: usuario_permissoes.permissao_codigo })
    .from(usuario_permissoes)
    .where(eq(usuario_permissoes.usuario_id, userId))
    .orderBy(asc(usuario_permissoes.permissao_codigo)));
  return rows.map(row => row.code);
}

export async function effectivePermissionsForUser(user: UsuarioRow): Promise<string[]> {
  if (user.papel_codigo === 'master') return permissionsFor('master');
  return permissionsFor(user.papel_codigo, await grantedPermissionsForUser(user.id));
}
