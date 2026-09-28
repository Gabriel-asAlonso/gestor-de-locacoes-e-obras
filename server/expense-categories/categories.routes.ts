import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../common/types.ts';
import { readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { listExpenseCategories } from './categories.service.ts';

const querySchema = z.object({ search: z.string().trim().max(200).optional() }).strict();

export const expenseCategoriesRoutes = new Hono<AppEnv>();
expenseCategoriesRoutes.use('*', requireAuth);
expenseCategoriesRoutes.get('/', requirePermission(PERMISSIONS.CATEGORIAS_DESPESA_LER), async (c) => c.json(await listExpenseCategories(readQuery(c, querySchema).search)));
