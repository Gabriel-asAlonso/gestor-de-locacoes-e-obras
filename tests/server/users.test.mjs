import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, get, bearer, loginAs, ADMIN } from './setup.mjs';
import { findUserById } from '../../server/users/users.service.ts';
import { verifyPassword } from '../../server/auth/password.ts';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);

test('cria usuário (201) sem retornar a senha/hash', async () => {
  const { status, body } = await post(
    app,
    '/api/users',
    { nome: 'Novo', email: 'novo@teste.com', senha: 'senha-nova-1234', perfilCodigo: 'usuario', ativo: true },
    bearer(token),
  );
  assert.equal(status, 201);
  assert.ok(body.id);
  assert.equal(body.email, 'novo@teste.com');
  assert.equal(body.senha_hash, undefined);
  assert.equal(body.senha, undefined);
});

test('senha é armazenada com hash seguro (scrypt), nunca em texto', async () => {
  const { body } = await post(
    app,
    '/api/users',
    { nome: 'Hash', email: 'hash@teste.com', senha: 'senha-hash-1234', perfilCodigo: 'usuario', ativo: true },
    bearer(token),
  );
  const row = await findUserById(body.id);
  assert.ok(row.senha_hash.startsWith('scrypt$'));
  assert.notEqual(row.senha_hash, 'senha-hash-1234');
  assert.equal(await verifyPassword('senha-hash-1234', row.senha_hash), true);
  assert.equal(await verifyPassword('errada', row.senha_hash), false);
});

test('e-mail duplicado devolve 409 CONFLITO', async () => {
  const dup = await post(
    app,
    '/api/users',
    { nome: 'Dup', email: ADMIN.email, senha: 'senha-dup-1234', perfilCodigo: 'usuario', ativo: true },
    bearer(token),
  );
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'CONFLITO');
});

test('e-mail duplicado ignora caixa (unicidade normalizada)', async () => {
  const dup = await post(
    app,
    '/api/users',
    { nome: 'Dup2', email: ADMIN.email.toUpperCase(), senha: 'senha-dup-1234', perfilCodigo: 'usuario', ativo: true },
    bearer(token),
  );
  assert.equal(dup.status, 409);
});

test('criar usuário sem autenticação devolve 401', async () => {
  const res = await post(app, '/api/users', {
    nome: 'X',
    email: 'x@teste.com',
    senha: 'senha-1234',
    perfilCodigo: 'usuario',
    ativo: true,
  });
  assert.equal(res.status, 401);
});

test('GET /api/users/:id inexistente devolve 404', async () => {
  const res = await get(app, '/api/users/00000000-0000-4000-8000-000000000000', bearer(token));
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NAO_ENCONTRADO');
});

test('campos controlados pelo sistema são rejeitados (strict)', async () => {
  const res = await post(
    app,
    '/api/users',
    { nome: 'Y', email: 'y@teste.com', senha: 'senha-1234', perfilCodigo: 'usuario', ativo: true, id: 'forjado', createdBy: 'x' },
    bearer(token),
  );
  assert.equal(res.status, 400);
});

test('listagem devolve envelope { data: [...] }', async () => {
  const res = await get(app, '/api/users', bearer(token));
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.every((u) => u.senha_hash === undefined));
  assert.ok(res.body.data.every((u) => ['pendente', 'ativo', 'rejeitado', 'inativo'].includes(u.status)));
  assert.ok(res.body.data.every((u) => typeof u.createdAt === 'string' && typeof u.updatedAt === 'string'));
});
