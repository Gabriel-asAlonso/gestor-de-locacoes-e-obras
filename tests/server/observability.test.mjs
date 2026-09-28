import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, get, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();
const { logger, recentLogEvents } = await import('../../server/common/logger.ts');
const { withRead } = await import('../../server/database/connection.ts');
const { auditoria_eventos } = await import('../../db/schema.ts');
const { eq } = await import('drizzle-orm');

test('logger sanitiza recursivamente segredos, arrays, erros e campos reservados', () => {
  logger.error('TEST_SANITIZATION', {
    password: 'aberta', nested: { refreshToken: 'token-aberto', ok: 'valor' },
    rows: [{ apiKey: 'chave' }], error: new Error('senha do banco = segredo'), level: 'forjado',
  }, 'Teste de sanitização.');
  const event = recentLogEvents().at(-1);
  const serialized = JSON.stringify(event);
  assert.equal(event.level, 'error');
  assert.match(serialized, /\[REDACTED\]/);
  assert.doesNotMatch(serialized, /aberta|token-aberto|chave|senha do banco|segredo|forjado/);
});

test('request ID atravessa resposta, transação e consulta de auditoria', async () => {
  const requestId = 'trace-observability-00000001';
  const registration = await post(app, '/api/auth/register', {
    nome: 'Pessoa rastreável', email: 'rastreavel@teste.com', senha: 'senha-segura-1234',
  }, { 'x-request-id': requestId });
  assert.equal(registration.status, 201);
  assert.equal(registration.res.headers.get('x-request-id'), requestId);
  const rows = await withRead(db => db.select().from(auditoria_eventos).where(eq(auditoria_eventos.registro_id, registration.body.id)));
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.request_id === requestId));
  assert.ok(rows.every(row => row.event_code === 'AUDIT_SOLICITACAO_PUBLICA_DE_ACESSO'));
  assert.ok(rows.every(row => row.origem === 'api'));

  const token = await loginAs(app, ADMIN);
  const listed = await get(app, `/api/logs/audit?requestId=${requestId}`, bearer(token));
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.some(row => row.requestId === requestId));
});

test('request ID inválido ou excessivo é substituído', async () => {
  const response = await app.request('/health', { headers: { 'x-request-id': 'curto' } });
  assert.notEqual(response.headers.get('x-request-id'), 'curto');
  assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
});
