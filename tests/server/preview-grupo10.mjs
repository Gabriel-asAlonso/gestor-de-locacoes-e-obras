/** Disposable browser preview: isolated migrated SQLite from setup.mjs, never production data. */
import { serve } from '@hono/node-server';
import { prepare, post, bearer, loginAs, ADMIN } from './setup.mjs';

const { app } = await prepare();
const token = await loginAs(app, ADMIN);
const auth = bearer(token);
const carteira = (await post(app, '/api/carteiras', { nome: 'Carteira de teste G10', titularNome: 'Teste', titularDocumento: '1010' }, auth)).body;
const imovel = (await post(app, '/api/imoveis', { carteiraId: carteira.id, nome: 'Edifício de teste G10', endereco: 'Rua de teste' }, auth)).body;
const profissional = (await post(app, '/api/profissionais', { nome: 'Responsável de teste G10' }, auth)).body;
const work = (await post(app, '/api/obras', {
  titulo: 'Obra de teste do Grupo 10', imovelId: imovel.id, responsavelProfissionalId: profissional.id,
  descricao: 'Validação local e descartável', inicioPrevisto: '2026-09-01', terminoPrevisto: '2026-12-01',
  orcamento: '10000.00',
}, auth)).body;
serve({ fetch: app.fetch, port: 3001, hostname: '127.0.0.1' });
process.stdout.write(`Prévia isolada em http://127.0.0.1:3001; obra ${work.codigo}; use as credenciais da fixture local documentadas no teste.\n`);
