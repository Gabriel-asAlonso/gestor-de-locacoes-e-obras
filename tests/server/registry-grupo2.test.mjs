import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, patch, get, bearer, loginAs, ADMIN } from './setup.mjs';
import { withTransaction } from '../../server/database/connection.ts';
import { imobiliarias } from '../../db/schema.ts';
import { nextCode } from '../../server/common/codes.ts';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);
const auth = bearer(token);

// Base registry needed for units/tenants.
const carteira = (await post(app, '/api/carteiras', { nome: 'Carteira Alpha', titularNome: 'Titular', titularDocumento: '11.111.111/0001-11' }, auth)).body;
const imovel = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Edifício Nexo', endereco: 'Rua A, 100' }, auth)).body;

// Insert an agency directly (no create endpoint until a later group).
const agency = await withTransaction({ system: 'test:agency' }, async (db, audit) => {
  const [row] = await db.insert(imobiliarias).values({
    codigo: nextCode('IMB', []), razao_social: 'Imobiliária Central', nome_fantasia: 'Central', documento: '22.222.222/0001-22',
    creci: 'CRECI-123', contato_nome: 'Contato', telefone: '(31) 3333-3333', email: 'central@imob.com',
    created_by: audit.created_by, updated_by: audit.updated_by,
  }).returning();
  return row;
});

test('unidade: cria (201) com campos preservados e sem retornar dados fora do contrato', async () => {
  const res = await post(app, '/api/unidades', {
    imovelId: imovel.id, nome: 'Sala 101', tipo: 'sala_comercial', areaPrivativa: '45.50',
    codigoComercial: '101', bloco: 'Torre A', andar: '3', areaTotal: '60.00', inscricaoMunicipal: '123.456',
  }, auth);
  assert.equal(res.status, 201);
  assert.match(res.body.codigo, /^UNI-\d+$/);
  assert.equal(res.body.imovelNome, 'Edifício Nexo');
  assert.equal(res.body.carteiraNome, 'Carteira Alpha');
  assert.equal(res.body.areaPrivativa, '45.50');
  assert.equal(res.body.areaTotal, '60.00');
  assert.equal(res.body.codigoComercial, '101');
  assert.equal(res.body.bloco, 'Torre A');
  assert.equal(res.body.ocupada, false);
});

test('unidade: nome duplicado no mesmo imóvel devolve 409', async () => {
  const dup = await post(app, '/api/unidades', { imovelId: imovel.id, nome: 'Sala 101', areaPrivativa: '30.00' }, auth);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'CONFLITO');
});

test('unidade: área decimal inválida devolve 400', async () => {
  const bad = await post(app, '/api/unidades', { imovelId: imovel.id, nome: 'Sala 999', areaPrivativa: '12.345' }, auth);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'VALIDACAO');
});

test('unidade: lista por imóvel e edita', async () => {
  const list = await get(app, `/api/unidades?imovelId=${imovel.id}`, auth);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.length >= 1);
  const unit = list.body.data[0];
  const patched = await patch(app, `/api/unidades/${unit.id}`, { bloco: 'Torre B' }, auth);
  assert.equal(patched.status, 200);
  assert.equal(patched.body.bloco, 'Torre B');
});

test('unidade: sem autenticação devolve 401', async () => {
  const res = await get(app, `/api/unidades?imovelId=${imovel.id}`);
  assert.equal(res.status, 401);
});

test('imobiliárias: leitura lista a imobiliária inserida', async () => {
  const list = await get(app, '/api/imobiliarias', auth);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((row) => row.id === agency.id && row.razaoSocial === 'Imobiliária Central'));
});

test('locatário: cria (201) vinculando imobiliária e preserva campos', async () => {
  const res = await post(app, '/api/locatarios', {
    tipoPessoa: 'PJ', nome: 'Comércio Aurora Ltda', documento: '33.333.333/0001-33', nomeFantasia: 'Aurora',
    imobiliariaId: agency.id, canalPreferido: 'WhatsApp', enderecoCobranca: 'Rua B, 200 · Savassi', inscricaoMunicipal: '987',
    observacoes: 'Contato somente em horário comercial.',
  }, auth);
  assert.equal(res.status, 201);
  assert.match(res.body.codigo, /^LOC-\d+$/);
  assert.equal(res.body.imobiliariaCodigo, agency.codigo);
  assert.equal(res.body.canalPreferido, 'WhatsApp');
  assert.equal(res.body.enderecoCobranca, 'Rua B, 200 · Savassi');
  assert.equal(res.body.observacoes, 'Contato somente em horário comercial.');
});

test('locatário: documento duplicado (mesmo tipo) devolve 409', async () => {
  const dup = await post(app, '/api/locatarios', { tipoPessoa: 'PJ', nome: 'Outro', documento: '33.333.333/0001-33' }, auth);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'CONFLITO');
});

test('locatário: persiste após nova consulta (reload) e filtra por imobiliária', async () => {
  const list = await get(app, `/api/locatarios?imobiliariaId=${agency.id}`, auth);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((row) => row.nome === 'Comércio Aurora Ltda' && row.imobiliariaCodigo === agency.codigo));
});
