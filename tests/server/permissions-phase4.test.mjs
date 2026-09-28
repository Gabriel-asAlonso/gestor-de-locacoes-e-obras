import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, get, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();

async function request(method, path, token, body) {
  const response = await app.request(path, {
    method,
    headers: { ...bearer(token), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

test('fluxo completo de aprovação, autorização, delegação, auditoria e invalidação de sessão', async () => {
  const masterToken = await loginAs(app, ADMIN);

  const registration = await post(app, '/api/auth/register', {
    nome: 'Usuário autorizado', email: 'autorizado@teste.com', senha: 'senha-usuario-1234',
  });
  assert.equal(registration.status, 201);
  const userId = registration.body.id;
  assert.equal((await post(app, '/api/auth/login', { email: 'autorizado@teste.com', senha: 'senha-usuario-1234' })).status, 403);

  const pending = await get(app, '/api/users?status=pendente', bearer(masterToken));
  assert.equal(pending.status, 200);
  assert.ok(pending.body.data.some(user => user.id === userId));
  const initialAccess = await get(app, `/api/users/${userId}/permissions`, bearer(masterToken));
  assert.deepEqual(initialAccess.body.permissoes, []);

  const approved = await request('POST', `/api/users/${userId}/approve`, masterToken, {
    permissoes: ['painel:ler', 'carteiras:ler'],
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, 'ativo');

  const userLogin = await post(app, '/api/auth/login', { email: 'autorizado@teste.com', senha: 'senha-usuario-1234' });
  assert.equal(userLogin.status, 200);
  assert.deepEqual(new Set(userLogin.body.permissoes), new Set(['painel:ler', 'carteiras:ler']));
  const oldUserToken = userLogin.body.token;
  assert.equal((await get(app, '/api/carteiras', bearer(oldUserToken))).status, 200);
  assert.equal((await get(app, '/api/imoveis', bearer(oldUserToken))).status, 403);

  const delegateRegistration = await post(app, '/api/auth/register', {
    nome: 'Gestora delegada', email: 'gestora@teste.com', senha: 'senha-gestora-1234',
  });
  const delegateId = delegateRegistration.body.id;
  const delegatePermissions = ['usuarios:ler', 'usuarios:aprovar', 'permissoes:ler', 'permissoes:editar', 'painel:ler'];
  assert.equal((await request('POST', `/api/users/${delegateId}/approve`, masterToken, { permissoes: delegatePermissions })).status, 200);
  const delegateToken = await loginAs(app, { email: 'gestora@teste.com', senha: 'senha-gestora-1234' });

  const selfEscalation = await request('PUT', `/api/users/${delegateId}/permissions`, delegateToken, {
    permissoes: [...delegatePermissions, 'imoveis:ler'],
  });
  assert.equal(selfEscalation.status, 403);

  const illegalDelegation = await request('PUT', `/api/users/${userId}/permissions`, delegateToken, {
    permissoes: ['imoveis:ler'],
  });
  assert.equal(illegalDelegation.status, 403);

  const changed = await request('PUT', `/api/users/${userId}/permissions`, masterToken, {
    permissoes: ['painel:ler', 'imoveis:ler'],
  });
  assert.equal(changed.status, 200);
  assert.deepEqual(new Set(changed.body.permissoes), new Set(['painel:ler', 'imoveis:ler']));
  assert.equal((await get(app, '/api/auth/me', bearer(oldUserToken))).status, 401);

  const renewedUserToken = await loginAs(app, { email: 'autorizado@teste.com', senha: 'senha-usuario-1234' });
  assert.equal((await get(app, '/api/carteiras', bearer(renewedUserToken))).status, 403);
  assert.equal((await get(app, '/api/imoveis', bearer(renewedUserToken))).status, 200);

  assert.equal((await request('POST', `/api/users/${userId}/deactivate`, masterToken)).status, 200);
  assert.equal((await get(app, '/api/auth/me', bearer(renewedUserToken))).status, 401);
  assert.equal((await post(app, '/api/auth/login', { email: 'autorizado@teste.com', senha: 'senha-usuario-1234' })).status, 403);
  assert.equal((await request('POST', `/api/users/${userId}/activate`, masterToken)).status, 200);
  assert.equal((await post(app, '/api/auth/login', { email: 'autorizado@teste.com', senha: 'senha-usuario-1234' })).status, 200);

  const rejectedRegistration = await post(app, '/api/auth/register', {
    nome: 'Usuário rejeitado', email: 'rejeitado@teste.com', senha: 'senha-rejeitada-1234',
  });
  assert.equal((await request('POST', `/api/users/${rejectedRegistration.body.id}/reject`, masterToken)).status, 200);
  assert.equal((await post(app, '/api/auth/login', { email: 'rejeitado@teste.com', senha: 'senha-rejeitada-1234' })).status, 403);

  const { withRead } = await import('../../server/database/connection.ts');
  const { auditoria_eventos } = await import('../../db/schema.ts');
  const audits = await withRead(db => db.select().from(auditoria_eventos));
  const permissionAudits = audits.filter(event => event.entidade === 'usuario_permissoes');
  assert.ok(permissionAudits.some(event => event.operacao === 'grant' && event.ator_usuario_id));
  assert.ok(permissionAudits.some(event => event.operacao === 'revoke' && event.ator_usuario_id));
  assert.ok(audits.some(event => event.motivo === 'Aprovação de solicitação de acesso'));
  assert.ok(audits.some(event => event.motivo === 'Rejeição de solicitação de acesso'));
});
