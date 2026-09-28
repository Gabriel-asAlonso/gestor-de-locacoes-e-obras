/**
 * Comprehensive, idempotent QA fixture. Refuses to run outside a test-named database.
 */
import { basename } from 'node:path';
import { eq } from 'drizzle-orm';
import { databasePath, openDatabase } from '../db/local.ts';
import * as s from '../db/schema.ts';
import { createUser, findUserByEmail } from '../server/users/users.service.ts';

const target = databasePath();
if (!/(test|teste|qa|homolog)/i.test(basename(target))) {
  throw new Error(`Recusado: DATABASE_PATH não identifica um banco de teste (${target}).`);
}

const testPassword = 'Teste@123456';
const userSpecs = [
  { nome: 'Administrador QA', email: 'admin.qa@teste.local', papelCodigo: 'master', status: 'ativo' },
  { nome: 'Analista Financeiro QA', email: 'analista.qa@teste.local', papelCodigo: 'usuario', status: 'ativo' },
  { nome: 'Operador de Obras QA', email: 'obras.qa@teste.local', papelCodigo: 'usuario', status: 'ativo' },
  { nome: 'Auditor QA', email: 'auditor.qa@teste.local', papelCodigo: 'usuario', status: 'ativo' },
  { nome: 'Usuário Pendente QA', email: 'pendente.qa@teste.local', papelCodigo: 'usuario', status: 'pendente' },
];

const users = [];
for (const spec of userSpecs) {
  const existing = await findUserByEmail(spec.email);
  users.push(
    existing ??
      (await createUser(
        { ...spec, senha: testPassword },
        { system: 'seed:massa-completa-qa:usuarios:v1' },
      )),
  );
}

const [admin, analyst, worksOperator, auditor] = users;
const database = openDatabase(target);
const context = { system: 'seed:massa-completa-qa:dominio:v1' };
const add = async (db, table, values) => (await db.insert(table).values(values).returning())[0];

try {
  await database.transaction({ actorId: admin.id }, async (db) => {
    const permissionRows = [
      [analyst, 'painel:ler'],
      [analyst, 'carteiras:ler'],
      [analyst, 'contratos:ler'],
      [analyst, 'cobrancas:ler'],
      [analyst, 'recebimentos:ler'],
      [worksOperator, 'painel:ler'],
      [worksOperator, 'obras:ler'],
      [worksOperator, 'obras:editar'],
      [worksOperator, 'aportes:ler'],
      [auditor, 'painel:ler'],
      [auditor, 'logs:auditoria:ler'],
      [auditor, 'documentos:ler'],
    ].map(([user, permission]) => ({
      usuario_id: user.id,
      permissao_codigo: permission,
      concedida_por: admin.id,
    }));
    await db.insert(s.usuario_permissoes).values(permissionRows).onConflictDoNothing();
  });

  const result = await database.transaction(context, async (db, audit) => {
    const [marker] = await db
      .select()
      .from(s.carteiras)
      .where(eq(s.carteiras.codigo, 'CAR-QA-CARGA-01'))
      .limit(1);
    if (marker) return { inserted: false, markerId: marker.id };

    const categories = [];
    for (const [codigo, nome] of [
      ['qa-administrativo', 'Administrativo QA'],
      ['qa-obras', 'Obras QA'],
      ['qa-servicos', 'Serviços QA'],
    ]) {
      categories.push(await add(db, s.categorias_despesa, { codigo, nome }));
    }

    const agencies = [];
    const accounts = [];
    const suppliers = [];
    const professionals = [];
    const partners = [];
    for (let i = 1; i <= 3; i += 1) {
      agencies.push(await add(db, s.imobiliarias, {
        codigo: `IMOB-QA-${100 + i}`,
        razao_social: `Imobiliária QA ${i} Ltda.`,
        nome_fantasia: `Imobiliária Teste ${i}`,
        documento: `10.000.00${i}/0001-0${i}`,
        creci: `CRECI-QA-${1000 + i}`,
        contato_nome: `Contato Imobiliária ${i}`,
        telefone: `(11) 4000-100${i}`,
        email: `imobiliaria${i}@teste.local`,
      }));
      accounts.push(await add(db, s.contas_financeiras, { nome: `Conta Financeira QA ${i}` }));
      suppliers.push(await add(db, s.fornecedores, { nome: `Fornecedor QA ${i} Ltda.` }));
      professionals.push(await add(db, s.profissionais, { nome: `Profissional QA ${i}` }));
      partners.push(await add(db, s.socios, { nome: `Sócio QA ${i}` }));
    }
    partners.push(await add(db, s.socios, { nome: 'Sócio QA 4' }));

    const portfolios = [];
    const properties = [];
    const tenants = [];
    const unitsByProperty = [];
    const contracts = [];
    const contractCharges = [];
    const works = [];

    for (let i = 1; i <= 3; i += 1) {
      const portfolio = await add(db, s.carteiras, {
        codigo: i === 1 ? 'CAR-QA-CARGA-01' : `CAR-QA-CARGA-0${i}`,
        nome: `Carteira Ampliada QA ${i}`,
        titular_nome: `Holding QA ${i} Ltda.`,
        titular_documento: `20.000.00${i}/0001-0${i}`,
        gestor_descricao: `Gestor responsável pela carteira QA ${i}`,
      });
      portfolios.push(portfolio);

      const property = await add(db, s.imoveis, {
        codigo: `IMO-QA-${100 + i}`,
        carteira_id: portfolio.id,
        nome: `Empreendimento QA ${i}`,
        endereco: `Avenida de Homologação, ${100 + i} - São Paulo/SP`,
        tipo: i === 2 ? 'centro_comercial' : 'edificio_comercial',
        cep: `0100${i}-000`,
        logradouro: 'Avenida de Homologação',
        numero: String(100 + i),
        bairro: 'Centro de Testes',
        cidade: 'São Paulo',
        uf: 'SP',
      });
      properties.push(property);

      const propertyUnits = [];
      for (let unitIndex = 1; unitIndex <= 2; unitIndex += 1) {
        propertyUnits.push(await add(db, s.unidades, {
          codigo: `UNI-QA-C${i}0${unitIndex}`,
          imovel_id: property.id,
          nome: `Conjunto ${i}0${unitIndex}`,
          tipo: unitIndex === 1 ? 'sala_comercial' : 'loja',
          area_privativa: unitIndex === 1 ? '90.00' : '120.00',
          area_total: unitIndex === 1 ? '105.00' : '145.00',
          andar: unitIndex === 1 ? `${i}º andar` : 'Térreo',
        }));
      }
      unitsByProperty.push(propertyUnits);

      const tenant = await add(db, s.locatarios, {
        codigo: `LOC-QA-${100 + i}`,
        tipo_pessoa: 'PJ',
        nome: `Locatário Ampliado QA ${i} Ltda.`,
        documento: `30.000.00${i}/0001-0${i}`,
        nome_fantasia: `Operação QA ${i}`,
        contato_nome: `Responsável Locatário ${i}`,
        telefone: `(11) 5000-100${i}`,
        email: `locatario${i}@teste.local`,
        imobiliaria_id: agencies[i - 1].id,
        canal_preferido: i === 1 ? 'e-mail' : 'WhatsApp',
      });
      tenants.push(tenant);

      const monthlyRent = 3500 + (i - 1) * 500;
      const contract = await add(db, s.contratos, {
        codigo: `CTR-QA-${100 + i}`,
        imovel_id: property.id,
        locatario_id: tenant.id,
        inicio: '2026-01-01',
        termino_previsto: '2028-12-31',
        aluguel_mensal: `${monthlyRent}.00`,
        dia_vencimento: 10,
        indice_reajuste: 'IPCA',
        mes_reajuste: 1,
        forma_pagamento_prevista: i === 3 ? 'pix' : 'boleto',
        finalidade: 'comercial',
        data_assinatura: '2025-12-15',
      });
      await db.insert(s.contrato_unidades).values({ contrato_id: contract.id, unidade_id: propertyUnits[0].id });
      const rentCharge = await add(db, s.contrato_encargos, {
        contrato_id: contract.id,
        ordem: 1,
        nome: 'Aluguel mensal',
        natureza: 'aluguel',
      });
      const serviceCharge = await add(db, s.contrato_encargos, {
        contrato_id: contract.id,
        ordem: 2,
        nome: 'Condomínio estimado',
        natureza: 'encargo',
        valor_base: '450.00',
      });
      contractCharges.push([rentCharge, serviceCharge]);
      await db
        .update(s.contratos)
        .set({ estado: 'ativo', updated_at: audit.updated_at, updated_by: audit.updated_by })
        .where(eq(s.contratos.id, contract.id));
      contracts.push(contract);

      works.push(await add(db, s.obras, {
        codigo: `OBR-QA-${100 + i}`,
        titulo: `Projeto de melhoria QA ${i}`,
        imovel_id: property.id,
        unidade_id: propertyUnits[0].id,
        responsavel_profissional_id: professionals[i - 1].id,
        tipo_intervencao: i === 1 ? 'reforma' : i === 2 ? 'manutencao' : 'obra',
        descricao: `Obra de homologação completa número ${i}.`,
        prioridade: i === 3 ? 'alta' : 'media',
        estado: 'em_andamento',
        risco_informado: i === 2 ? 'atencao' : 'dentro_prazo',
        progresso_percentual: `${20 + i * 10}.00`,
        inicio_previsto: '2026-09-01',
        termino_previsto: '2027-02-28',
        orcamento: `${20000 + i * 5000}.00`,
        reserva: '2500.00',
      }));
    }

    const activities = [];
    const allocations = [];
    const diaries = [];
    const regularExpenses = [];
    const expensePayments = [];
    for (let i = 0; i < works.length; i += 1) {
      const work = works[i];
      const firstActivity = await add(db, s.obra_atividades, {
        obra_id: work.id,
        codigo: `ATV-QA-${i + 1}-01`,
        etapa: 'preparacao',
        titulo: 'Levantamento técnico',
        responsavel_profissional_id: professionals[i].id,
        inicio: '2026-09-01',
        termino: '2026-09-15',
        estado: 'concluida',
      });
      const secondActivity = await add(db, s.obra_atividades, {
        obra_id: work.id,
        codigo: `ATV-QA-${i + 1}-02`,
        etapa: 'execucao',
        titulo: 'Execução dos serviços',
        responsavel_profissional_id: professionals[(i + 1) % professionals.length].id,
        inicio: '2026-09-16',
        termino: '2026-12-15',
        estado: i === 1 ? 'bloqueada' : 'em_andamento',
        motivo_bloqueio: i === 1 ? 'Aguardando liberação do condomínio.' : null,
      });
      activities.push(firstActivity, secondActivity);

      const firstAllocation = await add(db, s.obra_alocacoes_equipe, {
        obra_id: work.id,
        profissional_id: professionals[i].id,
        codigo: `EQP-QA-${i + 1}-01`,
        funcao: 'Coordenação técnica',
        inicio: '2026-09-01',
        termino: '2027-02-28',
        modalidade: 'horas',
        quantidade: '80.00',
        valor_unitario: '150.00',
      });
      const secondAllocation = await add(db, s.obra_alocacoes_equipe, {
        obra_id: work.id,
        profissional_id: professionals[(i + 1) % professionals.length].id,
        codigo: `EQP-QA-${i + 1}-02`,
        funcao: 'Execução especializada',
        inicio: '2026-09-16',
        termino: '2026-12-15',
        modalidade: 'diarias',
        quantidade: '20.00',
        valor_unitario: '480.00',
      });
      allocations.push(firstAllocation, secondAllocation);
      await db.insert(s.obra_equipe_atividades).values([
        { alocacao_id: firstAllocation.id, atividade_id: firstActivity.id },
        { alocacao_id: firstAllocation.id, atividade_id: secondActivity.id },
        { alocacao_id: secondAllocation.id, atividade_id: secondActivity.id },
      ]);

      const workPartners = [partners[i], partners[(i + 1) % partners.length]];
      const participationA = await add(db, s.obra_socios, {
        obra_id: work.id,
        socio_id: workPartners[0].id,
        percentual: '60.00',
      });
      const participationB = await add(db, s.obra_socios, {
        obra_id: work.id,
        socio_id: workPartners[1].id,
        percentual: '40.00',
      });
      const contribution = await add(db, s.aportes, {
        obra_id: work.id,
        codigo: `APT-QA-${i + 1}-01`,
        data_solicitacao: '2026-09-05',
        descricao: `Aporte inicial da obra QA ${i + 1}`,
        valor_solicitado: '10000.00',
      });
      const quotaA = await add(db, s.aporte_cotas, {
        aporte_id: contribution.id,
        obra_socio_id: participationA.id,
        ordem_rateio: 1,
        nome_socio_pactuado: workPartners[0].nome,
        valor_devido: '6000.00',
      });
      await add(db, s.aporte_cotas, {
        aporte_id: contribution.id,
        obra_socio_id: participationB.id,
        ordem_rateio: 2,
        nome_socio_pactuado: workPartners[1].nome,
        valor_devido: '4000.00',
      });
      await add(db, s.aporte_pagamentos, {
        cota_id: quotaA.id,
        codigo: `PAG-APT-QA-${i + 1}-01`,
        data_pagamento: '2026-09-08',
        valor: '3000.00',
        observacoes: 'Pagamento parcial de homologação.',
      });

      await add(db, s.obra_ajustes_caixa, {
        obra_id: work.id,
        codigo: `AJU-QA-${i + 1}-01`,
        data_movimento: '2026-09-12',
        descricao: 'Crédito de ajuste inicial',
        valor_assinado: '250.00',
      });
      await add(db, s.obra_ajustes_caixa, {
        obra_id: work.id,
        codigo: `AJU-QA-${i + 1}-02`,
        data_movimento: '2026-09-13',
        descricao: 'Débito de ajuste operacional',
        valor_assinado: '-50.00',
      });

      const diary = await add(db, s.obra_diario, {
        obra_id: work.id,
        codigo: `DIA-QA-${i + 1}-01`,
        tipo: 'atualizacao',
        titulo: 'Atualização semanal',
        descricao: `Registro de evolução da obra QA ${i + 1}.`,
        autor_usuario_id: worksOperator.id,
        progresso_registrado: `${25 + i * 10}.00`,
      });
      diaries.push(diary);
      await add(db, s.obra_diario, {
        obra_id: work.id,
        codigo: `DIA-QA-${i + 1}-02`,
        tipo: 'ocorrencia',
        titulo: 'Vistoria de qualidade',
        descricao: 'Vistoria executada e registrada para testes.',
        autor_usuario_id: auditor.id,
      });
      await add(db, s.obra_pendencias, {
        obra_id: work.id,
        codigo: `PEN-QA-${i + 1}-01`,
        titulo: 'Validar documentação',
        descricao: 'Pendência aberta para validação funcional.',
        severidade: i === 2 ? 'critica' : 'atencao',
      });
      await add(db, s.obra_pendencias, {
        obra_id: work.id,
        codigo: `PEN-QA-${i + 1}-02`,
        titulo: 'Conferir levantamento',
        descricao: 'Pendência concluída na carga de testes.',
        severidade: 'informativa',
        resolvida_em: '2026-09-20T12:00:00.000Z',
        resolvida_por: worksOperator.id,
      });

      const regularExpense = await add(db, s.despesas, {
        codigo: `DES-QA-${100 + i + 1}`,
        fornecedor_id: suppliers[i].id,
        origem: 'operacao',
        categoria_id: categories[i].id,
        descricao: `Despesa operacional QA ${i + 1}`,
        valor: `${1200 + i * 200}.00`,
        vencimento: `2026-10-${10 + i}`,
        forma_pagamento_prevista: i === 2 ? 'pix' : 'boleto',
        conta_financeira_prevista_id: accounts[i].id,
      });
      regularExpenses.push(regularExpense);
      expensePayments.push(await add(db, s.pagamentos_despesa, {
        despesa_id: regularExpense.id,
        codigo: `PAG-DES-QA-${i + 1}-01`,
        data_pagamento: `2026-10-${10 + i}`,
        valor: `${600 + i * 100}.00`,
        forma_pagamento: 'transferencia',
        conta_financeira_id: accounts[i].id,
      }));

      const constructionExpense = await add(db, s.despesas, {
        codigo: `DES-OBRA-QA-${i + 1}`,
        fornecedor_id: suppliers[(i + 1) % suppliers.length].id,
        origem: 'contratacao_obra',
        descricao: `Contratação especializada da obra QA ${i + 1}`,
        valor: '5000.00',
        vencimento: '2026-10-25',
        forma_pagamento_prevista: 'transferencia',
        conta_financeira_prevista_id: accounts[i].id,
      });
      await db.insert(s.obra_contratacoes).values({
        despesa_id: constructionExpense.id,
        obra_id: work.id,
        codigo: `CONT-QA-${i + 1}-01`,
        tipo_fornecimento: i === 1 ? 'material' : 'servico',
        data_contratacao: '2026-09-10',
      });
    }

    const charges = [];
    const receipts = [];
    for (let i = 0; i < contracts.length; i += 1) {
      const monthlyRent = 3500 + i * 500;
      const charge = await add(db, s.cobrancas, {
        codigo: `COB-QA-${100 + i + 1}`,
        contrato_id: contracts[i].id,
        competencia: '2026-10-01',
        forma_pagamento_prevista: i === 2 ? 'pix' : 'boleto',
      });
      charges.push(charge);
      const rentItem = await add(db, s.cobranca_itens, {
        cobranca_id: charge.id,
        contrato_encargo_id: contractCharges[i][0].id,
        ordem: 1,
        nome_emissao: 'Aluguel outubro/2026',
        natureza: 'aluguel',
        vencimento: '2026-10-10',
        valor: `${monthlyRent}.00`,
      });
      const serviceItem = await add(db, s.cobranca_itens, {
        cobranca_id: charge.id,
        contrato_encargo_id: contractCharges[i][1].id,
        ordem: 2,
        nome_emissao: 'Condomínio outubro/2026',
        natureza: 'encargo',
        vencimento: '2026-10-10',
        valor: '450.00',
      });

      if (i === 0) {
        const receipt = await add(db, s.recebimentos, {
          codigo: 'REC-QA-101',
          cobranca_id: charge.id,
          data_recebimento: '2026-10-10',
          valor: '2200.00',
          forma_pagamento: 'transferencia',
          conta_financeira_id: accounts[i].id,
        });
        receipts.push(receipt);
        await db.insert(s.recebimento_alocacoes).values([
          { recebimento_id: receipt.id, cobranca_item_id: rentItem.id, valor: '1750.00' },
          { recebimento_id: receipt.id, cobranca_item_id: serviceItem.id, valor: '450.00' },
        ]);
      } else {
        const total = monthlyRent + 450;
        const negotiatedTotal = total + 50;
        const entry = i === 1 ? 600 : 500;
        const installment = (negotiatedTotal - entry) / 3;
        const negotiation = await add(db, s.negociacoes, {
          cobranca_id: charge.id,
          versao: 1,
          saldo_base: `${total}.00`,
          desconto: '50.00',
          acrescimo: '100.00',
          entrada_prevista: `${entry}.00`,
          quantidade_parcelas: 3,
          primeiro_vencimento: '2026-10-15',
          data_acordo: '2026-09-20',
          motivo: i === 1 ? 'inadimplencia_temporaria' : 'renegociacao_comercial',
          forma_pagamento_prevista: 'boleto',
        });
        const installmentRows = [];
        installmentRows.push(await add(db, s.negociacao_parcelas, {
          negociacao_id: negotiation.id,
          numero: 0,
          vencimento: '2026-09-20',
          valor: `${entry}.00`,
        }));
        for (let installmentNumber = 1; installmentNumber <= 3; installmentNumber += 1) {
          installmentRows.push(await add(db, s.negociacao_parcelas, {
            negociacao_id: negotiation.id,
            numero: installmentNumber,
            vencimento: `2026-${9 + installmentNumber}-${15}`,
            valor: `${installment}.00`,
          }));
        }
        const receipt = await add(db, s.recebimentos, {
          codigo: `REC-QA-${100 + i + 1}`,
          cobranca_id: charge.id,
          data_recebimento: '2026-09-20',
          valor: `${entry}.00`,
          forma_pagamento: 'pix',
          conta_financeira_id: accounts[i].id,
        });
        receipts.push(receipt);
        await db.insert(s.recebimento_alocacoes).values({
          recebimento_id: receipt.id,
          negociacao_parcela_id: installmentRows[0].id,
          valor: `${entry}.00`,
        });
      }
    }

    const documents = [];
    for (let i = 0; i < works.length; i += 1) {
      const expenseDocument = await add(db, s.documentos, { nome_original: `despesa-qa-${i + 1}.pdf` });
      const paymentDocument = await add(db, s.documentos, { nome_original: `pagamento-qa-${i + 1}.pdf` });
      const diaryDocument = await add(db, s.documentos, { nome_original: `diario-qa-${i + 1}.jpg` });
      const propertyDocument = await add(db, s.documentos, { nome_original: `matricula-imovel-qa-${i + 1}.pdf` });
      documents.push(expenseDocument, paymentDocument, diaryDocument, propertyDocument);
      await db.insert(s.documento_vinculos).values([
        { documento_id: expenseDocument.id, despesa_id: regularExpenses[i].id },
        { documento_id: paymentDocument.id, pagamento_despesa_id: expensePayments[i].id },
        { documento_id: diaryDocument.id, diario_id: diaries[i].id },
      ]);
      await db.insert(s.documento_imovel_vinculos).values({
        documento_id: propertyDocument.id,
        imovel_id: properties[i].id,
        topico: 'documentacao-legal',
      });
    }

    return {
      inserted: true,
      portfolios: portfolios.length,
      properties: properties.length,
      units: unitsByProperty.flat().length,
      tenants: tenants.length,
      contracts: contracts.length,
      works: works.length,
      activities: activities.length,
      allocations: allocations.length,
      charges: charges.length,
      receipts: receipts.length,
      documents: documents.length,
    };
  });

  console.log(JSON.stringify({ database: target, users: users.length, ...result }, null, 2));
} finally {
  database.close();
}
