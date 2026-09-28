import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { readJson, readParams } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { activityBlockSchema, activityCreateSchema, activityParamsSchema, activityReprogramSchema, worksNestParamsSchema } from './dto.ts';
import { blockActivity, completeActivity, createActivity, listActivities, reprogramActivity } from './activities.service.ts';

// Montado em /obras/:obraId/atividades — o param obraId vem do caminho pai.
export const activitiesRoutes = new Hono<AppEnv>();
activitiesRoutes.use('*', requireAuth);
activitiesRoutes.get('/', requirePermission(PERMISSIONS.OBRAS_LER), async (c) => c.json(await listActivities(readParams(c, worksNestParamsSchema).obraId)));
activitiesRoutes.post('/', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => created(c, await createActivity(readParams(c, worksNestParamsSchema).obraId, await readJson(c, activityCreateSchema), { actorId: c.get('user').id })));
activitiesRoutes.post('/:id/concluir', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => { const p = readParams(c, activityParamsSchema); return ok(c, await completeActivity(p.obraId, p.id, { actorId: c.get('user').id })); });
activitiesRoutes.post('/:id/bloquear', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => { const p = readParams(c, activityParamsSchema); return ok(c, await blockActivity(p.obraId, p.id, (await readJson(c, activityBlockSchema)).motivo, { actorId: c.get('user').id })); });
activitiesRoutes.post('/:id/reprogramar', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => { const p = readParams(c, activityParamsSchema); return ok(c, await reprogramActivity(p.obraId, p.id, await readJson(c, activityReprogramSchema), { actorId: c.get('user').id })); });
