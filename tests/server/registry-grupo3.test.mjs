import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, get, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);
const auth = bearer(token);

const carteira = (await post(app, '/api/carteiras', { nome: 'Carteira G3', titularNome: 'T', titularDocumento: '10' }, auth)).body;
const imovel = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Ed G3', endereco: 'Rua G3' }, auth)).body;
const imovel2 = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Ed G3 B', endereco: 'Rua G3 B' }, auth)).body;
const unit1 = (await post(app, '/api/unidades', { imovelId: imovel.id, nome: 'Sala 101', areaPrivativa: '40.00' }, auth)).body;
const unit2 = (await post(app, '/api/unidades', { imovelId: imovel.id, nome: 'Sala 102', areaPrivativa: '35.00' }, auth)).body;
const unitOther = (await post(app, '/api/unidades', { imovelId: imovel2.id, nome: 'Sala X', areaPrivativa: '20.00' }, auth)).body;

const agencyCreate = await post(app, '/api/imobiliarias', { razaoSocial: 'Central Imóveis Ltda', nomeFantasia: 'Central', documento: '11.444.777/0001-61', creci: 'CRECI-1', contatoNome: 'Ana', telefone: '(31) 3000-0000', email: 'a@central.com', observacoes: 'Atendimento em horário comercial.' }, auth);
const agencyDup = await post(app, '/api/imobiliarias', { razaoSocial: 'Outra', documento: '11.444.777/0001-61', creci: 'CRECI-2', contatoNome: 'B' }, auth);
const agency = agencyCreate.body;
const tenant = (await post(app, '/api/locatarios', { tipoPessoa: 'PJ', nome: 'Loja Sol Ltda', documento: '33.333.333/0001-33', imobiliariaId: agency.id }, auth)).body;
const unitList = (await get(app, `/api/unidades?imovelId=${imovel.id}`, auth)).body.data;

const contractBody = {
  imovelId: imovel.id, locatarioId: tenant.id, unidadeIds: unitList.map((u) => u.id),
  inicio: '2026-02-01', terminoPrevisto: '2027-01-31', aluguelMensal: '3200.00', diaVencimento: 10,
  indiceReajuste: 'IPCA', mesReajuste: 2, formaPagamentoPrevista: 'boleto', formaPagamentoTexto: 'Débito automático',
  finalidade: 'Comercial', multaAtrasoPercentual: '2.00', jurosMensalPercentual: '1.00', garantiaTipo: 'Fiador', garantiaDetalhe: 'João',
  encargos: [{ nome: 'Aluguel', natureza: 'aluguel', valorBase: null }, { nome: 'Condomínio', natureza: 'encargo', valorBase: '450.00' }],
};

test('imobiliária: cria (201) com código gerado', () => {
  assert.equal(agencyCreate.status, 201);
  assert.match(agencyCreate.body.codigo, /^IMB-\d+$/);
  assert.equal(agencyCreate.body.razaoSocial, 'Central Imóveis Ltda');
  assert.equal(agencyCreate.body.observacoes, 'Atendimento em horário comercial.');
});

test('imobiliária: documento duplicado devolve 409', () => {
  assert.equal(agencyDup.status, 409);
});

test('contrato: cria (201) com unidades, encargos e campos preservados', async () => {
  const res = await post(app, '/api/contratos', contractBody, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.codigo, /^CTR-\d+$/);
  assert.equal(res.body.estado, 'ativo');
  assert.equal(res.body.aluguelMensal, '3200.00');
  assert.equal(res.body.imovelNome, 'Ed G3');
  assert.equal(res.body.locatarioNome, 'Loja Sol Ltda');
  assert.equal(res.body.unidades.length, 2);
  assert.equal(res.body.encargos.length, 2);
  assert.equal(res.body.multaAtrasoPercentual, '2.00');
  assert.equal(res.body.formaPagamentoTexto, 'Débito automático');
  const aluguel = res.body.encargos.find((e) => e.natureza === 'aluguel');
  assert.equal(aluguel.valorBase, null);
});

test('contrato: unidade de outro imóvel devolve 422', async () => {
  const res = await post(app, '/api/contratos', { ...contractBody, unidadeIds: [unitOther.id] }, auth);
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'REGRA_NEGOCIO');
});

test('contrato: sem unidades devolve 400', async () => {
  const res = await post(app, '/api/contratos', { ...contractBody, unidadeIds: [] }, auth);
  assert.equal(res.status, 400);
});

test('contrato: lista e filtra por locatário (persistência)', async () => {
  const res = await get(app, `/api/contratos?locatarioId=${tenant.id}`, auth);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.some((c) => c.locatarioNome === 'Loja Sol Ltda' && c.unidades.length === 2));
});

test('contrato: sem autenticação devolve 401', async () => {
  const res = await get(app, '/api/contratos');
  assert.equal(res.status, 401);
});
