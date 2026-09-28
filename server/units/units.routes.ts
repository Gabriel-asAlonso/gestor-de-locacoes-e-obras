import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { unitCreateSchema, unitIdSchema, unitListQuerySchema, unitPatchSchema } from './dto.ts';
import { createUnit, findUnit, listUnits, updateUnit } from './units.service.ts';

export const unitsRoutes = new Hono<AppEnv>();
unitsRoutes.use('*', requireAuth);
unitsRoutes.get('/', requirePermission(PERMISSIONS.UNIDADES_LER), async (c) => c.json(await listUnits(readQuery(c, unitListQuerySchema))));
unitsRoutes.get('/:id', requirePermission(PERMISSIONS.UNIDADES_LER), async (c) => { const row = await findUnit(readParams(c, unitIdSchema).id); if (!row) throw new NotFoundError('Unidade não encontrada.'); return ok(c, row); });
unitsRoutes.post('/', requirePermission(PERMISSIONS.UNIDADES_CRIAR), async (c) => created(c, await createUnit(await readJson(c, unitCreateSchema), { actorId: c.get('user').id })));
unitsRoutes.patch('/:id', requirePermission(PERMISSIONS.UNIDADES_EDITAR), async (c) => ok(c, await updateUnit(readParams(c, unitIdSchema).id, await readJson(c, unitPatchSchema), { actorId: c.get('user').id })));
