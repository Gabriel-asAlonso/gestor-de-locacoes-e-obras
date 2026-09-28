import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { tenantCreateSchema, tenantIdSchema, tenantListQuerySchema, tenantPatchSchema } from './dto.ts';
import { createTenant, findTenant, listTenants, updateTenant } from './tenants.service.ts';

export const tenantsRoutes = new Hono<AppEnv>();
tenantsRoutes.use('*', requireAuth);
tenantsRoutes.get('/', requirePermission(PERMISSIONS.LOCATARIOS_LER), async (c) => c.json(await listTenants(readQuery(c, tenantListQuerySchema))));
tenantsRoutes.get('/:id', requirePermission(PERMISSIONS.LOCATARIOS_LER), async (c) => { const row = await findTenant(readParams(c, tenantIdSchema).id); if (!row) throw new NotFoundError('Locatário não encontrado.'); return ok(c, row); });
tenantsRoutes.post('/', requirePermission(PERMISSIONS.LOCATARIOS_CRIAR), async (c) => created(c, await createTenant(await readJson(c, tenantCreateSchema), { actorId: c.get('user').id })));
tenantsRoutes.patch('/:id', requirePermission(PERMISSIONS.LOCATARIOS_EDITAR), async (c) => ok(c, await updateTenant(readParams(c, tenantIdSchema).id, await readJson(c, tenantPatchSchema), { actorId: c.get('user').id })));
