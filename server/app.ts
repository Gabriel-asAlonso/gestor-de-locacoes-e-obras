/**
 * Builds the Hono application: global middleware, routes and the centralised error
 * handling. Kept pure (no server start) so tests can exercise it via `app.request(...)`.
 */
import { Hono } from 'hono';
import type { AppEnv } from './common/types.ts';
import { requestLogger } from './common/request-logger.ts';
import { corsMiddleware, secureHeadersMiddleware, bodyLimitMiddleware } from './common/security.ts';
import { errorHandler, notFoundHandler } from './common/error-handler.ts';
import { authRoutes } from './auth/auth.routes.ts';
import { usersRoutes } from './users/users.routes.ts';
import { healthRoutes } from './health/health.routes.ts';
import { permissionsRoutes } from './permissions/permissions.routes.ts';
import { registerModules } from './modules/index.ts';
import { logsRoutes } from './logs/logs.routes.ts';

export function buildApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  app.use('*', requestLogger);
  app.use('*', secureHeadersMiddleware());
  app.use('*', corsMiddleware());
  app.use('*', bodyLimitMiddleware());

  app.route('/health', healthRoutes);

  const api = new Hono<AppEnv>();
  api.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });
  api.route('/auth', authRoutes);
  api.route('/users', usersRoutes);
  api.route('/permissions', permissionsRoutes);
  api.route('/logs', logsRoutes);
  registerModules(api);
  app.route('/api', api);

  return app;
}
