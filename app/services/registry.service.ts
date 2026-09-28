import { createEmptyCategorizedDocuments, documentTypeLabel, fileExtension, type CategorizedDocuments, type LocalDocument, type RegistryDocumentTopicId } from '../local-documents';
import type { WorkAttention, WorkCommitment, WorkInterventionType, WorkPriority, WorkRecord, WorkRisk, WorkStatus } from '../works-mocks';
import type { WorkActivity, WorkActivityStatus, WorkContribution, WorkFinancialEntry, WorkJournalEntry, WorkPartner, WorkPendingItem, WorkSupplier, WorkSupplierStatus, WorkTeamAllocation } from '../work-detail-mocks';
import { apiClient } from './auth.service';

type Collection<T> = { data: T[] };
type PortfolioDto = {
  id: string; codigo: string; nome: string; titularNome: string; titularDocumento: string;
  gestorDescricao: string | null; descricao: string | null; observacoes: string | null;
  quantidadeImoveis: number; quantidadeUnidades: number; unidadesOcupadas: number;
};
type PropertyDto = {
  id: string; codigo: string; carteiraId: string; carteiraNome: string; nome: string; endereco: string;
  tipo: 'edificio_comercial' | 'centro_comercial' | 'complexo_logistico' | 'outro'; cep: string | null;
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; inscricaoMunicipal: string | null; matricula: string | null;
  cartorioRegistro: string | null; gestorDescricao: string | null; observacoes: string | null;
  unidadesTotal: number; unidadesOcupadas: number;
};
type DocumentDto = { id: string; nome: string; mimeType: string; tamanho: number; topico: RegistryDocumentTopicId };

export type PortfolioRecord = {
  databaseId: string; id: string; name: string; holder: string; document: string; properties: number; units: number; occupiedUnits: number;
  manager?: string; description?: string; notes?: string;
};
export type PropertyRecord = {
  databaseId: string; portfolioDatabaseId: string; id: string; portfolio: string; name: string; address: string; units: number;
  propertyType?: string; cep?: string; street?: string; number?: string; complement?: string; district?: string;
  city?: string; state?: string; municipalRegistration?: string; registryNumber?: string; registryOffice?: string;
  manager?: string; notes?: string;
};

const PROPERTY_TYPES: Record<PropertyDto['tipo'], string> = {
  edificio_comercial: 'Edifício comercial', centro_comercial: 'Centro comercial',
  complexo_logistico: 'Complexo logístico', outro: 'Outro',
};
const PROPERTY_TYPE_CODES: Record<string, PropertyDto['tipo']> = Object.fromEntries(Object.entries(PROPERTY_TYPES).map(([code, label]) => [label, code])) as Record<string, PropertyDto['tipo']>;
const optional = (value: FormDataEntryValue | null) => String(value ?? '').trim() || null;

export const mapPortfolio = (row: PortfolioDto): PortfolioRecord => ({
  databaseId: row.id, id: row.codigo, name: row.nome, holder: row.titularNome, document: row.titularDocumento,
  properties: Number(row.quantidadeImoveis), units: Number(row.quantidadeUnidades), occupiedUnits: Number(row.unidadesOcupadas), manager: row.gestorDescricao ?? undefined,
  description: row.descricao ?? undefined, notes: row.observacoes ?? undefined,
});
export const mapProperty = (row: PropertyDto): PropertyRecord => ({
  databaseId: row.id, portfolioDatabaseId: row.carteiraId, id: row.codigo, portfolio: row.carteiraNome,
  name: row.nome, address: row.endereco, units: Number(row.unidadesTotal), propertyType: PROPERTY_TYPES[row.tipo],
  cep: row.cep ?? undefined, street: row.logradouro ?? undefined, number: row.numero ?? undefined,
  complement: row.complemento ?? undefined, district: row.bairro ?? undefined, city: row.cidade ?? undefined,
  state: row.uf ?? undefined, municipalRegistration: row.inscricaoMunicipal ?? undefined,
  registryNumber: row.matricula ?? undefined, registryOffice: row.cartorioRegistro ?? undefined,
  manager: row.gestorDescricao ?? undefined, notes: row.observacoes ?? undefined,
});

function portfolioPayload(data: FormData) {
  return { nome: String(data.get('portfolioName') ?? '').trim(), titularNome: String(data.get('portfolioHolder') ?? '').trim(),
    titularDocumento: String(data.get('portfolioDocument') ?? '').trim(), gestorDescricao: optional(data.get('portfolioManager')),
    descricao: optional(data.get('portfolioDescription')), observacoes: optional(data.get('portfolioNotes')) };
}
function propertyPayload(data: FormData, portfolios: PortfolioRecord[]) {
  const portfolioName = String(data.get('propertyPortfolio') ?? '');
  const portfolio = portfolios.find((item) => item.name === portfolioName);
  if (!portfolio) throw new Error('Selecione uma carteira válida.');
  const street = String(data.get('propertyStreet') ?? '').trim();
  const number = String(data.get('propertyNumber') ?? '').trim();
  const complement = String(data.get('propertyComplement') ?? '').trim();
  const district = String(data.get('propertyDistrict') ?? '').trim();
  const city = String(data.get('propertyCity') ?? '').trim();
  const state = String(data.get('propertyState') ?? '').trim().toUpperCase();
  const address = [street && `${street}${number ? `, ${number}` : ''}${complement ? `, ${complement}` : ''}`, district, city && state ? `${city}/${state}` : city || state].filter(Boolean).join(' · ');
  return { carteiraId: portfolio.databaseId, nome: String(data.get('propertyName') ?? '').trim(), endereco: address,
    tipo: PROPERTY_TYPE_CODES[String(data.get('propertyType') ?? '')] ?? 'outro', cep: optional(data.get('propertyCep')),
    logradouro: street || null, numero: number || null, complemento: complement || null, bairro: district || null,
    cidade: city || null, uf: state || null, inscricaoMunicipal: optional(data.get('propertyMunicipalRegistration')),
    matricula: optional(data.get('propertyRegistryNumber')), cartorioRegistro: optional(data.get('propertyRegistryOffice')),
    gestorDescricao: optional(data.get('propertyManager')), observacoes: optional(data.get('propertyNotes')) };
}

type UnitDto = {
  id: string; codigo: string; imovelId: string; imovelNome: string; carteiraId: string; carteiraNome: string;
  nome: string; tipo: 'sala_comercial' | 'loja' | 'galpao' | 'modulo' | 'outro'; areaPrivativa: string; ocupada: boolean;
  codigoComercial: string | null; bloco: string | null; andar: string | null; areaTotal: string | null;
  inscricaoMunicipal: string | null; observacoes: string | null;
};
type TenantDto = {
  id: string; codigo: string; tipoPessoa: 'PF' | 'PJ'; nome: string; documento: string; nomeFantasia: string | null;
  contatoNome: string | null; telefone: string | null; email: string | null; imobiliariaId: string | null;
  imobiliariaCodigo: string | null; imobiliariaNome: string | null; canalPreferido: string | null;
  enderecoCobranca: string | null; inscricaoMunicipal: string | null; observacoes: string | null;
};
type AgencyDto = {
  id: string; codigo: string; razaoSocial: string; nomeFantasia: string | null; documento: string; creci: string;
  contatoNome: string; telefone: string | null; email: string | null; observacoes: string | null;
};

export type UnitRecord = {
  databaseId: string; imovelDatabaseId: string; id: string; property: string; portfolio: string; name: string;
  area: number; occupied: boolean; unitType?: string; code?: string; block?: string; floor?: string;
  totalArea?: number; municipalRegistration?: string; notes?: string;
};
export type TenantRecord = {
  databaseId: string; id: string; type: 'PJ' | 'PF'; name: string; document: string; contracts: number;
  tradeName?: string; contactName?: string; phone?: string; email?: string; preferredChannel?: string;
  billingAddress?: string; municipalRegistration?: string; responsibleAgencyId?: string; notes?: string;
};
export type AgencyRecord = {
  databaseId: string; id: string; name: string; tradeName?: string; document: string; creci: string;
  contactName: string; phone?: string; email?: string; notes?: string;
};

// The front offers 7 unit types; the approved model enum has 5 (db/domains.ts). "Quiosque" and
// "Depósito" have no code and map to "outro" on persistence — registered divergence (see report).
const UNIT_TYPES: Record<UnitDto['tipo'], string> = { sala_comercial: 'Sala comercial', loja: 'Loja', galpao: 'Galpão', modulo: 'Módulo', outro: 'Outro' };
const UNIT_TYPE_CODES: Record<string, UnitDto['tipo']> = Object.fromEntries(Object.entries(UNIT_TYPES).map(([code, label]) => [label, code])) as Record<string, UnitDto['tipo']>;

export const mapUnit = (row: UnitDto): UnitRecord => ({
  databaseId: row.id, imovelDatabaseId: row.imovelId, id: row.codigo, property: row.imovelNome, portfolio: row.carteiraNome,
  name: row.nome, area: Number(row.areaPrivativa), occupied: row.ocupada, unitType: UNIT_TYPES[row.tipo],
  code: row.codigoComercial ?? undefined, block: row.bloco ?? undefined, floor: row.andar ?? undefined,
  totalArea: row.areaTotal != null ? Number(row.areaTotal) : undefined,
  municipalRegistration: row.inscricaoMunicipal ?? undefined, notes: row.observacoes ?? undefined,
});
export const mapTenant = (row: TenantDto): TenantRecord => ({
  databaseId: row.id, id: row.codigo, type: row.tipoPessoa, name: row.nome, document: row.documento, contracts: 0,
  tradeName: row.nomeFantasia ?? undefined, contactName: row.contatoNome ?? undefined, phone: row.telefone ?? undefined,
  email: row.email ?? undefined, preferredChannel: row.canalPreferido ?? undefined, billingAddress: row.enderecoCobranca ?? undefined,
  municipalRegistration: row.inscricaoMunicipal ?? undefined, responsibleAgencyId: row.imobiliariaCodigo ?? undefined,
  notes: row.observacoes ?? undefined,
});
export const mapAgency = (row: AgencyDto): AgencyRecord => ({
  databaseId: row.id, id: row.codigo, name: row.razaoSocial, tradeName: row.nomeFantasia ?? undefined,
  document: row.documento, creci: row.creci, contactName: row.contatoNome, phone: row.telefone ?? undefined, email: row.email ?? undefined,
  notes: row.observacoes ?? undefined,
});

type ContractChargeRuleShape = { name: string; responsibility: string; calculation: string; amount: number; dueRule: string; recurrence: string; proofRequired: boolean };
type ContractEncargoDto = { nome: string; natureza: 'aluguel' | 'encargo'; valorBase: string | null };
type ContractDto = {
  id: string; codigo: string; imovelId: string; imovelNome: string; carteiraId: string; carteiraNome: string;
  locatarioId: string; locatarioNome: string; inicio: string; terminoPrevisto: string; aluguelMensal: string; diaVencimento: number;
  indiceReajuste: string | null; mesReajuste: number | null; formaPagamentoPrevista: string | null; formaPagamentoTexto: string | null;
  observacoes: string | null; estado: string; finalidade: string | null; dataOcupacao: string | null; dataAssinatura: string | null;
  referenciaPagamento: string | null; periodicidadeReajusteMeses: number | null; multaAtrasoPercentual: string | null;
  jurosMensalPercentual: string | null; canalEnvio: string | null; garantiaTipo: string | null; garantiaDetalhe: string | null;
  regraPrimeiraCobranca: string | null; nomeDocumento: string | null;
  unidades: Array<{ id: string; nome: string }>; encargos: ContractEncargoDto[];
};
export type ContractRecord = {
  databaseId: string; id: string; portfolio: string; property: string; units: string[]; tenant: string; period: string;
  rent: number; due: number; adjustment: string; charges: string[]; chargeRules?: ContractChargeRuleShape[]; estado: string;
  startIso?: string; endIso?: string; occupancyDate?: string; purpose?: string; paymentReference?: string; adjustmentIndex?: string;
  adjustmentPeriod?: number; lateFee?: number; monthlyInterest?: number; paymentMethod?: string; deliveryChannel?: string;
  guaranteeType?: string; guaranteeDetails?: string; signatureDate?: string; firstChargeRule?: string; documentName?: string; notes?: string;
};

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const PAYMENT_LABELS: Record<string, string> = { boleto: 'Boleto', pix: 'Pix', transferencia: 'Transferência' };
const PAYMENT_CODES: Record<string, 'boleto' | 'pix' | 'transferencia'> = { Boleto: 'boleto', Pix: 'pix', 'Transferência': 'transferencia' };
const fmtContractDate = (iso: string) => { const [y, m, d] = iso.split('-'); return m ? `${d} ${MONTH_ABBR[Number(m) - 1]} ${y}` : iso; };

export const mapContract = (row: ContractDto): ContractRecord => ({
  databaseId: row.id, id: row.codigo, portfolio: row.carteiraNome, property: row.imovelNome,
  units: row.unidades.map((unit) => unit.nome), tenant: row.locatarioNome,
  period: `${fmtContractDate(row.inicio)} — ${fmtContractDate(row.terminoPrevisto)}`, rent: Number(row.aluguelMensal),
  due: row.diaVencimento, adjustment: row.mesReajuste ? MONTH_NAMES[row.mesReajuste - 1] ?? '' : '', charges: row.encargos.map((item) => item.nome),
  chargeRules: row.encargos.map((item) => ({
    name: item.nome, responsibility: '', calculation: item.valorBase != null ? 'Valor fixo' : '',
    amount: item.valorBase != null ? Number(item.valorBase) : 0, dueRule: '', recurrence: '', proofRequired: false,
  })), estado: row.estado, startIso: row.inicio, endIso: row.terminoPrevisto, occupancyDate: row.dataOcupacao ?? undefined,
  purpose: row.finalidade ?? undefined, paymentReference: row.referenciaPagamento ?? undefined, adjustmentIndex: row.indiceReajuste ?? undefined,
  adjustmentPeriod: row.periodicidadeReajusteMeses ?? undefined, lateFee: row.multaAtrasoPercentual != null ? Number(row.multaAtrasoPercentual) : undefined,
  monthlyInterest: row.jurosMensalPercentual != null ? Number(row.jurosMensalPercentual) : undefined,
  paymentMethod: row.formaPagamentoTexto ?? (row.formaPagamentoPrevista ? PAYMENT_LABELS[row.formaPagamentoPrevista] : undefined),
  deliveryChannel: row.canalEnvio ?? undefined, guaranteeType: row.garantiaTipo ?? undefined, guaranteeDetails: row.garantiaDetalhe ?? undefined,
  signatureDate: row.dataAssinatura ?? undefined, firstChargeRule: row.regraPrimeiraCobranca ?? undefined,
  documentName: row.nomeDocumento ?? undefined, notes: row.observacoes ?? undefined,
});

// ————————————————————————————————————————————————————————————————
// Grupo 4 — Cobranças, Recebimentos e Negociações (E14–E19)
// Valores derivados (total, recebido, saldo, status, parcelas) vêm do servidor; o front só
// mapeia e envia o que o usuário revisou nos modais. Ver CONTRATO-DA-API §4.9–4.11.
// ————————————————————————————————————————————————————————————————
type ChargeItemDto = { id: string; ordem: number; nome: string; natureza: 'aluguel' | 'encargo'; vencimento: string; valor: string; recebido: string; saldo: string; contratoEncargoId: string | null; referencia: string | null };
type ParcelaDto = { id: string; numero: number; vencimento: string; valor: string; recebido: string; saldo: string };
type NegotiationDto = {
  id: string; cobrancaId?: string; versao: number; saldoBase: string; desconto: string; acrescimo: string; entradaPrevista: string;
  totalNegociado: string; totalFinanciado: string; quantidadeParcelas: number; primeiroVencimento: string; dataAcordo: string;
  motivo: string; motivoOutro: string | null; formaPagamentoPrevista: string | null;
  multa: string; juros: string; correcao: string; contatoNome: string | null; contatoCanal: string | null;
  documentoNome: string | null; observacoes: string | null; substituidaEm: string | null; parcelas: ParcelaDto[];
};
type ReceiptDto = {
  id: string; codigo: string; cobrancaId?: string; dataRecebimento: string; dataCredito: string | null;
  valor: string; valorRecebido: string; desconto: string; acrescimo: string; formaPagamento: string | null;
  contaFinanceiraId: string | null; contaDescricao: string | null; referencia: string | null; pagadorDescricao: string | null;
  comprovanteNome: string | null; observacoes: string | null; estornoDeId: string | null; motivoEstorno: string | null;
  alocacoes: Array<{ cobrancaItemId: string | null; negociacaoParcelaId: string | null; valor: string }>;
};
type ChargeDto = {
  id: string; codigo: string; contratoId: string; contratoCodigo: string; carteiraId: string; carteiraNome: string;
  imovelId: string; imovelNome: string; locatarioId: string; locatarioNome: string; competencia: string;
  formaPagamentoPrevista: string | null; observacoes: string | null; unidades: Array<{ nome: string }>;
  itens: ChargeItemDto[]; total: string; recebido: string; saldoOperacional: string; statusDerivado: string;
  negociacaoVigente: NegotiationDto | null; recebimentos: ReceiptDto[];
};

export type ChargeStatus = 'Vencida' | 'Em aberto' | 'Próxima' | 'Parcial' | 'Negociada' | 'Recebida';
export type ChargeItemRecord = { databaseId: string; name: string; natureza: 'aluguel' | 'encargo'; dueDate: string; dueDateIso: string; amount: number; received: number; reference?: string; supportDocumentName?: string };
export type ChargeRecord = {
  databaseId: string; id: string; contract: string; portfolio: string; property: string; units: string[]; tenant: string;
  competence: string; status: ChargeStatus; items: ChargeItemRecord[]; inclusionType?: string; paymentMethod?: string; notes?: string;
  receivedAmount?: number; operationalBalance?: number;
  // Parcelas em aberto do acordo vigente (para alocar recebimentos quando negociada).
  openParcels?: Array<{ databaseId: string; numero: number; balance: number }>;
};

const PAYMENT_ENUM_LABELS: Record<string, string> = { boleto: 'Boleto bancário', pix: 'Pix', transferencia: 'Transferência bancária' };
const paymentToEnum = (label: string): 'boleto' | 'pix' | 'transferencia' | null => {
  const value = label.toLowerCase();
  if (value.includes('pix')) return 'pix';
  if (value.includes('transfer')) return 'transferencia';
  if (value.includes('boleto')) return 'boleto';
  return null;
};
// Motivo: 4 opções da UI ↔ 4 códigos do domínio (divergência registrada; "Readequação"/"Acordo comercial"
// convergem em renegociacao_comercial e o texto livre de "Outro" não é persistido — D07).
const NEGOTIATION_REASON_TO_CODE: Record<string, string> = {
  'Atraso temporário': 'inadimplencia_temporaria', 'Readequação de fluxo': 'renegociacao_comercial',
  'Contestação parcial': 'acordo_extrajudicial', 'Acordo comercial': 'renegociacao_comercial', 'Outro': 'outro',
};
const NEGOTIATION_CODE_TO_REASON: Record<string, string> = {
  inadimplencia_temporaria: 'Atraso temporário', renegociacao_comercial: 'Acordo comercial',
  acordo_extrajudicial: 'Contestação parcial', outro: 'Outro',
};
const competenceLabel = (competencia: string) => { const [year, month] = competencia.split('-'); return `${month}/${year}`; };

export const mapCharge = (row: ChargeDto): ChargeRecord => ({
  databaseId: row.id, id: row.codigo, contract: row.contratoCodigo, portfolio: row.carteiraNome, property: row.imovelNome,
  units: row.unidades.map((unit) => unit.nome), tenant: row.locatarioNome, competence: competenceLabel(row.competencia),
  status: row.statusDerivado as ChargeStatus,
  items: row.itens.map((item) => ({
    databaseId: item.id, name: item.nome, natureza: item.natureza, dueDate: fmtContractDate(item.vencimento), dueDateIso: item.vencimento,
    amount: Number(item.valor), received: Number(item.recebido), reference: item.referencia ?? undefined,
  })),
  paymentMethod: row.formaPagamentoPrevista ? PAYMENT_ENUM_LABELS[row.formaPagamentoPrevista] : undefined,
  notes: row.observacoes ?? undefined, receivedAmount: Number(row.recebido), operationalBalance: Number(row.saldoOperacional),
  openParcels: row.negociacaoVigente
    ? row.negociacaoVigente.parcelas.filter((parcela) => Number(parcela.saldo) > 0)
      .sort((a, b) => a.numero - b.numero).map((parcela) => ({ databaseId: parcela.id, numero: parcela.numero, balance: Number(parcela.saldo) }))
    : undefined,
});

export type NegotiationRecordShape = {
  databaseId: string; id: string; chargeId: string; originalBalance: number; discount: number; surcharge: number; downPayment: number;
  installmentCount: number; firstDueDate: string; negotiatedTotal: number; financedAmount: number;
  schedule: Array<{ number: number; dueDate: string; amount: number }>; reason: string; paymentMethod: string;
  otherReason?: string; downPaymentDueDate?: string; contactName?: string; contactChannel?: string;
  surchargeBreakdown?: { fine: number; interest: number; correction: number }; agreementDocumentName?: string;
  notes: string; createdAt: string; updatedAt: string;
};
export const mapNegotiation = (row: NegotiationDto, chargeCode: string): NegotiationRecordShape => {
  const entrada = row.parcelas.find((parcela) => parcela.numero === 0);
  return {
    databaseId: row.id, id: row.id, chargeId: chargeCode, originalBalance: Number(row.saldoBase), discount: Number(row.desconto),
    surcharge: Number(row.acrescimo), downPayment: Number(row.entradaPrevista), installmentCount: row.quantidadeParcelas,
    firstDueDate: row.primeiroVencimento, negotiatedTotal: Number(row.totalNegociado), financedAmount: Number(row.totalFinanciado),
    schedule: row.parcelas.filter((parcela) => parcela.numero > 0).sort((a, b) => a.numero - b.numero)
      .map((parcela) => ({ number: parcela.numero, dueDate: parcela.vencimento, amount: Number(parcela.valor) })),
    reason: NEGOTIATION_CODE_TO_REASON[row.motivo] ?? 'Outro', otherReason: row.motivoOutro ?? undefined,
    paymentMethod: row.formaPagamentoPrevista ? PAYMENT_ENUM_LABELS[row.formaPagamentoPrevista] : 'Boleto bancário',
    downPaymentDueDate: entrada?.vencimento, contactName: row.contatoNome ?? undefined, contactChannel: row.contatoCanal ?? undefined,
    surchargeBreakdown: { fine: Number(row.multa), interest: Number(row.juros), correction: Number(row.correcao) },
    agreementDocumentName: row.documentoNome ?? undefined, notes: row.observacoes ?? '', createdAt: row.dataAcordo, updatedAt: row.dataAcordo,
  };
};

export type ReceiptRecordShape = {
  id: string; databaseId: string; chargeId: string; receiptDate: string; creditDate: string; amount: number; discount: number; interest: number;
  paymentMethod: string; financialAccount: string; reference: string; thirdPartyPayer: string; proofName: string; note: string;
  allocations: Array<{ itemIndex: number; amount: number }>;
};
export const mapReceipt = (row: ReceiptDto, charge: ChargeRecord): ReceiptRecordShape => ({
  id: row.codigo, databaseId: row.id, chargeId: charge.id, receiptDate: row.dataRecebimento, creditDate: row.dataCredito ?? row.dataRecebimento,
  amount: Number(row.valorRecebido), discount: Number(row.desconto), interest: Number(row.acrescimo),
  paymentMethod: row.formaPagamento ? PAYMENT_ENUM_LABELS[row.formaPagamento] : '—',
  financialAccount: row.contaDescricao ?? '—', reference: row.referencia ?? '', thirdPartyPayer: row.pagadorDescricao ?? '',
  proofName: row.comprovanteNome ?? '', note: row.observacoes ?? row.motivoEstorno ?? '',
  allocations: row.alocacoes.flatMap((allocation) => {
    const itemIndex = allocation.cobrancaItemId ? charge.items.findIndex((item) => item.databaseId === allocation.cobrancaItemId) : -1;
    return itemIndex >= 0 ? [{ itemIndex, amount: Number(allocation.valor) }] : [];
  }),
});

function chargePayload(data: FormData, contracts: ContractRecord[]) {
  const contractCode = String(data.get('chargeContract') ?? '');
  const contract = contracts.find((item) => item.id === contractCode);
  if (!contract) throw new Error('Selecione um contrato válido.');
  const competenceInput = String(data.get('chargeCompetence') ?? '').trim(); // AAAA-MM
  if (!/^\d{4}-\d{2}$/.test(competenceInput)) throw new Error('Informe a competência (mês) da cobrança.');
  const draftItems = JSON.parse(String(data.get('chargeItemsJson') ?? '[]')) as Array<{ name: string; due: string; amount: number; reference?: string }>;
  if (!draftItems.length) throw new Error('Emita ao menos um item na cobrança.');
  const paymentLabel = String(data.get('chargePaymentMethod') ?? '').trim();
  return {
    contratoId: contract.databaseId, competencia: `${competenceInput}-01`,
    formaPagamentoPrevista: paymentToEnum(paymentLabel) ?? 'boleto', observacoes: optional(data.get('chargeNotes')),
    // natureza derivada pelo nome (mesmo critério do contrato); valores revisados pelo usuário, não inventados (D05).
    itens: draftItems.map((item, index) => ({
      ordem: index + 1, nome: item.name, natureza: (item.name === 'Aluguel' ? 'aluguel' : 'encargo') as 'aluguel' | 'encargo',
      vencimento: item.due, valor: (Number(item.amount) || 0).toFixed(2), referencia: item.reference?.trim() || null,
    })),
  };
}

function contractPayload(data: FormData, properties: PropertyRecord[], units: UnitRecord[], tenants: TenantRecord[]) {
  const propertyName = String(data.get('contractProperty') ?? '');
  const property = properties.find((item) => item.name === propertyName);
  if (!property) throw new Error('Selecione um imóvel válido.');
  const tenant = tenants.find((item) => item.id === String(data.get('contractTenant') ?? ''));
  if (!tenant) throw new Error('Selecione um locatário válido.');
  const unidadeIds = data.getAll('contractUnits').map(String).map((code) => units.find((unit) => unit.id === code)?.databaseId).filter((id): id is string => Boolean(id));
  const rules = JSON.parse(String(data.get('contractRulesJson') ?? '[]')) as ContractChargeRuleShape[];
  const paymentLabel = String(data.get('contractPaymentMethod') ?? '').trim();
  const adjustmentIndex = String(data.get('contractAdjustmentIndex') ?? '').trim();
  const monthName = String(data.get('contractAdjustmentMonth') ?? '');
  const monthIndex = MONTH_NAMES.indexOf(monthName);
  const decimalOrNull = (value: FormDataEntryValue | null) => { const raw = String(value ?? '').trim(); return raw && Number(raw) > 0 ? Number(raw).toFixed(2) : null; };
  return {
    imovelId: property.databaseId, locatarioId: tenant.databaseId, unidadeIds,
    inicio: String(data.get('contractStart') ?? ''), terminoPrevisto: String(data.get('contractEnd') ?? ''),
    aluguelMensal: (Number(data.get('contractRent')) || 0).toFixed(2), diaVencimento: Number(data.get('contractDueDay')) || 10,
    indiceReajuste: adjustmentIndex || null, mesReajuste: adjustmentIndex === 'Sem reajuste' ? null : monthIndex >= 0 ? monthIndex + 1 : null,
    formaPagamentoPrevista: PAYMENT_CODES[paymentLabel] ?? null, formaPagamentoTexto: paymentLabel || null,
    observacoes: optional(data.get('contractNotes')), finalidade: optional(data.get('contractPurpose')),
    dataOcupacao: optional(data.get('contractOccupancyDate')), dataAssinatura: optional(data.get('contractSignatureDate')),
    referenciaPagamento: optional(data.get('contractPaymentReference')), periodicidadeReajusteMeses: adjustmentIndex === 'Sem reajuste' ? null : Number(data.get('contractAdjustmentPeriod')) || null,
    multaAtrasoPercentual: decimalOrNull(data.get('contractLateFee')), jurosMensalPercentual: decimalOrNull(data.get('contractMonthlyInterest')),
    canalEnvio: optional(data.get('contractDeliveryChannel')), garantiaTipo: optional(data.get('contractGuaranteeType')),
    garantiaDetalhe: optional(data.get('contractGuaranteeDetails')), regraPrimeiraCobranca: optional(data.get('contractFirstChargeRule')),
    nomeDocumento: optional(data.get('contractDocumentName')),
    encargos: rules.map((rule) => ({ nome: rule.name, natureza: (rule.name === 'Aluguel' ? 'aluguel' : 'encargo') as 'aluguel' | 'encargo', valorBase: rule.name === 'Aluguel' ? null : (rule.amount > 0 ? Number(rule.amount).toFixed(2) : null) })),
  };
}

function unitPayload(data: FormData, properties: PropertyRecord[], current?: UnitRecord | null) {
  const propertyName = String(data.get('unitProperty') ?? '');
  const property = properties.find((item) => item.name === propertyName)
    ?? (current ? properties.find((item) => item.databaseId === current.imovelDatabaseId) : undefined);
  if (!property) throw new Error('Selecione um imóvel válido.');
  const typeLabel = String(data.get('unitType') ?? '');
  const code = String(data.get('unitCode') ?? '').trim();
  const name = current?.occupied ? current.name : `${typeLabel.replace(' comercial', '')} ${code}`.trim();
  const totalArea = String(data.get('unitTotalArea') ?? '').trim();
  return {
    imovelId: property.databaseId, nome: name, tipo: UNIT_TYPE_CODES[typeLabel] ?? 'outro',
    areaPrivativa: String(data.get('unitArea') ?? '').trim(), codigoComercial: code || null,
    bloco: optional(data.get('unitBlock')), andar: optional(data.get('unitFloor')), areaTotal: totalArea || null,
    inscricaoMunicipal: optional(data.get('unitMunicipalRegistration')), observacoes: optional(data.get('unitNotes')),
  };
}
function tenantBilling(data: FormData): string {
  const street = String(data.get('tenantBillingStreet') ?? '').trim();
  const number = String(data.get('tenantBillingNumber') ?? '').trim();
  const complement = String(data.get('tenantBillingComplement') ?? '').trim();
  const district = String(data.get('tenantBillingDistrict') ?? '').trim();
  const city = String(data.get('tenantBillingCity') ?? '').trim();
  const state = String(data.get('tenantBillingState') ?? '').trim().toUpperCase();
  const cep = String(data.get('tenantBillingCep') ?? '').trim();
  return [street && `${street}${number ? `, ${number}` : ''}${complement ? `, ${complement}` : ''}`, district, city && state ? `${city}/${state}` : city || state, cep].filter(Boolean).join(' · ');
}
function tenantPayload(data: FormData, agencies: AgencyRecord[], current?: TenantRecord | null) {
  const agencyCode = String(data.get('tenantResponsibleAgency') ?? '');
  const agency = agencyCode ? agencies.find((item) => item.id === agencyCode) : undefined;
  return {
    tipoPessoa: String(data.get('tenantType') ?? 'PJ'), nome: String(data.get('tenantName') ?? '').trim(),
    documento: String(data.get('tenantDocument') ?? '').trim(), nomeFantasia: optional(data.get('tenantTradeName')),
    contatoNome: optional(data.get('tenantContactName')), telefone: optional(data.get('tenantPhone')),
    email: optional(data.get('tenantEmail')), imobiliariaId: agency?.databaseId ?? null,
    canalPreferido: optional(data.get('tenantPreferredChannel')), enderecoCobranca: tenantBilling(data) || current?.billingAddress || null,
    inscricaoMunicipal: optional(data.get('tenantMunicipalRegistration')), observacoes: optional(data.get('tenantNotes')),
  };
}

// ————————————————————————————————————————————————————————————————
// Grupo 5 — Despesas e pagamentos (E20/E21) + fornecedores (E07) e categorias (E09)
// Status/saldo/pago/dataPagamento vêm derivados do servidor; o front resolve fornecedor
// (buscar-ou-criar por nome) e categoria (rótulo → id) antes de emitir. Ver §4.12–4.14.
// ————————————————————————————————————————————————————————————————
type SupplierDto = { id: string; nome: string; ativo: boolean };
type CategoryDto = { id: string; codigo: string; nome: string; ativo: boolean };
type PaymentDto = { id: string; dataPagamento: string; valor: string; formaPagamento: string | null; contaFinanceiraId: string | null; observacoes: string | null; estornoDeId: string | null; motivoEstorno: string | null };
type ExpenseDto = {
  id: string; codigo: string; origem: string; fornecedorId: string; fornecedorNome: string; categoriaId: string | null; categoriaNome: string | null;
  descricao: string; valor: string; competencia: string | null; vencimento: string; previsaoPagamento: string | null;
  alocacaoTipo: string | null; alocacaoReferencia: string | null; tipoLancamento: string | null; recorrencia: string | null;
  tipoDocumento: string | null; numeroDocumento: string | null; dataEmissao: string | null; anexoNome: string | null;
  formaPagamentoPrevista: string | null; contaFinanceiraPrevistaId: string | null; contaDescricaoPrevista: string | null; observacoes: string | null;
  pago: string; saldo: string; statusDerivado: string; dataPagamento: string | null; pagamentos: PaymentDto[];
};

export type SupplierRecord = { databaseId: string; name: string };
export type CategoryRecord = { databaseId: string; codigo: string; name: string };
export type ExpenseStatusLabel = 'Pendente' | 'Pago' | 'Vencido';
export type ExpenseRecord = {
  databaseId: string; id: string; supplier: string; description: string; category: string; amount: number; balance: number;
  dueDate: string; dueIso: string; paidDate: string | null; status: ExpenseStatusLabel;
  paymentMethod?: string; financialAccount?: string; notes?: string;
  // ids das baixas efetivas (não estornadas) — para reabrir/estornar.
  openPaymentIds?: string[];
  allocationType?: string; allocationId?: string; competence?: string; issueDate?: string; documentType?: string;
  documentNumber?: string; plannedDate?: string; entryType?: string; recurrence?: string; attachmentName?: string;
};

export const mapSupplier = (row: SupplierDto): SupplierRecord => ({ databaseId: row.id, name: row.nome });
export const mapCategory = (row: CategoryDto): CategoryRecord => ({ databaseId: row.id, codigo: row.codigo, name: row.nome });
export const mapExpense = (row: ExpenseDto): ExpenseRecord => {
  const reversed = new Set(row.pagamentos.filter((payment) => payment.estornoDeId).map((payment) => payment.estornoDeId));
  const openPaymentIds = row.pagamentos.filter((payment) => !payment.estornoDeId && !reversed.has(payment.id)).map((payment) => payment.id);
  return {
    databaseId: row.id, id: row.codigo, supplier: row.fornecedorNome, description: row.descricao, category: row.categoriaNome ?? 'Outros',
    amount: Number(row.valor), balance: Number(row.saldo), dueDate: fmtContractDate(row.vencimento), dueIso: row.vencimento,
    paidDate: row.dataPagamento ? fmtContractDate(row.dataPagamento) : null, status: row.statusDerivado as ExpenseStatusLabel,
    paymentMethod: row.formaPagamentoPrevista ? PAYMENT_ENUM_LABELS[row.formaPagamentoPrevista] : undefined,
    financialAccount: row.contaDescricaoPrevista ?? undefined, notes: row.observacoes ?? undefined, openPaymentIds,
    allocationType: row.alocacaoTipo ?? undefined, allocationId: row.alocacaoReferencia ?? undefined,
    competence: row.competencia ?? undefined, plannedDate: row.previsaoPagamento ?? undefined,
    issueDate: row.dataEmissao ?? undefined, documentType: row.tipoDocumento ?? undefined,
    documentNumber: row.numeroDocumento ?? undefined, entryType: row.tipoLancamento ?? undefined,
    recurrence: row.recorrencia ?? undefined, attachmentName: row.anexoNome ?? undefined,
  };
};

// "Serviços profissionais" (rótulo da UI) não está no catálogo semeado → cai em "Outros" (divergência registrada).
function resolveCategoryId(label: string, categories: CategoryRecord[]): string {
  const match = categories.find((category) => category.name === label) ?? categories.find((category) => category.name === 'Outros');
  if (!match) throw new Error('Nenhuma categoria de despesa disponível.');
  return match.databaseId;
}
function expensePayload(data: FormData, categories: CategoryRecord[]) {
  const supplierName = String(data.get('expenseSupplier') ?? '').trim();
  if (!supplierName) throw new Error('Informe o fornecedor da despesa.');
  const alreadyPaid = data.get('expenseAlreadyPaid') === 'on';
  return {
    supplierName, alreadyPaid,
    core: {
      categoriaId: resolveCategoryId(String(data.get('expenseCategory') ?? ''), categories), descricao: String(data.get('expenseDescription') ?? '').trim(),
      valor: (Number(data.get('expenseAmount')) || 0).toFixed(2), competencia: optional(data.get('expenseCompetence')),
      vencimento: String(data.get('expenseDueDate') ?? ''), previsaoPagamento: optional(data.get('expensePlannedDate')),
      alocacaoTipo: optional(data.get('expenseAllocationType')), alocacaoReferencia: optional(data.get('expenseAllocationId')),
      tipoLancamento: optional(data.get('expenseEntryType')), recorrencia: optional(data.get('expenseRecurrence')),
      tipoDocumento: optional(data.get('expenseDocumentType')), numeroDocumento: optional(data.get('expenseDocumentNumber')),
      dataEmissao: optional(data.get('expenseIssueDate')), anexoNome: optional(data.get('expenseAttachmentName')),
      formaPagamentoPrevista: paymentToEnum(String(data.get('expensePaymentMethod') ?? '')),
      contaDescricaoPrevista: optional(data.get('expenseFinancialAccount')), observacoes: optional(data.get('expenseNotes')),
    },
    // Baixa imediata quando "já paga": data + valor total (a UI quita o total; conta financeira é D12 → null).
    payment: alreadyPaid ? { dataPagamento: String(data.get('expensePaidDate') ?? ''), valor: (Number(data.get('expenseAmount')) || 0).toFixed(2), formaPagamento: paymentToEnum(String(data.get('expensePaymentMethod') ?? '')) } : null,
  };
}

// ————————————————————————————————————————————————————————————————
// Grupo 6 — Obras (E22) + profissionais (E08)
// Estado/progresso são operações; spent/saldo são "realizado informado" (provisório D10),
// nunca fabricados a partir de sub-recursos ainda mockados. Ver §4.16 e §4.18.
// ————————————————————————————————————————————————————————————————
type ProfessionalDto = { id: string; nome: string; ativo: boolean };
type WorkDto = {
  id: string; codigo: string; titulo: string; imovelId: string; imovelNome: string; carteiraNome: string; unidadeId: string | null; unidadeNome: string | null;
  responsavelProfissionalId: string; responsavelNome: string; tipoIntervencao: string; descricao: string; prioridade: string; estado: string;
  riscoInformado: string; progressoPercentual: string; inicioPrevisto: string; terminoPrevisto: string; orcamento: string; reserva: string;
  realizadoInformado: string; proximaAtividadeDescricao: string | null; observacoes: string | null; createdAt: string; updatedAt: string;
};

export type ProfessionalRecord = { databaseId: string; name: string };
export const mapProfessional = (row: ProfessionalDto): ProfessionalRecord => ({ databaseId: row.id, name: row.nome });

const WORK_STATUS: Record<string, WorkStatus> = { planejada: 'Planejada', em_andamento: 'Em andamento', pausada: 'Pausada', concluida: 'Concluída', cancelada: 'Cancelada' };
const WORK_STATUS_CODE: Record<string, string> = { Planejada: 'planejada', 'Em andamento': 'em_andamento', Pausada: 'pausada', 'Concluída': 'concluida', Cancelada: 'cancelada' };
const WORK_PRIORITY: Record<string, WorkPriority> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
const WORK_PRIORITY_CODE: Record<string, string> = { Baixa: 'baixa', 'Média': 'media', Alta: 'alta', Urgente: 'urgente' };
const WORK_INTERVENTION: Record<string, WorkInterventionType> = { obra: 'Obra', reforma: 'Reforma', reparo: 'Reparo', manutencao: 'Manutenção', emergencia: 'Emergência' };
const WORK_INTERVENTION_CODE: Record<string, string> = { Obra: 'obra', Reforma: 'reforma', Reparo: 'reparo', 'Manutenção': 'manutencao', 'Emergência': 'emergencia' };
const WORK_RISK: Record<string, WorkRisk> = { dentro_prazo: 'Dentro do prazo', atencao: 'Atenção', em_atraso: 'Em atraso' };

export const mapWork = (row: WorkDto): WorkRecord => ({
  databaseId: row.id, id: row.codigo, title: row.titulo, property: row.imovelNome, unit: row.unidadeNome ?? undefined,
  manager: row.responsavelNome, status: WORK_STATUS[row.estado] ?? 'Planejada', priority: WORK_PRIORITY[row.prioridade] ?? 'Média',
  risk: row.estado === 'concluida' ? 'Concluída' : (WORK_RISK[row.riscoInformado] ?? 'Dentro do prazo'),
  progress: Math.round(Number(row.progressoPercentual)), startDateIso: row.inicioPrevisto, endDateIso: row.terminoPrevisto,
  endLabel: fmtContractDate(row.terminoPrevisto), updatedAtIso: row.updatedAt,
  budget: Number(row.orcamento), spent: Number(row.realizadoInformado),
  projectedCashBalance: Number(row.orcamento) + Number(row.reserva) - Number(row.realizadoInformado),
  nextActivity: row.proximaAtividadeDescricao ?? 'Definir planejamento inicial',
  lastUpdateLabel: `Atualizada em ${fmtContractDate(row.updatedAt.slice(0, 10))}`,
  interventionType: WORK_INTERVENTION[row.tipoIntervencao] ?? 'Obra', description: row.descricao || undefined,
  reserve: Number(row.reserva), notes: row.observacoes ?? undefined,
});

// Cadastro da obra (sem estado/progresso — esses são operações dedicadas).
function workCore(work: WorkRecord, properties: PropertyRecord[], units: UnitRecord[], responsavelProfissionalId: string) {
  const property = properties.find((item) => item.name === work.property);
  if (!property) throw new Error('Selecione um imóvel válido para a obra.');
  const unidadeId = work.unit ? (units.find((unit) => unit.name === work.unit && unit.property === work.property)?.databaseId ?? null) : null;
  const descricao = (work.description ?? '').trim();
  if (!descricao) throw new Error('Informe a descrição da obra.');
  return {
    titulo: work.title.trim(), imovelId: property.databaseId, unidadeId, responsavelProfissionalId, descricao,
    inicioPrevisto: work.startDateIso, terminoPrevisto: work.endDateIso, orcamento: (Number(work.budget) || 0).toFixed(2),
    reserva: (Number(work.reserve) || 0).toFixed(2), tipoIntervencao: WORK_INTERVENTION_CODE[work.interventionType ?? 'Obra'] ?? 'obra',
    prioridade: WORK_PRIORITY_CODE[work.priority] ?? 'media', observacoes: work.notes?.trim() || null,
  };
}

// ————————————————————————————————————————————————————————————————
// Grupo 7 — Obras/Atividades (E23, aninhado em /api/obras/:obraId/atividades)
// Estado da atividade é derivado das ações (concluir/bloquear/reprogramar); concluir recalcula
// o progresso da obra no servidor. Ver §4.19.
// ————————————————————————————————————————————————————————————————
type ActivityDto = {
  id: string; codigo: string; obraId: string; etapa: string; titulo: string; responsavelProfissionalId: string; responsavelNome: string;
  inicio: string; termino: string; estado: string; motivoBloqueio: string | null;
};
type ActivityBundleDto = { atividades: ActivityDto[]; obra: WorkDto };

const ACTIVITY_STAGE: Record<string, WorkActivity['stage']> = { preparacao: 'Preparação', execucao: 'Execução', entrega: 'Entrega' };
const ACTIVITY_STAGE_CODE: Record<string, string> = { 'Preparação': 'preparacao', 'Execução': 'execucao', 'Entrega': 'entrega' };
const ACTIVITY_STATUS: Record<string, WorkActivityStatus> = { nao_iniciada: 'Não iniciada', em_andamento: 'Em andamento', bloqueada: 'Bloqueada', concluida: 'Concluída' };

export const mapActivity = (row: ActivityDto): WorkActivity => ({
  databaseId: row.id, id: row.codigo, stage: ACTIVITY_STAGE[row.etapa] ?? 'Execução', title: row.titulo, manager: row.responsavelNome,
  startDateIso: row.inicio, endDateIso: row.termino, status: ACTIVITY_STATUS[row.estado] ?? 'Não iniciada', blockedReason: row.motivoBloqueio ?? undefined,
});
export type ActivityBundle = { activities: WorkActivity[]; work: WorkRecord };
const activityBundle = (dto: ActivityBundleDto): ActivityBundle => ({ activities: dto.atividades.map(mapActivity), work: mapWork(dto.obra) });

// ————————————————————————————————————————————————————————————————
// Grupo 8 — Obras/Equipe (E24/E25) e Contratações (E26, D08)
// Custo da equipe é derivado (quantidade × valorUnitario). Uma contratação é uma despesa de obra
// (origem=contratacao_obra) + especialização + fornecedor, criados atomicamente. Ver §4.20/§4.21.
// ————————————————————————————————————————————————————————————————
type AllocationDto = { id: string; codigo: string; obraId: string; profissionalId: string; profissionalNome: string; funcao: string; inicio: string; termino: string; modalidade: string; quantidade: string; valorUnitario: string };
type ContractPaymentDto = { id: string; dataPagamento: string; valor: string; observacoes: string | null; estornoDeId: string | null; motivoEstorno: string | null };
type WorkContractDto = {
  id: string; codigo: string; obraId: string; tipoFornecimento: string; dataContratacao: string; fornecedorId: string; fornecedorNome: string;
  descricao: string; valorContratado: string; vencimento: string; observacoes: string | null; pago: string; saldo: string; statusDerivado: string;
  dataUltimoPagamento: string | null; pagamentos: ContractPaymentDto[];
};

const MODALIDADE: Record<string, WorkTeamAllocation['workMode']> = { horas: 'Horas', diarias: 'Diárias' };
const MODALIDADE_CODE: Record<string, string> = { Horas: 'horas', 'Diárias': 'diarias' };
const FORNECIMENTO: Record<string, WorkSupplier['supplyType']> = { servico: 'Serviço', produto: 'Produto', material: 'Material' };
const FORNECIMENTO_CODE: Record<string, string> = { 'Serviço': 'servico', Produto: 'produto', Material: 'material' };

export const mapAllocation = (row: AllocationDto): WorkTeamAllocation => ({
  databaseId: row.id, id: row.codigo, name: row.profissionalNome, role: row.funcao, startDateIso: row.inicio, endDateIso: row.termino,
  workMode: MODALIDADE[row.modalidade] ?? 'Horas', quantity: Number(row.quantidade), unitRate: Number(row.valorUnitario), activityIds: [],
});
export const mapWorkContract = (row: WorkContractDto): WorkSupplier => ({
  databaseId: row.id, id: row.codigo, name: row.fornecedorNome, supplyType: FORNECIMENTO[row.tipoFornecimento] ?? 'Serviço', description: row.descricao,
  contractedAmount: Number(row.valorContratado), paidAmount: Number(row.pago), status: row.statusDerivado as WorkSupplierStatus,
  contractDateIso: row.dataContratacao, dueDateIso: row.vencimento, lastPaymentDateIso: row.dataUltimoPagamento ?? undefined,
  notes: row.observacoes ?? undefined, documents: [],
  payments: row.pagamentos.filter((payment) => !payment.estornoDeId).map((payment) => ({ id: payment.id, amount: Number(payment.valor), dateIso: payment.dataPagamento, note: payment.observacoes ?? undefined })),
});

// Grupo 10: consultas financeiras e diário usam as linhas imutáveis já gravadas;
// não existe tabela duplicada de "lançamentos financeiros".
type FinanceEntryDto = { id: string; codigo: string | null; tipo: 'aporte' | 'ajuste'; descricao: string;
  parte: string; valor: string; data: string; origemId: string | null; estornoDeId: string | null };
type WorkFinanceDto = { obraId: string; equipeCusto: string; fornecedoresContratado: string;
  fornecedoresPago: string; fornecedoresPendente: string; aportesRecebidos: string;
  ajustesLiquidos: string; caixaDisponivel: string; entradas: FinanceEntryDto[] };
type JournalFileDto = { id: string; nome: string; tamanho: number; mimeType: string };
type JournalDto = { id: string; codigo: string; tipo: string; titulo: string; descricao: string;
  ocorridoEm: string; progressoRegistrado: string | null; autorNome: string; arquivos: JournalFileDto[] };
type PendingDto = { id: string; codigo: string; titulo: string; descricao: string; severidade: string };
export type WorkFinanceRecord = {
  workDatabaseId: string; teamCost: number; supplierContracted: number; supplierPaid: number;
  supplierPending: number; totalCommitted: number; contributionsReceived: number;
  cashAdjustments: number; cashMovements: number; availableCash: number; entries: WorkFinancialEntry[];
};
export type WorkPanelRecord = { attentions: WorkAttention[]; commitments: WorkCommitment[]; positionDateIso: string };
export class PartialJournalUploadError extends Error {
  public readonly journalId: string;
  public readonly fileName: string;
  constructor(journalId: string, fileName: string, cause: unknown) {
    super(`Registro do diário salvo, mas não foi possível anexar ${fileName}. Use “Adicionar arquivo” no registro para tentar novamente.`, { cause });
    this.name = 'PartialJournalUploadError';
    this.journalId = journalId;
    this.fileName = fileName;
  }
}
const JOURNAL_KIND: Record<string, WorkJournalEntry['kind']> = {
  atualizacao: 'Atualização', ocorrencia: 'Ocorrência', pendencia: 'Pendência', arquivo: 'Arquivo',
};
const JOURNAL_KIND_CODE: Record<WorkJournalEntry['kind'], string> = {
  'Atualização': 'atualizacao', 'Ocorrência': 'ocorrencia', 'Pendência': 'pendencia', 'Arquivo': 'arquivo',
};
export const mapWorkFinance = (row: WorkFinanceDto): WorkFinanceRecord => {
  const reversedIds = new Set(row.entradas.map((entry) => entry.estornoDeId).filter((id): id is string => Boolean(id)));
  return {
    workDatabaseId: row.obraId, teamCost: Number(row.equipeCusto), supplierContracted: Number(row.fornecedoresContratado),
    supplierPaid: Number(row.fornecedoresPago), supplierPending: Number(row.fornecedoresPendente),
    totalCommitted: Number(row.equipeCusto) + Number(row.fornecedoresContratado),
    contributionsReceived: Number(row.aportesRecebidos), cashAdjustments: Number(row.ajustesLiquidos),
    cashMovements: Number(row.aportesRecebidos) + Number(row.ajustesLiquidos), availableCash: Number(row.caixaDisponivel),
    entries: row.entradas.map((entry) => ({ databaseId: entry.id, id: entry.codigo ?? `EST-${entry.id.slice(0, 8)}`,
      kind: entry.tipo === 'aporte' ? 'Aporte' : 'Ajuste', description: entry.descricao,
      party: entry.parte, amount: Number(entry.valor), dateIso: entry.data, status: 'Registrado',
      sourceId: entry.origemId ?? undefined,
      canReverse: entry.tipo === 'ajuste' && !entry.estornoDeId && !reversedIds.has(entry.id) })),
  };
};
export const mapWorkJournal = (row: JournalDto): WorkJournalEntry => ({
  databaseId: row.id, id: row.codigo, kind: JOURNAL_KIND[row.tipo] ?? 'Atualização',
  title: row.titulo, description: row.descricao, author: row.autorNome,
  dateIso: row.ocorridoEm, progress: row.progressoRegistrado ? Number(row.progressoRegistrado) : undefined,
  files: row.arquivos.map((file) => file.nome), fileDocuments: row.arquivos.map((file) => ({ id: file.id, name: file.nome })),
});
export const mapWorkPending = (row: PendingDto): WorkPendingItem => ({ databaseId: row.id,
  id: row.codigo, title: row.titulo, description: row.descricao,
  tone: row.severidade === 'critica' ? 'danger' : row.severidade === 'atencao' ? 'warning' : 'info',
});

export type ChargeBundle = { charge: ChargeRecord; negotiation: NegotiationRecordShape | null; receipts: ReceiptRecordShape[] };
function chargeBundle(dto: ChargeDto): ChargeBundle {
  const charge = mapCharge(dto);
  const negotiation = dto.negociacaoVigente ? mapNegotiation(dto.negociacaoVigente, charge.id) : null;
  const receipts = dto.recebimentos.filter((receipt) => !receipt.estornoDeId).map((receipt) => mapReceipt(receipt, charge));
  return { charge, negotiation, receipts };
}
async function fetchChargeBundle(databaseId: string): Promise<ChargeBundle> {
  return chargeBundle(await apiClient.request<ChargeDto>(`/cobrancas/${databaseId}`));
}
const toCents = (value: number) => Math.round(value * 100);

export const registryService = {
  async listPortfolios(search = '') { const result = await apiClient.request<Collection<PortfolioDto>>(`/carteiras${search ? `?search=${encodeURIComponent(search)}` : ''}`); return result.data.map(mapPortfolio); },
  async savePortfolio(data: FormData, current?: PortfolioRecord | null) {
    const row = await apiClient.request<PortfolioDto>(current ? `/carteiras/${current.databaseId}` : '/carteiras', { method: current ? 'PATCH' : 'POST', body: JSON.stringify(portfolioPayload(data)) });
    return mapPortfolio(row);
  },
  async listProperties(search = '', portfolioId?: string) {
    const query = new URLSearchParams(); if (search) query.set('search', search); if (portfolioId) query.set('carteiraId', portfolioId);
    const result = await apiClient.request<Collection<PropertyDto>>(`/imoveis${query.size ? `?${query}` : ''}`); return result.data.map(mapProperty);
  },
  async getProperty(id: string) { return mapProperty(await apiClient.request<PropertyDto>(`/imoveis/${id}`)); },
  async saveProperty(data: FormData, portfolios: PortfolioRecord[], current?: PropertyRecord | null) {
    const row = await apiClient.request<PropertyDto>(current ? `/imoveis/${current.databaseId}` : '/imoveis', { method: current ? 'PATCH' : 'POST', body: JSON.stringify(propertyPayload(data, portfolios)) });
    return mapProperty(row);
  },
  async listPropertyDocuments(propertyId: string): Promise<CategorizedDocuments> {
    const result = await apiClient.request<Collection<DocumentDto>>(`/imoveis/${propertyId}/documentos`);
    const categorized = createEmptyCategorizedDocuments();
    await Promise.all(result.data.map(async (row) => {
      const blob = await apiClient.requestBlob(`/documentos/${row.id}/conteudo`);
      const extension = fileExtension(row.nome);
      const document: LocalDocument = { id: row.id, name: row.nome, extension, typeLabel: documentTypeLabel(extension), size: row.tamanho, objectUrl: URL.createObjectURL(blob) };
      categorized[row.topico].push(document);
    }));
    return categorized;
  },
  async uploadPropertyDocument(propertyId: string, topic: RegistryDocumentTopicId, file: File) {
    const body = new FormData(); body.set('topico', topic); body.set('arquivo', file);
    return apiClient.request<DocumentDto>(`/imoveis/${propertyId}/documentos`, { method: 'POST', body });
  },
  removePropertyDocument: (propertyId: string, documentId: string) => apiClient.request<void>(`/imoveis/${propertyId}/documentos/${documentId}`, { method: 'DELETE' }),
  async listUnits(search = '') { const result = await apiClient.request<Collection<UnitDto>>(`/unidades${search ? `?search=${encodeURIComponent(search)}` : ''}`); return result.data.map(mapUnit); },
  async getUnit(id: string) { return mapUnit(await apiClient.request<UnitDto>(`/unidades/${id}`)); },
  async saveUnit(data: FormData, properties: PropertyRecord[], current?: UnitRecord | null) {
    const row = await apiClient.request<UnitDto>(current ? `/unidades/${current.databaseId}` : '/unidades', { method: current ? 'PATCH' : 'POST', body: JSON.stringify(unitPayload(data, properties, current)) });
    return mapUnit(row);
  },
  async listTenants(search = '') { const result = await apiClient.request<Collection<TenantDto>>(`/locatarios${search ? `?search=${encodeURIComponent(search)}` : ''}`); return result.data.map(mapTenant); },
  async getTenant(id: string) { return mapTenant(await apiClient.request<TenantDto>(`/locatarios/${id}`)); },
  async saveTenant(data: FormData, agencies: AgencyRecord[], current?: TenantRecord | null) {
    const row = await apiClient.request<TenantDto>(current ? `/locatarios/${current.databaseId}` : '/locatarios', { method: current ? 'PATCH' : 'POST', body: JSON.stringify(tenantPayload(data, agencies, current)) });
    return mapTenant(row);
  },
  async listAgencies(search = '') { const result = await apiClient.request<Collection<AgencyDto>>(`/imobiliarias${search ? `?search=${encodeURIComponent(search)}` : ''}`); return result.data.map(mapAgency); },
  async createAgency(agency: { name: string; tradeName?: string; document: string; creci: string; contactName: string; phone?: string; email?: string; notes?: string }) {
    const row = await apiClient.request<AgencyDto>('/imobiliarias', { method: 'POST', body: JSON.stringify({
      razaoSocial: agency.name, nomeFantasia: agency.tradeName || null, documento: agency.document, creci: agency.creci,
      contatoNome: agency.contactName, telefone: agency.phone || null, email: agency.email || null, observacoes: agency.notes || null,
    }) });
    return mapAgency(row);
  },
  async listContracts(search = '') { const result = await apiClient.request<Collection<ContractDto>>(`/contratos${search ? `?search=${encodeURIComponent(search)}` : ''}`); return result.data.map(mapContract); },
  async getContract(id: string) { return mapContract(await apiClient.request<ContractDto>(`/contratos/${id}`)); },
  async saveContract(data: FormData, properties: PropertyRecord[], units: UnitRecord[], tenants: TenantRecord[]) {
    const row = await apiClient.request<ContractDto>('/contratos', { method: 'POST', body: JSON.stringify(contractPayload(data, properties, units, tenants)) });
    return mapContract(row);
  },
  async listCharges(search = ''): Promise<ChargeBundle[]> {
    const result = await apiClient.request<Collection<ChargeDto>>(`/cobrancas${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    return result.data.map(chargeBundle);
  },
  getCharge: (databaseId: string) => fetchChargeBundle(databaseId),
  async saveCharge(data: FormData, contracts: ContractRecord[]): Promise<ChargeBundle> {
    return chargeBundle(await apiClient.request<ChargeDto>('/cobrancas', { method: 'POST', body: JSON.stringify(chargePayload(data, contracts)) }));
  },
  async saveReceipt(charge: ChargeRecord, receipt: { amount: number; receiptDate: string; creditDate: string; discount: number; interest: number; paymentMethod: string; financialAccount: string; reference: string; thirdPartyPayer: string; proofName: string; note: string; allocations: Array<{ itemIndex: number; amount: number }> }): Promise<ChargeBundle> {
    // Com acordo vigente o dinheiro liquida as parcelas (por vencimento); sem acordo, os itens da cobrança (D07).
    const alocacoes = charge.openParcels?.length
      ? (() => {
          let remaining = toCents(receipt.amount + receipt.discount - receipt.interest);
          const out: Array<{ negociacaoParcelaId: string; valor: string }> = [];
          for (const parcela of charge.openParcels) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, toCents(parcela.balance));
            if (take > 0) { out.push({ negociacaoParcelaId: parcela.databaseId, valor: (take / 100).toFixed(2) }); remaining -= take; }
          }
          return out;
        })()
      : receipt.allocations.filter((allocation) => allocation.amount > 0)
          .map((allocation) => ({ cobrancaItemId: charge.items[allocation.itemIndex]!.databaseId, valor: allocation.amount.toFixed(2) }));
    if (!alocacoes.length) throw new Error('Distribua o recebimento entre os itens da cobrança.');
    const valorCents = alocacoes.reduce((sum, allocation) => sum + toCents(Number(allocation.valor)), 0);
    await apiClient.request<ReceiptDto>('/recebimentos', { method: 'POST', body: JSON.stringify({
      cobrancaId: charge.databaseId, dataRecebimento: receipt.receiptDate, valor: (valorCents / 100).toFixed(2),
      dataCredito: receipt.creditDate || null, valorRecebido: receipt.amount.toFixed(2), desconto: receipt.discount.toFixed(2),
      acrescimo: receipt.interest.toFixed(2), formaPagamento: paymentToEnum(receipt.paymentMethod),
      contaDescricao: receipt.financialAccount || null, referencia: receipt.reference || null,
      pagadorDescricao: receipt.thirdPartyPayer || null, comprovanteNome: receipt.proofName || null,
      observacoes: receipt.note || null, alocacoes,
    }) });
    return fetchChargeBundle(charge.databaseId);
  },
  async saveNegotiation(charge: ChargeRecord, negotiation: { discount: number; surcharge: number; downPayment: number; downPaymentDueDate?: string; installmentCount: number; firstDueDate: string; reason: string; otherReason?: string; paymentMethod: string; contactName?: string; contactChannel?: string; surchargeBreakdown?: { fine: number; interest: number; correction: number }; agreementDocumentName?: string; notes: string }, existingDatabaseId?: string): Promise<ChargeBundle> {
    const body = {
      desconto: negotiation.discount.toFixed(2), acrescimo: negotiation.surcharge.toFixed(2), entradaPrevista: negotiation.downPayment.toFixed(2),
      entradaVencimento: negotiation.downPayment > 0 ? (negotiation.downPaymentDueDate || null) : null,
      quantidadeParcelas: negotiation.installmentCount, primeiroVencimento: negotiation.firstDueDate,
      dataAcordo: new Date().toISOString().slice(0, 10), motivo: NEGOTIATION_REASON_TO_CODE[negotiation.reason] ?? 'outro',
      motivoOutro: negotiation.reason === 'Outro' ? (negotiation.otherReason?.trim() || null) : null,
      formaPagamentoPrevista: paymentToEnum(negotiation.paymentMethod),
      multa: (negotiation.surchargeBreakdown?.fine ?? 0).toFixed(2),
      juros: (negotiation.surchargeBreakdown?.interest ?? 0).toFixed(2),
      correcao: (negotiation.surchargeBreakdown?.correction ?? 0).toFixed(2),
      contatoNome: negotiation.contactName?.trim() || null, contatoCanal: negotiation.contactChannel || null,
      documentoNome: negotiation.agreementDocumentName || null, observacoes: negotiation.notes?.trim() || null,
    };
    if (existingDatabaseId) await apiClient.request<NegotiationDto>(`/negociacoes/${existingDatabaseId}/substituir`, { method: 'POST', body: JSON.stringify(body) });
    else await apiClient.request<NegotiationDto>('/negociacoes', { method: 'POST', body: JSON.stringify({ cobrancaId: charge.databaseId, ...body }) });
    return fetchChargeBundle(charge.databaseId);
  },
  async listSuppliers(search = ''): Promise<SupplierRecord[]> {
    const result = await apiClient.request<Collection<SupplierDto>>(`/fornecedores${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    return result.data.map(mapSupplier);
  },
  async listExpenseCategories(): Promise<CategoryRecord[]> {
    const result = await apiClient.request<Collection<CategoryDto>>('/categorias-despesa');
    return result.data.map(mapCategory);
  },
  async listExpenses(search = ''): Promise<ExpenseRecord[]> {
    const result = await apiClient.request<Collection<ExpenseDto>>(`/despesas${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    return result.data.map(mapExpense);
  },
  getExpense: async (databaseId: string) => mapExpense(await apiClient.request<ExpenseDto>(`/despesas/${databaseId}`)),
  async saveExpense(data: FormData, categories: CategoryRecord[], suppliers: SupplierRecord[]): Promise<ExpenseRecord> {
    const { supplierName, alreadyPaid, core, payment } = expensePayload(data, categories);
    // Buscar-ou-criar fornecedor por nome exato (o datalist reaproveita nomes existentes; não funde por semelhança — §4.13).
    const existing = suppliers.find((supplier) => supplier.name.trim().toLowerCase() === supplierName.toLowerCase());
    const fornecedorId = existing?.databaseId ?? (await apiClient.request<SupplierDto>('/fornecedores', { method: 'POST', body: JSON.stringify({ nome: supplierName }) })).id;
    const dto = await apiClient.request<ExpenseDto>('/despesas', { method: 'POST', body: JSON.stringify({ fornecedorId, ...core }) });
    if (alreadyPaid && payment) await apiClient.request(`/despesas/${dto.id}/pagamentos`, { method: 'POST', body: JSON.stringify(payment) });
    return mapExpense(await apiClient.request<ExpenseDto>(`/despesas/${dto.id}`));
  },
  async payExpense(expense: ExpenseRecord, dataPagamento: string): Promise<ExpenseRecord> {
    await apiClient.request(`/despesas/${expense.databaseId}/pagamentos`, { method: 'POST', body: JSON.stringify({ dataPagamento, valor: expense.balance.toFixed(2) }) });
    return this.getExpense(expense.databaseId);
  },
  async reopenExpense(expense: ExpenseRecord, motivo: string): Promise<ExpenseRecord> {
    for (const pagamentoId of expense.openPaymentIds ?? []) {
      await apiClient.request(`/despesas/${expense.databaseId}/pagamentos/${pagamentoId}/estornar`, { method: 'POST', body: JSON.stringify({ motivo }) });
    }
    return this.getExpense(expense.databaseId);
  },
  async listProfessionals(search = ''): Promise<ProfessionalRecord[]> {
    const result = await apiClient.request<Collection<ProfessionalDto>>(`/profissionais${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    return result.data.map(mapProfessional);
  },
  async listWorks(search = ''): Promise<WorkRecord[]> {
    const result = await apiClient.request<Collection<WorkDto>>(`/obras${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    return result.data.map(mapWork);
  },
  getWork: async (databaseId: string) => mapWork(await apiClient.request<WorkDto>(`/obras/${databaseId}`)),
  async saveWork(work: WorkRecord, properties: PropertyRecord[], units: UnitRecord[], professionals: ProfessionalRecord[]): Promise<WorkRecord> {
    // Responsável: buscar-ou-criar por nome (mesmo padrão de fornecedor).
    const existingProf = professionals.find((professional) => professional.name.trim().toLowerCase() === work.manager.trim().toLowerCase());
    const responsavelProfissionalId = existingProf?.databaseId ?? (await apiClient.request<ProfessionalDto>('/profissionais', { method: 'POST', body: JSON.stringify({ nome: work.manager.trim() }) })).id;
    const core = workCore(work, properties, units, responsavelProfissionalId);
    if (work.databaseId) return mapWork(await apiClient.request<WorkDto>(`/obras/${work.databaseId}`, { method: 'PATCH', body: JSON.stringify(core) }));
    const estado = work.status === 'Em andamento' ? 'em_andamento' : 'planejada';
    return mapWork(await apiClient.request<WorkDto>('/obras', { method: 'POST', body: JSON.stringify({ ...core, estado }) }));
  },
  async updateWorkProgress(work: WorkRecord, progress: number, proximaAtividade: string): Promise<WorkRecord> {
    return mapWork(await apiClient.request<WorkDto>(`/obras/${work.databaseId}/progresso`, { method: 'POST', body: JSON.stringify({ progressoPercentual: progress.toFixed(2), proximaAtividadeDescricao: proximaAtividade || null }) }));
  },
  async transitionWorkState(work: WorkRecord, status: WorkStatus, motivo?: string): Promise<WorkRecord> {
    return mapWork(await apiClient.request<WorkDto>(`/obras/${work.databaseId}/estado`, { method: 'POST', body: JSON.stringify({ estado: WORK_STATUS_CODE[status], motivo: motivo || null }) }));
  },
  async listActivities(obraId: string): Promise<WorkActivity[]> {
    const result = await apiClient.request<Collection<ActivityDto>>(`/obras/${obraId}/atividades`);
    return result.data.map(mapActivity);
  },
  async createActivity(obraId: string, draft: { stage: string; manager: string; title: string; startDateIso: string; endDateIso: string }, professionals: ProfessionalRecord[]): Promise<ActivityBundle> {
    const existing = professionals.find((professional) => professional.name.trim().toLowerCase() === draft.manager.trim().toLowerCase());
    const responsavelProfissionalId = existing?.databaseId ?? (await apiClient.request<ProfessionalDto>('/profissionais', { method: 'POST', body: JSON.stringify({ nome: draft.manager.trim() }) })).id;
    return activityBundle(await apiClient.request<ActivityBundleDto>(`/obras/${obraId}/atividades`, { method: 'POST', body: JSON.stringify({
      etapa: ACTIVITY_STAGE_CODE[draft.stage] ?? 'execucao', titulo: draft.title, responsavelProfissionalId, inicio: draft.startDateIso, termino: draft.endDateIso,
    }) }));
  },
  async completeActivity(obraId: string, activityDatabaseId: string): Promise<ActivityBundle> {
    return activityBundle(await apiClient.request<ActivityBundleDto>(`/obras/${obraId}/atividades/${activityDatabaseId}/concluir`, { method: 'POST', body: '{}' }));
  },
  async blockActivity(obraId: string, activityDatabaseId: string, motivo: string): Promise<ActivityBundle> {
    return activityBundle(await apiClient.request<ActivityBundleDto>(`/obras/${obraId}/atividades/${activityDatabaseId}/bloquear`, { method: 'POST', body: JSON.stringify({ motivo }) }));
  },
  async reprogramActivity(obraId: string, activityDatabaseId: string, novoTermino: string, justificativa: string): Promise<ActivityBundle> {
    return activityBundle(await apiClient.request<ActivityBundleDto>(`/obras/${obraId}/atividades/${activityDatabaseId}/reprogramar`, { method: 'POST', body: JSON.stringify({ novoTermino, justificativa }) }));
  },
  async listTeam(obraId: string): Promise<WorkTeamAllocation[]> {
    const result = await apiClient.request<Collection<AllocationDto>>(`/obras/${obraId}/equipe`);
    return result.data.map(mapAllocation);
  },
  async createAllocation(obraId: string, draft: { name: string; role: string; startDateIso: string; endDateIso: string; workMode: string; quantity: number; unitRate: number }, professionals: ProfessionalRecord[]): Promise<WorkTeamAllocation[]> {
    const existing = professionals.find((professional) => professional.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
    const profissionalId = existing?.databaseId ?? (await apiClient.request<ProfessionalDto>('/profissionais', { method: 'POST', body: JSON.stringify({ nome: draft.name.trim() }) })).id;
    const result = await apiClient.request<Collection<AllocationDto>>(`/obras/${obraId}/equipe`, { method: 'POST', body: JSON.stringify({
      profissionalId, funcao: draft.role, modalidade: MODALIDADE_CODE[draft.workMode] ?? 'horas', quantidade: (draft.quantity || 0).toFixed(2),
      valorUnitario: (draft.unitRate || 0).toFixed(2), inicio: draft.startDateIso || null, termino: draft.endDateIso || null,
    }) });
    return result.data.map(mapAllocation);
  },
  async removeAllocation(obraId: string, allocationDatabaseId: string): Promise<WorkTeamAllocation[]> {
    const result = await apiClient.request<Collection<AllocationDto>>(`/obras/${obraId}/equipe/${allocationDatabaseId}`, { method: 'DELETE' });
    return result.data.map(mapAllocation);
  },
  async listWorkContracts(obraId: string): Promise<WorkSupplier[]> {
    const result = await apiClient.request<Collection<WorkContractDto>>(`/obras/${obraId}/contratacoes`);
    return result.data.map(mapWorkContract);
  },
  // Grupo 9 — Sócios/participações e aportes (o servidor devolve já no formato do painel).
  async listWorkPartners(obraId: string): Promise<WorkPartner[]> {
    return (await apiClient.request<Collection<WorkPartner>>(`/obras/${obraId}/socios`)).data;
  },
  async addWorkPartner(obraId: string, name: string, participationPercent: number): Promise<WorkPartner[]> {
    return (await apiClient.request<Collection<WorkPartner>>(`/obras/${obraId}/socios`, { method: 'POST', body: JSON.stringify({ nome: name.trim(), percentual: participationPercent.toFixed(2) }) })).data;
  },
  async editWorkParticipation(obraId: string, socioId: string, participationPercent: number): Promise<WorkPartner[]> {
    return (await apiClient.request<Collection<WorkPartner>>(`/obras/${obraId}/socios/${socioId}`, { method: 'PATCH', body: JSON.stringify({ percentual: participationPercent.toFixed(2) }) })).data;
  },
  async removeWorkPartner(obraId: string, socioId: string): Promise<WorkPartner[]> {
    return (await apiClient.request<Collection<WorkPartner>>(`/obras/${obraId}/socios/${socioId}`, { method: 'DELETE' })).data;
  },
  async listWorkContributions(obraId: string): Promise<WorkContribution[]> {
    return (await apiClient.request<Collection<WorkContribution>>(`/obras/${obraId}/aportes`)).data;
  },
  async createWorkContribution(obraId: string, data: { description: string; amount: number; dateIso: string }): Promise<WorkContribution[]> {
    return (await apiClient.request<Collection<WorkContribution>>(`/obras/${obraId}/aportes`, { method: 'POST', body: JSON.stringify({ descricao: data.description.trim(), valorSolicitado: data.amount.toFixed(2), dataSolicitacao: data.dateIso }) })).data;
  },
  async registerContributionPayment(obraId: string, aporteId: string, cotaId: string, data: { amount: number; dateIso: string; note?: string }): Promise<WorkContribution[]> {
    return (await apiClient.request<Collection<WorkContribution>>(`/obras/${obraId}/aportes/${aporteId}/cotas/${cotaId}/pagamentos`, { method: 'POST', body: JSON.stringify({ valor: data.amount.toFixed(2), dataPagamento: data.dateIso, observacoes: data.note ?? null }) })).data;
  },
  async listWorkFinances(): Promise<WorkFinanceRecord[]> {
    const result = await apiClient.request<Collection<WorkFinanceDto>>('/obras/financeiro-resumo');
    return result.data.map(mapWorkFinance);
  },
  async getWorkPanel(): Promise<WorkPanelRecord> {
    return apiClient.request<WorkPanelRecord>('/obras/painel');
  },
  async getWorkFinance(obraId: string): Promise<WorkFinanceRecord> {
    return mapWorkFinance(await apiClient.request<WorkFinanceDto>(`/obras/${obraId}/financeiro`));
  },
  async createCashAdjustment(obraId: string, dateIso: string, description: string, amount: number): Promise<WorkFinanceRecord> {
    return mapWorkFinance(await apiClient.request<WorkFinanceDto>(`/obras/${obraId}/financeiro/ajustes-caixa`, {
      method: 'POST', body: JSON.stringify({ dataMovimento: dateIso, descricao: description, valorAssinado: amount.toFixed(2) }),
    }));
  },
  async reverseCashAdjustment(obraId: string, id: string, motivo: string): Promise<WorkFinanceRecord> {
    return mapWorkFinance(await apiClient.request<WorkFinanceDto>(`/obras/${obraId}/financeiro/ajustes-caixa/${id}/estornar`, {
      method: 'POST', body: JSON.stringify({ motivo }),
    }));
  },
  async listWorkJournal(obraId: string): Promise<WorkJournalEntry[]> {
    const result = await apiClient.request<Collection<JournalDto>>(`/obras/${obraId}/diario`);
    return result.data.map(mapWorkJournal);
  },
  async createWorkJournal(obraId: string, entry: { kind: WorkJournalEntry['kind']; title: string; description: string;
    progress?: number; nextActivity?: string; files?: File[] }): Promise<WorkJournalEntry> {
    const dto = await apiClient.request<JournalDto>(`/obras/${obraId}/diario`, { method: 'POST', body: JSON.stringify({
      tipo: JOURNAL_KIND_CODE[entry.kind], titulo: entry.title, descricao: entry.description,
      progressoRegistrado: entry.progress == null ? null : entry.progress.toFixed(2),
      proximaAtividadeDescricao: entry.nextActivity || null,
    }) });
    for (const file of entry.files ?? []) {
      try { await this.uploadWorkJournalFile(obraId, dto.id, file); }
      catch (error) { throw new PartialJournalUploadError(dto.id, file.name, error); }
    }
    const updated = await apiClient.request<JournalDto>(`/obras/${obraId}/diario/${dto.id}`);
    return mapWorkJournal(updated);
  },
  async uploadWorkJournalFile(obraId: string, entryId: string, file: File): Promise<WorkJournalEntry> {
    const body = new FormData(); body.set('arquivo', file);
    return mapWorkJournal(await apiClient.request<JournalDto>(`/obras/${obraId}/diario/${entryId}/documentos`, { method: 'POST', body }));
  },
  async listWorkPending(obraId: string): Promise<WorkPendingItem[]> {
    const result = await apiClient.request<Collection<PendingDto>>(`/obras/${obraId}/pendencias`);
    return result.data.map(mapWorkPending);
  },
  async resolveWorkPending(obraId: string, id: string): Promise<WorkPendingItem[]> {
    const result = await apiClient.request<Collection<PendingDto>>(`/obras/${obraId}/pendencias/${id}/resolver`, { method: 'POST', body: '{}' });
    return result.data.map(mapWorkPending);
  },
  async downloadDocument(id: string, name: string): Promise<void> {
    const blob = await apiClient.requestBlob(`/documentos/${id}/conteudo`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  async createWorkContract(obraId: string, draft: { name: string; supplyType: string; description: string; contractedAmount: number; contractDateIso: string; dueDateIso: string; notes?: string }): Promise<WorkSupplier[]> {
    const result = await apiClient.request<Collection<WorkContractDto>>(`/obras/${obraId}/contratacoes`, { method: 'POST', body: JSON.stringify({
      fornecedorNome: draft.name.trim(), tipoFornecimento: FORNECIMENTO_CODE[draft.supplyType] ?? 'servico', descricao: draft.description,
      valorContratado: (draft.contractedAmount || 0).toFixed(2), dataContratacao: draft.contractDateIso, vencimento: draft.dueDateIso, observacoes: draft.notes?.trim() || null,
    }) });
    return result.data.map(mapWorkContract);
  },
  async payWorkContract(obraId: string, contractDatabaseId: string, draft: { amount: number; dateIso: string; note?: string }): Promise<WorkSupplier[]> {
    const result = await apiClient.request<Collection<WorkContractDto>>(`/obras/${obraId}/contratacoes/${contractDatabaseId}/pagamentos`, { method: 'POST', body: JSON.stringify({
      dataPagamento: draft.dateIso, valor: (draft.amount || 0).toFixed(2), observacoes: draft.note?.trim() || null,
    }) });
    return result.data.map(mapWorkContract);
  },
};
