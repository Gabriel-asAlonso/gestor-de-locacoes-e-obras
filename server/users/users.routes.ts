/**
 * Users routes. Every route requires authentication and a specific permission —
 * enforced on the server, not by the front-end hiding controls.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { collection, created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { createUserSchema, permissionSetSchema, userIdParamSchema, userListQuerySchema } from './dto.ts';
import { createUser, findUserById, listUsers } from './users.service.ts';
import { toPublicUser } from './users.mapper.ts';
import { activateUser, approveUser, deactivateUser, rejectUser, replaceUserPermissions, userAccess } from './access.service.ts';

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.use('*', requireAuth);

usersRoutes.get('/', requirePermission(PERMISSIONS.USUARIOS_LER), async (c) =>
  collection(c, (await listUsers(readQuery(c, userListQuerySchema).status)).map(toPublicUser)),
);

usersRoutes.post('/', requirePermission(PERMISSIONS.USUARIOS_CRIAR), async (c) => {
  const dto = await readJson(c, createUserSchema);
  const row = await createUser(
    { nome: dto.nome, email: dto.email, senha: dto.senha, papelCodigo: 'usuario', ativo: dto.ativo ?? false },
    { actorId: c.get('user').id },
  );
  return created(c, toPublicUser(row));
});

usersRoutes.get('/:id', requirePermission(PERMISSIONS.USUARIOS_LER), async (c) => {
  const { id } = readParams(c, userIdParamSchema);
  const row = await findUserById(id);
  if (!row) throw new NotFoundError('Usuário não encontrado.');
  return ok(c, toPublicUser(row));
});

usersRoutes.get('/:id/permissions', requirePermission(PERMISSIONS.PERMISSOES_LER), async (c) => {
  const { id } = readParams(c, userIdParamSchema);
  return ok(c, await userAccess(id));
});

usersRoutes.put('/:id/permissions', requirePermission(PERMISSIONS.PERMISSOES_EDITAR), async (c) => {
  const { id } = readParams(c, userIdParamSchema);
  const dto = await readJson(c, permissionSetSchema);
  return ok(c, await replaceUserPermissions(id, dto.permissoes, c.get('user'), c.get('permissions')));
});

usersRoutes.post('/:id/approve', requirePermission(PERMISSIONS.USUARIOS_APROVAR, PERMISSIONS.PERMISSOES_EDITAR), async (c) => {
  const { id } = readParams(c, userIdParamSchema);
  const dto = await readJson(c, permissionSetSchema);
  return ok(c, toPublicUser(await approveUser(id, dto.permissoes, c.get('user'), c.get('permissions'))));
});

usersRoutes.post('/:id/reject', requirePermission(PERMISSIONS.USUARIOS_REJEITAR), async (c) => {
  const { id } = readParams(c, userIdParamSchema);
  return ok(c, toPublicUser(await rejectUser(id, c.get('user'))));
});

usersRoutes.post('/:id/deactivate', requirePermission(PERMISSIONS.USUARIOS_INATIVAR), async (c) => {
  const { id } = readParams(c, userIdParamSchema);
  return ok(c, toPublicUser(await deactivateUser(id, c.get('user'))));
});

usersRoutes.post('/:id/activate', requirePermission(PERMISSIONS.USUARIOS_ATIVAR), async (c) => {
  const { id } = readParams(c, userIdParamSchema);
  return ok(c, toPublicUser(await activateUser(id, c.get('user'))));
});
