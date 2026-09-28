/** Shared request-scoped types for the Hono context. */
import type { DomainCode } from '../../db/domains.ts';

export interface AuthTokenPayload {
  sub: string; // usuario.id
  perfil: string | null; // perfil_codigo
  autorizacaoVersao: number;
  typ: 'access' | 'refresh';
  jti: string;
  sid: string; // Stable session identity across refresh rotation.
  sessionExp: number; // Absolute session deadline; refresh cannot extend it.
  iat: number;
  exp: number;
}

/** The safe view of the authenticated user attached to the request. Never carries senha_hash. */
export interface AuthenticatedUser {
  id: string;
  nome: string;
  email: string;
  perfilCodigo: string | null;
  status: DomainCode<'usuarioStatus'>;
  ativo: boolean;
  autorizacaoVersao: number;
}

export interface AppVariables {
  requestId: string;
  user: AuthenticatedUser;
  auth: AuthTokenPayload;
  permissions: string[];
}

/** Bind to Hono via `new Hono<AppEnv>()` so `c.get('user')` etc. are typed. */
export type AppEnv = { Variables: AppVariables };
