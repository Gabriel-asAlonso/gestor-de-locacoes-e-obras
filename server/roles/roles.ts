/**
 * Hybrid authorization policy: the structural Master role expands to every stable
 * permission, while regular users receive explicit grants from usuario_permissoes.
 * Callers use only these helpers and never infer access from an e-mail or credential.
 */
import { ALL_PERMISSIONS } from '../permissions/permissions.ts';

const WILDCARD = '*';

/** Master holds every permission; regular users receive explicit database grants. */
const ROLE_POLICY: Readonly<Record<string, ReadonlySet<string>>> = {
  master: new Set([WILDCARD]),
  usuario: new Set(),
};

export const SUPPORTED_ROLES = Object.keys(ROLE_POLICY);

export function roleExists(perfil: string | null | undefined): boolean {
  return typeof perfil === 'string' && perfil in ROLE_POLICY;
}

export function isMasterRole(papel: string | null | undefined): boolean {
  return papel === 'master';
}

export function hasPermission(papel: string | null | undefined, granted: Iterable<string>, permission: string): boolean {
  if (!papel) return false;
  const set = ROLE_POLICY[papel];
  if (!set) return false;
  return set.has(WILDCARD) || new Set(granted).has(permission);
}

/** Concrete effective permission list for login, /auth/me and request guards. */
export function permissionsFor(papel: string | null | undefined, granted: Iterable<string> = []): string[] {
  if (!papel) return [];
  const set = ROLE_POLICY[papel];
  if (!set) return [];
  return set.has(WILDCARD) ? [...ALL_PERMISSIONS] : [...new Set(granted)].filter(code => ALL_PERMISSIONS.includes(code)).sort();
}
