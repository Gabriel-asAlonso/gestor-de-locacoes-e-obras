import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, get, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);
const auth = bearer(token);
const carteira = (await post(app, '/api/carteiras', { nome: 'Carteira G10', titularNome: 'T', titularDocumento: '10' }, auth)).body;
const imovel = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Ed G10', endereco: 'Rua G10' }, auth)).body;
const prof = (await post(app, '/api/profissionais', { nome: 'Responsável G10' }, auth)).body;
const work = (await post(app, '/api/obras', {
  titulo: 'Obra G10', imovelId: imovel.id, responsavelProfissionalId: prof.id,
  descricao: 'Escopo G10', inicioPrevisto: '2026-09-01', terminoPrevisto: '2026-12-01', orcamento: '30000.00',
}, auth)).body;
const financePath = `/api/obras/${work.id}/financeiro`;
const journalPath = `/api/obras/${work.id}/diario`;
const pendingPath = `/api/obras/${work.id}/pendencias`;

test('financeiro: consulta vazia e resumo do painel não inventam movimentos', async () => {
  const finance = await get(app, financePath, auth);
  assert.equal(finance.status, 200);
  assert.equal(finance.body.caixaDisponivel, '0.00');
  assert.deepEqual(finance.body.entradas, []);
  const all = await get(app, '/api/obras/financeiro-resumo', auth);
  assert.equal(all.status, 200);
  assert.equal(all.body.data.find((row) => row.obraId === work.id).caixaDisponivel, '0.00');
});

test('financeiro: alocação é compromisso, pagamento fornecedor é saída real', async () => {
  const allocation = await post(app, `/api/obras/${work.id}/equipe`, {
    profissionalId: prof.id, funcao: 'Encarregado', modalidade: 'horas', quantidade: '10.00', valorUnitario: '30.00',
  }, auth);
  assert.equal(allocation.status, 201, JSON.stringify(allocation.body));
  const contracts = await post(app, `/api/obras/${work.id}/contratacoes`, {
    fornecedorNome: 'Fornecedor G10', descricao: 'Serviço G10', valorContratado: '1000.00',
    dataContratacao: '2026-09-05', vencimento: '2026-10-05',
  }, auth);
  assert.equal(contracts.status, 201, JSON.stringify(contracts.body));
  const contractId = contracts.body.data.find((row) => row.descricao === 'Serviço G10').id;
  const pay = await post(app, `/api/obras/${work.id}/contratacoes/${contractId}/pagamentos`, {
    dataPagamento: '2026-09-06', valor: '200.00',
  }, auth);
  assert.equal(pay.status, 201, JSON.stringify(pay.body));
  const finance = (await get(app, financePath, auth)).body;
  assert.equal(finance.equipeCusto, '300.00');
  assert.equal(finance.fornecedoresContratado, '1000.00');
  assert.equal(finance.fornecedoresPago, '200.00');
  assert.equal(finance.fornecedoresPendente, '800.00');
  assert.equal(finance.caixaDisponivel, '-200.00');
  assert.ok((await get(app, journalPath, auth)).body.data.some((row) => row.titulo.includes('Pagamento')));
});

test('ajuste: grava, recarrega e estorna sem apagar o histórico', async () => {
  const before = (await get(app, journalPath, auth)).body.data.length;
  const created = await post(app, `${financePath}/ajustes-caixa`, {
    dataMovimento: '2026-09-07', descricao: 'Conferência G10', valorAssinado: '500.00',
  }, auth);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.caixaDisponivel, '300.00');
  const adjustment = created.body.entradas.find((row) => row.descricao === 'Conferência G10');
  assert.ok(adjustment?.id);
  assert.equal((await get(app, financePath, auth)).body.caixaDisponivel, '300.00');
  const reversed = await post(app, `${financePath}/ajustes-caixa/${adjustment.id}/estornar`, { motivo: 'Duplicado' }, auth);
  assert.equal(reversed.status, 200, JSON.stringify(reversed.body));
  assert.equal(reversed.body.caixaDisponivel, '-200.00');
  assert.equal(reversed.body.entradas.filter((row) => row.tipo === 'ajuste').length, 2);
  assert.equal((await get(app, `${financePath}/ajustes-caixa`, auth)).body.data.length, 2);
  assert.equal((await get(app, journalPath, auth)).body.data.length, before + 2);
  assert.equal((await post(app, `${financePath}/ajustes-caixa/${adjustment.id}/estornar`, { motivo: 'Outra vez' }, auth)).status, 422);
});

test('diário: registro com progresso e pendência persistem após nova consulta', async () => {
  const created = await post(app, journalPath, {
    tipo: 'pendencia', titulo: 'Decisão G10', descricao: 'Aguardar aprovação',
    progressoRegistrado: '35.00', proximaAtividadeDescricao: 'Solicitar aprovação',
  }, auth);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.titulo, 'Decisão G10');
  assert.match(created.body.ocorridoEm, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal((await get(app, `/api/obras/${work.id}`, auth)).body.progressoPercentual, '35.00');
  assert.ok((await get(app, journalPath, auth)).body.data.some((row) => row.id === created.body.id));
  const pending = (await get(app, pendingPath, auth)).body.data.find((row) => row.titulo === 'Decisão G10');
  assert.ok(pending?.id);
  const resolved = await post(app, `${pendingPath}/${pending.id}/resolver`, {}, auth);
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  assert.ok(!resolved.body.data.some((row) => row.id === pending.id));
  assert.ok((await get(app, journalPath, auth)).body.data.some((row) => row.titulo === 'Pendência resolvida'));
});

test('diário: bytes do arquivo vinculado podem ser baixados após nova consulta', async () => {
  const created = await post(app, journalPath, { tipo: 'arquivo', titulo: 'Comprovante G10', descricao: 'Anexo real' }, auth);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const body = new FormData();
  body.set('arquivo', new File([new Uint8Array([37, 80, 68, 70, 45, 49])], 'registro.pdf', { type: 'application/pdf' }));
  const uploaded = await app.request(`${journalPath}/${created.body.id}/documentos`, { method: 'POST', headers: auth, body });
  assert.equal(uploaded.status, 201, await uploaded.text());
  const reloaded = (await get(app, `${journalPath}/${created.body.id}`, auth)).body;
  assert.equal(reloaded.arquivos[0].nome, 'registro.pdf');
  const download = await app.request(`/api/documentos/${reloaded.arquivos[0].id}/conteudo`, { headers: auth });
  assert.equal(download.status, 200);
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), new Uint8Array([37, 80, 68, 70, 45, 49]));
});

test('painel: atenção e agenda vêm de atividade/pêndencia reais, sem fixtures fixas', async () => {
  const activity = await post(app, `/api/obras/${work.id}/atividades`, {
    etapa: 'execucao', titulo: 'Marco G10', responsavelProfissionalId: prof.id,
    inicio: '2026-09-05', termino: '2026-09-10',
  }, auth);
  assert.equal(activity.status, 201, JSON.stringify(activity.body));
  const pending = await post(app, pendingPath, { titulo: 'Pendência do painel G10', descricao: 'Decidir escopo', severidade: 'critica' }, auth);
  assert.equal(pending.status, 201, JSON.stringify(pending.body));
  const panel = await get(app, '/api/obras/painel', auth);
  assert.equal(panel.status, 200, JSON.stringify(panel.body));
  assert.ok(panel.body.attentions.some((row) => row.workId === work.codigo && row.title === 'Pendência do painel G10'));
  assert.ok(panel.body.commitments.some((row) => row.workId === work.codigo && row.title === 'Marco G10'));
  assert.ok(!panel.body.attentions.some((row) => row.workId === 'OBR-002'));
  assert.match(panel.body.positionDateIso, /^\d{4}-\d{2}-\d{2}$/);
});

test('validação e permissões: payload inválido e ausência de sessão não alteram o banco', async () => {
  const before = (await get(app, financePath, auth)).body.entradas.length;
  assert.equal((await post(app, `${financePath}/ajustes-caixa`, {
    dataMovimento: '2026-09-07', descricao: 'Zero', valorAssinado: '0.00',
  }, auth)).status, 400);
  assert.equal((await get(app, financePath, auth)).body.entradas.length, before);
  assert.equal((await get(app, financePath)).status, 401);
  assert.equal((await get(app, journalPath)).status, 401);
  assert.equal((await post(app, journalPath, { tipo: 'atualizacao', titulo: 'X', descricao: 'Y' })).status, 401);
});
