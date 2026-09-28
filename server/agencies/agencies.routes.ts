// Imobiliárias: read (auxiliary data for locatários) + create (Grupo 3). Edit/inactivate remain later.
import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { agencyCreateSchema, agencyIdSchema, agencyListQuerySchema, createAgency, findAgency, listAgencies } from './agencies.service.ts';

export const agenciesRoutes = new Hono<AppEnv>();
agenciesRoutes.use('*', requireAuth);
agenciesRoutes.get('/', requirePermission(PERMISSIONS.IMOBILIARIAS_LER), async (c) => c.json(await listAgencies(readQuery(c, agencyListQuerySchema))));
agenciesRoutes.get('/:id', requirePermission(PERMISSIONS.IMOBILIARIAS_LER), async (c) => { const row = await findAgency(readParams(c, agencyIdSchema).id); if (!row) throw new NotFoundError('Imobiliária não encontrada.'); return ok(c, row); });
agenciesRoutes.post('/', requirePermission(PERMISSIONS.IMOBILIARIAS_CRIAR), async (c) => created(c, await createAgency(await readJson(c, agencyCreateSchema), { actorId: c.get('user').id })));
