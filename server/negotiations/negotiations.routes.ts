import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { negotiationCreateSchema, negotiationIdSchema, negotiationListQuerySchema, negotiationSubstituteSchema } from './dto.ts';
import { createNegotiation, findNegotiation, listNegotiations, substituteNegotiation } from './negotiations.service.ts';

export const negotiationsRoutes = new Hono<AppEnv>();
negotiationsRoutes.use('*', requireAuth);
negotiationsRoutes.get('/', requirePermission(PERMISSIONS.NEGOCIACOES_LER), async (c) => c.json(await listNegotiations(readQuery(c, negotiationListQuerySchema))));
negotiationsRoutes.get('/:id', requirePermission(PERMISSIONS.NEGOCIACOES_LER), async (c) => { const row = await findNegotiation(readParams(c, negotiationIdSchema).id); if (!row) throw new NotFoundError('Negociação não encontrada.'); return ok(c, row); });
negotiationsRoutes.post('/', requirePermission(PERMISSIONS.NEGOCIACOES_REGISTRAR), async (c) => created(c, await createNegotiation(await readJson(c, negotiationCreateSchema), { actorId: c.get('user').id })));
negotiationsRoutes.post('/:id/substituir', requirePermission(PERMISSIONS.NEGOCIACOES_REGISTRAR), async (c) => created(c, await substituteNegotiation(readParams(c, negotiationIdSchema).id, await readJson(c, negotiationSubstituteSchema), { actorId: c.get('user').id })));
