/** Central structured logger with deep redaction and a bounded recent-event store. */
import { loadConfig } from '../config/env.ts';
import { requestContext } from '../observability/context.ts';
import { sanitizeFields } from '../observability/sanitizer.ts';
import { randomUUID } from 'node:crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogType = 'technical' | 'authentication' | 'security' | 'business' | 'audit';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, critical: 50 };
const RESERVED = new Set(['timestamp', 'level', 'type', 'eventCode', 'message', 'requestId']);

export interface LogEvent {
  id: string; timestamp: string; level: LogLevel; type: LogType; eventCode: string; message: string;
  requestId?: string; userId?: string; source: 'backend'; module?: string; entity?: string; entityId?: string;
  route?: string; method?: string; statusCode?: number; durationMs?: number; outcome?: 'success' | 'failure' | 'denied';
  metadata?: Record<string, unknown>;
}

const recent: LogEvent[] = [];
const RECENT_LIMIT = 1_000;

function threshold(): number {
  try {
    return ORDER[loadConfig().LOG_LEVEL];
  } catch {
    return ORDER.info; // logging must never crash because config is not ready yet
  }
}

function emit(level: LogLevel, eventCode: string, message: string, fields: Record<string, unknown> = {}, type: LogType = 'technical'): void {
  if (ORDER[level] < threshold()) return;
  const context = requestContext();
  const safe = sanitizeFields(fields);
  for (const key of RESERVED) delete safe[key];
  const known: Record<string, unknown> = {};
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(safe)) {
    if (['userId', 'module', 'entity', 'entityId', 'route', 'method', 'statusCode', 'durationMs', 'outcome'].includes(key)) known[key] = value;
    else if (value !== undefined) metadata[key] = value;
  }
  const event: LogEvent = {
    id: randomUUID(), timestamp: new Date().toISOString(), level, type, eventCode, message,
    requestId: context?.requestId,
    userId: (known['userId'] as string | undefined) ?? context?.userId,
    source: 'backend',
    module: known['module'] as string | undefined,
    entity: known['entity'] as string | undefined,
    entityId: known['entityId'] as string | undefined,
    route: (known['route'] as string | undefined) ?? context?.path,
    method: (known['method'] as string | undefined) ?? context?.method,
    statusCode: known['statusCode'] as number | undefined,
    durationMs: known['durationMs'] as number | undefined,
    outcome: known['outcome'] as LogEvent['outcome'],
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
  recent.push(event);
  if (recent.length > RECENT_LIMIT) recent.splice(0, recent.length - RECENT_LIMIT);
  const line = JSON.stringify(event);
  if (level === 'warn' || level === 'error' || level === 'critical') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

const technical = (level: LogLevel) => (eventCode: string, fields?: Record<string, unknown>, message = eventCode) => emit(level, eventCode, message, fields);

export const logger = {
  debug: technical('debug'), info: technical('info'), warn: technical('warn'), error: technical('error'), critical: technical('critical'),
  event: (level: LogLevel, type: LogType, eventCode: string, message: string, fields?: Record<string, unknown>) => emit(level, eventCode, message, fields, type),
};

export function recentLogEvents(): readonly LogEvent[] { return recent; }
