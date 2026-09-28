/**
 * Single place that turns any thrown error into the standardised envelope.
 * Internal details (stack, SQL, file paths, ORM internals) never reach the client —
 * they go to the logs. Unexpected errors become a safe 500.
 */
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { AppError, InternalError, NotFoundError, ValidationError } from './errors.ts';
import { errorBody } from './http.ts';
import { logger } from './logger.ts';
import { zodIssuesToDetails } from './zod.ts';
import { loadConfig } from '../config/env.ts';
import { EVENTS } from '../observability/event-codes.ts';

function safeErrorForLog(error: unknown, includeStack: boolean): Record<string, unknown> {
  if (!(error instanceof Error)) return { name: 'UnknownError', message: String(error) };
  if (/failed query|sqlite|constraint failed|database/i.test(error.message)) {
    return { name: error.name, category: 'database_operation' };
  }
  return { name: error.name, message: error.message, stack: includeStack ? error.stack : undefined };
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return new ValidationError('Dados inválidos.', zodIssuesToDetails(err));
  if (err instanceof HTTPException) {
    // Body-limit and other Hono middleware throw these (e.g. 413 payload too large).
    const code = err.status === 413 ? 'PAYLOAD_MUITO_GRANDE' : err.status === 429 ? 'MUITAS_TENTATIVAS' : 'ERRO_HTTP';
    return new AppError(err.status, code, err.message || 'Requisição rejeitada.');
  }
  return new InternalError();
}

export const errorHandler: ErrorHandler = (err, c: Context) => {
  const appError = toAppError(err);
  const requestId = c.get('requestId') as string | undefined;
  const config = safeConfig();

  if (appError.statusCode >= 500) {
    // Log the real cause internally; never expose it.
    logger.event('error', 'technical', EVENTS.API_UNHANDLED_ERROR, 'Erro inesperado ao processar a requisição.', {
      route: c.req.path, method: c.req.method, statusCode: appError.statusCode, outcome: 'failure',
      error: safeErrorForLog(err, !config?.isProduction),
    });
  } else {
    const level = appError.statusCode === 401 || appError.statusCode === 403 || appError.statusCode === 429 ? 'warn' : 'debug';
    logger.event(level, appError.statusCode === 401 || appError.statusCode === 403 || appError.statusCode === 429 ? 'security' : 'technical',
      EVENTS.API_HANDLED_ERROR, 'Requisição rejeitada de forma controlada.', {
        code: appError.code, statusCode: appError.statusCode, route: c.req.path, method: c.req.method, outcome: appError.statusCode === 403 ? 'denied' : 'failure',
      });
  }

  const exposeMessage = appError.expose && !(appError.statusCode >= 500 && config?.isProduction);
  const message = exposeMessage ? appError.message : 'Erro interno.';
  return c.json(errorBody(appError.code, message, appError.details, requestId), appError.statusCode as never);
};

export const notFoundHandler: NotFoundHandler = (c: Context) => {
  const requestId = c.get('requestId') as string | undefined;
  const err = new NotFoundError('Rota não encontrada.');
  return c.json(errorBody(err.code, err.message, err.details, requestId), 404);
};

function safeConfig() {
  try {
    return loadConfig();
  } catch {
    return null;
  }
}
