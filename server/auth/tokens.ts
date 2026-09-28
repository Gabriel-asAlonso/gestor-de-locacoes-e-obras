/**
 * JWT issuing/verification. Access token is short-lived; refresh token is longer-lived,
 * rotated on every use, and can be revoked (logout). Tokens carry only id + profile —
 * never email, name or any secret.
 *
 * Revocation is persisted in SQLite; the unique JTI claim prevents concurrent refresh reuse.
 */
import { sign, verify } from 'hono/jwt';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config/env.ts';
import { UnauthorizedError } from '../common/errors.ts';
import type { AuthTokenPayload } from '../common/types.ts';
import { consumeToken, isTokenRevoked } from './revocations.repository.ts';

export interface TokenRevocationStore {
  revoke(jti: string, expEpochSeconds: number): boolean;
  isRevoked(jti: string): boolean;
}

export const revocationStore: TokenRevocationStore = { revoke: consumeToken, isRevoked: isTokenRevoked };

const ALG = 'HS256' as const;
const nowSeconds = () => Math.floor(Date.now() / 1000);

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO instant when the access token expires
}

export async function issueTokens(user: { id: string; perfilCodigo: string | null; autorizacaoVersao: number }, identity?: Pick<AuthTokenPayload, 'sid' | 'sessionExp'>): Promise<IssuedTokens> {
  const config = loadConfig();
  const iat = nowSeconds();
  const sid = identity?.sid ?? randomUUID();
  const refreshExp = identity?.sessionExp ?? iat + config.JWT_REFRESH_EXPIRES_IN;
  const accessExp = Math.min(iat + config.JWT_EXPIRES_IN, refreshExp);

  const base = { sub: user.id, perfil: user.perfilCodigo, autorizacaoVersao: user.autorizacaoVersao, sid, sessionExp: refreshExp };
  const accessToken = await sign({ ...base, typ: 'access', jti: randomUUID(), iat, exp: accessExp }, config.JWT_SECRET, ALG);
  const refreshToken = await sign({ ...base, typ: 'refresh', jti: randomUUID(), iat, exp: refreshExp }, config.JWT_REFRESH_SECRET, ALG);

  return { accessToken, refreshToken, expiresAt: new Date(accessExp * 1000).toISOString() };
}

async function verifyToken(token: string, secret: string, expected: 'access' | 'refresh'): Promise<AuthTokenPayload> {
  let payload: AuthTokenPayload;
  try {
    payload = (await verify(token, secret, ALG)) as unknown as AuthTokenPayload;
  } catch {
    throw new UnauthorizedError('Token inválido ou expirado.');
  }
  if (payload.typ !== expected) throw new UnauthorizedError('Tipo de token inválido.');
  if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string' || !/^[0-9a-f-]{36}$/.test(payload.jti)
    || typeof payload.sid !== 'string' || !/^[0-9a-f-]{36}$/.test(payload.sid)
    || !Number.isSafeInteger(payload.autorizacaoVersao) || payload.autorizacaoVersao < 1
    || !Number.isSafeInteger(payload.sessionExp) || payload.sessionExp <= nowSeconds()
    || !Number.isSafeInteger(payload.exp) || payload.exp > payload.sessionExp || !Number.isSafeInteger(payload.iat)) throw new UnauthorizedError('Token inválido.');
  if (revocationStore.isRevoked(payload.jti) || revocationStore.isRevoked(payload.sid)) throw new UnauthorizedError('Token revogado.');
  return payload;
}

export const verifyAccessToken = (token: string) => verifyToken(token, loadConfig().JWT_SECRET, 'access');
export const verifyRefreshToken = (token: string) => verifyToken(token, loadConfig().JWT_REFRESH_SECRET, 'refresh');

/** Adds a token's jti to the denylist until its own expiry (used by logout and refresh rotation). */
export function revokeToken(payload: Pick<AuthTokenPayload, 'jti' | 'exp'>): boolean {
  return revocationStore.revoke(payload.jti, payload.exp);
}

export function revokeSession(payload: Pick<AuthTokenPayload, 'sid' | 'sessionExp'>): void {
  revocationStore.revoke(payload.sid, payload.sessionExp);
}
