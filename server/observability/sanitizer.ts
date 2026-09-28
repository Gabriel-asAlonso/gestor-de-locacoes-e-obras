const SENSITIVE_KEY = /(?:password|senha|passphrase|authorization|cookie|token|jwt|secret|api[_-]?key|client[_-]?secret|session|credential)/i;
const MAX_DEPTH = 6;
const MAX_ARRAY = 50;
const MAX_KEYS = 100;
const MAX_STRING = 4_000;

function cleanString(value: string): string {
  if (/(?:senha|password|passphrase|authorization|cookie|refresh[_-]?token|access[_-]?token|api[_-]?key|client[_-]?secret|jwt)/i.test(value)) return '[REDACTED_SENSITIVE_TEXT]';
  if (value.length <= MAX_STRING) return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return `${value.slice(0, MAX_STRING)}…[truncated]`;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return cleanString(value);
  if (typeof value === 'symbol' || typeof value === 'function') return `[${typeof value}]`;
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (value instanceof Error) return sanitizeValue({ name: value.name, message: value.message, stack: value.stack, cause: value.cause }, depth + 1, seen);
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map(item => sanitizeValue(item, depth + 1, seen));
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value).slice(0, MAX_KEYS)) {
    output[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeValue(nested, depth + 1, seen);
  }
  return output;
}

export function sanitize(value: unknown): unknown {
  return sanitizeValue(value, 0, new WeakSet());
}

export function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  return sanitize(fields) as Record<string, unknown>;
}
