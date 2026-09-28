import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { readParams, readQuery } from '../common/validation.ts';
import { ok } from '../common/http.ts';
import { clientErrorSchema, logIdParamSchema, logListQuerySchema } from './dto.ts';
import { auditEvent, listAuditEvents, listTechnicalEvents, logSummary, technicalEvent } from './logs.service.ts';
import { logger } from '../common/logger.ts';
import { EVENTS } from '../observability/event-codes.ts';
import { readJson } from '../common/validation.ts';
import { hasPermission } from '../roles/roles.ts';

export const logsRoutes = new Hono<AppEnv>();
logsRoutes.use('*', requireAuth);
logsRoutes.post('/client-errors', async c => {
  const error = await readJson(c, clientErrorSchema);
  logger.event('error', 'technical', EVENTS.CLIENT_UNEXPECTED_ERROR, 'Erro inesperado capturado no frontend.', {
    module: 'frontend', outcome: 'failure', clientEventCode: error.eventCode, clientRoute: error.route,
    error: { message: error.message, stack: error.stack, componentStack: error.componentStack }, metadata: error.metadata,
  });
  return ok(c, { received: true });
});
logsRoutes.get('/summary', requirePermission(PERMISSIONS.LOGS_AUDITORIA_LER), async c => ok(c, await logSummary(
  hasPermission(c.get('user').perfilCodigo, c.get('permissions'), PERMISSIONS.LOGS_TECNICOS_LER),
)));
logsRoutes.get('/audit', requirePermission(PERMISSIONS.LOGS_AUDITORIA_LER), async c => ok(c, await listAuditEvents(readQuery(c, logListQuerySchema))));
logsRoutes.get('/audit/:id', requirePermission(PERMISSIONS.LOGS_AUDITORIA_LER), async c => ok(c, await auditEvent(readParams(c, logIdParamSchema).id)));
logsRoutes.get('/technical', requirePermission(PERMISSIONS.LOGS_TECNICOS_LER), c => ok(c, listTechnicalEvents(readQuery(c, logListQuerySchema))));
logsRoutes.get('/technical/:id', requirePermission(PERMISSIONS.LOGS_TECNICOS_LER), c => ok(c, technicalEvent(readParams(c, logIdParamSchema).id)));
