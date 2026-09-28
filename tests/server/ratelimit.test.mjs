import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.APP_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef-xyz';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef-xyz';
process.env.AUTH_RATE_LIMIT_MAX = '3';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
process.env.DATABASE_PATH = join(tmpdir(), `locacoes-rl-${randomUUID()}.sqlite`);

const { migrate } = await import('../../db/migrations.ts');
const { openSqlite } = await import('../../db/local.ts');
const { createUser } = await import('../../server/users/users.service.ts');
const { buildApp } = await import('../../server/app.ts');

const sqlite = openSqlite();
try {
  migrate(sqlite);
} finally {
  sqlite.close();
}
await createUser({ nome: 'Admin', email: 'admin@rl.com', senha: 'senha-admin-1234', perfilCodigo: 'administrador', ativo: true }, { system: 'test:rl' });
const app = buildApp();

const attempt = () =>
  app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@rl.com', senha: 'senha-errada' }),
  });

test('/auth/login limita tentativas abusivas com 429', async () => {
  const statuses = [];
  for (let i = 0; i < 4; i += 1) statuses.push((await attempt()).status);
  // With max=3, the first three are processed (401) and the fourth is throttled (429).
  assert.deepEqual(statuses.slice(0, 3), [401, 401, 401]);
  assert.equal(statuses[3], 429);
});
