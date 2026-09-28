/**
 * Centralised authorization guard. Use after `requireAuth`:
 *   route.post('/', requireAuth, requirePermission(PERMISSIONS.USUARIOS_CRIAR), handler)
 * The check runs on the server for every protected action — hiding a button on the
 * front-end is never a substitute (API contract §11, task item 19).
 */
import type { MiddlewareHandler } from 'hono';
import { ForbiddenError, UnauthorizedError } from '../common/errors.ts';
import { hasPermission } from '../roles/roles.ts';
import type { AppEnv } from '../common/types.ts';
import { logger } from '../common/logger.ts';
import { EVENTS } from '../observability/event-codes.ts';

export function requirePermission(...permissions: string[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) throw new UnauthorizedError('Autenticação necessária.'); // requireAuth must run first
    const granted = c.get('permissions');
    for (const permission of permissions) {
      if (!hasPermission(user.perfilCodigo, granted, permission)) {
        logger.event('warn', 'security', EVENTS.AUTH_PERMISSION_DENIED, 'Tentativa de ação sem permissão.', {
          userId: user.id, requiredPermission: permission, outcome: 'denied', statusCode: 403,
        });
        throw new ForbiddenError('Você não possui permissão para esta ação.');
      }
    }
    await next();
  };
}
