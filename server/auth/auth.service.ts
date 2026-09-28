/**
 * Authentication flow: login → issue tokens; refresh → rotate; logout → revoke.
 * Only safe information is returned. Login failure is uniform (never reveals whether
 * the e-mail exists).
 */
import { findUserByEmail, findUserById, type UsuarioRow } from '../users/users.service.ts';
import { toPublicUser, type PublicUser } from '../users/users.mapper.ts';
import { verifyPassword } from './password.ts';
import { issueTokens, revokeToken, revokeSession, verifyRefreshToken } from './tokens.ts';
import { ForbiddenError, UnauthorizedError } from '../common/errors.ts';
import { logger } from '../common/logger.ts';
import type { AuthenticatedUser, AuthTokenPayload } from '../common/types.ts';
import { ensureUserCanAccess } from './user-access.ts';
import { effectivePermissionsForUser } from '../permissions/permissions.service.ts';
import { EVENTS } from '../observability/event-codes.ts';

export interface SessionResponse {
  token: string;
  refreshToken: string;
  expiresAt: string;
  usuario: PublicUser;
  permissoes: string[];
}

async function buildSession(row: UsuarioRow, identity?: Pick<AuthTokenPayload, 'sid' | 'sessionExp'>): Promise<SessionResponse> {
  const tokens = await issueTokens({ id: row.id, perfilCodigo: row.papel_codigo, autorizacaoVersao: row.autorizacao_versao }, identity);
  return {
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    usuario: toPublicUser(row),
    permissoes: await effectivePermissionsForUser(row),
  };
}

export async function login(email: string, senha: string): Promise<SessionResponse> {
  const row = await findUserByEmail(email);
  // Uniform failure regardless of whether the user exists or the password is wrong.
  if (!row || !(await verifyPassword(senha, row.senha_hash))) {
    logger.event('warn', 'authentication', EVENTS.AUTH_LOGIN_FAILED, 'Tentativa de login inválida.', { outcome: 'denied' });
    throw new UnauthorizedError('Credenciais inválidas.');
  }
  ensureUserCanAccess(row);
  logger.event('info', 'authentication', EVENTS.AUTH_LOGIN_SUCCEEDED, 'Usuário autenticado com sucesso.', { userId: row.id, outcome: 'success' });
  return buildSession(row);
}

export async function refresh(refreshToken: string): Promise<SessionResponse> {
  const payload = await verifyRefreshToken(refreshToken);
  const row = await findUserById(payload.sub);
  if (!row) throw new UnauthorizedError('Usuário não encontrado.');
  ensureUserCanAccess(row);
  if (!revokeToken(payload)) throw new UnauthorizedError('Token revogado.');
  logger.event('info', 'authentication', EVENTS.AUTH_TOKEN_REFRESHED, 'Token de sessão renovado.', { userId: row.id, outcome: 'success' });
  return buildSession(row, payload);
}

export async function logout(accessPayload: AuthTokenPayload, refreshToken?: string): Promise<void> {
  if (refreshToken) {
    try {
      const refreshPayload = await verifyRefreshToken(refreshToken);
      if (refreshPayload.sub !== accessPayload.sub || refreshPayload.sid !== accessPayload.sid) throw new ForbiddenError('Token não pertence à sessão atual.');
      revokeToken(refreshPayload);
    } catch (error) {
      // Already-invalid refresh tokens cannot recover a session; DB failures must propagate.
      if (!(error instanceof UnauthorizedError)) throw error;
    }
  }
  revokeSession(accessPayload);
  revokeToken(accessPayload);
  logger.event('info', 'authentication', EVENTS.AUTH_LOGOUT, 'Sessão encerrada.', { userId: accessPayload.sub, outcome: 'success' });
}

export function sessionInfo(user: AuthenticatedUser, permissoes: string[]): { usuario: AuthenticatedUser; permissoes: string[] } {
  return { usuario: user, permissoes };
}
