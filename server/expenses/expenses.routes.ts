import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { expenseCreateSchema, expenseIdSchema, expenseListQuerySchema, paymentCreateSchema, paymentParamsSchema, paymentReversalSchema } from './dto.ts';
import { createExpense, findExpense, listExpenses, registerPayment, reversePayment } from './expenses.service.ts';

export const expensesRoutes = new Hono<AppEnv>();
expensesRoutes.use('*', requireAuth);
expensesRoutes.get('/', requirePermission(PERMISSIONS.DESPESAS_LER), async (c) => c.json(await listExpenses(readQuery(c, expenseListQuerySchema))));
expensesRoutes.get('/:id', requirePermission(PERMISSIONS.DESPESAS_LER), async (c) => { const row = await findExpense(readParams(c, expenseIdSchema).id); if (!row) throw new NotFoundError('Despesa não encontrada.'); return ok(c, row); });
expensesRoutes.post('/', requirePermission(PERMISSIONS.DESPESAS_CRIAR), async (c) => created(c, await createExpense(await readJson(c, expenseCreateSchema), { actorId: c.get('user').id })));
expensesRoutes.post('/:id/pagamentos', requirePermission(PERMISSIONS.DESPESAS_PAGAR), async (c) => created(c, await registerPayment(readParams(c, expenseIdSchema).id, await readJson(c, paymentCreateSchema), { actorId: c.get('user').id })));
expensesRoutes.post('/:id/pagamentos/:pagId/estornar', requirePermission(PERMISSIONS.DESPESAS_ESTORNAR), async (c) => { const params = readParams(c, paymentParamsSchema); return ok(c, await reversePayment(params.id, params.pagId, (await readJson(c, paymentReversalSchema)).motivo, { actorId: c.get('user').id })); });
