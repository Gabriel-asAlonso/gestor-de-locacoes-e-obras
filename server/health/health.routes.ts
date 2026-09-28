/** Liveness/readiness probe. Reports app status and DB connectivity; no sensitive config. */
import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { pingDatabase } from '../database/connection.ts';

const startedAt = Date.now();

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get('/', async (c) => {
  const dbUp = await pingDatabase();
  return c.json(
    {
      status: dbUp ? 'ok' : 'degraded',
      db: dbUp ? 'up' : 'down',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    },
    dbUp ? 200 : 503,
  );
});
