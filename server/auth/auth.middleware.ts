/**
 * Centralised authentication guard. Protected routes use `requireAuth` instead of
 * checking tokens by hand. It verifies the access token, reloads the user from the DB
 * (so a just-deactivated user is rejected), and attaches the safe user + payload to the
 * request context.
 */
import type { MiddlewareHandler } from 'hono';
import { AppError, ForbiddenError, UnauthorizedError } from '../common/errors.ts';
import { verifyAccessToken } from './tokens.ts';
import { findUserById } from '../users/users.service.ts';
import { toAuthenticatedUser } from '../users/users.mapper.ts';
import type { AppEnv } from '../common/types.ts';
import { ensureUserCanAccess } from './user-access.ts';
import { effectivePermissionsForUser } from '../permissions/permissions.service.ts';
import { enrichRequestContext } from '../observability/context.ts';
import { logger } from '../common/logger.ts';
import { EVENTS } from '../observability/event-codes.ts';

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    const header = (c.req.header('Authorization') ?? '').trim();
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) throw new UnauthorizedError('Credencial de acesso ausente.', 'AUTH_REQUIRED');

    const payload = await verifyAccessToken(match[1]!);
    const row = await findUserById(payload.sub);
    if (!row) throw new UnauthorizedError('Usuário não encontrado.', 'AUTH_USER_NOT_FOUND');
    try { ensureUserCanAccess(row); }
    catch (error) {
      if (error instanceof ForbiddenError) throw new UnauthorizedError('A sessão não possui mais acesso ao sistema.', 'AUTH_SESSION_REVOKED');
      throw error;
    }
    if (payload.autorizacaoVersao !== row.autorizacao_versao) throw new UnauthorizedError('As autorizações da sessão foram atualizadas.', 'AUTHORIZATION_VERSION_CHANGED');

    c.set('user', toAuthenticatedUser(row));
    c.set('auth', payload);
    c.set('permissions', await effectivePermissionsForUser(row));
    enrichRequestContext({ userId: row.id });
    await next();
  } catch (error) {
    logger.event('warn', 'authentication', EVENTS.AUTH_TOKEN_REJECTED, 'Credencial de acesso rejeitada.', {
      outcome: 'denied', reason: error instanceof AppError ? error.code : 'UNKNOWN', statusCode: error instanceof AppError ? error.statusCode : 500,
    });
    throw error;
  }
};
