import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError, REFRESH_STORAGE_KEY } from '../../app/services/api-client.ts';
import { prepare, ADMIN, INACTIVE } from '../server/setup.mjs';
const { app, admin } = await prepare();

function client(options = {}) {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const calls = [];
  const fetchApp = (path, init) => { calls.push(path); return app.request(path, init); };
  return { data, calls, storage, api: new ApiClient({ baseUrl: '/api', storage: () => storage, fetch: fetchApp, ...options }), fetchApp };
}

test('cliente → Hono → SQLite: login, me, reload, rotação e logout real', async () => {
  const { api, data, storage, fetchApp } = client();
  const session = await api.login(ADMIN.email, ADMIN.senha);
  assert.equal(session.usuario.id, admin.id);
  assert.equal((await api.request('/auth/me')).usuario.id, admin.id);
  assert.deepEqual([...data.keys()], [REFRESH_STORAGE_KEY]);
  assert.ok(!JSON.stringify([...data]).includes(ADMIN.senha));
  const initialRefresh = data.get(REFRESH_STORAGE_KEY);
  const reloaded = new ApiClient({ baseUrl: '/api', storage: () => storage, fetch: fetchApp });
  assert.equal((await reloaded.restore()).usuario.id, admin.id);
  assert.notEqual(data.get(REFRESH_STORAGE_KEY), initialRefresh);
  await reloaded.logout();
  assert.equal(data.size, 0);
  assert.equal(await new ApiClient({ baseUrl: '/api', storage: () => storage }).restore(), null);
  await assert.rejects(api.request('/auth/me'), error => error.status === 401);
});

test('sem credenciais não há fallback mock; inativo continua sem acesso', async () => {
  const { api, data } = client();
  await assert.rejects(api.login(ADMIN.email, 'errada'), error => error.status === 401 && error.message === 'Credenciais inválidas.');
  await assert.rejects(api.login(INACTIVE.email, INACTIVE.senha), error => error.status === 403);
  assert.equal(data.size, 0);
});

test('cadastro público retorna pendente e não cria sessão no cliente', async () => {
  const { api, data } = client();
  const result = await api.register({ nome: 'Cadastro Cliente', email: 'cliente@teste.com', senha: 'senha-cliente-123' });
  assert.equal(result.status, 'pendente');
  assert.equal(result.email, 'cliente@teste.com');
  assert.equal(data.size, 0);
  await assert.rejects(api.login('cliente@teste.com', 'senha-cliente-123'), error => error.status === 403 && /aguardando aprovação/i.test(error.message));
  assert.equal(data.size, 0);
});

test('restauração concorrente usa um único refresh e publica somente informações públicas', async () => {
  const { api, storage, fetchApp } = client();
  await api.login(ADMIN.email, ADMIN.senha);
  let refreshes = 0;
  const reloaded = new ApiClient({ baseUrl: '/api', storage: () => storage, fetch: (url, init) => {
    if (url.endsWith('/refresh')) refreshes++;
    return fetchApp(url, init);
  } });
  let published;
  reloaded.subscribe(value => { published = value; });
  const values = await Promise.all([reloaded.restore(), reloaded.restore(), reloaded.restore()]);
  assert.ok(values.every(value => value.usuario.id === admin.id));
  assert.equal(refreshes, 1);
  assert.equal(published.token, undefined);
  assert.equal(published.refreshToken, undefined);
});

test('401 concorrentes renovam uma vez; 403 não tenta refresh', async () => {
  let rejectAccess = true;
  let refreshes = 0;
  const { api } = client({ fetch: async (url, init) => {
    if (url.endsWith('/refresh')) { refreshes++; rejectAccess = false; }
    if (url.endsWith('/auth/me') && rejectAccess) return Response.json({ error: { code: 'NAO_AUTENTICADO', message: 'Token expirado.' } }, { status: 401 });
    if (url.endsWith('/forbidden')) return Response.json({ error: { message: 'Sem permissão.' } }, { status: 403 });
    return app.request(url, init);
  } });
  await api.login(ADMIN.email, ADMIN.senha);
  assert.ok((await Promise.all([api.request('/auth/me'), api.request('/auth/me')])).every(value => value.usuario.id === admin.id));
  assert.equal(refreshes, 1);
  await assert.rejects(api.request('/forbidden'), error => error.status === 403);
  assert.equal(refreshes, 1);
});

test('erro interno / HTML / conexão não expõe SQL, stack nem corpo bruto', async () => {
  for (const fakeFetch of [
    async () => Response.json({ error: { message: 'SELECT senha_hash FROM usuarios', details: [{ message: 'stack segredo' }] } }, { status: 500 }),
    async () => new Response('<html>stack</html>', { status: 502 }),
    async () => { throw new TypeError('network secret'); },
  ]) {
    const { api } = client({ fetch: fakeFetch });
    await assert.rejects(api.login(ADMIN.email, ADMIN.senha), error => error instanceof ApiError && !/SELECT|senha_hash|stack|secret/.test(error.message) && error.details.length === 0);
  }
});

test('refresh revogado limpa sessão; falha temporária preserva possibilidade de recuperar', async () => {
  const { api, data, storage } = client();
  await api.login(ADMIN.email, ADMIN.senha);
  const offline = new ApiClient({ baseUrl: '/api', storage: () => storage, fetch: async () => { throw new TypeError('offline'); } });
  await assert.rejects(offline.restore(), error => error.code === 'CONEXAO');
  assert.equal(data.size, 1);
  const denied = new ApiClient({ baseUrl: '/api', storage: () => storage, fetch: async () => Response.json({ error: { message: 'Sessão expirada.' } }, { status: 401 }) });
  await assert.rejects(denied.restore(), error => error.status === 401);
  assert.equal(data.size, 0);
});

test('logout offline limpa somente sessão local e retorna erro em vez de confirmar revogação', async () => {
  let offline = false;
  const { api, data } = client({ fetch: (url, init) => offline ? Promise.reject(new TypeError('offline')) : app.request(url, init) });
  await api.login(ADMIN.email, ADMIN.senha);
  offline = true;
  await assert.rejects(api.logout(), error => error.code === 'CONEXAO');
  assert.equal(data.size, 0);
});

test('storage indisponível não impede login durante a aba; URL absoluta arbitrária é rejeitada', async () => {
  const { api } = client({ storage: () => { throw new Error('disabled'); } });
  assert.equal((await api.login(ADMIN.email, ADMIN.senha)).usuario.id, admin.id);
  await assert.rejects(api.request('https://outro.example/'), /caminho relativo/);
  await api.logout();
});

test('resposta atrasada da sessão anterior não atravessa logout', async () => {
  let finish;
  const pendingResponse = new Promise(resolve => { finish = resolve; });
  const { api } = client({ fetch: (url, init) => url.endsWith('/slow') ? pendingResponse : app.request(url, init) });
  await api.login(ADMIN.email, ADMIN.senha);
  const pending = api.request('/slow');
  await api.logout();
  finish(Response.json({ data: 'somente-da-sessao-anterior' }));
  await assert.rejects(pending, error => error.status === 401);
});

test('logout aguarda refresh em andamento e revoga o token recém-rotacionado', async () => {
  const { api: original, storage, fetchApp } = client();
  await original.login(ADMIN.email, ADMIN.senha);
  let resume;
  const barrier = new Promise(resolve => { resume = resolve; });
  const api = new ApiClient({ baseUrl: '/api', storage: () => storage, fetch: async (url, init) => {
    const result = await fetchApp(url, init);
    if (url.endsWith('/refresh')) await barrier;
    return result;
  } });
  const restoring = api.restore().catch(error => { assert.equal(error.status, 401); });
  const out = api.logout();
  resume();
  await Promise.all([restoring, out]);
  assert.equal(storage.getItem(REFRESH_STORAGE_KEY), null);
  await assert.rejects(original.request('/auth/me'), error => error.status === 401);
});
