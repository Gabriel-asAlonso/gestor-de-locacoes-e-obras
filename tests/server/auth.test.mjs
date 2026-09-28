import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sign } from 'hono/jwt';
import { prepare, post, get, bearer, loginAs, ADMIN, INACTIVE } from './setup.mjs';
import { hasPermission } from '../../server/roles/roles.ts';

const { app, admin } = await prepare();

test('login válido devolve tokens e usuário sem senha', async () => {
  const { status, body } = await post(app, '/api/auth/login', { email: ADMIN.email, senha: ADMIN.senha });
  assert.equal(status, 200);
  assert.ok(body.token && body.refreshToken && body.expiresAt);
  assert.equal(body.usuario.email, ADMIN.email);
  assert.equal(body.usuario.senha_hash, undefined);
  assert.equal(body.usuario.senhaHash, undefined);
  assert.ok(Array.isArray(body.permissoes) && body.permissoes.includes('usuarios:criar'));
});

test('senha inválida devolve 401 sem revelar o motivo', async () => {
  const { status, body } = await post(app, '/api/auth/login', { email: ADMIN.email, senha: 'errada' });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'NAO_AUTENTICADO');
});

test('usuário inexistente devolve 401', async () => {
  const { status } = await post(app, '/api/auth/login', { email: 'ninguem@teste.com', senha: 'seja-la-o-que-for' });
  assert.equal(status, 401);
});

test('usuário inativo (sem acesso) devolve 403', async () => {
  const { status, body } = await post(app, '/api/auth/login', { email: INACTIVE.email, senha: INACTIVE.senha });
  assert.equal(status, 403);
  assert.equal(body.error.code, 'SEM_PERMISSAO');
});

test('login com payload inválido devolve 400 VALIDACAO', async () => {
  const { status, body } = await post(app, '/api/auth/login', { email: 'nao-e-email', senha: '' });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'VALIDACAO');
  assert.ok(body.error.details.length > 0);
});

test('endpoint protegido sem token devolve 401', async () => {
  const { status } = await get(app, '/api/auth/me');
  assert.equal(status, 401);
});

test('token válido acessa /api/auth/me', async () => {
  const token = await loginAs(app, ADMIN);
  const { status, body } = await get(app, '/api/auth/me', bearer(token));
  assert.equal(status, 200);
  assert.equal(body.usuario.id, admin.id);
  assert.ok(body.permissoes.includes('usuarios:ler'));
});

test('token inválido devolve 401', async () => {
  const { status } = await get(app, '/api/auth/me', bearer('token.invalido.aqui'));
  assert.equal(status, 401);
});

test('token expirado devolve 401', async () => {
  const past = Math.floor(Date.now() / 1000) - 60;
  const expired = await sign(
    { sub: admin.id, perfil: 'administrador', typ: 'access', jti: randomUUID(), iat: past - 60, exp: past },
    process.env.JWT_SECRET,
  );
  const { status } = await get(app, '/api/auth/me', bearer(expired));
  assert.equal(status, 401);
});

test('refresh rotaciona e o refresh anterior é revogado', async () => {
  const login = await post(app, '/api/auth/login', { email: ADMIN.email, senha: ADMIN.senha });
  const first = login.body.refreshToken;
  const refreshed = await post(app, '/api/auth/refresh', { refreshToken: first });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.body.token);
  // reusing the old refresh token must now fail (rotation)
  const reused = await post(app, '/api/auth/refresh', { refreshToken: first });
  assert.equal(reused.status, 401);
});

test('logout revoga o access token atual', async () => {
  const token = await loginAs(app, ADMIN);
  const before = await get(app, '/api/auth/me', bearer(token));
  assert.equal(before.status, 200);
  const out = await post(app, '/api/auth/logout', {}, bearer(token));
  assert.equal(out.status, 200);
  const after = await get(app, '/api/auth/me', bearer(token));
  assert.equal(after.status, 401);
});

test('política de autorização: Master tem tudo e usuário depende de concessão explícita', () => {
  assert.equal(hasPermission('master', [], 'usuarios:criar'), true);
  assert.equal(hasPermission('usuario', ['usuarios:criar'], 'usuarios:criar'), true);
  assert.equal(hasPermission('usuario', [], 'usuarios:criar'), false);
  assert.equal(hasPermission(null, [], 'usuarios:ler'), false);
});
