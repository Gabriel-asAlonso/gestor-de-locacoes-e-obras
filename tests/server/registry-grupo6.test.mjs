import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, patch, get, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);
const auth = bearer(token);

const carteira = (await post(app, '/api/carteiras', { nome: 'Carteira G6', titularNome: 'T', titularDocumento: '60' }, auth)).body;
const imovel = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Ed G6', endereco: 'Rua G6' }, auth)).body;
const imovel2 = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Ed G6 B', endereco: 'Rua G6 B' }, auth)).body;
const unit = (await post(app, '/api/unidades', { imovelId: imovel.id, nome: 'Galpão 01', areaPrivativa: '120.00' }, auth)).body;
const unitOther = (await post(app, '/api/unidades', { imovelId: imovel2.id, nome: 'Sala X', areaPrivativa: '20.00' }, auth)).body;
const prof = (await post(app, '/api/profissionais', { nome: 'Rafael Almeida' }, auth)).body;

const baseWork = {
  titulo: 'Reforma da cobertura', imovelId: imovel.id, responsavelProfissionalId: prof.id, descricao: 'Impermeabilização e telhado',
  inicioPrevisto: '2026-07-08', terminoPrevisto: '2026-09-05', orcamento: '185000.00', unidadeId: unit.id, prioridade: 'alta',
};

test('profissional: cria (201) só com nome', () => {
  assert.match(prof.id, /[0-9a-f-]{36}/);
  assert.equal(prof.nome, 'Rafael Almeida');
});

test('obra: cria (201) com código, vínculos e estado planejada', async () => {
  const res = await post(app, '/api/obras', baseWork, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.codigo, /^OBR-\d+$/);
  assert.equal(res.body.estado, 'planejada');
  assert.equal(res.body.imovelNome, 'Ed G6');
  assert.equal(res.body.unidadeNome, 'Galpão 01');
  assert.equal(res.body.responsavelNome, 'Rafael Almeida');
  assert.equal(res.body.orcamento, '185000.00');
  assert.equal(res.body.progressoPercentual, '0.00');
});

test('obra: sem descrição devolve 400', async () => {
  const res = await post(app, '/api/obras', { ...baseWork, descricao: '' }, auth);
  assert.equal(res.status, 400);
});

test('obra: término antes do início devolve 400', async () => {
  const res = await post(app, '/api/obras', { ...baseWork, terminoPrevisto: '2026-06-01' }, auth);
  assert.equal(res.status, 400);
});

test('obra: unidade de outro imóvel devolve 422', async () => {
  const res = await post(app, '/api/obras', { ...baseWork, unidadeId: unitOther.id }, auth);
  assert.equal(res.status, 422);
});

test('obra: profissional inexistente devolve 404', async () => {
  const res = await post(app, '/api/obras', { ...baseWork, responsavelProfissionalId: '00000000-0000-4000-8000-000000000000' }, auth);
  assert.equal(res.status, 404);
});

test('obra: edição (PATCH) altera cadastro', async () => {
  const work = (await post(app, '/api/obras', baseWork, auth)).body;
  const res = await patch(app, `/api/obras/${work.id}`, { titulo: 'Reforma revisada', orcamento: '190000.00' }, auth);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.titulo, 'Reforma revisada');
  assert.equal(res.body.orcamento, '190000.00');
});

test('obra: progresso atualiza percentual e próxima atividade', async () => {
  const work = (await post(app, '/api/obras', baseWork, auth)).body;
  const res = await post(app, `/api/obras/${work.id}/progresso`, { progressoPercentual: '50.00', proximaAtividadeDescricao: 'Setor B' }, auth);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.progressoPercentual, '50.00');
  assert.equal(res.body.proximaAtividadeDescricao, 'Setor B');
});

test('obra: transição planejada→concluida direta é bloqueada (422)', async () => {
  const work = (await post(app, '/api/obras', baseWork, auth)).body;
  const res = await post(app, `/api/obras/${work.id}/estado`, { estado: 'concluida' }, auth);
  assert.equal(res.status, 422);
});

test('obra: iniciar e concluir fecha em 100% e trava progresso', async () => {
  const work = (await post(app, '/api/obras', baseWork, auth)).body;
  const started = await post(app, `/api/obras/${work.id}/estado`, { estado: 'em_andamento' }, auth);
  assert.equal(started.status, 200);
  assert.equal(started.body.estado, 'em_andamento');

  const done = await post(app, `/api/obras/${work.id}/estado`, { estado: 'concluida', motivo: 'Entrega final' }, auth);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.estado, 'concluida');
  assert.equal(done.body.progressoPercentual, '100.00');

  const blocked = await post(app, `/api/obras/${work.id}/progresso`, { progressoPercentual: '80.00' }, auth);
  assert.equal(blocked.status, 422);
});

test('obra: lista filtra por estado', async () => {
  const res = await get(app, '/api/obras?estado=planejada', auth);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((work) => work.estado === 'planejada'));
});

test('obra: sem autenticação devolve 401', async () => {
  const res = await get(app, '/api/obras');
  assert.equal(res.status, 401);
});
