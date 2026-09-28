import test from 'node:test';
import assert from 'node:assert/strict';

process.env.APP_ENV ||= 'test';
process.env.LOG_LEVEL ||= 'error';
process.env.JWT_SECRET ||= 'test-access-secret-0123456789abcdef-xyz';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-0123456789abcdef-xyz';

const { Hono } = await import('hono');
const { errorHandler, notFoundHandler } = await import('../../server/common/error-handler.ts');
const errors = await import('../../server/common/errors.ts');

const app = new Hono();
app.onError(errorHandler);
app.notFound(notFoundHandler);
app.get('/validacao', () => {
  throw new errors.ValidationError('Dados inválidos.', [{ field: 'a', message: 'obrigatório' }]);
});
app.get('/naoauth', () => {
  throw new errors.UnauthorizedError();
});
app.get('/semperm', () => {
  throw new errors.ForbiddenError();
});
app.get('/naoencontrado', () => {
  throw new errors.NotFoundError();
});
app.get('/conflito', () => {
  throw new errors.ConflictError();
});
app.get('/regra', () => {
  throw new errors.BusinessRuleError();
});
app.get('/limite', () => {
  throw new errors.TooManyRequestsError();
});
app.get('/interno', () => {
  throw new Error('SEGREDO: senha do banco = 123 em /caminho/interno.sql');
});

const cases = [
  ['/validacao', 400, 'VALIDACAO'],
  ['/naoauth', 401, 'NAO_AUTENTICADO'],
  ['/semperm', 403, 'SEM_PERMISSAO'],
  ['/naoencontrado', 404, 'NAO_ENCONTRADO'],
  ['/conflito', 409, 'CONFLITO'],
  ['/regra', 422, 'REGRA_NEGOCIO'],
  ['/limite', 429, 'MUITAS_TENTATIVAS'],
];

for (const [path, status, code] of cases) {
  test(`${code} → HTTP ${status} no envelope padrão`, async () => {
    const res = await app.request(path);
    assert.equal(res.status, status);
    const body = await res.json();
    assert.equal(body.error.code, code);
    assert.equal(typeof body.error.message, 'string');
  });
}

test('erro inesperado → 500 sem vazar detalhes internos', async () => {
  const res = await app.request('/interno');
  assert.equal(res.status, 500);
  const raw = JSON.stringify(await res.json());
  assert.match(raw, /ERRO_INTERNO/);
  assert.doesNotMatch(raw, /SEGREDO|senha do banco|\.sql/);
});

test('rota inexistente → 404 no mesmo envelope', async () => {
  const res = await app.request('/rota-que-nao-existe');
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, 'NAO_ENCONTRADO');
});

test('todo erro segue o formato único { error: { code, message } }', async () => {
  const res = await app.request('/conflito');
  const body = await res.json();
  assert.ok(body.error && typeof body.error.code === 'string' && typeof body.error.message === 'string');
});
