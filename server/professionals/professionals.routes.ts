import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { createProfessional, findProfessional, listProfessionals, professionalCreateSchema, professionalIdSchema, professionalListQuerySchema } from './professionals.service.ts';

export const professionalsRoutes = new Hono<AppEnv>();
professionalsRoutes.use('*', requireAuth);
professionalsRoutes.get('/', requirePermission(PERMISSIONS.PROFISSIONAIS_LER), async (c) => c.json(await listProfessionals(readQuery(c, professionalListQuerySchema))));
professionalsRoutes.get('/:id', requirePermission(PERMISSIONS.PROFISSIONAIS_LER), async (c) => { const row = await findProfessional(readParams(c, professionalIdSchema).id); if (!row) throw new NotFoundError('Profissional não encontrado.'); return ok(c, row); });
professionalsRoutes.post('/', requirePermission(PERMISSIONS.PROFISSIONAIS_CRIAR), async (c) => created(c, await createProfessional(await readJson(c, professionalCreateSchema), { actorId: c.get('user').id })));
