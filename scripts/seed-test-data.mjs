/**
 * Creates a small, coherent domain fixture in an explicitly test-only database.
 * DATABASE_PATH must contain "test", "teste", "qa" or "homolog" in its filename.
 */
import { basename } from 'node:path';
import { eq } from 'drizzle-orm';
import { databasePath, openDatabase } from '../db/local.ts';
import * as s from '../db/schema.ts';

const target = databasePath();
if (!/(test|teste|qa|homolog)/i.test(basename(target))) {
  throw new Error(`Recusado: DATABASE_PATH não identifica um banco de teste (${target}).`);
}

const database = openDatabase(target);
const context = { system: 'seed:massa-de-testes:v1' };
const add = async (db, table, values) => (await db.insert(table).values(values).returning())[0];

try {
  const result = await database.transaction(context, async (db, audit) => {
    const [existing] = await db.select().from(s.carteiras).where(eq(s.carteiras.codigo, 'CAR-QA-001')).limit(1);
    if (existing) return { inserted: false, carteiraId: existing.id };

    const [categoria] = await db
      .select()
      .from(s.categorias_despesa)
      .where(eq(s.categorias_despesa.codigo, 'manutencao'))
      .limit(1);
    if (!categoria) throw new Error('Execute o seed estrutural antes da massa de testes.');

    const carteira = await add(db, s.carteiras, {
      codigo: 'CAR-QA-001',
      nome: 'Carteira QA',
      titular_nome: 'Empresa de Testes Ltda.',
      titular_documento: '12.345.678/0001-90',
    });
    const imovel = await add(db, s.imoveis, {
      codigo: 'IMO-QA-001',
      carteira_id: carteira.id,
      nome: 'Edifício de Testes',
      endereco: 'Rua dos Testes, 100 - São Paulo/SP',
    });
    const unidade = await add(db, s.unidades, {
      codigo: 'UNI-QA-101',
      imovel_id: imovel.id,
      nome: 'Conjunto 101',
      area_privativa: '85.50',
    });
    const locatario = await add(db, s.locatarios, {
      codigo: 'LOC-QA-001',
      nome: 'Locatário de Testes Ltda.',
      documento: '98.765.432/0001-10',
    });
    const profissional = await add(db, s.profissionais, { nome: 'Responsável Técnico QA' });
    const fornecedor = await add(db, s.fornecedores, { nome: 'Fornecedor de Testes Ltda.' });
    const contrato = await add(db, s.contratos, {
      codigo: 'CTR-QA-001',
      imovel_id: imovel.id,
      locatario_id: locatario.id,
      inicio: '2026-01-01',
      termino_previsto: '2027-12-31',
      aluguel_mensal: '3500.00',
    });
    await db.insert(s.contrato_unidades).values({ contrato_id: contrato.id, unidade_id: unidade.id });
    await db
      .update(s.contratos)
      .set({ estado: 'ativo', updated_at: audit.updated_at, updated_by: audit.updated_by })
      .where(eq(s.contratos.id, contrato.id));

    const obra = await add(db, s.obras, {
      codigo: 'OBR-QA-001',
      titulo: 'Reforma da unidade de testes',
      imovel_id: imovel.id,
      unidade_id: unidade.id,
      responsavel_profissional_id: profissional.id,
      descricao: 'Massa de dados para validação funcional.',
      inicio_previsto: '2026-09-01',
      termino_previsto: '2026-11-30',
      orcamento: '15000.00',
    });
    const despesa = await add(db, s.despesas, {
      codigo: 'DES-QA-001',
      fornecedor_id: fornecedor.id,
      categoria_id: categoria.id,
      descricao: 'Manutenção preventiva de teste',
      valor: '850.00',
      vencimento: '2026-10-10',
    });
    const cobranca = await add(db, s.cobrancas, {
      codigo: 'COB-QA-001',
      contrato_id: contrato.id,
      competencia: '2026-09-01',
    });
    const item = await add(db, s.cobranca_itens, {
      cobranca_id: cobranca.id,
      ordem: 1,
      nome_emissao: 'Aluguel setembro/2026',
      natureza: 'aluguel',
      vencimento: '2026-09-10',
      valor: '3500.00',
    });
    const recebimento = await add(db, s.recebimentos, {
      codigo: 'REC-QA-001',
      cobranca_id: cobranca.id,
      data_recebimento: '2026-09-10',
      valor: '3500.00',
    });
    await db.insert(s.recebimento_alocacoes).values({
      recebimento_id: recebimento.id,
      cobranca_item_id: item.id,
      valor: '3500.00',
    });

    return {
      inserted: true,
      carteiraId: carteira.id,
      imovelId: imovel.id,
      contratoId: contrato.id,
      obraId: obra.id,
      despesaId: despesa.id,
      cobrancaId: cobranca.id,
      recebimentoId: recebimento.id,
    };
  });
  console.log(JSON.stringify({ database: target, ...result }, null, 2));
} finally {
  database.close();
}
