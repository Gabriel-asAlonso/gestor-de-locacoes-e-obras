import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { chargeCreateSchema, chargeIdSchema, chargeListQuerySchema } from './dto.ts';
import { createCharge, findCharge, listCharges } from './charges.service.ts';

export const chargesRoutes = new Hono<AppEnv>();
chargesRoutes.use('*', requireAuth);
chargesRoutes.get('/', requirePermission(PERMISSIONS.COBRANCAS_LER), async (c) => c.json(await listCharges(readQuery(c, chargeListQuerySchema))));
chargesRoutes.get('/:id', requirePermission(PERMISSIONS.COBRANCAS_LER), async (c) => { const row = await findCharge(readParams(c, chargeIdSchema).id); if (!row) throw new NotFoundError('Cobrança não encontrada.'); return ok(c, row); });
chargesRoutes.post('/', requirePermission(PERMISSIONS.COBRANCAS_CRIAR), async (c) => created(c, await createCharge(await readJson(c, chargeCreateSchema), { actorId: c.get('user').id })));
