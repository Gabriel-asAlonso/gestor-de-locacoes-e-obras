import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, post, get, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);
const auth = bearer(token);

// Base registry chain (carteira → imóvel → unidade → locatário → contrato ativo).
const carteira = (await post(app, '/api/carteiras', { nome: 'Carteira G4', titularNome: 'T', titularDocumento: '20' }, auth)).body;
const imovel = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Ed G4', endereco: 'Rua G4' }, auth)).body;
const unit = (await post(app, '/api/unidades', { imovelId: imovel.id, nome: 'Sala 401', areaPrivativa: '40.00' }, auth)).body;
const tenant = (await post(app, '/api/locatarios', { tipoPessoa: 'PJ', nome: 'Loja G4 Ltda', documento: '33.333.333/0001-33' }, auth)).body;
const contract = (await post(app, '/api/contratos', {
  imovelId: imovel.id, locatarioId: tenant.id, unidadeIds: [unit.id], inicio: '2026-01-01', terminoPrevisto: '2026-12-31',
  aluguelMensal: '3200.00', diaVencimento: 10, encargos: [{ nome: 'Aluguel', natureza: 'aluguel', valorBase: null }, { nome: 'Condomínio', natureza: 'encargo', valorBase: '450.00' }],
}, auth)).body;

const chargeItens = [
  { ordem: 1, nome: 'Aluguel', natureza: 'aluguel', vencimento: '2026-05-10', valor: '3200.00' },
  { ordem: 2, nome: 'Condomínio', natureza: 'encargo', vencimento: '2026-05-10', valor: '450.00' },
];

test('cobrança: cria (201) com itens, total e saldo derivados', async () => {
  const res = await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2026-05-01', itens: chargeItens }, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.codigo, /^COB-\d+$/);
  assert.equal(res.body.total, '3650.00');
  assert.equal(res.body.recebido, '0.00');
  assert.equal(res.body.saldoOperacional, '3650.00');
  assert.equal(res.body.itens.length, 2);
  assert.equal(res.body.locatarioNome, 'Loja G4 Ltda');
  assert.equal(res.body.negociacaoVigente, null);
});

test('cobrança: competência duplicada por contrato devolve 409', async () => {
  await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2026-11-01', itens: chargeItens }, auth);
  const dup = await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2026-11-01', itens: chargeItens }, auth);
  assert.equal(dup.status, 409);
});

test('cobrança: sem itens devolve 400', async () => {
  const res = await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2026-07-01', itens: [] }, auth);
  assert.equal(res.status, 400);
});

test('cobrança: competência que não é dia 01 devolve 400', async () => {
  const res = await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2026-07-15', itens: chargeItens }, auth);
  assert.equal(res.status, 400);
});

test('recebimento: alocação por item liquida parcialmente e reflete no saldo', async () => {
  const charge = (await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2026-08-01', itens: chargeItens }, auth)).body;
  const aluguel = charge.itens.find((item) => item.natureza === 'aluguel');
  const receipt = await post(app, '/api/recebimentos', {
    cobrancaId: charge.id, dataRecebimento: '2026-08-12', dataCredito: '2026-08-13', valor: '1000.00',
    valorRecebido: '990.00', desconto: '20.00', acrescimo: '10.00', formaPagamento: 'pix',
    contaDescricao: 'Conta QA', referencia: 'PIX-G4-001', pagadorDescricao: 'Pagador terceiro',
    comprovanteNome: 'comprovante.pdf', observacoes: 'Recebimento completo para validação',
    alocacoes: [{ cobrancaItemId: aluguel.id, valor: '1000.00' }],
  }, auth);
  assert.equal(receipt.status, 201, JSON.stringify(receipt.body));
  assert.match(receipt.body.codigo, /^REC-\d+$/);
  assert.equal(receipt.body.dataCredito, '2026-08-13');
  assert.equal(receipt.body.valorRecebido, '990.00');
  assert.equal(receipt.body.desconto, '20.00');
  assert.equal(receipt.body.acrescimo, '10.00');
  assert.equal(receipt.body.contaDescricao, 'Conta QA');
  assert.equal(receipt.body.pagadorDescricao, 'Pagador terceiro');
  assert.equal(receipt.body.comprovanteNome, 'comprovante.pdf');
  assert.equal(receipt.body.observacoes, 'Recebimento completo para validação');

  const detail = (await get(app, `/api/cobrancas/${charge.id}`, auth)).body;
  assert.equal(detail.recebido, '1000.00');
  assert.equal(detail.saldoOperacional, '2650.00');
  assert.equal(detail.statusDerivado, 'Parcial');
  assert.equal(detail.itens.find((item) => item.natureza === 'aluguel').recebido, '1000.00');
});

test('recebimento: valor acima do saldo operacional devolve 422', async () => {
  const charge = (await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2026-09-01', itens: chargeItens }, auth)).body;
  const item = charge.itens[0];
  const res = await post(app, '/api/recebimentos', { cobrancaId: charge.id, dataRecebimento: '2026-09-12', valor: '9999.00', alocacoes: [{ cobrancaItemId: item.id, valor: '9999.00' }] }, auth);
  assert.equal(res.status, 422);
});

test('recebimento: soma das alocações diferente do valor devolve 422', async () => {
  const charge = (await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2026-10-01', itens: chargeItens }, auth)).body;
  const item = charge.itens[0];
  const res = await post(app, '/api/recebimentos', { cobrancaId: charge.id, dataRecebimento: '2026-10-12', valor: '100.00', alocacoes: [{ cobrancaItemId: item.id, valor: '50.00' }] }, auth);
  assert.equal(res.status, 422);
});

test('recebimento: quitação integral marca a cobrança como Recebida e permite estorno', async () => {
  const charge = (await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2026-12-01', itens: chargeItens }, auth)).body;
  const receipt = (await post(app, '/api/recebimentos', {
    cobrancaId: charge.id, dataRecebimento: '2026-12-12', valor: '3650.00',
    alocacoes: charge.itens.map((item) => ({ cobrancaItemId: item.id, valor: item.valor })),
  }, auth)).body;
  let detail = (await get(app, `/api/cobrancas/${charge.id}`, auth)).body;
  assert.equal(detail.statusDerivado, 'Recebida');
  assert.equal(detail.saldoOperacional, '0.00');

  const reversal = await post(app, `/api/recebimentos/${receipt.id}/estornar`, { motivo: 'Pagamento não compensado' }, auth);
  assert.equal(reversal.status, 200, JSON.stringify(reversal.body));
  assert.equal(reversal.body.estornoDeId, receipt.id);
  detail = (await get(app, `/api/cobrancas/${charge.id}`, auth)).body;
  assert.equal(detail.recebido, '0.00');
  assert.equal(detail.saldoOperacional, '3650.00');

  const doubleReversal = await post(app, `/api/recebimentos/${receipt.id}/estornar`, { motivo: 'de novo' }, auth);
  assert.equal(doubleReversal.status, 422);
});

test('negociação: cria acordo com entrada como parcela 0 e parcelas derivadas', async () => {
  const charge = (await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2027-01-01', itens: chargeItens }, auth)).body;
  const res = await post(app, '/api/negociacoes', {
    cobrancaId: charge.id, desconto: '150.00', acrescimo: '60.00', entradaPrevista: '650.00', entradaVencimento: '2027-02-05',
    quantidadeParcelas: 3, primeiroVencimento: '2027-03-10', dataAcordo: '2027-01-15', motivo: 'renegociacao_comercial',
    motivoOutro: null, multa: '10.00', juros: '40.00', correcao: '10.00', contatoNome: 'Contato QA',
    contatoCanal: 'E-mail', documentoNome: 'acordo.pdf', observacoes: 'Condições aprovadas no teste',
  }, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.saldoBase, '3650.00');
  assert.equal(res.body.totalNegociado, '3560.00');
  assert.equal(res.body.totalFinanciado, '2910.00');
  assert.equal(res.body.versao, 1);
  assert.equal(res.body.multa, '10.00');
  assert.equal(res.body.juros, '40.00');
  assert.equal(res.body.correcao, '10.00');
  assert.equal(res.body.contatoNome, 'Contato QA');
  assert.equal(res.body.contatoCanal, 'E-mail');
  assert.equal(res.body.documentoNome, 'acordo.pdf');
  assert.equal(res.body.observacoes, 'Condições aprovadas no teste');
  const entrada = res.body.parcelas.find((p) => p.numero === 0);
  assert.equal(entrada.valor, '650.00');
  assert.equal(entrada.vencimento, '2027-02-05');
  const financed = res.body.parcelas.filter((p) => p.numero > 0);
  assert.equal(financed.length, 3);
  assert.equal(financed.reduce((sum, p) => sum + Number(p.valor), 0).toFixed(2), '2910.00');

  const detail = (await get(app, `/api/cobrancas/${charge.id}`, auth)).body;
  assert.equal(detail.statusDerivado, 'Negociada');
  assert.ok(detail.negociacaoVigente);
  assert.equal(detail.negociacaoVigente.versao, 1);
});

test('negociação: entrada maior ou igual ao total devolve 422', async () => {
  const charge = (await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2027-02-01', itens: chargeItens }, auth)).body;
  const res = await post(app, '/api/negociacoes', {
    cobrancaId: charge.id, desconto: '0.00', acrescimo: '0.00', entradaPrevista: '3650.00', entradaVencimento: '2027-03-05',
    quantidadeParcelas: 2, primeiroVencimento: '2027-04-10', dataAcordo: '2027-02-15', motivo: 'inadimplencia_temporaria',
  }, auth);
  assert.equal(res.status, 422);
});

test('negociação: acordo vigente duplicado devolve 409 e substituir gera versão 2', async () => {
  const charge = (await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2027-03-01', itens: chargeItens }, auth)).body;
  const first = (await post(app, '/api/negociacoes', {
    cobrancaId: charge.id, desconto: '100.00', acrescimo: '0.00', entradaPrevista: '0.00',
    quantidadeParcelas: 2, primeiroVencimento: '2027-04-10', dataAcordo: '2027-03-15', motivo: 'inadimplencia_temporaria',
  }, auth)).body;

  const dup = await post(app, '/api/negociacoes', {
    cobrancaId: charge.id, desconto: '0.00', acrescimo: '0.00', entradaPrevista: '0.00',
    quantidadeParcelas: 2, primeiroVencimento: '2027-04-10', dataAcordo: '2027-03-15', motivo: 'inadimplencia_temporaria',
  }, auth);
  assert.equal(dup.status, 409);

  const sub = await post(app, `/api/negociacoes/${first.id}/substituir`, {
    desconto: '200.00', acrescimo: '0.00', entradaPrevista: '0.00',
    quantidadeParcelas: 3, primeiroVencimento: '2027-05-10', dataAcordo: '2027-04-01', motivo: 'renegociacao_comercial',
  }, auth);
  assert.equal(sub.status, 201, JSON.stringify(sub.body));
  assert.equal(sub.body.versao, 2);
  assert.equal(sub.body.saldoBase, '3550.00');
  assert.equal(sub.body.totalNegociado, '3350.00');
});

test('negociação: parcelas em mês curto respeitam o calendário do banco (clamp)', async () => {
  const charge = (await post(app, '/api/cobrancas', { contratoId: contract.id, competencia: '2027-04-01', itens: chargeItens }, auth)).body;
  const res = await post(app, '/api/negociacoes', {
    cobrancaId: charge.id, desconto: '0.00', acrescimo: '0.00', entradaPrevista: '0.00',
    quantidadeParcelas: 2, primeiroVencimento: '2027-01-31', dataAcordo: '2027-04-15', motivo: 'inadimplencia_temporaria',
  }, auth);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const financed = res.body.parcelas.filter((p) => p.numero > 0).sort((a, b) => a.numero - b.numero);
  assert.equal(financed[0].vencimento, '2027-01-31');
  assert.equal(financed[1].vencimento, '2027-02-28');
});

test('cobrança: contrato inexistente devolve 404', async () => {
  const res = await post(app, '/api/cobrancas', { contratoId: '00000000-0000-4000-8000-000000000000', competencia: '2026-05-01', itens: chargeItens }, auth);
  assert.equal(res.status, 404);
});

test('cobrança: sem autenticação devolve 401', async () => {
  const res = await get(app, '/api/cobrancas');
  assert.equal(res.status, 401);
});
