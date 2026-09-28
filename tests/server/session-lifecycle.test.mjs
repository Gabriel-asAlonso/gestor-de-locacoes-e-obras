import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fork } from 'node:child_process';
import { decode } from 'hono/jwt';
import { prepare, post, get, bearer, ADMIN } from './setup.mjs';
const { app, admin } = await prepare();
const login = () => post(app, '/api/auth/login', ADMIN).then(result => result.body);

test('refresh concorrente só emite uma sucessora', async () => {
  const session = await login();
  const results = await Promise.all(Array.from({ length: 5 }, () => post(app, '/api/auth/refresh', { refreshToken: session.refreshToken })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 401, 401, 401, 401]);
});

test('logout aguarda e revoga toda a sessão, inclusive access anterior à rotação', async () => {
  const session = await login();
  const rotated = (await post(app, '/api/auth/refresh', { refreshToken: session.refreshToken })).body;
  const result = await post(app, '/api/auth/logout', { refreshToken: rotated.refreshToken }, bearer(rotated.token));
  assert.equal(result.status, 200);
  assert.equal((await get(app, '/api/auth/me', bearer(session.token))).status, 401);
  assert.equal((await get(app, '/api/auth/me', bearer(rotated.token))).status, 401);
  assert.equal((await post(app, '/api/auth/refresh', { refreshToken: rotated.refreshToken })).status, 401);
});

test('logout concorrente com refresh não deixa sucessora utilizável', async () => {
  const session = await login();
  const [rotation, out] = await Promise.all([
    post(app, '/api/auth/refresh', { refreshToken: session.refreshToken }),
    post(app, '/api/auth/logout', { refreshToken: session.refreshToken }, bearer(session.token)),
  ]);
  assert.equal(out.status, 200);
  if (rotation.status === 200) {
    assert.equal((await get(app, '/api/auth/me', bearer(rotation.body.token))).status, 401);
    assert.equal((await post(app, '/api/auth/refresh', { refreshToken: rotation.body.refreshToken })).status, 401);
  } else assert.equal(rotation.status, 401);
});

test('logout não pode revogar outra sessão; schema rejeita campo inesperado', async () => {
  const first = await login();
  const second = await login();
  assert.equal((await post(app, '/api/auth/logout', { refreshToken: second.refreshToken }, bearer(first.token))).status, 403);
  assert.equal((await get(app, '/api/auth/me', bearer(second.token))).status, 200);
  assert.equal((await post(app, '/api/auth/logout', { usuarioId: admin.id }, bearer(first.token))).status, 400);
});

test('refresh preserva prazo absoluto e respostas de sessão nunca são cacheadas', async () => {
  const session = await login();
  const rotated = await post(app, '/api/auth/refresh', { refreshToken: session.refreshToken });
  assert.equal(decode(rotated.body.refreshToken).payload.sessionExp, decode(session.refreshToken).payload.sessionExp);
  assert.equal(decode(rotated.body.token).payload.sid, decode(session.token).payload.sid);
  assert.equal(rotated.res.headers.get('cache-control'), 'no-store');
});

async function start() {
  const child = fork(new URL('../helpers/auth-http-server.mjs', import.meta.url), [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const [message] = await once(child, 'message');
  return { child, base: `http://127.0.0.1:${message.port}` };
}
async function stop(child) { const done = once(child, 'exit'); child.send('stop'); await done; }

test('HTTP + banco persistem usuário, sessão e logout entre processos reiniciados', { timeout: 20000 }, async () => {
  let server = await start();
  const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const session = await fetch(`${server.base}/api/auth/login`, json(ADMIN)).then(r => r.json());
    await stop(server.child);
    server = await start();
    const me = await fetch(`${server.base}/api/auth/me`, { headers: bearer(session.token) });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).usuario.id, admin.id);
    const out = await fetch(`${server.base}/api/auth/logout`, { ...json({ refreshToken: session.refreshToken }), headers: { ...json({}).headers, ...bearer(session.token) } });
    assert.equal(out.status, 200);
    await stop(server.child);
    server = await start();
    assert.equal((await fetch(`${server.base}/api/auth/me`, { headers: bearer(session.token) })).status, 401);
    assert.equal((await fetch(`${server.base}/api/auth/refresh`, json({ refreshToken: session.refreshToken }))).status, 401);
  } finally { if (server.child.connected) await stop(server.child); }
});
