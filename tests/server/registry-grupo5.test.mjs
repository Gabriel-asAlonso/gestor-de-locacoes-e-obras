import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, get, bearer, loginAs, ADMIN } from './setup.mjs';
import { seed } from '../../db/seed.ts';

const { app } = await prepare();
await seed();                       // categorias de despesa são catálogo semeado (db/seed.ts), não migração
const token = await loginAs(app, ADMIN);
const auth = bearer(token);

const categories = (await get(app, '/api/categorias-despesa', auth)).body.data;
const manutencao = categories.find((category) => category.nome === 'Manutenção');
const supplier = (await post(app, '/api/fornecedores', { nome: 'Manutenção Nova Chave' }, auth)).body;

const baseExpense = { fornecedorId: supplier.id, categoriaId: manutencao?.id, descricao: 'Revisão do portão', valor: '780.00', vencimento: '2026-05-10' };

test('categorias-despesa: catálogo semeado é retornado', () => {
  assert.ok(categories.length >= 7);
  assert.ok(manutencao, 'categoria Manutenção presente');
});

test('fornecedor: cria (201) só com nome', () => {
  assert.match(supplier.id, /[0-9a-f-]{36}/);
  assert.equal(supplier.nome, 'Manutenção Nova Chave');
});

test('despesa: cria (201) com código, saldo e status derivados', async () => {
  const res = await post(app, '/api/despesas', baseExpense, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.codigo, /^PAG-\d+$/);
  assert.equal(res.body.valor, '780.00');
  assert.equal(res.body.pago, '0.00');
  assert.equal(res.body.saldo, '780.00');
  assert.equal(res.body.statusDerivado, 'Vencido');    // vencimento no passado, sem pagamento
  assert.equal(res.body.fornecedorNome, 'Manutenção Nova Chave');
  assert.equal(res.body.categoriaNome, 'Manutenção');
});

test('despesa: fornecedor inexistente devolve 404', async () => {
  const res = await post(app, '/api/despesas', { ...baseExpense, fornecedorId: '00000000-0000-4000-8000-000000000000' }, auth);
  assert.equal(res.status, 404);
});

test('despesa: categoria inexistente devolve 404', async () => {
  const res = await post(app, '/api/despesas', { ...baseExpense, categoriaId: '00000000-0000-4000-8000-000000000000' }, auth);
  assert.equal(res.status, 404);
});

test('pagamento: baixa parcial reduz o saldo mantendo em aberto', async () => {
  const expense = (await post(app, '/api/despesas', { ...baseExpense, vencimento: '2027-03-10' }, auth)).body;
  const pay = await post(app, `/api/despesas/${expense.id}/pagamentos`, { dataPagamento: '2027-03-05', valor: '300.00', formaPagamento: 'pix' }, auth);
  assert.equal(pay.status, 201, JSON.stringify(pay.body));
  const detail = pay.body.expense;
  assert.equal(detail.pago, '300.00');
  assert.equal(detail.saldo, '480.00');
  assert.equal(detail.statusDerivado, 'Pendente');
});

test('pagamento: quitação integral marca Pago e registra a data', async () => {
  const expense = (await post(app, '/api/despesas', { ...baseExpense, vencimento: '2027-04-10' }, auth)).body;
  const pay = (await post(app, `/api/despesas/${expense.id}/pagamentos`, { dataPagamento: '2027-04-08', valor: '780.00' }, auth)).body;
  assert.equal(pay.expense.statusDerivado, 'Pago');
  assert.equal(pay.expense.saldo, '0.00');
  assert.equal(pay.expense.dataPagamento, '2027-04-08');
});

test('pagamento: valor acima do saldo devolve 422', async () => {
  const expense = (await post(app, '/api/despesas', { ...baseExpense, vencimento: '2027-05-10' }, auth)).body;
  const res = await post(app, `/api/despesas/${expense.id}/pagamentos`, { dataPagamento: '2027-05-08', valor: '900.00' }, auth);
  assert.equal(res.status, 422);
});

test('estorno: reabre o saldo e impede duplo estorno', async () => {
  const expense = (await post(app, '/api/despesas', { ...baseExpense, vencimento: '2027-06-10' }, auth)).body;
  const pay = (await post(app, `/api/despesas/${expense.id}/pagamentos`, { dataPagamento: '2027-06-08', valor: '780.00' }, auth)).body;
  assert.equal(pay.expense.statusDerivado, 'Pago');

  const reopen = await post(app, `/api/despesas/${expense.id}/pagamentos/${pay.pagamentoId}/estornar`, { motivo: 'Pagamento não compensado' }, auth);
  assert.equal(reopen.status, 200, JSON.stringify(reopen.body));
  assert.equal(reopen.body.pago, '0.00');
  assert.equal(reopen.body.saldo, '780.00');
  assert.notEqual(reopen.body.statusDerivado, 'Pago');

  const again = await post(app, `/api/despesas/${expense.id}/pagamentos/${pay.pagamentoId}/estornar`, { motivo: 'de novo' }, auth);
  assert.equal(again.status, 422);
});

test('despesa: lista ordena críticos antes de pagos', async () => {
  const res = await get(app, '/api/despesas', auth);
  assert.equal(res.status, 200);
  const ranks = { Vencido: 0, Pendente: 1, Pago: 2 };
  const seq = res.body.data.map((expense) => ranks[expense.statusDerivado]);
  assert.deepEqual(seq, [...seq].sort((a, b) => a - b));
});

test('despesa: sem autenticação devolve 401', async () => {
  const res = await get(app, '/api/despesas');
  assert.equal(res.status, 401);
});
