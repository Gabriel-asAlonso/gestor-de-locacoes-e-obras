import { ApiError } from './api-client';
import { apiClient } from './auth.service';

export interface AuditLogRecord {
  id: string; timestamp: string; userId: string | null; actorContext: string | null; actorName: string | null; actorEmail: string | null;
  entity: string; entityId: string | null; compoundKey: Record<string, string> | null; operation: string; reason: string | null;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null; requestId: string | null; eventCode: string | null;
  category: string | null; module: string | null; source: string | null;
}
export interface TechnicalLogRecord {
  id: string; timestamp: string; level: string; type: string; eventCode: string; message: string; requestId?: string; userId?: string;
  module?: string; entity?: string; entityId?: string; route?: string; method?: string; statusCode?: number; durationMs?: number;
  outcome?: string; metadata?: Record<string, unknown>;
}
export interface LogSummary { auditToday: number; errors: number; warnings: number; critical: number; authenticationFailures: number }
export interface PageResult<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const queryString = (filters: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') query.set(key, String(value));
  return query.toString();
};

function pageResult<T>(value: unknown): PageResult<T> {
  if (!isObject(value) || !Array.isArray(value.data) || !isObject(value.pagination)) throw new ApiError('Resposta inválida ao consultar os registros.', 502, 'RESPOSTA_INVALIDA');
  return value as unknown as PageResult<T>;
}

export const logsService = {
  async summary(): Promise<LogSummary> { return apiClient.request<LogSummary>('/logs/summary'); },
  async audit(filters: Record<string, string | number | undefined>): Promise<PageResult<AuditLogRecord>> {
    return pageResult<AuditLogRecord>(await apiClient.request(`/logs/audit?${queryString(filters)}`));
  },
  async technical(filters: Record<string, string | number | undefined>): Promise<PageResult<TechnicalLogRecord>> {
    return pageResult<TechnicalLogRecord>(await apiClient.request(`/logs/technical?${queryString(filters)}`));
  },
};

