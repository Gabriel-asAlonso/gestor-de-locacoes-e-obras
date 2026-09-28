import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { readJson, readParams } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { allocationCreateSchema, allocationParamsSchema, worksNestParamsSchema } from './dto.ts';
import { createAllocation, listTeam, removeAllocation } from './team.service.ts';

// Montado em /obras/:obraId/equipe.
export const workTeamRoutes = new Hono<AppEnv>();
workTeamRoutes.use('*', requireAuth);
workTeamRoutes.get('/', requirePermission(PERMISSIONS.OBRAS_LER), async (c) => c.json(await listTeam(readParams(c, worksNestParamsSchema).obraId)));
workTeamRoutes.post('/', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => created(c, await createAllocation(readParams(c, worksNestParamsSchema).obraId, await readJson(c, allocationCreateSchema), { actorId: c.get('user').id })));
workTeamRoutes.delete('/:id', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => { const p = readParams(c, allocationParamsSchema); return ok(c, await removeAllocation(p.obraId, p.id, { actorId: c.get('user').id })); });
