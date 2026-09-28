import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { readJson, readParams } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { adjustmentCreateSchema, adjustmentParams, adjustmentReverseSchema, workFinanceParams } from './dto.ts';
import { createAdjustment, listAdjustments, reverseAdjustment, workFinance } from './finance.service.ts';

export const financeRoutes = new Hono<AppEnv>();
financeRoutes.use('*', requireAuth);
financeRoutes.get('/', requirePermission(PERMISSIONS.OBRAS_LER), async (c) => ok(c, await workFinance(readParams(c, workFinanceParams).obraId)));
financeRoutes.get('/ajustes-caixa', requirePermission(PERMISSIONS.OBRAS_LER), async (c) => c.json(await listAdjustments(readParams(c, workFinanceParams).obraId)));
financeRoutes.post('/ajustes-caixa', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => created(c, await createAdjustment(readParams(c, workFinanceParams).obraId, await readJson(c, adjustmentCreateSchema), { actorId: c.get('user').id })));
financeRoutes.post('/ajustes-caixa/:id/estornar', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => {
  const params = readParams(c, adjustmentParams);
  return ok(c, await reverseAdjustment(params.obraId, params.id, (await readJson(c, adjustmentReverseSchema)).motivo, { actorId: c.get('user').id }));
});
