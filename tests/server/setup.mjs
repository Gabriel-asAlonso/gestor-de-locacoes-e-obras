/**
 * Shared test setup: an isolated, migrated temp SQLite database, test env, an admin
 * and an inactive user, and the built app. node --test runs each test FILE in its own
 * process, so the env/DB here are private to the file that imports this module.
 */
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.APP_ENV ||= 'test';
process.env.LOG_LEVEL ||= 'error';
process.env.JWT_SECRET ||= 'test-access-secret-0123456789abcdef-xyz';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-0123456789abcdef-xyz';
process.env.JWT_EXPIRES_IN ||= '15m';
process.env.JWT_REFRESH_EXPIRES_IN ||= '7d';
// Functional suites must not fight the shared rate-limit bucket; the limiter has its own test.
process.env.AUTH_RATE_LIMIT_MAX ||= '10000';
process.env.DATABASE_PATH = join(tmpdir(), `locacoes-test-${randomUUID()}.sqlite`);
process.env.UPLOADS_PATH = join(tmpdir(), `locacoes-uploads-${randomUUID()}`);

const { migrate } = await import('../../db/migrations.ts');
const { openSqlite } = await import('../../db/local.ts');
const { createUser } = await import('../../server/users/users.service.ts');
const { buildApp } = await import('../../server/app.ts');

export const ADMIN = { email: 'admin@teste.com', senha: 'senha-admin-1234' };
export const INACTIVE = { email: 'inativo@teste.com', senha: 'senha-inativa-1234' };

export async function prepare() {
  const sqlite = openSqlite();
  try {
    migrate(sqlite);
  } finally {
    sqlite.close();
  }
  const admin = await createUser(
    { nome: 'Administrador', email: ADMIN.email, senha: ADMIN.senha, perfilCodigo: 'administrador', status: 'ativo' },
    { system: 'test:admin' },
  );
  const inactive = await createUser(
    { nome: 'Inativo', email: INACTIVE.email, senha: INACTIVE.senha, perfilCodigo: null, status: 'inativo' },
    { system: 'test:inactive' },
  );
  return { app: buildApp(), admin, inactive };
}

const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export async function post(app, path, body, headers = {}) {
  const res = await app.request(path, { ...json(body), headers: { ...json(body).headers, ...headers } });
  return { status: res.status, body: await res.json().catch(() => null), res };
}

export async function patch(app, path, body, headers = {}) {
  const res = await app.request(path, { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null), res };
}

export async function get(app, path, headers = {}) {
  const res = await app.request(path, { headers });
  return { status: res.status, body: await res.json().catch(() => null), res };
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

export async function loginAs(app, creds) {
  const { body } = await post(app, '/api/auth/login', { email: creds.email, senha: creds.senha });
  return body.token;
}
