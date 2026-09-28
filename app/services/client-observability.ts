import { apiClient } from './auth.service';

const reported = new Map<string, number>();

function shouldReport(signature: string): boolean {
  const now = Date.now();
  const last = reported.get(signature) ?? 0;
  reported.set(signature, now);
  if (reported.size > 100) for (const [key, value] of reported) if (now - value > 60_000) reported.delete(key);
  return now - last > 5_000;
}

export function reportClientError(error: unknown, eventCode: string, metadata?: Record<string, unknown>, componentStack?: string): void {
  const normalized = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Erro desconhecido no frontend.');
  const signature = `${eventCode}:${normalized.name}:${normalized.message}`;
  if (!shouldReport(signature)) return;
  void apiClient.reportClientError({
    eventCode, message: normalized.message, stack: normalized.stack, componentStack,
    route: typeof window === 'undefined' ? undefined : `${window.location.pathname}${window.location.search}`,
    metadata,
  }).catch(() => undefined);
}

