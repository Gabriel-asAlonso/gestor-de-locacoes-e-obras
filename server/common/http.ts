/** Response helpers so every handler returns the same envelope shape (API contract §2.3). */
import type { Context } from 'hono';
import type { ErrorDetail } from './errors.ts';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Single resource: the object is returned directly. */
export const ok = <T>(c: Context, data: T, status = 200) => c.json(data as object, status as never);

export const created = <T>(c: Context, data: T) => c.json(data as object, 201);

export const noContent = (c: Context) => c.body(null, 204);

/**
 * Collection: always wrapped in `{ data }`. Pagination is optional (the front does
 * not paginate today); the `pagination` block appears only when provided.
 */
export const collection = <T>(c: Context, data: T[], pagination?: Pagination) =>
  c.json(pagination ? { data, pagination } : { data });

export interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: ErrorDetail[] };
  requestId?: string;
}

export function errorBody(code: string, message: string, details: ErrorDetail[], requestId?: string): ErrorBody {
  const body: ErrorBody = { success: false, error: { code, message } };
  if (details.length) body.error.details = details;
  if (requestId) body.requestId = requestId;
  return body;
}
