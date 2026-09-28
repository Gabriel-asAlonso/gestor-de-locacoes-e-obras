import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, get, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);
const auth = bearer(token);

const carteira = (await post(app, '/api/carteiras', { nome: 'Carteira G8', titularNome: 'T', titularDocumento: '80' }, auth)).body;
const imovel = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Ed G8', endereco: 'Rua G8' }, auth)).body;
const prof = (await post(app, '/api/profissionais', { nome: 'Lucas Rocha' }, auth)).body;
const work = (await post(app, '/api/obras', {
  titulo: 'Obra G8', imovelId: imovel.id, responsavelProfissionalId: prof.id, descricao: 'Escopo',
  inicioPrevisto: '2026-07-01', terminoPrevisto: '2026-10-01', orcamento: '200000.00',
}, auth)).body;

// ——— Equipe (E24/E25) ———
test('equipe: aloca profissional (201) e exclui custo do envio', async () => {
  const res = await post(app, `/api/obras/${work.id}/equipe`, { profissionalId: prof.id, funcao: 'Encarregado', modalidade: 'horas', quantidade: '160.00', valorUnitario: '35.00' }, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.length, 1);
  const allocation = res.body.data[0];
  assert.match(allocation.codigo, /^EQP-\d+$/);
  assert.equal(allocation.profissionalNome, 'Lucas Rocha');
  assert.equal(allocation.quantidade, '160.00');
  assert.equal(allocation.valorUnitario, '35.00');
});

test('equipe: quantidade zero devolve 400', async () => {
  const res = await post(app, `/api/obras/${work.id}/equipe`, { profissionalId: prof.id, funcao: 'X', quantidade: '0.00' }, auth);
  assert.equal(res.status, 400);
});

test('equipe: remoção lógica retira da lista ativa', async () => {
  const created = (await post(app, `/api/obras/${work.id}/equipe`, { profissionalId: prof.id, funcao: 'Ajudante', quantidade: '80.00', valorUnitario: '20.00' }, auth)).body.data;
  const target = created.find((item) => item.funcao === 'Ajudante');
  const before = created.length;
  const res = await app.request(`/api/obras/${work.id}/equipe/${target.id}`, { method: 'DELETE', headers: auth });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.length, before - 1);
  assert.ok(!body.data.some((item) => item.id === target.id));
});

// ——— Fornecedores / contratações (E26, D08) ———
test('contratação: cria despesa+especialização+fornecedor atomicamente e deriva saldo', async () => {
  const res = await post(app, `/api/obras/${work.id}/contratacoes`, {
    fornecedorNome: 'Elétrica Norte', tipoFornecimento: 'servico', descricao: 'Instalação elétrica', valorContratado: '48000.00',
    dataContratacao: '2026-07-05', vencimento: '2026-08-05',
  }, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const contract = res.body.data[0];
  assert.match(contract.codigo, /^OC-\d+$/);
  assert.equal(contract.fornecedorNome, 'Elétrica Norte');
  assert.equal(contract.valorContratado, '48000.00');
  assert.equal(contract.pago, '0.00');
  assert.equal(contract.saldo, '48000.00');
});

test('contratação: não aparece no livro de despesas (origem de obra é separada)', async () => {
  const despesas = (await get(app, '/api/despesas', auth)).body.data;
  assert.ok(despesas.every((expense) => expense.descricao !== 'Instalação elétrica'));
});

test('contratação: pagamento parcial reduz o saldo e marca parcialmente pago', async () => {
  const contract = (await post(app, `/api/obras/${work.id}/contratacoes`, { fornecedorNome: 'Hidráulica Sul', descricao: 'Tubulação', valorContratado: '10000.00', dataContratacao: '2026-07-06', vencimento: '2027-01-06' }, auth)).body.data.find((c) => c.descricao === 'Tubulação');
  const pay = await post(app, `/api/obras/${work.id}/contratacoes/${contract.id}/pagamentos`, { dataPagamento: '2026-07-10', valor: '4000.00' }, auth);
  assert.equal(pay.status, 201, JSON.stringify(pay.body));
  const updated = pay.body.data.find((c) => c.id === contract.id);
  assert.equal(updated.pago, '4000.00');
  assert.equal(updated.saldo, '6000.00');
  assert.equal(updated.statusDerivado, 'Parcialmente pago');
});

test('contratação: pagamento acima do saldo devolve 422', async () => {
  const contract = (await post(app, `/api/obras/${work.id}/contratacoes`, { fornecedorNome: 'Pintura Leste', descricao: 'Pintura', valorContratado: '5000.00', dataContratacao: '2026-07-06', vencimento: '2027-02-06' }, auth)).body.data.find((c) => c.descricao === 'Pintura');
  const res = await post(app, `/api/obras/${work.id}/contratacoes/${contract.id}/pagamentos`, { dataPagamento: '2026-07-10', valor: '9000.00' }, auth);
  assert.equal(res.status, 422);
});

test('contratação: reutiliza fornecedor existente por nome exato', async () => {
  const before = (await get(app, '/api/fornecedores?search=Elétrica Norte', auth)).body.data.length;
  await post(app, `/api/obras/${work.id}/contratacoes`, { fornecedorNome: 'Elétrica Norte', descricao: 'Reforço elétrico', valorContratado: '3000.00', dataContratacao: '2026-07-08', vencimento: '2027-03-08' }, auth);
  const after = (await get(app, '/api/fornecedores?search=Elétrica Norte', auth)).body.data.length;
  assert.equal(after, before);   // não duplica o fornecedor
});

test('equipe: sem autenticação devolve 401', async () => {
  const res = await get(app, `/api/obras/${work.id}/equipe`);
  assert.equal(res.status, 401);
});
