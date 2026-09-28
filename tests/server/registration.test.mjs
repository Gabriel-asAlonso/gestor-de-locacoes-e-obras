import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post } from './setup.mjs';
import { findUserByEmail } from '../../server/users/users.service.ts';
import { verifyPassword } from '../../server/auth/password.ts';

const { app } = await prepare();

test('cadastro público cria usuário pendente sem perfil, sessão ou senha exposta', async () => {
  const senha = 'senha-segura-123';
  const response = await post(app, '/api/auth/register', {
    nome: 'Pessoa Pendente',
    email: ' PENDENTE@EXEMPLO.COM ',
    senha,
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.email, 'pendente@exemplo.com');
  assert.equal(response.body.status, 'pendente');
  assert.equal(response.body.token, undefined);
  assert.equal(response.body.refreshToken, undefined);
  assert.equal(response.body.perfilCodigo, undefined);
  assert.equal(response.body.ativo, undefined);
  assert.ok(!JSON.stringify(response.body).includes(senha));

  const row = await findUserByEmail('pendente@exemplo.com');
  assert.equal(row.status, 'pendente');
  assert.equal(row.ativo, false);
  assert.equal(row.perfil_codigo, null);
  assert.notEqual(row.senha_hash, senha);
  assert.equal(await verifyPassword(senha, row.senha_hash), true);

  const login = await post(app, '/api/auth/login', { email: row.email, senha });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.message, 'Cadastro aguardando aprovação.');
});

test('cadastro público bloqueia duplicidade e campos administrativos', async () => {
  const duplicate = await post(app, '/api/auth/register', {
    nome: 'Outra Pessoa',
    email: 'pendente@exemplo.com',
    senha: 'outra-senha-123',
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.details[0].field, 'email');

  for (const field of ['status', 'ativo', 'perfilCodigo', 'permissoes']) {
    const response = await post(app, '/api/auth/register', {
      nome: 'Campo Indevido',
      email: `${field.toLowerCase()}@exemplo.com`,
      senha: 'senha-segura-123',
      [field]: field === 'ativo' ? true : 'administrador',
    });
    assert.equal(response.status, 400, field);
    assert.equal(await findUserByEmail(`${field.toLowerCase()}@exemplo.com`), null);
  }
});
