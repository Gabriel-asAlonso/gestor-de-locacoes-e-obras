import { and, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { auditoria_eventos, usuarios } from '../../db/schema.ts';
import { withRead } from '../database/connection.ts';
import { recentLogEvents } from '../common/logger.ts';
import { NotFoundError } from '../common/errors.ts';
import type { LogListQuery } from './dto.ts';

const auditConditions = (query: LogListQuery): SQL[] => {
  const conditions: SQL[] = [];
  if (query.from) conditions.push(gte(auditoria_eventos.ocorrido_em, query.from));
  if (query.to) conditions.push(lte(auditoria_eventos.ocorrido_em, query.to));
  if (query.userId) conditions.push(eq(auditoria_eventos.ator_usuario_id, query.userId));
  if (query.eventCode) conditions.push(eq(auditoria_eventos.event_code, query.eventCode));
  if (query.entity) conditions.push(eq(auditoria_eventos.entidade, query.entity));
  if (query.operation) conditions.push(eq(auditoria_eventos.operacao, query.operation));
  if (query.requestId) conditions.push(eq(auditoria_eventos.request_id, query.requestId));
  return conditions;
};

const auditSelect = {
  id: auditoria_eventos.id, timestamp: auditoria_eventos.ocorrido_em, userId: auditoria_eventos.ator_usuario_id,
  actorContext: auditoria_eventos.contexto_ator, actorName: usuarios.nome, actorEmail: usuarios.email,
  entity: auditoria_eventos.entidade, entityId: auditoria_eventos.registro_id, compoundKey: auditoria_eventos.chave_composta,
  operation: auditoria_eventos.operacao, reason: auditoria_eventos.motivo, before: auditoria_eventos.antes,
  after: auditoria_eventos.depois, requestId: auditoria_eventos.request_id, eventCode: auditoria_eventos.event_code,
  category: auditoria_eventos.categoria, module: auditoria_eventos.modulo, source: auditoria_eventos.origem,
};

export async function listAuditEvents(query: LogListQuery) {
  const conditions = auditConditions(query);
  const where = conditions.length ? and(...conditions) : undefined;
  return withRead(async db => {
    const [rows, totals] = await Promise.all([
      db.select(auditSelect).from(auditoria_eventos).leftJoin(usuarios, eq(auditoria_eventos.ator_usuario_id, usuarios.id))
        .where(where).orderBy(desc(auditoria_eventos.ocorrido_em), desc(auditoria_eventos.id))
        .limit(query.limit).offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(auditoria_eventos).where(where),
    ]);
    const total = totals[0]?.value ?? 0;
    return { data: rows, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  });
}

export async function auditEvent(id: string) {
  const rows = await withRead(db => db.select(auditSelect).from(auditoria_eventos)
    .leftJoin(usuarios, eq(auditoria_eventos.ator_usuario_id, usuarios.id)).where(eq(auditoria_eventos.id, id)).limit(1));
  if (!rows[0]) throw new NotFoundError('Evento de auditoria não encontrado.');
  return rows[0];
}

export function listTechnicalEvents(query: LogListQuery) {
  const filtered = [...recentLogEvents()].reverse().filter(event => {
    if (query.from && event.timestamp < query.from) return false;
    if (query.to && event.timestamp > query.to) return false;
    if (query.userId && event.userId !== query.userId) return false;
    if (query.level && event.level !== query.level) return false;
    if (query.type && event.type !== query.type) return false;
    if (query.eventCode && event.eventCode !== query.eventCode) return false;
    if (query.entity && event.entity !== query.entity) return false;
    if (query.requestId && event.requestId !== query.requestId) return false;
    return true;
  });
  const start = (query.page - 1) * query.limit;
  return { data: filtered.slice(start, start + query.limit), pagination: {
    page: query.page, limit: query.limit, total: filtered.length, totalPages: Math.ceil(filtered.length / query.limit),
  } };
}

export function technicalEvent(id: string) {
  const event = recentLogEvents().find(item => item.id === id);
  if (!event) throw new NotFoundError('Log técnico não encontrado ou já removido da memória.');
  return event;
}

export async function logSummary(includeTechnical: boolean) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const auditToday = await withRead(db => db.select({ value: count() }).from(auditoria_eventos).where(gte(auditoria_eventos.ocorrido_em, today.toISOString())));
  const current = recentLogEvents();
  return {
    auditToday: auditToday[0]?.value ?? 0,
    errors: includeTechnical ? current.filter(event => event.level === 'error').length : 0,
    warnings: includeTechnical ? current.filter(event => event.level === 'warn').length : 0,
    critical: includeTechnical ? current.filter(event => event.level === 'critical').length : 0,
    authenticationFailures: includeTechnical ? current.filter(event => event.eventCode === 'AUTH_LOGIN_FAILED').length : 0,
  };
}
