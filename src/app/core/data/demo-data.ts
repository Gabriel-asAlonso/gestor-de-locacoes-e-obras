import type { Charge, Contract, Expense, Portfolio, Property, RealEstateAgency, Tenant, Unit } from '../models/domain.models';

export const DEMO_DATE_ISO = '2026-08-12';
export const WORKS_DEMO_DATE_ISO = '2026-08-24';

export const INITIAL_PORTFOLIOS: Portfolio[] = [
  { id: 'CAR-001', name: 'Carteira Atlas', holder: 'Atlas Patrimonial Ltda.', document: '12.345.678/0001-10', properties: 4, units: 9 },
  { id: 'CAR-002', name: 'Carteira Horizonte', holder: 'Horizonte Imóveis Ltda.', document: '98.765.432/0001-20', properties: 4, units: 5 },
];

export const INITIAL_PROPERTIES: Property[] = [
  { id: 'IMO-001', portfolio: 'Carteira Atlas', name: 'Centro Empresarial Nexo', address: 'Rua das Acácias, 240 · Centro', units: 3 },
  { id: 'IMO-002', portfolio: 'Carteira Atlas', name: 'Complexo Aurora', address: 'Av. do Contorno, 1180 · Norte', units: 2 },
  { id: 'IMO-003', portfolio: 'Carteira Horizonte', name: 'Edifício Horizonte', address: 'Rua do Mercado, 84 · Centro', units: 1 },
  { id: 'IMO-004', portfolio: 'Carteira Horizonte', name: 'Galeria Pátio Azul', address: 'Alameda Sul, 510 · Jardins', units: 1 },
  { id: 'IMO-005', portfolio: 'Carteira Atlas', name: 'Parque Logístico Vereda', address: 'Rod. das Indústrias, 920 · Distrito Industrial', units: 2 },
  { id: 'IMO-006', portfolio: 'Carteira Atlas', name: 'Edifício Jardim Central', address: 'Av. das Nações, 860 · Bela Vista', units: 2 },
  { id: 'IMO-007', portfolio: 'Carteira Horizonte', name: 'Shopping Alameda', address: 'Praça das Flores, 145 · Savassi', units: 2 },
  { id: 'IMO-008', portfolio: 'Carteira Horizonte', name: 'Centro Comercial Orla', address: 'Av. Beira-Mar, 780 · Praia', units: 1 },
];

export const PROPERTY_IMAGES: Record<string, string> = {
  'IMO-001': '/properties/centro-empresarial-nexo.jpg',
  'IMO-002': '/properties/complexo-aurora.jpg',
  'IMO-003': '/properties/edificio-horizonte.jpg',
  'IMO-004': '/properties/galeria-patio-azul.jpg',
  'IMO-005': '/properties/parque-logistico-vereda.jpg',
  'IMO-006': '/properties/edificio-jardim-central.jpg',
  'IMO-007': '/properties/shopping-alameda.jpg',
  'IMO-008': '/properties/centro-comercial-orla.jpg',
};
export const FALLBACK_PROPERTY_IMAGE = PROPERTY_IMAGES['IMO-001'];

export const INITIAL_UNITS: Unit[] = [
  { id: 'UNI-001', property: 'Centro Empresarial Nexo', portfolio: 'Carteira Atlas', name: 'Sala 101', area: 42, occupied: true },
  { id: 'UNI-002', property: 'Centro Empresarial Nexo', portfolio: 'Carteira Atlas', name: 'Sala 102', area: 39, occupied: true },
  { id: 'UNI-003', property: 'Centro Empresarial Nexo', portfolio: 'Carteira Atlas', name: 'Sala 201', area: 68, occupied: false },
  { id: 'UNI-004', property: 'Complexo Aurora', portfolio: 'Carteira Atlas', name: 'Galpão 01', area: 310, occupied: true },
  { id: 'UNI-005', property: 'Complexo Aurora', portfolio: 'Carteira Atlas', name: 'Galpão 02', area: 280, occupied: true },
  { id: 'UNI-006', property: 'Edifício Horizonte', portfolio: 'Carteira Horizonte', name: 'Módulo A', area: 96, occupied: true },
  { id: 'UNI-007', property: 'Galeria Pátio Azul', portfolio: 'Carteira Horizonte', name: 'Loja 04', area: 74, occupied: false },
  { id: 'UNI-008', property: 'Parque Logístico Vereda', portfolio: 'Carteira Atlas', name: 'Galpão A', area: 420, occupied: false },
  { id: 'UNI-009', property: 'Parque Logístico Vereda', portfolio: 'Carteira Atlas', name: 'Galpão B', area: 380, occupied: true },
  { id: 'UNI-010', property: 'Edifício Jardim Central', portfolio: 'Carteira Atlas', name: 'Sala 301', area: 74, occupied: true },
  { id: 'UNI-011', property: 'Edifício Jardim Central', portfolio: 'Carteira Atlas', name: 'Sala 302', area: 68, occupied: false },
  { id: 'UNI-012', property: 'Shopping Alameda', portfolio: 'Carteira Horizonte', name: 'Loja 11', area: 55, occupied: true },
  { id: 'UNI-013', property: 'Shopping Alameda', portfolio: 'Carteira Horizonte', name: 'Loja 12', area: 61, occupied: false },
  { id: 'UNI-014', property: 'Centro Comercial Orla', portfolio: 'Carteira Horizonte', name: 'Loja térrea', area: 88, occupied: false },
];

export const INITIAL_TENANTS: Tenant[] = [
  { id: 'LOC-018', type: 'PJ', name: 'Estúdio Vereda Ltda.', document: '23.456.789/0001-95', contracts: 1, responsibleAgencyId: 'IMB-001' },
  { id: 'LOC-021', type: 'PJ', name: 'Clínica Lumina Ltda.', document: '34.567.890/0001-30', contracts: 1, responsibleAgencyId: 'IMB-001' },
  { id: 'LOC-009', type: 'PJ', name: 'Logística Prisma Ltda.', document: '45.678.901/0001-75', contracts: 1, responsibleAgencyId: 'IMB-002' },
  { id: 'LOC-014', type: 'PJ', name: 'Oficina Sete Ltda.', document: '12.345.678/0001-95', contracts: 1, responsibleAgencyId: 'IMB-003' },
  { id: 'LOC-004', type: 'PF', name: 'Marina Duarte', document: '123.456.789-09', contracts: 0 },
];

export const INITIAL_AGENCIES: RealEstateAgency[] = [
  { id: 'IMB-001', name: 'Nexo Administração de Imóveis Ltda.', tradeName: 'Nexo Imóveis', document: '11.444.777/0001-61', creci: 'CRECI-MG 12.845-J', contactName: 'Renata Alves', phone: '(31) 99842-1300', email: 'relacionamento@nexoimoveis.com.br' },
  { id: 'IMB-002', name: 'Prisma Gestão Imobiliária Ltda.', tradeName: 'Prisma Gestão', document: '45.678.901/0001-75', creci: 'CRECI-MG 18.302-J', contactName: 'Carlos Menezes', phone: '(31) 3345-8900', email: 'gestao@prismaimobiliaria.com.br' },
  { id: 'IMB-003', name: 'Horizonte Locações Ltda.', tradeName: 'Horizonte Locações', document: '34.567.890/0001-30', creci: 'CRECI-MG 21.774-J', contactName: 'Beatriz Lima', phone: '(31) 99102-4488', email: 'atendimento@horizontelocacoes.com.br' },
];

export const INITIAL_CONTRACTS: Contract[] = [
  { id: 'CTR-014', portfolio: 'Carteira Atlas', property: 'Centro Empresarial Nexo', units: ['Sala 101'], tenant: 'Estúdio Vereda Ltda.', period: '01 fev 2026 — 31 jan 2027', rent: 3200, due: 10, adjustment: 'Fevereiro', charges: ['Aluguel', 'IPTU', 'Condomínio'] },
  { id: 'CTR-021', portfolio: 'Carteira Atlas', property: 'Centro Empresarial Nexo', units: ['Sala 102'], tenant: 'Clínica Lumina Ltda.', period: '01 jun 2026 — 31 mai 2027', rent: 4850, due: 12, adjustment: 'Junho', charges: ['Aluguel', 'Condomínio'] },
  { id: 'CTR-009', portfolio: 'Carteira Atlas', property: 'Complexo Aurora', units: ['Galpão 01', 'Galpão 02'], tenant: 'Logística Prisma Ltda.', period: '15 mar 2026 — 14 mar 2027', rent: 8900, due: 14, adjustment: 'Março', charges: ['Aluguel', 'IPTU', 'Água'] },
  { id: 'CTR-018', portfolio: 'Carteira Horizonte', property: 'Edifício Horizonte', units: ['Módulo A'], tenant: 'Oficina Sete Ltda.', period: '01 ago 2026 — 31 jul 2027', rent: 2750, due: 15, adjustment: 'Agosto', charges: ['Aluguel', 'Condomínio'] },
];

export const INITIAL_CHARGES: Charge[] = [
  { id: 'COB-0084', contract: 'CTR-014', portfolio: 'Carteira Atlas', property: 'Centro Empresarial Nexo', units: ['Sala 101'], tenant: 'Estúdio Vereda Ltda.', competence: '07/2026', status: 'Vencida', items: [
    { name: 'Aluguel', dueDate: '10 ago 2026', dueDateIso: '2026-08-10', amount: 3200, received: 0 },
    { name: 'IPTU', dueDate: '10 ago 2026', dueDateIso: '2026-08-10', amount: 385, received: 0 },
    { name: 'Condomínio', dueDate: '12 ago 2026', dueDateIso: '2026-08-12', amount: 640, received: 0 },
  ] },
  { id: 'COB-0086', contract: 'CTR-021', portfolio: 'Carteira Atlas', property: 'Centro Empresarial Nexo', units: ['Sala 102'], tenant: 'Clínica Lumina Ltda.', competence: '08/2026', status: 'Parcial', items: [
    { name: 'Aluguel', dueDate: '12 ago 2026', dueDateIso: '2026-08-12', amount: 4850, received: 2000 },
    { name: 'Condomínio', dueDate: '12 ago 2026', dueDateIso: '2026-08-12', amount: 820, received: 0 },
  ] },
  { id: 'COB-0087', contract: 'CTR-009', portfolio: 'Carteira Atlas', property: 'Complexo Aurora', units: ['Galpão 01', 'Galpão 02'], tenant: 'Logística Prisma Ltda.', competence: '08/2026', status: 'Próxima', items: [
    { name: 'Aluguel', dueDate: '14 ago 2026', dueDateIso: '2026-08-14', amount: 8900, received: 0 },
    { name: 'Água', dueDate: '18 ago 2026', dueDateIso: '2026-08-18', amount: 460, received: 0 },
  ] },
  { id: 'COB-0088', contract: 'CTR-018', portfolio: 'Carteira Horizonte', property: 'Edifício Horizonte', units: ['Módulo A'], tenant: 'Oficina Sete Ltda.', competence: '08/2026', status: 'Próxima', items: [
    { name: 'Aluguel', dueDate: '15 ago 2026', dueDateIso: '2026-08-15', amount: 2750, received: 0 },
    { name: 'Condomínio', dueDate: '15 ago 2026', dueDateIso: '2026-08-15', amount: 530, received: 0 },
  ] },
  { id: 'COB-0078', contract: 'CTR-014', portfolio: 'Carteira Atlas', property: 'Centro Empresarial Nexo', units: ['Sala 101'], tenant: 'Estúdio Vereda Ltda.', competence: '06/2026', status: 'Recebida', items: [
    { name: 'Aluguel', dueDate: '10 jul 2026', dueDateIso: '2026-07-10', amount: 3200, received: 3200 },
    { name: 'IPTU', dueDate: '10 jul 2026', dueDateIso: '2026-07-10', amount: 385, received: 385 },
  ] },
];

export const INITIAL_EXPENSES: Expense[] = [
  { id: 'PAG-0031', supplier: 'Energia Azul Distribuição', description: 'Energia elétrica · Centro Empresarial Nexo', category: 'Utilidades', amount: 1840.70, dueDate: '09 ago 2026', dueIso: '2026-08-09', paidDate: null, status: 'Vencido' },
  { id: 'PAG-0032', supplier: 'Condomínio Empresarial Nexo', description: 'Cota condominial · agosto/2026', category: 'Condomínio', amount: 2460, dueDate: '12 ago 2026', dueIso: '2026-08-12', paidDate: null, status: 'Pendente' },
  { id: 'PAG-0033', supplier: 'Manutenção Nova Chave', description: 'Revisão preventiva do portão de acesso', category: 'Manutenção', amount: 780, dueDate: '15 ago 2026', dueIso: '2026-08-15', paidDate: null, status: 'Pendente' },
  { id: 'PAG-0034', supplier: 'Prefeitura Municipal', description: 'IPTU · parcela 08/10', category: 'Tributos', amount: 1340, dueDate: '20 ago 2026', dueIso: '2026-08-20', paidDate: null, status: 'Pendente' },
  { id: 'PAG-0028', supplier: 'Seguradora Farol', description: 'Apólice patrimonial · parcela 04/06', category: 'Seguros', amount: 2250, dueDate: '05 ago 2026', dueIso: '2026-08-05', paidDate: '04 ago 2026', status: 'Pago' },
  { id: 'PAG-0027', supplier: 'Conecta Telecom', description: 'Internet corporativa · julho/2026', category: 'Telecom', amount: 389.90, dueDate: '02 ago 2026', dueIso: '2026-08-02', paidDate: '01 ago 2026', status: 'Pago' },
];

export const MANAGER_OPTIONS = ['Núcleo Patrimonial', 'Operação Comercial', 'Financeiro e Contratos'];
export const PROPERTY_TYPE_OPTIONS = ['Edifício comercial', 'Centro comercial', 'Galeria', 'Shopping', 'Complexo logístico', 'Galpão', 'Outro'];
export const UNIT_TYPE_OPTIONS = ['Sala comercial', 'Loja', 'Galpão', 'Módulo', 'Quiosque', 'Depósito', 'Outro'];
export const EXPENSE_CATEGORY_OPTIONS = ['Condomínio', 'Manutenção', 'Seguros', 'Telecom', 'Tributos', 'Utilidades', 'Serviços profissionais', 'Outros'];
export const FINANCIAL_ACCOUNT_OPTIONS = ['Banco Operacional', 'Conta de Recebíveis', 'Caixa administrativo'];
export const PAYMENT_METHOD_OPTIONS = ['Boleto bancário', 'Pix', 'Transferência bancária', 'Débito automático', 'Dinheiro'];
export const DOCUMENT_TYPE_OPTIONS = ['Nota fiscal', 'Boleto', 'Guia', 'Recibo', 'Contrato', 'Outro'];
export const WORK_TEAM_OPTIONS = [
  { name: 'Rafael Almeida', role: 'Engenheiro responsável' },
  { name: 'Carlos Mendes', role: 'Supervisor de campo' },
  { name: 'Marina Costa', role: 'Arquiteta' },
  { name: 'Patrícia Nunes', role: 'Coordenadora de obras' },
  { name: 'Lucas Rocha', role: 'Técnico de manutenção' },
  { name: 'Ana Beatriz Lima', role: 'Assistente operacional' },
];
