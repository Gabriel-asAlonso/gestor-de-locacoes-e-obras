/** Assigns a request id and logs each completed request (no bodies, headers or tokens). */
import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';
import { logger } from './logger.ts';
import type { AppEnv } from './types.ts';
import { EVENTS } from '../observability/event-codes.ts';
import { runWithRequestContext } from '../observability/context.ts';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{16,64}$/;

export const requestLogger: MiddlewareHandler<AppEnv> = async (c, next) => {
  const incoming = c.req.header('x-request-id')?.trim();
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  const start = Date.now();
  let failed = false;
  await runWithRequestContext({
    requestId, method: c.req.method, path: c.req.path, origin: 'api', startedAt: start,
    userAgent: c.req.header('user-agent')?.slice(0, 300),
  }, async () => {
    try { await next(); }
    catch (error) { failed = true; throw error; }
    finally {
      logger.event(failed ? 'error' : 'info', 'technical', failed ? EVENTS.HTTP_REQUEST_FAILED : EVENTS.HTTP_REQUEST_COMPLETED,
        failed ? 'Requisição interrompida por erro.' : 'Requisição concluída.', {
          method: c.req.method, route: c.req.path, statusCode: failed ? 500 : c.res.status,
          durationMs: Date.now() - start, outcome: failed ? 'failure' : 'success',
        });
    }
  });
};
