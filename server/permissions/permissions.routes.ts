import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from './authorize.middleware.ts';
import { ALL_PERMISSIONS, PERMISSIONS } from './permissions.ts';
import { ok } from '../common/http.ts';

export const permissionsRoutes = new Hono<AppEnv>();

permissionsRoutes.use('*', requireAuth);
permissionsRoutes.get('/', requirePermission(PERMISSIONS.PERMISSOES_LER), (c) => ok(c, { data: ALL_PERMISSIONS }));
