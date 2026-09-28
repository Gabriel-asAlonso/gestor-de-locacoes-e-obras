import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, get, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);
const auth = bearer(token);

const carteira = (await post(app, '/api/carteiras', { nome: 'Carteira G7', titularNome: 'T', titularDocumento: '70' }, auth)).body;
const imovel = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Ed G7', endereco: 'Rua G7' }, auth)).body;
const prof = (await post(app, '/api/profissionais', { nome: 'Marina Costa' }, auth)).body;
const work = (await post(app, '/api/obras', {
  titulo: 'Obra G7', imovelId: imovel.id, responsavelProfissionalId: prof.id, descricao: 'Escopo',
  inicioPrevisto: '2026-07-01', terminoPrevisto: '2026-10-01', orcamento: '100000.00',
}, auth)).body;

const activityBody = { etapa: 'preparacao', titulo: 'Mobilização do canteiro', responsavelProfissionalId: prof.id, inicio: '2026-07-02', termino: '2026-07-10' };

test('atividade: cria (201) com código local e estado inicial', async () => {
  const res = await post(app, `/api/obras/${work.id}/atividades`, activityBody, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.atividades.length, 1);
  const activity = res.body.atividades[0];
  assert.match(activity.codigo, /^ATV-\d+$/);
  assert.equal(activity.estado, 'nao_iniciada');
  assert.equal(activity.etapa, 'preparacao');
  assert.equal(activity.responsavelNome, 'Marina Costa');
  assert.equal(res.body.obra.id, work.id);
});

test('atividade: término antes do início devolve 400', async () => {
  const res = await post(app, `/api/obras/${work.id}/atividades`, { ...activityBody, termino: '2026-06-01' }, auth);
  assert.equal(res.status, 400);
});

test('atividade: concluir recalcula o progresso da obra e define a próxima', async () => {
  const w = (await post(app, '/api/obras', { titulo: 'Obra prog', imovelId: imovel.id, responsavelProfissionalId: prof.id, descricao: 'x', inicioPrevisto: '2026-07-01', terminoPrevisto: '2026-10-01', orcamento: '50000.00' }, auth)).body;
  const a1 = (await post(app, `/api/obras/${w.id}/atividades`, { ...activityBody, titulo: 'A1', inicio: '2026-07-02', termino: '2026-07-05' }, auth)).body.atividades.find((a) => a.titulo === 'A1');
  await post(app, `/api/obras/${w.id}/atividades`, { ...activityBody, titulo: 'A2', inicio: '2026-07-06', termino: '2026-07-09' }, auth);

  const done = await post(app, `/api/obras/${w.id}/atividades/${a1.id}/concluir`, {}, auth);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.obra.progressoPercentual, '50.00');       // 1 de 2 concluídas
  assert.equal(done.body.obra.proximaAtividadeDescricao, 'A2');
  assert.equal(done.body.atividades.find((a) => a.titulo === 'A1').estado, 'concluida');
});

test('atividade: bloquear exige motivo (422) e registra o motivo', async () => {
  const created = (await post(app, `/api/obras/${work.id}/atividades`, { ...activityBody, titulo: 'A bloqueio' }, auth)).body;
  const activity = created.atividades.find((a) => a.titulo === 'A bloqueio');

  const semMotivo = await post(app, `/api/obras/${work.id}/atividades/${activity.id}/bloquear`, {}, auth);
  assert.equal(semMotivo.status, 400);   // motivo ausente falha na validação do corpo

  const res = await post(app, `/api/obras/${work.id}/atividades/${activity.id}/bloquear`, { motivo: 'Falta de material' }, auth);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const blocked = res.body.atividades.find((a) => a.id === activity.id);
  assert.equal(blocked.estado, 'bloqueada');
  assert.equal(blocked.motivoBloqueio, 'Falta de material');
});

test('atividade: reprogramar altera o término e valida a ordem das datas', async () => {
  const created = (await post(app, `/api/obras/${work.id}/atividades`, { ...activityBody, titulo: 'A reprog', inicio: '2026-07-02', termino: '2026-07-10' }, auth)).body;
  const activity = created.atividades.find((a) => a.titulo === 'A reprog');

  const invalido = await post(app, `/api/obras/${work.id}/atividades/${activity.id}/reprogramar`, { novoTermino: '2026-06-01', justificativa: 'x' }, auth);
  assert.equal(invalido.status, 422);

  const res = await post(app, `/api/obras/${work.id}/atividades/${activity.id}/reprogramar`, { novoTermino: '2026-07-20', justificativa: 'Chuvas' }, auth);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.atividades.find((a) => a.id === activity.id).termino, '2026-07-20');
});

test('atividade: concluir de outra obra devolve 404', async () => {
  const other = (await post(app, '/api/obras', { titulo: 'Outra', imovelId: imovel.id, responsavelProfissionalId: prof.id, descricao: 'x', inicioPrevisto: '2026-07-01', terminoPrevisto: '2026-10-01', orcamento: '10000.00' }, auth)).body;
  const activity = (await post(app, `/api/obras/${work.id}/atividades`, { ...activityBody, titulo: 'Isolada' }, auth)).body.atividades.find((a) => a.titulo === 'Isolada');
  const res = await post(app, `/api/obras/${other.id}/atividades/${activity.id}/concluir`, {}, auth);
  assert.equal(res.status, 404);
});

test('atividade: lista sem autenticação devolve 401', async () => {
  const res = await get(app, `/api/obras/${work.id}/atividades`);
  assert.equal(res.status, 401);
});
