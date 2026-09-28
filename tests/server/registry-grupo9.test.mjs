import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, patch, get, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);
const auth = bearer(token);

const carteira = (await post(app, '/api/carteiras', { nome: 'Carteira G9', titularNome: 'T', titularDocumento: '90' }, auth)).body;
const imovel = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Ed G9', endereco: 'Rua G9' }, auth)).body;
const prof = (await post(app, '/api/profissionais', { nome: 'Resp G9' }, auth)).body;

let counter = 0;
async function newWork() {
  counter += 1;
  return (await post(app, '/api/obras', {
    titulo: `Obra G9-${counter}`, imovelId: imovel.id, responsavelProfissionalId: prof.id, descricao: 'Escopo',
    inicioPrevisto: '2026-07-01', terminoPrevisto: '2026-10-01', orcamento: '100000.00',
  }, auth)).body;
}

// ——— Sócios / participações (E27) ———
test('sócios: lista vazia e vínculo cria participação corrente (SOC-001)', async () => {
  const work = await newWork();
  assert.deepEqual((await get(app, `/api/obras/${work.id}/socios`, auth)).body.data, []);
  const res = await post(app, `/api/obras/${work.id}/socios`, { nome: 'Nexo Participações', percentual: '50.00' }, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].code, 'SOC-001');
  assert.equal(res.body.data[0].name, 'Nexo Participações');
  assert.equal(res.body.data[0].participationPercent, 50);
});

test('sócios: total acima de 100% devolve 422', async () => {
  const work = await newWork();
  await post(app, `/api/obras/${work.id}/socios`, { nome: 'A', percentual: '50.00' }, auth);
  const res = await post(app, `/api/obras/${work.id}/socios`, { nome: 'B', percentual: '60.00' }, auth);
  assert.equal(res.status, 422, JSON.stringify(res.body));
});

test('sócios: mesmo sócio já vinculado devolve 409', async () => {
  const work = await newWork();
  await post(app, `/api/obras/${work.id}/socios`, { nome: 'Nexo Participações', percentual: '50.00' }, auth);
  const res = await post(app, `/api/obras/${work.id}/socios`, { nome: 'Nexo Participações', percentual: '20.00' }, auth);
  assert.equal(res.status, 409, JSON.stringify(res.body));
});

test('sócios: editar participação cria nova versão e respeita o teto de 100%', async () => {
  const work = await newWork();
  const a = (await post(app, `/api/obras/${work.id}/socios`, { nome: 'A', percentual: '50.00' }, auth)).body.data[0];
  await post(app, `/api/obras/${work.id}/socios`, { nome: 'B', percentual: '50.00' }, auth);
  const edit = await patch(app, `/api/obras/${work.id}/socios/${a.id}`, { percentual: '30.00' }, auth);
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  const list = edit.body.data;
  assert.equal(list.find((row) => row.id === a.id).participationPercent, 30);
  assert.equal(list.reduce((sum, row) => sum + row.participationPercent, 0), 80);
  // Elevar B para 80 (total 110) é barrado.
  const b = list.find((row) => row.name === 'B');
  const over = await patch(app, `/api/obras/${work.id}/socios/${b.id}`, { percentual: '80.00' }, auth);
  assert.equal(over.status, 422);
});

test('sócios: remoção lógica retira da distribuição corrente', async () => {
  const work = await newWork();
  const a = (await post(app, `/api/obras/${work.id}/socios`, { nome: 'A', percentual: '50.00' }, auth)).body.data[0];
  await post(app, `/api/obras/${work.id}/socios`, { nome: 'B', percentual: '50.00' }, auth);
  const res = await app.request(`/api/obras/${work.id}/socios/${a.id}`, { method: 'DELETE', headers: auth });
  assert.equal(res.status, 200);
  const list = (await res.json()).data;
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'B');
});

// ——— Aportes, cotas (rateio) e pagamentos (E29–E32) ———
test('aporte: exige 100% de participação e reparte com no máximo 1 centavo de diferença', async () => {
  const work = await newWork();
  await post(app, `/api/obras/${work.id}/socios`, { nome: 'A', percentual: '50.00' }, auth);
  const partial = await post(app, `/api/obras/${work.id}/aportes`, { descricao: 'Capital', valorSolicitado: '100.00', dataSolicitacao: '2026-07-10' }, auth);
  assert.equal(partial.status, 422, 'aporte sem 100% deve falhar');
  await post(app, `/api/obras/${work.id}/socios`, { nome: 'B', percentual: '50.00' }, auth);
  const res = await post(app, `/api/obras/${work.id}/aportes`, { descricao: 'Capital', valorSolicitado: '100.01', dataSolicitacao: '2026-07-10' }, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const aporte = res.body.data[0];
  assert.match(aporte.id, /^APT-\d+$/);
  assert.equal(aporte.amount, 100.01);
  const soma = aporte.shares.reduce((sum, share) => sum + share.amountDue, 0);
  assert.ok(Math.abs(soma - 100.01) < 0.001, `soma das cotas ${soma}`);
  for (const share of aporte.shares) assert.ok(Math.abs(share.amountDue - 50.005) <= 0.01, `cota ${share.amountDue} dentro de 1 centavo`);
});

test('aporte: pagamento parcial reduz o saldo e excesso devolve 422', async () => {
  const work = await newWork();
  await post(app, `/api/obras/${work.id}/socios`, { nome: 'Solo', percentual: '100.00' }, auth);
  const aporte = (await post(app, `/api/obras/${work.id}/aportes`, { descricao: 'Único', valorSolicitado: '1000.00', dataSolicitacao: '2026-07-10' }, auth)).body.data[0];
  const cotaId = aporte.shares[0].cotaId;
  const pay = await post(app, `/api/obras/${work.id}/aportes/${aporte.databaseId}/cotas/${cotaId}/pagamentos`, { valor: '400.00', dataPagamento: '2026-07-15' }, auth);
  assert.equal(pay.status, 201, JSON.stringify(pay.body));
  const paidShare = pay.body.data[0].shares[0];
  assert.equal(paidShare.payments.reduce((sum, p) => sum + p.amount, 0), 400);
  const over = await post(app, `/api/obras/${work.id}/aportes/${aporte.databaseId}/cotas/${cotaId}/pagamentos`, { valor: '700.00', dataPagamento: '2026-07-16' }, auth);
  assert.equal(over.status, 422, 'pagamento acima do saldo deve falhar');
});

test('aportes/sócios: sem autenticação devolve 401', async () => {
  const work = await newWork();
  assert.equal((await get(app, `/api/obras/${work.id}/socios`)).status, 401);
  assert.equal((await get(app, `/api/obras/${work.id}/aportes`)).status, 401);
});
