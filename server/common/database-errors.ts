import { ConflictError } from './errors.ts';

export function isSqliteConstraint(error: unknown, pattern = /constraint failed/i): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (pattern.test(message)) return true;
    current = current instanceof Error ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export function rethrowConflict(error: unknown, message: string): never {
  if (isSqliteConstraint(error, /unique constraint failed/i)) throw new ConflictError(message);
  throw error;
}
