/**
 * Standardised request validation. Handlers call these helpers with a Zod schema;
 * invalid input is rejected with a 400 VALIDACAO before any business logic runs.
 * `.strict()` schemas reject unknown/extra properties (mass-assignment protection).
 */
import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { ValidationError } from './errors.ts';
import { zodIssuesToDetails } from './zod.ts';

export async function readJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ValidationError('Corpo da requisição ausente ou não é um JSON válido.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError('Dados inválidos.', zodIssuesToDetails(parsed.error));
  return parsed.data;
}

export function readQuery<T>(c: Context, schema: ZodType<T>): T {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) throw new ValidationError('Parâmetros de consulta inválidos.', zodIssuesToDetails(parsed.error));
  return parsed.data;
}

export function readParams<T>(c: Context, schema: ZodType<T>): T {
  const parsed = schema.safeParse(c.req.param());
  if (!parsed.success) throw new ValidationError('Parâmetro de rota inválido.', zodIssuesToDetails(parsed.error));
  return parsed.data;
}
