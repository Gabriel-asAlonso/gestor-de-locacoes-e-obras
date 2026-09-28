import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.APP_ENV ||= 'test';
process.env.LOG_LEVEL ||= 'error';
process.env.JWT_SECRET ||= 'test-access-secret-0123456789abcdef-xyz';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-0123456789abcdef-xyz';
process.env.DATABASE_PATH = join(tmpdir(), `locacoes-dbtest-${randomUUID()}.sqlite`);

const { migrate, migrationFiles } = await import('../../db/migrations.ts');
const { openSqlite } = await import('../../db/local.ts');
const { pingDatabase, assertSchemaReady } = await import('../../server/database/connection.ts');

test('banco vazio: assertSchemaReady falha claramente (migrations não aplicadas)', async () => {
  await assert.rejects(() => assertSchemaReady(), /migrations|usuarios/i);
});

test('migrations criam o schema a partir do zero', () => {
  const sqlite = openSqlite();
  try {
    const applied = migrate(sqlite);
    assert.ok(applied.length >= 1);
    assert.equal(applied.length, migrationFiles().length);
    const tables = sqlite
      .prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type='table' AND substr(name,1,2)!='__' AND substr(name,1,7)!='sqlite_'")
      .get();
    assert.equal(tables.n, 39); // inclui a associação explícita usuário-permissão da Fase 4
  } finally {
    sqlite.close();
  }
});

test('após migrations: conexão responde e schema está pronto', async () => {
  assert.equal(await pingDatabase(), true);
  await assert.doesNotReject(() => assertSchemaReady());
});
