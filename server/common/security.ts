/**
 * HTTP security middleware, configured per environment:
 *  - CORS: only configured origins; production never falls back to a permissive list.
 *  - secure headers: sensible defaults from Hono.
 *  - body limit: rejects oversized payloads.
 *  - rate limit: throttles abusive bursts on /auth/login and /auth/refresh.
 */
import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { getConnInfo } from '@hono/node-server/conninfo';
import { loadConfig } from '../config/env.ts';
import { AppError, TooManyRequestsError } from './errors.ts';
import type { AppEnv } from './types.ts';
import { logger } from './logger.ts';
import { EVENTS } from '../observability/event-codes.ts';

export function corsMiddleware(): MiddlewareHandler {
  const config = loadConfig();
  const origins = config.corsOrigins.length
    ? config.corsOrigins
    : config.isProduction
      ? [] // production must configure CORS_ORIGINS explicitly; no permissive default
      : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'];
  return cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 600,
  });
}

export function secureHeadersMiddleware(): MiddlewareHandler {
  return secureHeaders();
}

export function bodyLimitMiddleware(): MiddlewareHandler {
  const config = loadConfig();
  return bodyLimit({
    maxSize: config.BODY_LIMIT_BYTES,
    onError: () => {
      throw new AppError(413, 'PAYLOAD_MUITO_GRANDE', 'Payload excede o limite permitido.');
    },
  });
}

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

/** Fixed-window, in-memory rate limiter keyed by client IP (foundation level). */
export function authRateLimit(): MiddlewareHandler<AppEnv> {
  const { AUTH_RATE_LIMIT_MAX: max, AUTH_RATE_LIMIT_WINDOW_MS: windowMs } = loadConfig();
  return async (c, next) => {
    const key = clientIp(c);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      logger.event('warn', 'security', EVENTS.SECURITY_RATE_LIMITED, 'Limite de tentativas excedido.', {
        route: c.req.path, method: c.req.method, outcome: 'denied', retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
      });
      throw new TooManyRequestsError();
    }
    await next();
  };
}

function clientIp(c: Parameters<MiddlewareHandler>[0]): string {
  try {
    const address = getConnInfo(c).remote.address;
    if (address) return address;
  } catch {
    // conninfo not available (e.g. non-node adapter) — fall back to headers
  }
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return c.req.header('x-real-ip') ?? 'unknown';
}
