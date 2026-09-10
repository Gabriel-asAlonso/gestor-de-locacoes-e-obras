"use client";

import type { CSSProperties, ReactNode } from "react";
import { createContext, FormEvent, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Info,
  ArrowUpDown,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  ChevronsUpDown,
  CircleCheck,
  ClipboardList,
  DoorOpen,
  FileSignature,
  HandCoins,
  Handshake,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Ban,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  PencilLine,
  Play,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  UsersRound,
  WalletCards,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createWorkDetailMock,
  type WorkActivity,
  type WorkActivityStatus,
  type WorkContribution,
  type WorkFinancialEntry,
  type WorkJournalEntry,
  type WorkPartner,
  type WorkPendingItem,
  type WorkSupplier,
  type WorkTeamAllocation,
} from "./work-detail-mocks";
import { WorkSuppliersPanel } from "./work-suppliers";
import { WorkPartnersPanel, type PartnerPaymentEvent } from "./work-partners";
import { contributionRemaining, participationTotal } from "./work-partners-model";
import {
  ALL_REPORT_PORTFOLIOS,
  buildAccountingReportModel,
  competenceToInputValue,
  inputValueToCompetence,
  suggestedAccountingReportFilename,
} from "./accounting-report";
import type { AccountingReportDownload } from "./accounting-report-workbook";
import {
  buildNegotiationSchedule,
  calculateNegotiationTotals,
  validateNegotiationTerms,
  type ChargeNegotiation,
  type NegotiationTerms,
} from "./charge-negotiation";
import { CategorizedDocumentManager, DocumentCollection, DocumentManager } from "./document-manager";
import { FileField } from "./file-field";
import { ConfirmDialog, useDiscardGuard, type ConfirmPrompt } from "./confirm-dialog";
import { ModalPortal } from "./modal-portal";
import {
  createEmptyCategorizedDocuments,
  flattenCategorizedDocuments,
  revokeDocumentUrls,
  type CategorizedDocuments,
  type LocalDocument,
} from "./local-documents";
import {
  workAttentionRecords,
  workCommitments,
  workRecords,
  type WorkAttention,
  type WorkInterventionType,
  type WorkPriority,
  type WorkRecord,
  type WorkStatus,
} from "./works-mocks";

type Status = "Vencida" | "Em aberto" | "Próxima" | "Parcial" | "Negociada" | "Recebida";
type ExpenseStatus = "Pendente" | "Pago" | "Vencido";
type AppModule = "Módulo 1" | "Módulo 2";
type Page = "Visão geral" | "Carteiras" | "Imóveis" | "Unidades" | "Locatários" | "Contratos" | "Cobranças" | "Despesas" | "Obras" | "Nova obra" | "Detalhe da obra";
const MODULE_LABEL: Record<AppModule, string> = { "Módulo 1": "Locações", "Módulo 2": "Obras" };
const PAGE_AREA: Partial<Record<Page, string>> = {
  Carteiras: "Estrutura", Imóveis: "Estrutura", Unidades: "Estrutura", Locatários: "Estrutura",
  Contratos: "Locação", Cobranças: "Locação", Despesas: "Financeiro",
  "Nova obra": "Obras", "Detalhe da obra": "Obras",
};
const breadcrumbTrail = (module: AppModule, page: Page) =>
  [MODULE_LABEL[module], PAGE_AREA[page], page].filter((segment, index, list): segment is string => Boolean(segment) && segment !== list[index - 1]);
type FormKind = "portfolio" | "property" | "unit" | "tenant" | "contract" | "charge" | "expense" | null;
type ContentState = "ready" | "loading" | "error";
type ToastMessage = { message: string; reference: string } | null;
type FormDocuments = LocalDocument[] | CategorizedDocuments;
type WorkFormDraft = {
  interventionType: WorkInterventionType;
  title: string;
  property: string;
  unit: string;
  description: string;
  priority: WorkPriority;
  manager: string;
  team: string[];
  startDateIso: string;
  endDateIso: string;
  status: WorkStatus;
  budget: string;
  reserve: string;
  notes: string;
  attachments: string[];
};
type WorkFormErrorKey = keyof WorkFormDraft | "dateRange";
type WorkFormErrors = Partial<Record<WorkFormErrorKey, string>>;
type WorkDetailTab = "Resumo" | "Planejamento" | "Equipe" | "Fornecedores" | "Sócios" | "Financeiro" | "Diário e arquivos";
type WorkDetailAction =
  | { type: "update" | "activity" | "team" }
  | { type: "cash" }
  | { type: "block" | "reprogram"; activity: WorkActivity }
  | null;
type WorkCostSummary = {
  teamCost: number;
  supplierContracted: number;
  supplierPaid: number;
  supplierPending: number;
  totalCommitted: number;
  contributionsReceived: number;
  cashAdjustments: number;
  cashMovements: number;
  availableCash: number;
};
type Portfolio = {
  id: string;
  name: string;
  holder: string;
  document: string;
  properties: number;
  units: number;
  manager?: string;
  description?: string;
  notes?: string;
};
type Property = {
  id: string;
  portfolio: string;
  name: string;
  address: string;
  units: number;
  propertyType?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  municipalRegistration?: string;
  registryNumber?: string;
  registryOffice?: string;
  manager?: string;
  notes?: string;
};
type Unit = {
  id: string;
  property: string;
  portfolio: string;
  name: string;
  area: number;
  occupied: boolean;
  unitType?: string;
  code?: string;
  block?: string;
  floor?: string;
  totalArea?: number;
  municipalRegistration?: string;
  notes?: string;
};
type Tenant = {
  id: string;
  type: "PJ" | "PF";
  name: string;
  document: string;
  contracts: number;
  tradeName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  preferredChannel?: string;
  billingAddress?: string;
  municipalRegistration?: string;
  responsibleAgencyId?: string;
  notes?: string;
};
type RealEstateAgency = {
  id: string;
  name: string;
  tradeName?: string;
  document: string;
  creci: string;
  contactName: string;
  phone?: string;
  email?: string;
  notes?: string;
};
type RegistryDetail = { kind: "property"; record: Property } | { kind: "unit"; record: Unit } | { kind: "tenant"; record: Tenant };
const FilterStateContext = createContext(false);
type ContractChargeRule = {
  name: string;
  responsibility: string;
  calculation: string;
  amount: number;
  dueRule: string;
  recurrence: string;
  proofRequired: boolean;
};
type ChargeItem = {
  name: string;
  dueDate: string;
  dueDateIso?: string;
  amount: number;
  received: number;
  reference?: string;
  supportDocumentName?: string;
};
type ChargeDraftItem = { name: string; due: string; amount: number; reference?: string; supportDocumentName?: string };
type Charge = {
  id: string;
  contract: string;
  portfolio: string;
  property: string;
  units: string[];
  tenant: string;
  competence: string;
  status: Status;
  items: ChargeItem[];
  inclusionType?: string;
  paymentMethod?: string;
  notes?: string;
};
type Contract = {
  id: string;
  portfolio: string;
  property: string;
  units: string[];
  tenant: string;
  period: string;
  rent: number;
  due: number;
  adjustment: string;
  charges: string[];
  chargeRules?: ContractChargeRule[];
  startIso?: string;
  endIso?: string;
  occupancyDate?: string;
  purpose?: string;
  paymentReference?: string;
  adjustmentIndex?: string;
  adjustmentPeriod?: number;
  lateFee?: number;
  monthlyInterest?: number;
  paymentMethod?: string;
  deliveryChannel?: string;
  guaranteeType?: string;
  guaranteeDetails?: string;
  signatureDate?: string;
  firstChargeRule?: string;
  documentName?: string;
  notes?: string;
};
type Expense = {
  id: string;
  supplier: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  dueIso: string;
  paidDate: string | null;
  status: ExpenseStatus;
  allocationType?: string;
  allocationId?: string;
  competence?: string;
  issueDate?: string;
  documentType?: string;
  documentNumber?: string;
  plannedDate?: string;
  entryType?: string;
  recurrence?: string;
  paymentMethod?: string;
  financialAccount?: string;
  attachmentName?: string;
  notes?: string;
};
type ReceiptAllocation = { itemIndex: number; amount: number };
type ReceiptDraft = {
  id: string;
  chargeId: string;
  receiptDate: string;
  creditDate: string;
  amount: number;
  discount: number;
  interest: number;
  paymentMethod: string;
  financialAccount: string;
  reference: string;
  thirdPartyPayer: string;
  proofName: string;
  note: string;
  allocations: ReceiptAllocation[];
};
const expenseStatusPriority: Record<ExpenseStatus, number> = { Vencido: 0, Pendente: 1, Pago: 2 };

const portfolios: Portfolio[] = [
  { id: "CAR-001", name: "Carteira Atlas", holder: "Atlas Patrimonial Ltda.", document: "12.345.678/0001-10", properties: 4, units: 9 },
  { id: "CAR-002", name: "Carteira Horizonte", holder: "Horizonte Imóveis Ltda.", document: "98.765.432/0001-20", properties: 4, units: 5 },
];

const properties: Property[] = [
  { id: "IMO-001", portfolio: "Carteira Atlas", name: "Centro Empresarial Nexo", address: "Rua das Acácias, 240 · Centro", units: 3 },
  { id: "IMO-002", portfolio: "Carteira Atlas", name: "Complexo Aurora", address: "Av. do Contorno, 1180 · Norte", units: 2 },
  { id: "IMO-003", portfolio: "Carteira Horizonte", name: "Edifício Horizonte", address: "Rua do Mercado, 84 · Centro", units: 1 },
  { id: "IMO-004", portfolio: "Carteira Horizonte", name: "Galeria Pátio Azul", address: "Alameda Sul, 510 · Jardins", units: 1 },
  { id: "IMO-005", portfolio: "Carteira Atlas", name: "Parque Logístico Vereda", address: "Rod. das Indústrias, 920 · Distrito Industrial", units: 2 },
  { id: "IMO-006", portfolio: "Carteira Atlas", name: "Edifício Jardim Central", address: "Av. das Nações, 860 · Bela Vista", units: 2 },
  { id: "IMO-007", portfolio: "Carteira Horizonte", name: "Shopping Alameda", address: "Praça das Flores, 145 · Savassi", units: 2 },
  { id: "IMO-008", portfolio: "Carteira Horizonte", name: "Centro Comercial Orla", address: "Av. Beira-Mar, 780 · Praia", units: 1 },
];

const propertyCoverImages: Record<string, string> = {
  "IMO-001": "/properties/centro-empresarial-nexo.jpg",
  "IMO-002": "/properties/complexo-aurora.jpg",
  "IMO-003": "/properties/edificio-horizonte.jpg",
  "IMO-004": "/properties/galeria-patio-azul.jpg",
  "IMO-005": "/properties/parque-logistico-vereda.jpg",
  "IMO-006": "/properties/edificio-jardim-central.jpg",
  "IMO-007": "/properties/shopping-alameda.jpg",
  "IMO-008": "/properties/centro-comercial-orla.jpg",
};
const fallbackPropertyCover = "/properties/centro-empresarial-nexo.jpg";
const propertyCoverImagesByName = Object.fromEntries(properties.map((property) => [property.name, propertyCoverImages[property.id] ?? fallbackPropertyCover])) as Record<string, string>;

const units: Unit[] = [
  { id: "UNI-001", property: "Centro Empresarial Nexo", portfolio: "Carteira Atlas", name: "Sala 101", area: 42, occupied: true },
  { id: "UNI-002", property: "Centro Empresarial Nexo", portfolio: "Carteira Atlas", name: "Sala 102", area: 39, occupied: true },
  { id: "UNI-003", property: "Centro Empresarial Nexo", portfolio: "Carteira Atlas", name: "Sala 201", area: 68, occupied: false },
  { id: "UNI-004", property: "Complexo Aurora", portfolio: "Carteira Atlas", name: "Galpão 01", area: 310, occupied: true },
  { id: "UNI-005", property: "Complexo Aurora", portfolio: "Carteira Atlas", name: "Galpão 02", area: 280, occupied: true },
  { id: "UNI-006", property: "Edifício Horizonte", portfolio: "Carteira Horizonte", name: "Módulo A", area: 96, occupied: true },
  { id: "UNI-007", property: "Galeria Pátio Azul", portfolio: "Carteira Horizonte", name: "Loja 04", area: 74, occupied: false },
  { id: "UNI-008", property: "Parque Logístico Vereda", portfolio: "Carteira Atlas", name: "Galpão A", area: 420, occupied: false },
  { id: "UNI-009", property: "Parque Logístico Vereda", portfolio: "Carteira Atlas", name: "Galpão B", area: 380, occupied: true },
  { id: "UNI-010", property: "Edifício Jardim Central", portfolio: "Carteira Atlas", name: "Sala 301", area: 74, occupied: true },
  { id: "UNI-011", property: "Edifício Jardim Central", portfolio: "Carteira Atlas", name: "Sala 302", area: 68, occupied: false },
  { id: "UNI-012", property: "Shopping Alameda", portfolio: "Carteira Horizonte", name: "Loja 11", area: 55, occupied: true },
  { id: "UNI-013", property: "Shopping Alameda", portfolio: "Carteira Horizonte", name: "Loja 12", area: 61, occupied: false },
  { id: "UNI-014", property: "Centro Comercial Orla", portfolio: "Carteira Horizonte", name: "Loja térrea", area: 88, occupied: false },
];

const tenants: Tenant[] = [
  { id: "LOC-018", type: "PJ", name: "Estúdio Vereda Ltda.", document: "23.456.789/0001-95", contracts: 1, responsibleAgencyId: "IMB-001" },
  { id: "LOC-021", type: "PJ", name: "Clínica Lumina Ltda.", document: "34.567.890/0001-30", contracts: 1, responsibleAgencyId: "IMB-001" },
  { id: "LOC-009", type: "PJ", name: "Logística Prisma Ltda.", document: "45.678.901/0001-75", contracts: 1, responsibleAgencyId: "IMB-002" },
  { id: "LOC-014", type: "PJ", name: "Oficina Sete Ltda.", document: "12.345.678/0001-95", contracts: 1, responsibleAgencyId: "IMB-003" },
  { id: "LOC-004", type: "PF", name: "Marina Duarte", document: "123.456.789-09", contracts: 0 },
];

const realEstateAgencies: RealEstateAgency[] = [
  { id: "IMB-001", name: "Nexo Administração de Imóveis Ltda.", tradeName: "Nexo Imóveis", document: "11.444.777/0001-61", creci: "CRECI-MG 12.845-J", contactName: "Renata Alves", phone: "(31) 99842-1300", email: "relacionamento@nexoimoveis.com.br" },
  { id: "IMB-002", name: "Prisma Gestão Imobiliária Ltda.", tradeName: "Prisma Gestão", document: "45.678.901/0001-75", creci: "CRECI-MG 18.302-J", contactName: "Carlos Menezes", phone: "(31) 3345-8900", email: "gestao@prismaimobiliaria.com.br" },
  { id: "IMB-003", name: "Horizonte Locações Ltda.", tradeName: "Horizonte Locações", document: "34.567.890/0001-30", creci: "CRECI-MG 21.774-J", contactName: "Beatriz Lima", phone: "(31) 99102-4488", email: "atendimento@horizontelocacoes.com.br" },
];

const contracts: Contract[] = [
  { id: "CTR-014", portfolio: "Carteira Atlas", property: "Centro Empresarial Nexo", units: ["Sala 101"], tenant: "Estúdio Vereda Ltda.", period: "01 fev 2026 — 31 jan 2027", rent: 3200, due: 10, adjustment: "Fevereiro", charges: ["Aluguel", "IPTU", "Condomínio"] },
  { id: "CTR-021", portfolio: "Carteira Atlas", property: "Centro Empresarial Nexo", units: ["Sala 102"], tenant: "Clínica Lumina Ltda.", period: "01 jun 2026 — 31 mai 2027", rent: 4850, due: 12, adjustment: "Junho", charges: ["Aluguel", "Condomínio"] },
  { id: "CTR-009", portfolio: "Carteira Atlas", property: "Complexo Aurora", units: ["Galpão 01", "Galpão 02"], tenant: "Logística Prisma Ltda.", period: "15 mar 2026 — 14 mar 2027", rent: 8900, due: 14, adjustment: "Março", charges: ["Aluguel", "IPTU", "Água"] },
  { id: "CTR-018", portfolio: "Carteira Horizonte", property: "Edifício Horizonte", units: ["Módulo A"], tenant: "Oficina Sete Ltda.", period: "01 ago 2026 — 31 jul 2027", rent: 2750, due: 15, adjustment: "Agosto", charges: ["Aluguel", "Condomínio"] },
];

const charges: Charge[] = [
  { id: "COB-0084", contract: "CTR-014", portfolio: "Carteira Atlas", property: "Centro Empresarial Nexo", units: ["Sala 101"], tenant: "Estúdio Vereda Ltda.", competence: "07/2026", status: "Vencida", items: [
    { name: "Aluguel", dueDate: "10 ago 2026", amount: 3200, received: 0 },
    { name: "IPTU", dueDate: "10 ago 2026", amount: 385, received: 0 },
    { name: "Condomínio", dueDate: "12 ago 2026", amount: 640, received: 0 },
  ] },
  { id: "COB-0086", contract: "CTR-021", portfolio: "Carteira Atlas", property: "Centro Empresarial Nexo", units: ["Sala 102"], tenant: "Clínica Lumina Ltda.", competence: "08/2026", status: "Parcial", items: [
    { name: "Aluguel", dueDate: "12 ago 2026", amount: 4850, received: 2000 },
    { name: "Condomínio", dueDate: "12 ago 2026", amount: 820, received: 0 },
  ] },
  { id: "COB-0087", contract: "CTR-009", portfolio: "Carteira Atlas", property: "Complexo Aurora", units: ["Galpão 01", "Galpão 02"], tenant: "Logística Prisma Ltda.", competence: "08/2026", status: "Próxima", items: [
    { name: "Aluguel", dueDate: "14 ago 2026", amount: 8900, received: 0 },
    { name: "Água", dueDate: "18 ago 2026", amount: 460, received: 0 },
  ] },
  { id: "COB-0088", contract: "CTR-018", portfolio: "Carteira Horizonte", property: "Edifício Horizonte", units: ["Módulo A"], tenant: "Oficina Sete Ltda.", competence: "08/2026", status: "Próxima", items: [
    { name: "Aluguel", dueDate: "15 ago 2026", amount: 2750, received: 0 },
    { name: "Condomínio", dueDate: "15 ago 2026", amount: 530, received: 0 },
  ] },
  { id: "COB-0078", contract: "CTR-014", portfolio: "Carteira Atlas", property: "Centro Empresarial Nexo", units: ["Sala 101"], tenant: "Estúdio Vereda Ltda.", competence: "06/2026", status: "Recebida", items: [
    { name: "Aluguel", dueDate: "10 jul 2026", amount: 3200, received: 3200 },
    { name: "IPTU", dueDate: "10 jul 2026", amount: 385, received: 385 },
  ] },
];

function contractDueDate(competence: string, dueDay: number, paymentReference = "Mês a vencer") {
  const [sourceYear, sourceMonth] = competence.split("-").map(Number);
  const target = new Date(Date.UTC(sourceYear, sourceMonth - 1 + (paymentReference === "Mês vencido" ? 1 : 0), 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  if (!year || !month) return "";
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(dueDay, lastDay)).padStart(2, "0")}`;
}

function buildChargeItemsFromContract(contract: Contract, competence: string): ChargeDraftItem[] {
  const rules = contract.chargeRules?.length ? contract.chargeRules : contract.charges.map((name) => ({ name, amount: name === "Aluguel" ? contract.rent : 0 }));
  return rules.map((rule) => {
    const name = rule.name;
    const previousCharge = charges.find((charge) => charge.contract === contract.id && charge.items.some((item) => item.name === name));
    const previousAmount = previousCharge?.items.find((item) => item.name === name)?.amount;
    return {
      name,
      due: contractDueDate(competence, contract.due, contract.paymentReference),
      amount: name === "Aluguel" ? contract.rent : rule.amount || previousAmount || 0,
      reference: "",
    };
  });
}

const expenses: Expense[] = [
  { id: "PAG-0031", supplier: "Energia Azul Distribuição", description: "Energia elétrica · Centro Empresarial Nexo", category: "Utilidades", amount: 1840.70, dueDate: "09 ago 2026", dueIso: "2026-08-09", paidDate: null, status: "Vencido" },
  { id: "PAG-0032", supplier: "Condomínio Empresarial Nexo", description: "Cota condominial · agosto/2026", category: "Condomínio", amount: 2460, dueDate: "12 ago 2026", dueIso: "2026-08-12", paidDate: null, status: "Pendente" },
  { id: "PAG-0033", supplier: "Manutenção Nova Chave", description: "Revisão preventiva do portão de acesso", category: "Manutenção", amount: 780, dueDate: "15 ago 2026", dueIso: "2026-08-15", paidDate: null, status: "Pendente" },
  { id: "PAG-0034", supplier: "Prefeitura Municipal", description: "IPTU · parcela 08/10", category: "Tributos", amount: 1340, dueDate: "20 ago 2026", dueIso: "2026-08-20", paidDate: null, status: "Pendente" },
  { id: "PAG-0028", supplier: "Seguradora Farol", description: "Apólice patrimonial · parcela 04/06", category: "Seguros", amount: 2250, dueDate: "05 ago 2026", dueIso: "2026-08-05", paidDate: "04 ago 2026", status: "Pago" },
  { id: "PAG-0027", supplier: "Conecta Telecom", description: "Internet corporativa · julho/2026", category: "Telecom", amount: 389.90, dueDate: "02 ago 2026", dueIso: "2026-08-02", paidDate: "01 ago 2026", status: "Pago" },
];

const MANAGER_OPTIONS = ["Núcleo Patrimonial", "Operação Comercial", "Financeiro e Contratos"];
const PROPERTY_TYPE_OPTIONS = ["Edifício comercial", "Centro comercial", "Galeria", "Shopping", "Complexo logístico", "Galpão", "Outro"];
const UNIT_TYPE_OPTIONS = ["Sala comercial", "Loja", "Galpão", "Módulo", "Quiosque", "Depósito", "Outro"];
const EXPENSE_CATEGORY_OPTIONS = ["Condomínio", "Manutenção", "Seguros", "Telecom", "Tributos", "Utilidades", "Serviços profissionais", "Outros"];
const FINANCIAL_ACCOUNT_OPTIONS = ["Banco Operacional", "Conta de Recebíveis", "Caixa administrativo"];
const PAYMENT_METHOD_OPTIONS = ["Boleto bancário", "Pix", "Transferência bancária", "Débito automático", "Dinheiro"];
const DOCUMENT_TYPE_OPTIONS = ["Nota fiscal", "Boleto", "Guia", "Recibo", "Contrato", "Outro"];
const WORKS_DEMO_DATE_ISO = "2026-08-24";
const WORK_INTERVENTION_OPTIONS: WorkInterventionType[] = ["Obra", "Reforma", "Reparo", "Manutenção", "Emergência"];
const WORK_PRIORITY_OPTIONS: WorkPriority[] = ["Baixa", "Média", "Alta", "Urgente"];
const WORK_TEAM_OPTIONS = [
  { name: "Rafael Almeida", role: "Engenheiro responsável" },
  { name: "Carlos Mendes", role: "Supervisor de campo" },
  { name: "Marina Costa", role: "Arquiteta" },
  { name: "Patrícia Nunes", role: "Coordenadora de obras" },
  { name: "Lucas Rocha", role: "Técnico de manutenção" },
  { name: "Ana Beatriz Lima", role: "Assistente operacional" },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const brlCompact = (value: number) => {
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: thousands >= 10 ? 0 : 1 }).format(thousands)} mil`;
  }
  return brl.format(value);
};
const expenseMonths = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const formatExpenseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${expenseMonths[month - 1]} ${year}`;
};
const formatAddress = (...parts: Array<string | undefined>) => parts.filter((part) => part?.trim()).join(", ");
const nextRecordId = (prefix: string, records: Array<{ id: string }>, size = 3) => {
  const next = records.reduce((largest, record) => Math.max(largest, Number(record.id.match(/\d+/)?.[0] ?? 0)), 0) + 1;
  return `${prefix}-${String(next).padStart(size, "0")}`;
};
const chargeStatusFromItems = (items: ChargeItem[]): Status => {
  const dueDates = items.map((item) => item.dueDateIso).filter((value): value is string => Boolean(value)).sort();
  const earliestDue = dueDates[0];
  if (!earliestDue) return "Em aberto";
  if (earliestDue < DEMO_DATE_ISO) return "Vencida";
  const dueTime = Date.parse(`${earliestDue}T00:00:00Z`);
  const demoTime = Date.parse(`${DEMO_DATE_ISO}T00:00:00Z`);
  return dueTime - demoTime <= UPCOMING_WINDOW_DAYS * DAY_IN_MS ? "Próxima" : "Em aberto";
};
const documentDigits = (value: string) => value.replace(/\D/g, "");

function maskTenantDocument(value: string, type: Tenant["type"]) {
  const digits = documentDigits(value).slice(0, type === "PF" ? 11 : 14);
  if (type === "PF") return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return digits.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function hasValidCpf(value: string) {
  const digits = documentDigits(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (length: number) => {
    const sum = digits.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return calculate(9) === Number(digits[9]) && calculate(10) === Number(digits[10]);
}

function hasValidCnpj(value: string) {
  const digits = documentDigits(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = digits.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
}
const DEMO_DATE_ISO = "2026-08-12";
const UPCOMING_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
type ContractTermTone = "ok" | "renova" | "vencido";
const contractTermInfo = (period: string) => {
  const [startLabel = "", endLabel = ""] = period.split("—").map((part) => part.trim());
  const [dayText, monthText, yearText] = endLabel.split(/\s+/);
  const monthIndex = expenseMonths.indexOf((monthText ?? "").toLowerCase());
  const day = Number(dayText);
  const year = Number(yearText);
  if (monthIndex < 0 || !day || !year) {
    return { startLabel, endLabel: endLabel || "Não informado", endShort: endLabel || "Não informado", monthsLeft: null as number | null, tone: "ok" as ContractTermTone };
  }
  const endTime = Date.parse(`${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`);
  const monthsLeft = Math.round((endTime - Date.parse(`${DEMO_DATE_ISO}T00:00:00Z`)) / (DAY_IN_MS * 30.44));
  const tone: ContractTermTone = monthsLeft < 0 ? "vencido" : monthsLeft <= 6 ? "renova" : "ok";
  return { startLabel, endLabel, endShort: `${expenseMonths[monthIndex]}/${year}`, monthsLeft, tone };
};
const contractTermBadgeLabel = (info: ReturnType<typeof contractTermInfo>) => {
  if (info.monthsLeft === null) return "Ativo";
  if (info.tone === "vencido") return "Vencido";
  if (info.monthsLeft <= 0) return "Vence este mês";
  return `${info.tone === "renova" ? "Renova" : "Vence"} em ${info.monthsLeft} ${info.monthsLeft === 1 ? "mês" : "meses"}`;
};
const chargeTotal = (charge: Charge) => charge.items.reduce((sum, item) => sum + item.amount, 0);
const receivedTotal = (charge: Charge) => charge.items.reduce((sum, item) => sum + item.received, 0);
const chargeBalance = (charge: Charge) => chargeTotal(charge) - receivedTotal(charge);
const operationalChargeBalance = (charge: Charge, negotiation?: ChargeNegotiation) => negotiation?.negotiatedTotal ?? chargeBalance(charge);

const FOCUSABLE_ELEMENTS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function setDialogBackgroundState(element: HTMLElement, inactive: boolean) {
  if (inactive) {
    if (!element.hasAttribute("data-dialog-managed")) {
      element.dataset.dialogPreviousAriaHidden = element.getAttribute("aria-hidden") ?? "__absent__";
      element.dataset.dialogPreviousInert = element.hasAttribute("inert") ? "true" : "false";
      element.setAttribute("data-dialog-managed", "");
    }
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
    return;
  }

  if (!element.hasAttribute("data-dialog-managed")) return;
  const previousAriaHidden = element.dataset.dialogPreviousAriaHidden;
  if (previousAriaHidden === "__absent__") element.removeAttribute("aria-hidden");
  else if (previousAriaHidden !== undefined) element.setAttribute("aria-hidden", previousAriaHidden);
  if (element.dataset.dialogPreviousInert === "false") element.removeAttribute("inert");
  delete element.dataset.dialogPreviousAriaHidden;
  delete element.dataset.dialogPreviousInert;
  element.removeAttribute("data-dialog-managed");
}

function syncDialogStack() {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  if (!shell) return;
  const layers = Array.from(shell.querySelectorAll<HTMLElement>(":scope > .drawer-layer, :scope > .modal-layer"));
  const topLayer = layers.at(-1);
  Array.from(shell.children).forEach((child) => {
    if (child instanceof HTMLElement) setDialogBackgroundState(child, Boolean(topLayer && child !== topLayer));
  });

  layers.forEach((layer) => {
    const panel = layer.querySelector<HTMLElement>(".drawer, .receipt-modal");
    const title = panel?.querySelector<HTMLElement>("h2");
    const isTopLayer = layer === topLayer;
    const accessibleName = layer.getAttribute("aria-label");
    layer.removeAttribute("role");
    layer.removeAttribute("aria-modal");
    if (!panel) return;
    panel.setAttribute("role", "dialog");
    if (isTopLayer) panel.setAttribute("aria-modal", "true");
    else panel.removeAttribute("aria-modal");
    panel.setAttribute("tabindex", "-1");
    if (title) {
      if (!title.id) title.id = `dialog-title-${layers.indexOf(layer) + 1}`;
      title.setAttribute("tabindex", "-1");
      panel.setAttribute("aria-labelledby", title.id);
      panel.removeAttribute("aria-label");
    } else if (accessibleName) {
      panel.setAttribute("aria-label", accessibleName);
    }
    const backdrop = layer.querySelector<HTMLElement>(".drawer-backdrop");
    backdrop?.setAttribute("tabindex", "-1");
    backdrop?.setAttribute("aria-hidden", "true");
  });
}

function useDialogManagement() {
  const previousLayersRef = useRef<HTMLElement[]>([]);
  const openersRef = useRef(new WeakMap<HTMLElement, HTMLElement | null>());
  const focusedLayerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    if (!shell) return;
    const layers = Array.from(shell.querySelectorAll<HTMLElement>(":scope > .drawer-layer, :scope > .modal-layer"));
    const previousBodyOverflow = document.body.style.overflow;
    if (layers.length) document.body.style.overflow = "hidden";
    const previousLayers = previousLayersRef.current;
    const addedLayers = layers.filter((layer) => !previousLayers.includes(layer));
    const removedLayers = previousLayers.filter((layer) => !layers.includes(layer));
    const activeElement = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
    const inheritedOpener = [...removedLayers].reverse()
      .map((layer) => openersRef.current.get(layer))
      .find((element): element is HTMLElement => Boolean(element?.isConnected)) ?? null;
    addedLayers.forEach((layer) => openersRef.current.set(layer, activeElement ?? inheritedOpener));
    previousLayersRef.current = layers;
    syncDialogStack();

    const topLayer = layers.at(-1) ?? null;
    if (topLayer && topLayer !== focusedLayerRef.current) {
      const initialFocus = topLayer.querySelector<HTMLElement>("h2")
        ?? topLayer.querySelector<HTMLElement>(".drawer, .receipt-modal");
      initialFocus?.focus();
    }
    focusedLayerRef.current = topLayer;

    if (removedLayers.length && !addedLayers.length) {
      const opener = [...removedLayers].reverse()
        .map((layer) => openersRef.current.get(layer))
        .find((element): element is HTMLElement => Boolean(element?.isConnected));
      window.requestAnimationFrame(() => opener?.isConnected && opener.focus());
    }
    return () => {
      if (layers.length) document.body.style.overflow = previousBodyOverflow;
    };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shell = document.querySelector<HTMLElement>(".app-shell");
      const currentLayer = Array.from(shell?.querySelectorAll<HTMLElement>(":scope > .drawer-layer, :scope > .modal-layer") ?? []).at(-1);
      if (!currentLayer) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        currentLayer.querySelector<HTMLButtonElement>(".drawer-backdrop")?.click();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = currentLayer.querySelector<HTMLElement>(".drawer, .receipt-modal");
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS))
        .filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !panel.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !panel.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previousLayersRef.current = [];
      focusedLayerRef.current = null;
      window.requestAnimationFrame(syncDialogStack);
    };
  }, []);
}

function StatusBadge({ status }: { status: Status }) {
  const name = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, "-");
  return <span className={`status status-${name}`}><i aria-hidden="true" />{status}</span>;
}

export default function Home() {
  useDialogManagement();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeModule, setActiveModule] = useState<AppModule>("Módulo 1");
  const [page, setPage] = useState<Page>("Visão geral");
  const [search, setSearch] = useState("");
  const [portfolioFilter, setPortfolioFilter] = useState("Todas as carteiras");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [categoryFilter, setCategoryFilter] = useState("Todas as categorias");
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
  const [negotiationOpen, setNegotiationOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [registryDetail, setRegistryDetail] = useState<RegistryDetail | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [form, setForm] = useState<FormKind>(null);
  const [chargeSourceContract, setChargeSourceContract] = useState<Contract | null>(null);
  const [portfolioRecords, setPortfolioRecords] = useState<Portfolio[]>(portfolios);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const [propertyRecords, setPropertyRecords] = useState<Property[]>(properties);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [unitRecords, setUnitRecords] = useState<Unit[]>(units);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [tenantRecords, setTenantRecords] = useState<Tenant[]>(tenants);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [agencyRecords, setAgencyRecords] = useState<RealEstateAgency[]>(realEstateAgencies);
  const [agencyModalOpen, setAgencyModalOpen] = useState(false);
  const [contractRecords, setContractRecords] = useState<Contract[]>(contracts);
  const [chargeRecords, setChargeRecords] = useState<Charge[]>(charges);
  const [negotiationsByCharge, setNegotiationsByCharge] = useState<Record<string, ChargeNegotiation>>({});
  const [receiptsByCharge, setReceiptsByCharge] = useState<Record<string, ReceiptDraft[]>>({});
  const [documentsByOwner, setDocumentsByOwner] = useState<Record<string, LocalDocument[]>>({});
  const documentsByOwnerRef = useRef(documentsByOwner);
  const [categorizedDocumentsByOwner, setCategorizedDocumentsByOwner] = useState<Record<string, CategorizedDocuments>>({});
  const categorizedDocumentsByOwnerRef = useRef(categorizedDocumentsByOwner);
  const [expenseRecords, setExpenseRecords] = useState<Expense[]>(expenses);
  const [workRecordState, setWorkRecordState] = useState<WorkRecord[]>(workRecords);
  const [workTeamsById, setWorkTeamsById] = useState<Record<string, WorkTeamAllocation[]>>({});
  const [workSuppliersById, setWorkSuppliersById] = useState<Record<string, WorkSupplier[]>>({});
  const [workPartnersById, setWorkPartnersById] = useState<Record<string, WorkPartner[]>>({});
  const [workContributionsById, setWorkContributionsById] = useState<Record<string, WorkContribution[]>>({});
  const [workFinancialEntriesById, setWorkFinancialEntriesById] = useState<Record<string, WorkFinancialEntry[]>>({});
  const [workJournalById, setWorkJournalById] = useState<Record<string, WorkJournalEntry[]>>({});
  const [workPendingItemsById, setWorkPendingItemsById] = useState<Record<string, WorkPendingItem[]>>({});
  const [editingWork, setEditingWork] = useState<WorkRecord | null>(null);
  const [selectedWork, setSelectedWork] = useState<WorkRecord | null>(null);
  const [selectedWorkTab, setSelectedWorkTab] = useState<WorkDetailTab>("Resumo");
  const [workFormOrigin, setWorkFormOrigin] = useState<"Obras" | "Detalhe da obra">("Obras");
  const [toast, setToast] = useState<ToastMessage>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [contentState, setContentState] = useState<ContentState>("ready");
  const [online, setOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [overlayNavigation, setOverlayNavigation] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const workCostsById = useMemo(() => Object.fromEntries(workRecordState.map((work) => {
    const detail = createWorkDetailMock(work);
    return [work.id, summarizeWorkCosts(workTeamsById[work.id] ?? detail.team, workSuppliersById[work.id] ?? detail.suppliers, workFinancialEntriesById[work.id] ?? detail.financialEntries)];
  })), [workFinancialEntriesById, workRecordState, workSuppliersById, workTeamsById]);

  useEffect(() => { documentsByOwnerRef.current = documentsByOwner; }, [documentsByOwner]);
  useEffect(() => { categorizedDocumentsByOwnerRef.current = categorizedDocumentsByOwner; }, [categorizedDocumentsByOwner]);
  useEffect(() => () => revokeDocumentUrls(Object.values(documentsByOwnerRef.current).flat()), []);
  useEffect(() => () => revokeDocumentUrls(Object.values(categorizedDocumentsByOwnerRef.current).flatMap(flattenCategorizedDocuments)), []);
  useEffect(() => () => { if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current); }, []);

  useEffect(() => {
    const navigationQuery = window.matchMedia("(max-width: 900px)");
    const syncNavigationMode = () => {
      setOverlayNavigation(navigationQuery.matches);
      if (!navigationQuery.matches) setMenuOpen(false);
    };
    syncNavigationMode();
    navigationQuery.addEventListener("change", syncNavigationMode);
    return () => navigationQuery.removeEventListener("change", syncNavigationMode);
  }, []);

  useEffect(() => {
    if (!menuOpen || !overlayNavigation) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>("#app-sidebar .sidebar-mobile-close")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
  }, [menuOpen, overlayNavigation]);

  useEffect(() => {
    const handleOffline = () => { setOnline(false); setContentState("error"); };
    const handleOnline = () => {
      setOnline(true);
      setContentState("ready");
    };
    const initialConnectionCheck = window.setTimeout(() => { if (!navigator.onLine) handleOffline(); }, 0);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(initialConnectionCheck);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const chargeAttentionCount = chargeRecords.filter((charge) => charge.status === "Vencida" || charge.status === "Parcial").length;
  const chargesInScope = useMemo(() => chargeRecords.filter((charge) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [charge.id, charge.contract, charge.property, charge.tenant, charge.competence, ...charge.units, ...charge.items.map((item) => item.name)].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (portfolioFilter === "Todas as carteiras" || charge.portfolio === portfolioFilter);
  }), [chargeRecords, portfolioFilter, search]);
  const filteredCharges = useMemo(() => chargesInScope.filter((charge) => statusFilter === "Todas" || charge.status === statusFilter), [chargesInScope, statusFilter]);
  const filteredExpenses = useMemo(() => expenseRecords.filter((expense) => {
    const query = search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const matchesSearch = !query || [expense.id, expense.supplier, expense.description, expense.category].some((value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query));
    return matchesSearch && (statusFilter === "Todas" || expense.status === statusFilter) && (categoryFilter === "Todas as categorias" || expense.category === categoryFilter);
  }), [categoryFilter, expenseRecords, search, statusFilter]);

  const notify = (message: string, reference: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ message, reference });
    toastTimerRef.current = window.setTimeout(() => { setToast(null); toastTimerRef.current = null; }, 4200);
  };
  const dismissToast = () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast(null);
  };
  const changePage = (next: Page) => {
    setPage(next);
    setSearch("");
    setPortfolioFilter("Todas as carteiras");
    setStatusFilter("Todas");
    setCategoryFilter("Todas as categorias");
    setMenuOpen(false);
    setContentState(navigator.onLine ? "ready" : "error");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  };
  const changeModule = (next: AppModule) => {
    if (next === activeModule) return;
    setActiveModule(next);
    setPage("Visão geral");
    setSearch("");
    setPortfolioFilter("Todas as carteiras");
    setStatusFilter("Todas");
    setCategoryFilter("Todas as categorias");
    setSelectedCharge(null);
    setSelectedContract(null);
    setSelectedExpense(null);
    setRegistryDetail(null);
    setReceiptOpen(false);
    setNegotiationOpen(false);
    setReportOpen(false);
    setAgencyModalOpen(false);
    setForm(null);
    setEditingWork(null);
    setSelectedWork(null);
    setMenuOpen(false);
    setSidebarCollapsed(false);
    setContentState(navigator.onLine ? "ready" : "error");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  };
  const beginNewWork = () => {
    setEditingWork(null);
    setWorkFormOrigin("Obras");
    changePage("Nova obra");
  };
  const beginEditWork = (work: WorkRecord) => {
    setEditingWork(work);
    setWorkFormOrigin(page === "Detalhe da obra" ? "Detalhe da obra" : "Obras");
    changePage("Nova obra");
  };
  const leaveWorkForm = () => {
    setEditingWork(null);
    changePage(workFormOrigin === "Detalhe da obra" && selectedWork ? "Detalhe da obra" : "Obras");
  };
  const saveWork = (nextWork: WorkRecord) => {
    const isEditing = workRecordState.some((work) => work.id === nextWork.id);
    setWorkRecordState((current) => isEditing
      ? current.map((work) => work.id === nextWork.id ? nextWork : work)
      : [nextWork, ...current]);
    setWorkTeamsById((current) => current[nextWork.id] ? current : { ...current, [nextWork.id]: isEditing ? createWorkDetailMock(nextWork).team : [] });
    setWorkSuppliersById((current) => current[nextWork.id] ? current : { ...current, [nextWork.id]: isEditing ? createWorkDetailMock(nextWork).suppliers : [] });
    setWorkPartnersById((current) => current[nextWork.id] ? current : { ...current, [nextWork.id]: isEditing ? createWorkDetailMock(nextWork).partners : [] });
    setWorkContributionsById((current) => current[nextWork.id] ? current : { ...current, [nextWork.id]: isEditing ? createWorkDetailMock(nextWork).contributions : [] });
    setWorkFinancialEntriesById((current) => current[nextWork.id] ? current : { ...current, [nextWork.id]: isEditing ? createWorkDetailMock(nextWork).financialEntries : [] });
    setWorkJournalById((current) => current[nextWork.id] ? current : { ...current, [nextWork.id]: createWorkDetailMock(nextWork).journal });
    setWorkPendingItemsById((current) => current[nextWork.id] ? current : { ...current, [nextWork.id]: createWorkDetailMock(nextWork).pendingItems });
    setEditingWork(null);
    setSelectedWork(nextWork);
    setSelectedWorkTab("Resumo");
    notify(isEditing ? "Obra atualizada nesta sessão." : "Obra adicionada à demonstração.", nextWork.id);
    changePage("Detalhe da obra");
  };
  const openWorkDetail = (work: WorkRecord, initialTab: WorkDetailTab = "Resumo") => {
    setWorkTeamsById((current) => current[work.id] ? current : { ...current, [work.id]: createWorkDetailMock(work).team });
    setWorkSuppliersById((current) => current[work.id] ? current : { ...current, [work.id]: createWorkDetailMock(work).suppliers });
    setWorkPartnersById((current) => current[work.id] ? current : { ...current, [work.id]: createWorkDetailMock(work).partners });
    setWorkContributionsById((current) => current[work.id] ? current : { ...current, [work.id]: createWorkDetailMock(work).contributions });
    setWorkFinancialEntriesById((current) => current[work.id] ? current : { ...current, [work.id]: createWorkDetailMock(work).financialEntries });
    setWorkJournalById((current) => current[work.id] ? current : { ...current, [work.id]: createWorkDetailMock(work).journal });
    setWorkPendingItemsById((current) => current[work.id] ? current : { ...current, [work.id]: createWorkDetailMock(work).pendingItems });
    setSelectedWork(work);
    setSelectedWorkTab(initialTab);
    changePage("Detalhe da obra");
  };
  const updateWorkFromDetail = (nextWork: WorkRecord, message: string) => {
    setWorkRecordState((current) => current.map((work) => work.id === nextWork.id ? nextWork : work));
    setSelectedWork(nextWork);
    notify(message, nextWork.id);
  };
  const retryContent = () => {
    const connected = navigator.onLine;
    setOnline(connected);
    setContentState(connected ? "ready" : "error");
  };
  const login = (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => { setAuthenticated(true); setLoading(false); }, 650);
  };
  const saveReceipt = (receipt: ReceiptDraft) => {
    const updateCharge = (charge: Charge) => {
      const items = charge.items.map((item, itemIndex) => {
        const allocation = receipt.allocations.find((entry) => entry.itemIndex === itemIndex)?.amount ?? 0;
        return { ...item, received: Math.min(item.amount, item.received + allocation) };
      });
      const settled = items.every((item) => item.received >= item.amount - 0.009);
      return { ...charge, items, status: settled ? "Recebida" as const : "Parcial" as const };
    };
    setChargeRecords((records) => records.map((charge) => charge.id === receipt.chargeId ? updateCharge(charge) : charge));
    setSelectedCharge((charge) => charge?.id === receipt.chargeId ? updateCharge(charge) : charge);
    setReceiptsByCharge((current) => ({ ...current, [receipt.chargeId]: [...(current[receipt.chargeId] ?? []), receipt] }));
    setReceiptOpen(false);
    notify("Recebimento registrado e distribuído entre os itens.", receipt.id);
  };
  const saveNegotiation = (negotiation: ChargeNegotiation) => {
    const updating = Boolean(negotiationsByCharge[negotiation.chargeId]);
    setNegotiationsByCharge((current) => ({ ...current, [negotiation.chargeId]: negotiation }));
    setChargeRecords((records) => records.map((charge) => charge.id === negotiation.chargeId ? { ...charge, status: "Negociada" } : charge));
    setSelectedCharge((charge) => charge?.id === negotiation.chargeId ? { ...charge, status: "Negociada" } : charge);
    setNegotiationOpen(false);
    notify(updating ? "Condições da negociação atualizadas." : "Negociação registrada com sucesso.", negotiation.id);
  };
  const saveForm = (data: FormData, documents?: FormDocuments) => {
    let savedReference = "REG-DEMO";
    let message = "Cadastro salvo neste ambiente demonstrativo.";
    if (form === "portfolio") {
      savedReference = editingPortfolio?.id ?? nextRecordId("CAR", portfolioRecords);
      const values = {
        name: String(data.get("portfolioName") ?? ""),
        holder: String(data.get("portfolioHolder") ?? ""),
        document: String(data.get("portfolioDocument") ?? ""),
        manager: String(data.get("portfolioManager") ?? ""),
        description: String(data.get("portfolioDescription") ?? ""),
        notes: String(data.get("portfolioNotes") ?? ""),
      };
      if (editingPortfolio) {
        setPortfolioRecords((records) => records.map((record) => record.id === editingPortfolio.id ? { ...record, ...values } : record));
        message = "Carteira atualizada neste ambiente demonstrativo.";
      } else {
        setPortfolioRecords((records) => [...records, { id: savedReference, ...values, properties: 0, units: 0 }]);
        message = "Carteira criada neste ambiente demonstrativo.";
      }
    } else if (form === "property") {
      savedReference = editingProperty?.id ?? nextRecordId("IMO", propertyRecords);
      const street = String(data.get("propertyStreet") ?? "");
      const number = String(data.get("propertyNumber") ?? "");
      const complement = String(data.get("propertyComplement") ?? "");
      const district = String(data.get("propertyDistrict") ?? "");
      const city = String(data.get("propertyCity") ?? "");
      const state = String(data.get("propertyState") ?? "");
      const values = {
        portfolio: String(data.get("propertyPortfolio") ?? ""),
        name: String(data.get("propertyName") ?? ""),
        propertyType: String(data.get("propertyType") ?? ""),
        cep: String(data.get("propertyCep") ?? ""),
        street,
        number,
        complement,
        district,
        city,
        state,
        address: formatAddress(street, number, complement, district, city && state ? `${city}/${state}` : city || state) || editingProperty?.address || "",
        municipalRegistration: String(data.get("propertyMunicipalRegistration") ?? ""),
        registryNumber: String(data.get("propertyRegistryNumber") ?? ""),
        registryOffice: String(data.get("propertyRegistryOffice") ?? ""),
        manager: String(data.get("propertyManager") ?? ""),
        notes: String(data.get("propertyNotes") ?? ""),
      };
      if (editingProperty) {
        setPropertyRecords((records) => records.map((record) => record.id === editingProperty.id ? { ...record, ...values } : record));
        message = "Imóvel atualizado neste ambiente demonstrativo.";
      } else {
        setPropertyRecords((records) => [...records, { id: savedReference, ...values, units: 0 }]);
        message = "Imóvel criado neste ambiente demonstrativo.";
      }
    } else if (form === "unit") {
      savedReference = editingUnit?.id ?? nextRecordId("UNI", unitRecords);
      const unitProperty = editingUnit?.occupied ? editingUnit.property : String(data.get("unitProperty") ?? "");
      const selectedProperty = propertyRecords.find((record) => record.name === unitProperty);
      const unitType = String(data.get("unitType") ?? "");
      const code = String(data.get("unitCode") ?? "");
      const values = {
        property: unitProperty,
        portfolio: editingUnit?.occupied ? editingUnit.portfolio : selectedProperty?.portfolio ?? editingUnit?.portfolio ?? portfolioRecords[0]?.name ?? "",
        unitType,
        code,
        name: editingUnit?.occupied ? editingUnit.name : `${unitType.replace(" comercial", "")} ${code}`.trim(),
        area: Number(data.get("unitArea")),
        occupied: editingUnit?.occupied ?? false,
        block: String(data.get("unitBlock") ?? ""),
        floor: String(data.get("unitFloor") ?? ""),
        totalArea: Number(data.get("unitTotalArea")) || undefined,
        municipalRegistration: String(data.get("unitMunicipalRegistration") ?? ""),
        notes: String(data.get("unitNotes") ?? ""),
      };
      if (editingUnit) {
        setUnitRecords((records) => records.map((record) => record.id === editingUnit.id ? { ...record, ...values } : record));
        message = "Unidade atualizada neste ambiente demonstrativo.";
      } else {
        setUnitRecords((records) => [...records, { id: savedReference, ...values }]);
        message = "Unidade criada neste ambiente demonstrativo.";
      }
    } else if (form === "tenant") {
      savedReference = editingTenant?.id ?? nextRecordId("LOC", tenantRecords);
      const values = {
        type: String(data.get("tenantType") ?? "PJ") as Tenant["type"],
        name: String(data.get("tenantName") ?? ""),
        document: String(data.get("tenantDocument") ?? ""),
        tradeName: String(data.get("tenantTradeName") ?? ""),
        contactName: String(data.get("tenantContactName") ?? ""),
        phone: String(data.get("tenantPhone") ?? ""),
        email: String(data.get("tenantEmail") ?? ""),
        preferredChannel: String(data.get("tenantPreferredChannel") ?? ""),
        billingAddress: formatAddress(
          String(data.get("tenantBillingStreet") ?? ""),
          String(data.get("tenantBillingNumber") ?? ""),
          String(data.get("tenantBillingComplement") ?? ""),
          String(data.get("tenantBillingDistrict") ?? ""),
          String(data.get("tenantBillingCity") ?? ""),
          String(data.get("tenantBillingState") ?? ""),
          String(data.get("tenantBillingCep") ?? ""),
        ) || editingTenant?.billingAddress || "",
        municipalRegistration: String(data.get("tenantMunicipalRegistration") ?? ""),
        responsibleAgencyId: String(data.get("tenantResponsibleAgency") ?? "") || undefined,
        notes: String(data.get("tenantNotes") ?? ""),
      };
      if (editingTenant) {
        setTenantRecords((records) => records.map((record) => record.id === editingTenant.id ? { ...record, ...values } : record));
        if (values.name !== editingTenant.name) {
          setContractRecords((records) => records.map((record) => record.tenant === editingTenant.name ? { ...record, tenant: values.name } : record));
          setChargeRecords((records) => records.map((record) => record.tenant === editingTenant.name ? { ...record, tenant: values.name } : record));
        }
        message = "Locatário atualizado neste ambiente demonstrativo.";
      } else {
        setTenantRecords((records) => [...records, { id: savedReference, ...values, contracts: 0 }]);
        message = "Locatário criado neste ambiente demonstrativo.";
      }
    } else if (form === "contract") {
      savedReference = nextRecordId("CTR", contractRecords);
      const propertyName = String(data.get("contractProperty") ?? "");
      const selectedProperty = propertyRecords.find((record) => record.name === propertyName);
      const selectedUnitIds = data.getAll("contractUnits").map(String);
      const selectedUnitNames = selectedUnitIds.map((id) => unitRecords.find((unit) => unit.id === id)?.name).filter((name): name is string => Boolean(name));
      const tenantId = String(data.get("contractTenant") ?? "");
      const selectedTenant = tenantRecords.find((record) => record.id === tenantId);
      const startIso = String(data.get("contractStart") ?? "");
      const endIso = String(data.get("contractEnd") ?? "");
      const rules = JSON.parse(String(data.get("contractRulesJson") ?? "[]")) as ContractChargeRule[];
      const contract: Contract = {
        id: savedReference,
        portfolio: selectedProperty?.portfolio ?? String(data.get("contractPortfolio") ?? ""),
        property: propertyName,
        units: selectedUnitNames,
        tenant: selectedTenant?.name ?? "",
        period: `${formatExpenseDate(startIso)} — ${formatExpenseDate(endIso)}`,
        rent: Number(data.get("contractRent")),
        due: Number(data.get("contractDueDay")),
        adjustment: String(data.get("contractAdjustmentMonth") ?? ""),
        charges: rules.map((rule) => rule.name),
        chargeRules: rules,
        startIso,
        endIso,
        occupancyDate: String(data.get("contractOccupancyDate") ?? ""),
        purpose: String(data.get("contractPurpose") ?? ""),
        paymentReference: String(data.get("contractPaymentReference") ?? ""),
        adjustmentIndex: String(data.get("contractAdjustmentIndex") ?? ""),
        adjustmentPeriod: Number(data.get("contractAdjustmentPeriod")) || 12,
        lateFee: Number(data.get("contractLateFee")) || 0,
        monthlyInterest: Number(data.get("contractMonthlyInterest")) || 0,
        paymentMethod: String(data.get("contractPaymentMethod") ?? ""),
        deliveryChannel: String(data.get("contractDeliveryChannel") ?? ""),
        guaranteeType: String(data.get("contractGuaranteeType") ?? ""),
        guaranteeDetails: String(data.get("contractGuaranteeDetails") ?? ""),
        signatureDate: String(data.get("contractSignatureDate") ?? ""),
        firstChargeRule: String(data.get("contractFirstChargeRule") ?? ""),
        documentName: String(data.get("contractDocumentName") ?? ""),
        notes: String(data.get("contractNotes") ?? ""),
      };
      setContractRecords((records) => [...records, contract]);
      setUnitRecords((records) => records.map((unit) => selectedUnitIds.includes(unit.id) ? { ...unit, occupied: true } : unit));
      setTenantRecords((records) => records.map((record) => record.id === tenantId ? { ...record, contracts: record.contracts + 1 } : record));
      message = "Contrato criado e unidades vinculadas neste ambiente demonstrativo.";
    } else if (form === "charge") {
      savedReference = nextRecordId("COB", chargeRecords, 4);
      const contractId = String(data.get("chargeContract") ?? "");
      const selectedContract = contractRecords.find((record) => record.id === contractId);
      const competenceInput = String(data.get("chargeCompetence") ?? "");
      const [year, month] = competenceInput.split("-");
      const draftItems = JSON.parse(String(data.get("chargeItemsJson") ?? "[]")) as ChargeDraftItem[];
      const items: ChargeItem[] = draftItems.map((item) => ({
        name: item.name,
        reference: item.reference,
        supportDocumentName: item.supportDocumentName,
        dueDate: formatExpenseDate(item.due),
        dueDateIso: item.due,
        amount: item.amount,
        received: 0,
      }));
      const charge: Charge = {
        id: savedReference,
        contract: contractId,
        portfolio: selectedContract?.portfolio ?? "",
        property: selectedContract?.property ?? "",
        units: selectedContract?.units ?? [],
        tenant: selectedContract?.tenant ?? "",
        competence: `${month}/${year}`,
        status: chargeStatusFromItems(items),
        items,
        inclusionType: String(data.get("chargeInclusionType") ?? "Normal"),
        paymentMethod: String(data.get("chargePaymentMethod") ?? selectedContract?.paymentMethod ?? ""),
        notes: String(data.get("chargeNotes") ?? ""),
      };
      setChargeRecords((records) => [...records, charge]);
      message = "Cobrança criada e vinculada ao contrato.";
    } else if (form === "expense") {
      savedReference = nextRecordId("PAG", expenseRecords, 4);
      const dueIso = String(data.get("expenseDueDate") ?? "");
      const alreadyPaid = data.get("expenseAlreadyPaid") === "on";
      const paidIso = String(data.get("expensePaidDate") ?? "");
      const status: ExpenseStatus = alreadyPaid ? "Pago" : dueIso < DEMO_DATE_ISO ? "Vencido" : "Pendente";
      setExpenseRecords((records) => [...records, {
        id: savedReference,
        supplier: String(data.get("expenseSupplier") ?? ""),
        description: String(data.get("expenseDescription") ?? ""),
        category: String(data.get("expenseCategory") ?? ""),
        amount: Number(data.get("expenseAmount")),
        dueDate: formatExpenseDate(dueIso),
        dueIso,
        paidDate: alreadyPaid && paidIso ? formatExpenseDate(paidIso) : null,
        status,
        allocationType: String(data.get("expenseAllocationType") ?? "Geral"),
        allocationId: String(data.get("expenseAllocationId") ?? ""),
        competence: String(data.get("expenseCompetence") ?? ""),
        issueDate: String(data.get("expenseIssueDate") ?? ""),
        documentType: String(data.get("expenseDocumentType") ?? ""),
        documentNumber: String(data.get("expenseDocumentNumber") ?? ""),
        plannedDate: String(data.get("expensePlannedDate") ?? ""),
        entryType: String(data.get("expenseEntryType") ?? "Única"),
        recurrence: String(data.get("expenseRecurrence") ?? ""),
        paymentMethod: String(data.get("expensePaymentMethod") ?? ""),
        financialAccount: String(data.get("expenseFinancialAccount") ?? ""),
        attachmentName: String(data.get("expenseAttachmentName") ?? ""),
        notes: String(data.get("expenseNotes") ?? ""),
      }]);
      message = "Despesa cadastrada neste ambiente demonstrativo.";
    }
    if (documents && Array.isArray(documents) && (form === "tenant" || form === "unit")) {
      setDocumentsByOwner((current) => {
        const retainedIds = new Set(documents.map((document) => document.id));
        revokeDocumentUrls((current[savedReference] ?? []).filter((document) => !retainedIds.has(document.id)));
        return { ...current, [savedReference]: documents };
      });
    } else if (documents && !Array.isArray(documents) && form === "property") {
      setCategorizedDocumentsByOwner((current) => {
        const retainedIds = new Set(flattenCategorizedDocuments(documents).map((document) => document.id));
        const previousDocuments = current[savedReference] ? flattenCategorizedDocuments(current[savedReference]) : [];
        revokeDocumentUrls(previousDocuments.filter((document) => !retainedIds.has(document.id)));
        return { ...current, [savedReference]: documents };
      });
    }
    setForm(null);
    setEditingPortfolio(null);
    setEditingProperty(null);
    setEditingUnit(null);
    setEditingTenant(null);
    setChargeSourceContract(null);
    notify(message, savedReference);
  };
  const saveAgency = (agency: Omit<RealEstateAgency, "id">) => {
    const savedReference = nextRecordId("IMB", agencyRecords);
    setAgencyRecords((records) => [...records, { id: savedReference, ...agency }]);
    setAgencyModalOpen(false);
    notify("Imobiliária cadastrada e disponível para vinculação.", savedReference);
  };
  const editRegistryDetail = () => {
    if (!registryDetail) return;
    if (registryDetail.kind === "property") {
      setEditingProperty(registryDetail.record);
      setForm("property");
    } else if (registryDetail.kind === "unit") {
      setEditingUnit(registryDetail.record);
      setForm("unit");
    } else {
      setEditingTenant(registryDetail.record);
      setForm("tenant");
    }
    setRegistryDetail(null);
  };
  const updateRegistryDocuments = (ownerId: string, nextDocuments: CategorizedDocuments) => {
    setCategorizedDocumentsByOwner((current) => {
      const retainedIds = new Set(flattenCategorizedDocuments(nextDocuments).map((document) => document.id));
      const previousDocuments = current[ownerId] ? flattenCategorizedDocuments(current[ownerId]) : [];
      revokeDocumentUrls(previousDocuments.filter((document) => !retainedIds.has(document.id)));
      return { ...current, [ownerId]: nextDocuments };
    });
    notify("Anexos do cadastro atualizados.", ownerId);
  };

  if (!authenticated) return <Login loading={loading} onSubmit={login} />;

  return <main className={`app-shell ${sidebarCollapsed ? "app-shell-sidebar-collapsed" : ""}`}>
    <Sidebar module={activeModule} page={page} attentionCount={chargeAttentionCount} onModuleChange={changeModule} onNavigate={changePage} onLogout={() => setAuthenticated(false)} open={menuOpen} overlay={overlayNavigation} onClose={() => setMenuOpen(false)} collapsed={sidebarCollapsed} onExpand={() => setSidebarCollapsed(false)} onToggleCollapsed={() => setSidebarCollapsed((current) => !current)} />
    <section className="workspace" inert={overlayNavigation && menuOpen ? true : undefined}>
      <header className="topbar">
        <button type="button" ref={menuButtonRef} className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir navegação" aria-expanded={menuOpen} aria-controls="app-sidebar"><Menu aria-hidden="true" /></button>
        <div className="topbar-heading">
          <span className="topbar-brand-mark" aria-hidden="true"><span>L</span><i /><span>R</span></span>
          <nav className="breadcrumb" aria-label="Trilha de navegação">{breadcrumbTrail(activeModule, page).map((segment, index, list) => <span key={segment} className={index === list.length - 1 ? "breadcrumb-current" : undefined} aria-current={index === list.length - 1 ? "page" : undefined}>{segment}</span>)}</nav>
        </div>
        <div className="topbar-context"><span className="context-dot" /> Dados fictícios</div>
      </header>
      <div className="content">
        {!online && <ConnectionBanner onRetry={retryContent} />}
        {contentState === "loading" && <AuthenticatedPageSkeleton variant={page === "Visão geral" ? "dashboard" : page === "Detalhe da obra" ? "detail" : page === "Cobranças" || page === "Despesas" ? "ledger" : "list"} />}
        {contentState === "error" && online && <SystemError onRetry={retryContent} />}
        {(contentState === "ready" || !online) && <FilterStateContext.Provider value={Boolean(search || portfolioFilter !== "Todas as carteiras" || statusFilter !== "Todas" || categoryFilter !== "Todas as categorias")}><div className="page-enter" key={`${activeModule}-${page}`}>
          {activeModule === "Módulo 1" && page === "Visão geral" && <DashboardPage charges={chargeRecords} negotiations={negotiationsByCharge} expenses={expenseRecords} properties={propertyRecords} units={unitRecords} contracts={contractRecords} onNavigate={(next, status) => { changePage(next); if (status) setStatusFilter(status); }} />}
          {activeModule === "Módulo 2" && page === "Visão geral" && <WorksDashboardPage works={workRecordState} costsByWorkId={workCostsById} onNewWork={beginNewWork} onOpenWork={openWorkDetail} onNavigate={changePage} />}
          {activeModule === "Módulo 2" && page === "Obras" && <WorksListPage works={workRecordState} costsByWorkId={workCostsById} onNewWork={beginNewWork} onEditWork={beginEditWork} onOpenWork={openWorkDetail} />}
          {activeModule === "Módulo 2" && page === "Nova obra" && <WorkFormPage work={editingWork} works={workRecordState} properties={propertyRecords} units={unitRecords} onCancel={leaveWorkForm} onSave={saveWork} />}
          {activeModule === "Módulo 2" && page === "Detalhe da obra" && selectedWork && <WorkDetailPage key={selectedWork.id} work={selectedWork} initialTab={selectedWorkTab} initialTeam={workTeamsById[selectedWork.id] ?? createWorkDetailMock(selectedWork).team} onTeamChange={(team) => setWorkTeamsById((current) => ({ ...current, [selectedWork.id]: team }))} suppliers={workSuppliersById[selectedWork.id] ?? createWorkDetailMock(selectedWork).suppliers} onSuppliersChange={(suppliers) => setWorkSuppliersById((current) => ({ ...current, [selectedWork.id]: suppliers }))} partners={workPartnersById[selectedWork.id] ?? createWorkDetailMock(selectedWork).partners} onPartnersChange={(partners) => setWorkPartnersById((current) => ({ ...current, [selectedWork.id]: partners }))} contributions={workContributionsById[selectedWork.id] ?? createWorkDetailMock(selectedWork).contributions} onContributionsChange={(contributions) => setWorkContributionsById((current) => ({ ...current, [selectedWork.id]: contributions }))} financialEntries={workFinancialEntriesById[selectedWork.id] ?? createWorkDetailMock(selectedWork).financialEntries} onFinancialEntriesChange={(entries) => setWorkFinancialEntriesById((current) => ({ ...current, [selectedWork.id]: entries }))} initialJournal={workJournalById[selectedWork.id] ?? createWorkDetailMock(selectedWork).journal} onJournalChange={(entries) => setWorkJournalById((current) => ({ ...current, [selectedWork.id]: entries }))} initialPendingItems={workPendingItemsById[selectedWork.id] ?? createWorkDetailMock(selectedWork).pendingItems} onPendingItemsChange={(items) => setWorkPendingItemsById((current) => ({ ...current, [selectedWork.id]: items }))} onBack={() => { setSelectedWork(null); changePage("Obras"); }} onEdit={() => beginEditWork(selectedWork)} onUpdateWork={updateWorkFromDetail} onNotify={notify} />}
          {activeModule === "Módulo 1" && page === "Cobranças" && <ChargesPage charges={filteredCharges} summaryCharges={chargesInScope} negotiations={negotiationsByCharge} total={chargeRecords.length} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onOpen={setSelectedCharge} onNew={() => { setChargeSourceContract(null); setForm("charge"); }} onReport={() => setReportOpen(true)} />}
          {activeModule === "Módulo 1" && page === "Carteiras" && <PortfoliosPage portfolios={portfolioRecords} properties={propertyRecords} units={unitRecords} search={search} setSearch={setSearch} onNew={() => { setEditingPortfolio(null); setForm("portfolio"); }} onEdit={(portfolio) => { setEditingPortfolio(portfolio); setForm("portfolio"); }} onViewProperties={(portfolio) => { changePage("Imóveis"); setPortfolioFilter(portfolio.name); }} />}
          {activeModule === "Módulo 1" && page === "Imóveis" && <PropertiesPage properties={propertyRecords} units={unitRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => { setEditingProperty(null); setForm("property"); }} onOpen={(property) => setRegistryDetail({ kind: "property", record: property })} />}
          {activeModule === "Módulo 1" && page === "Unidades" && <UnitsPage units={unitRecords} properties={propertyRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => { setEditingUnit(null); setForm("unit"); }} onOpen={(unit) => setRegistryDetail({ kind: "unit", record: unit })} onEdit={(unit) => { setEditingUnit(unit); setForm("unit"); }} />}
          {activeModule === "Módulo 1" && page === "Locatários" && <TenantsPage tenants={tenantRecords} agencies={agencyRecords} contracts={contractRecords} charges={chargeRecords} search={search} setSearch={setSearch} onNew={() => { setEditingTenant(null); setForm("tenant"); }} onNewAgency={() => setAgencyModalOpen(true)} onOpen={(tenant) => setRegistryDetail({ kind: "tenant", record: tenant })} onEdit={(tenant) => { setEditingTenant(tenant); setForm("tenant"); }} />}
          {activeModule === "Módulo 1" && page === "Contratos" && <ContractsPage contracts={contractRecords} charges={chargeRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => setForm("contract")} onOpen={setSelectedContract} />}
          {activeModule === "Módulo 1" && page === "Despesas" && <ExpensesPage rows={filteredExpenses} total={expenseRecords.length} categories={Array.from(new Set(expenseRecords.map((expense) => expense.category)))} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onOpen={setSelectedExpense} onNew={() => setForm("expense")} />}
        </div></FilterStateContext.Provider>}
      </div>
    </section>
    {selectedCharge && <ChargeDrawer charge={selectedCharge} negotiation={negotiationsByCharge[selectedCharge.id]} receipts={receiptsByCharge[selectedCharge.id] ?? []} onClose={() => { setSelectedCharge(null); setNegotiationOpen(false); }} onReceipt={() => setReceiptOpen(true)} onNegotiate={() => setNegotiationOpen(true)} />}
    {selectedContract && <ContractDrawer contract={selectedContract} charges={chargeRecords} onClose={() => setSelectedContract(null)} onCharge={() => { setChargeSourceContract(selectedContract); setSelectedContract(null); setForm("charge"); }} />}
    {registryDetail && <RegistryDetailDrawer detail={registryDetail} properties={propertyRecords} units={unitRecords} contracts={contractRecords} charges={chargeRecords} documents={registryDetail.kind === "tenant" || registryDetail.kind === "unit" ? documentsByOwner[registryDetail.record.id] ?? [] : []} categorizedDocuments={registryDetail.kind === "property" ? categorizedDocumentsByOwner[registryDetail.record.id] ?? createEmptyCategorizedDocuments() : undefined} onCategorizedDocumentsChange={(nextDocuments) => updateRegistryDocuments(registryDetail.record.id, nextDocuments)} onClose={() => setRegistryDetail(null)} onEdit={editRegistryDetail} />}
    {selectedExpense && <ExpenseDrawer expense={selectedExpense} onClose={() => setSelectedExpense(null)} onStatusChange={(status, paidIso) => {
      const paidDate = status === "Pago" && paidIso ? formatExpenseDate(paidIso) : null;
      setExpenseRecords((records) => records.map((record) => record.id === selectedExpense.id ? { ...record, status, paidDate } : record));
      setSelectedExpense((record) => record ? { ...record, status, paidDate } : null);
      notify("Status da despesa atualizado.", selectedExpense.id);
    }} />}
    {receiptOpen && selectedCharge && <ReceiptModal charge={selectedCharge} onClose={() => setReceiptOpen(false)} onSave={saveReceipt} />}
    {negotiationOpen && selectedCharge && <NegotiationModal charge={selectedCharge} negotiation={negotiationsByCharge[selectedCharge.id]} onClose={() => setNegotiationOpen(false)} onSave={saveNegotiation} />}
    {reportOpen && <ReportExportModal initialPortfolio={portfolioFilter} portfolioOptions={portfolioRecords} propertyOptions={propertyRecords} tenantOptions={tenantRecords} chargeOptions={chargeRecords} onClose={() => setReportOpen(false)} onExported={(filename) => notify("Relatório contábil gerado e pronto para download.", filename)} />}
    {agencyModalOpen && <AgencyModal agencies={agencyRecords} onClose={() => setAgencyModalOpen(false)} onSave={saveAgency} />}
    {form && <EntityForm kind={form} portfolio={form === "portfolio" ? editingPortfolio : null} property={form === "property" ? editingProperty : null} unit={form === "unit" ? editingUnit : null} tenant={form === "tenant" ? editingTenant : null} documents={(form === "tenant" && editingTenant) || (form === "unit" && editingUnit) ? documentsByOwner[(editingTenant ?? editingUnit)!.id] ?? [] : []} categorizedDocuments={form === "property" && editingProperty ? categorizedDocumentsByOwner[editingProperty.id] ?? createEmptyCategorizedDocuments() : undefined} chargeSourceContract={form === "charge" ? chargeSourceContract : null} portfolioOptions={portfolioRecords} propertyOptions={propertyRecords} unitOptions={unitRecords} tenantOptions={tenantRecords} agencyOptions={agencyRecords} contractOptions={contractRecords} chargeOptions={chargeRecords} onClose={() => { setForm(null); setEditingPortfolio(null); setEditingProperty(null); setEditingUnit(null); setEditingTenant(null); setChargeSourceContract(null); }} onSave={saveForm} />}
    {toast && <SuccessToast message={toast} onClose={dismissToast} />}
  </main>;
}

function Login({ loading, onSubmit }: { loading: boolean; onSubmit: (event: FormEvent) => void }) {
  return <main className="login-page">
    <section className="login-brand" aria-label="Apresentação do sistema">
      <div className="login-brand-header">
        <div className="login-brand-lockup">
          <div className="brand-mark brand-mark-light" aria-hidden="true"><span>L</span><i /><span>R</span></div>
          <div><strong>Locações &amp; Recebíveis</strong><span>Gestão patrimonial</span></div>
        </div>
        <span className="login-module-badge">Módulo 1</span>
      </div>

      <div className="login-copy">
        <p className="eyebrow eyebrow-light">Gestão imobiliária integrada</p>
        <h1>Patrimônio sob controle.<span>Recebíveis em movimento.</span></h1>
        <p>Uma visão única para acompanhar estruturas, contratos e a saúde financeira da operação.</p>
        <ul className="login-capabilities" aria-label="Áreas do sistema">
          <li><span>01</span><strong>Patrimônio</strong><small>Carteiras, imóveis e unidades</small></li>
          <li><span>02</span><strong>Contratos</strong><small>Locatários e vínculos ativos</small></li>
          <li><span>03</span><strong>Financeiro</strong><small>Cobranças e despesas</small></li>
        </ul>
      </div>

      <div className="login-brand-footer">
        <div className="login-footer"><span /> Operação integrada</div>
        <div className="login-property-caption"><strong>Centro Empresarial Nexo</strong><span>Patrimônio em destaque</span></div>
      </div>
    </section>
    <section className="login-panel" aria-label="Acesso administrativo">
      <div className="login-panel-inner">
        <div className="login-panel-context"><span>LR</span><p><strong>Módulo administrativo</strong><small>Patrimônio, contratos e financeiro</small></p></div>
        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-heading"><p className="eyebrow">Acesso administrativo</p><h2>Boas-vindas</h2><p>Entre para visualizar a operação patrimonial e financeira em um único painel.</p></div>
          <label>E-mail<input type="email" defaultValue="administrativo@exemplo.com.br" autoComplete="email" required /></label>
          <label>Senha<input type="password" defaultValue="demonstracao" autoComplete="current-password" required /></label>
          <button className="primary-button login-button" disabled={loading} aria-busy={loading}>{loading ? <><span className="spinner" /> Preparando ambiente</> : <><span>Acessar painel</span><span className="login-button-arrow" aria-hidden="true"><ArrowRight /></span></>}</button>
          <div className="login-trust-note"><span aria-hidden="true"><Check /></span><p><strong>Dados exclusivamente demonstrativos</strong><small>Nenhuma informação real do cliente é exibida nesta versão.</small></p></div>
        </form>
        <p className="login-panel-version">Locações &amp; Recebíveis · Gestão operacional</p>
      </div>
    </section>
  </main>;
}

function SidebarGlyph({ name }: { name: string }) {
  const glyphs: Record<string, LucideIcon> = {
    "Operação": ClipboardList, "Estrutura": Landmark, "Locação": KeyRound, "Financeiro": WalletCards,
    "Visão geral": LayoutDashboard, "Carteiras": BriefcaseBusiness, "Imóveis": Building2, "Unidades": DoorOpen,
    "Locatários": UsersRound, "Contratos": FileSignature, "Cobranças": BadgeDollarSign, "Despesas": ReceiptText,
    "Obras": ClipboardList, "Cronograma": CalendarClock, "Equipe": UsersRound,
  };
  const Glyph = glyphs[name] ?? FileSignature;
  return <span className="sidebar-glyph sidebar-glyph-lucide" aria-hidden="true"><Glyph strokeWidth={1.8} /></span>;
}

function ModuleSwitcher({ module, onChange }: { module: AppModule; onChange: (module: AppModule) => void }) {
  const options: Array<{ value: AppModule; label: string; description: string }> = [
    { value: "Módulo 1", label: "Locações", description: "Patrimônio e recebíveis" },
    { value: "Módulo 2", label: "Obras", description: "Planejamento e execução" },
  ];
  const activeIndex = options.findIndex((option) => option.value === module);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(Math.max(0, activeIndex));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeOption = options[activeIndex] ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => optionRefs.current[highlightedIndex]?.focus());
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [highlightedIndex, open]);

  const openMenu = () => {
    setHighlightedIndex(Math.max(0, activeIndex));
    setOpen(true);
  };
  const chooseOption = (nextModule: AppModule) => {
    setOpen(false);
    onChange(nextModule);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    }
  };
  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (index + direction + options.length) % options.length;
      setHighlightedIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : options.length - 1;
      setHighlightedIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseOption(options[index].value);
    }
  };

  return <div ref={rootRef} className={`module-switcher ${open ? "is-open" : ""}`} data-module={module === "Módulo 1" ? "locacoes" : "obras"}>
    <span>Módulo de trabalho</span>
    <div className="module-switcher-field">
      <span className="module-switcher-mark" aria-hidden="true">{module === "Módulo 1" ? <KeyRound /> : <Building2 />}</span>
      <button type="button" ref={triggerRef} className="module-switcher-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls="module-switcher-options" onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={handleTriggerKeyDown}>
        <span><strong>{activeOption.label}</strong><small>{activeOption.description}</small></span>
        <ChevronsUpDown className="module-switcher-caret" aria-hidden="true" />
      </button>
      {open && <div id="module-switcher-options" className="module-switcher-menu" role="listbox" aria-label="Módulo de trabalho">{options.map((option, index) => <button type="button" role="option" key={option.value} ref={(element) => { optionRefs.current[index] = element; }} aria-selected={option.value === module} className={option.value === module ? "active" : highlightedIndex === index ? "highlighted" : ""} onClick={() => chooseOption(option.value)} onKeyDown={(event) => handleOptionKeyDown(event, index)}><span className="module-switcher-option-mark" aria-hidden="true">{option.value === "Módulo 1" ? <KeyRound /> : <Building2 />}</span><span><strong>{option.label}</strong><small>{option.description}</small></span>{option.value === module && <Check aria-hidden="true" />}</button>)}</div>}
    </div>
  </div>;
}

function Sidebar({ module, page, attentionCount, onModuleChange, onNavigate, onLogout, open, overlay, onClose, collapsed, onExpand, onToggleCollapsed }: { module: AppModule; page: Page; attentionCount: number; onModuleChange: (module: AppModule) => void; onNavigate: (page: Page) => void; onLogout: () => void; open: boolean; overlay: boolean; onClose: () => void; collapsed: boolean; onExpand: () => void; onToggleCollapsed: () => void }) {
  const [openTheme, setOpenTheme] = useState<string | null>("Operação");
  const groups: Array<{ name: string; description: string; pages: Array<{ name: Page; count?: number }> }> = [
    { name: "Operação", description: "Acompanhamento diário", pages: [{ name: "Visão geral" }] },
    { name: "Estrutura", description: "Cadastros e patrimônio", pages: [{ name: "Carteiras" }, { name: "Imóveis" }, { name: "Unidades" }, { name: "Locatários" }] },
    { name: "Locação", description: "Contratos e recebíveis", pages: [{ name: "Contratos" }, { name: "Cobranças", count: attentionCount }] },
    { name: "Financeiro", description: "Obrigações financeiras", pages: [{ name: "Despesas" }] },
  ];
  const worksItems: Array<{ name: string; description: string; page?: Page }> = [
    { name: "Visão geral", description: "Prioridades, agenda, equipe e financeiro", page: "Visão geral" },
    { name: "Obras", description: "Localizar e abrir cada obra", page: "Obras" },
  ];
  const compact = collapsed && !open;
  const item = (name: Page, count?: number) => <button type="button" onClick={() => onNavigate(name)} className={`nav-item ${page === name ? "active" : ""}`} aria-current={page === name ? "page" : undefined} title={compact ? name : undefined}><SidebarGlyph name={name} /><span className="nav-item-label">{name}</span>{count !== undefined && <b>{count}</b>}</button>;
  return <>
    {open && <button type="button" className="mobile-backdrop" onClick={onClose} aria-label="Fechar navegação" tabIndex={-1} aria-hidden="true" />}
    <aside id="app-sidebar" className={`sidebar ${open ? "sidebar-open" : ""} ${compact ? "sidebar-collapsed" : ""}`} aria-label={`Navegação do ${module}`} aria-hidden={overlay && !open ? true : undefined} inert={overlay && !open ? true : undefined}>
      <div className="sidebar-main">
        <div className="sidebar-brand">
          <div className="brand-mark sidebar-logo" aria-hidden="true"><span>L</span><i /><span>R</span></div>
          <div className="sidebar-brand-copy"><strong>Locações &amp; Recebíveis</strong><span>Gestão operacional</span></div>
          <button type="button" className="sidebar-collapse-button" onClick={onToggleCollapsed} aria-label={compact ? "Expandir navegação" : "Recolher navegação"} title={compact ? "Expandir navegação" : "Recolher navegação"}>{compact ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}</button>
          <button type="button" className="sidebar-mobile-close" onClick={onClose} aria-label="Fechar navegação"><X aria-hidden="true" /></button>
        </div>
        <ModuleSwitcher module={module} onChange={onModuleChange} />
        <nav aria-label={`Navegação principal do ${module}`}>
          <p className="sidebar-nav-label">Navegação</p>
          {module === "Módulo 1" ? <div className="theme-list">{groups.map((group, index) => {
            const expanded = openTheme === group.name;
            const hasActivePage = group.pages.some((entry) => entry.name === page);
            const regionId = `sidebar-theme-${index}`;
            return <section className="theme-group" key={group.name}>
              <button type="button" className={`theme-toggle ${expanded ? "open" : ""} ${hasActivePage ? "has-active-page" : ""}`} onClick={() => { if (compact) onExpand(); setOpenTheme(expanded && !collapsed ? null : group.name); }} aria-expanded={expanded && !compact} aria-controls={regionId} title={compact ? group.name : undefined}>
                <span className="theme-identity"><SidebarGlyph name={group.name} /><span className="theme-copy"><strong>{group.name}</strong><small>{group.description}</small></span></span>
                <span className="theme-chevron-shell" aria-hidden="true"><span className="theme-chevron" /></span>
              </button>
              {expanded && !compact && <div className="theme-pages" id={regionId}>{group.pages.map((entry) => <div key={entry.name}>{item(entry.name, entry.count)}</div>)}</div>}
            </section>;
          })}</div> : <div className="works-sidebar-menu">{worksItems.map((entry) => {
            const active = entry.page === page || (entry.page === "Obras" && (page === "Nova obra" || page === "Detalhe da obra"));
            return <button type="button" key={entry.name} className={active ? "active" : ""} disabled={!entry.page} aria-current={active ? "page" : undefined} onClick={() => entry.page && onNavigate(entry.page)}><SidebarGlyph name={entry.name} /><span><strong>{entry.name}</strong><small>{entry.description}</small></span>{!entry.page && <b>Em breve</b>}</button>;
          })}</div>}
        </nav>
      </div>
      <footer className="sidebar-footer">
        <div className="sidebar-account">
          <div className="avatar-shell"><div className="avatar">AD</div><span /></div>
          <div className="account-copy"><strong>Administrativo</strong><span>Acesso principal</span></div>
          <button type="button" className="logout-button" onClick={onLogout} aria-label="Sair do sistema" title="Sair"><LogOut className="logout-icon" aria-hidden="true" /><em>Sair</em></button>
        </div>
      </footer>
    </aside>
  </>;
}

function PageHeading({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action && onAction && <button type="button" className="primary-button button-with-icon" onClick={onAction}><Plus aria-hidden="true" />{action}</button>}</section>;
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="search-field"><Search aria-hidden="true" /><input type="search" aria-label="Buscar" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function FilterSelect({ label, value, onChange, children, active = false, variant = "filter", wide = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; active?: boolean; variant?: "filter" | "sort"; wide?: boolean }) {
  return <label className={`filter-select ${active ? "is-active" : ""} ${wide ? "filter-select-wide" : ""}`}>
    <span className="sr-only">{label}</span>
    {variant === "sort" ? <ArrowUpDown className="filter-select-icon" aria-hidden="true" /> : <SlidersHorizontal className="filter-select-icon" aria-hidden="true" />}
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    <span className="filter-select-chevron" aria-hidden="true" />
  </label>;
}

function PortfolioFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <FilterSelect label="Filtrar por carteira" value={value} onChange={onChange} active={value !== "Todas as carteiras"}><option>Todas as carteiras</option>{portfolios.map((portfolio) => <option key={portfolio.id}>{portfolio.name}</option>)}</FilterSelect>;
}

function ConnectionBanner({ onRetry }: { onRetry: () => void }) {
  return <aside className="connection-banner" role="alert"><span aria-hidden="true"><WifiOff /></span><div><strong>Sem conexão</strong><p>Os dados exibidos podem estar desatualizados. Reconecte para continuar salvando.</p></div><button type="button" className="secondary-button button-with-icon" onClick={onRetry}><RotateCcw aria-hidden="true" />Tentar novamente</button></aside>;
}

function SystemError({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return <section className={`system-error ${compact ? "system-error-compact" : ""}`} role="alert"><span aria-hidden="true"><TriangleAlert /></span><div><h3>Não foi possível carregar os dados</h3><p>Confira sua conexão e tente novamente. Nenhuma alteração foi perdida.</p></div><button type="button" className="primary-button button-with-icon" onClick={onRetry}><RotateCcw aria-hidden="true" />Tentar novamente</button></section>;
}

function AuthenticatedPageSkeleton({ variant = "list" }: { variant?: "dashboard" | "list" | "ledger" | "detail" }) {
  return <div className={`page-skeleton page-skeleton-${variant}`} role="status" aria-live="polite">
    <span className="sr-only">Carregando conteúdo</span>
    <div className="skeleton-heading"><i /><i /></div>
    {variant === "dashboard" ? <>
      <div className="skeleton-hero" />
      <div className="skeleton-split"><i /><i /></div>
    </> : variant === "detail" ? <>
      <div className="skeleton-hero skeleton-hero-detail" />
      <div className="skeleton-tabs">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
      <div className="skeleton-split"><i /><i /></div>
    </> : variant === "ledger" ? <>
      <div className="skeleton-cards">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
      <div className="skeleton-rows">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
    </> : <>
      <div className="skeleton-cards">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
      <div className="skeleton-toolbar" />
      <div className="skeleton-grid">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
    </>}
  </div>;
}

function SuccessToast({ message, onClose }: { message: Exclude<ToastMessage, null>; onClose: () => void }) {
  return <div className="toast" role="status" aria-live="polite" aria-atomic="true">
    <span className="toast-icon" aria-hidden="true"><CircleCheck /></span>
    <div><strong>{message.message}</strong><small>Referência: {message.reference}</small></div>
    <button type="button" className="toast-close" onClick={onClose} aria-label="Fechar notificação"><X aria-hidden="true" /></button>
    <i className="toast-progress" aria-hidden="true" />
  </div>;
}

function InlineFieldError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="inline-field-error" id="entity-form-error" role="alert"><span aria-hidden="true"><TriangleAlert /></span>{message}</p>;
}

function TableSection({ toolbar, children, footer }: { toolbar: ReactNode; children: ReactNode; footer: ReactNode }) {
  return <section className="table-section"><div className="table-toolbar">{toolbar}</div><div className="table-wrap">{children}</div><div className="table-footer">{footer}</div></section>;
}

function EmptyState({ filtered, entity = "registro", mark = "00", eyebrow = "Base pronta para começar", title, description, action, onAction, onClear, tone = "neutral" }: { filtered?: boolean; entity?: string; mark?: string; eyebrow?: string; title?: string; description?: string; action?: string; onAction?: () => void; onClear?: () => void; tone?: "neutral" | "portfolio" | "property" | "unit" | "tenant" | "contract" | "charge" | "expense" }) {
  const hasActiveFilter = useContext(FilterStateContext);
  const isFiltered = filtered ?? hasActiveFilter;
  const resolvedTitle = isFiltered ? "Nenhum resultado encontrado" : title ?? `Nenhum ${entity} cadastrado`;
  const resolvedDescription = isFiltered ? "Os dados continuam preservados. Limpe os filtros ou ajuste a busca para visualizar outros registros." : description ?? `Quando houver algum ${entity}, ele aparecerá aqui.`;
  return <section className={`empty-state empty-state-${isFiltered ? "filtered" : tone}`} aria-live="polite">
    <div className="empty-state-copy">
      <p className="empty-state-eyebrow"><span aria-hidden="true">{isFiltered ? "↺" : mark}</span>{isFiltered ? "Busca sem correspondência" : eyebrow}</p>
      <h3>{resolvedTitle}</h3>
      <p>{resolvedDescription}</p>
      <div className="empty-state-actions">
        {isFiltered && onClear && <button type="button" className="primary-button button-with-icon" onClick={onClear}><RotateCcw aria-hidden="true" />Limpar filtros</button>}
        {action && onAction && <button type="button" className={`${isFiltered ? "secondary-button" : "primary-button"} button-with-icon`} onClick={onAction}><Plus aria-hidden="true" />{action}</button>}
      </div>
    </div>
    <div className="empty-state-visual" aria-hidden="true">
      <span className="empty-state-orbit" />
      <span className="empty-state-sheet"><b>{isFiltered ? "?" : mark}</b><i /><i /><em>{isFiltered ? <Search /> : <Plus />}</em></span>
    </div>
  </section>;
}

function CompactEmptyState({ mark, title, description, tone = "neutral" }: { mark: string; title: string; description: string; tone?: "neutral" | "success" | "charge" | "tenant" }) {
  return <div className={`compact-empty-state compact-empty-state-${tone}`}><span aria-hidden="true">{mark}</span><div><strong>{title}</strong><p>{description}</p></div></div>;
}
function UnitPills({ values }: { values: string[] }) { return <div className="tag-list">{values.map((value) => <span key={value}>{value}</span>)}</div>; }
function tenantInitials(name: string) {
  const ignoredWords = new Set(["ltda.", "ltda", "s/a", "sa", "de", "da", "do", "dos", "das"]);
  const words = name.split(/\s+/).filter((word) => word && !ignoredWords.has(word.toLowerCase()));
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function WorkStatusBadge({ status }: { status: WorkStatus }) {
  const statusClass: Record<WorkStatus, string> = {
    Planejada: "planned",
    "Em andamento": "active",
    Pausada: "paused",
    Concluída: "completed",
    Cancelada: "cancelled",
  };
  return <span className={`work-status work-status-${statusClass[status]}`}><i aria-hidden="true" />{status}</span>;
}

function WorkAttentionIcon({ kind }: { kind: WorkAttention["kind"] }) {
  if (kind === "schedule") return <CalendarClock aria-hidden="true" />;
  if (kind === "update") return <ClipboardList aria-hidden="true" />;
  if (kind === "payment" || kind === "supplier") return <HandCoins aria-hidden="true" />;
  return <TriangleAlert aria-hidden="true" />;
}

function workAttentionDestination(kind: WorkAttention["kind"]): { tab: WorkDetailTab; label: string } {
  if (kind === "schedule") return { tab: "Planejamento", label: "Abrir planejamento" };
  if (kind === "update") return { tab: "Diário e arquivos", label: "Ver atualizações" };
  if (kind === "supplier" || kind === "payment") return { tab: "Fornecedores", label: "Ver fornecedores" };
  return { tab: "Financeiro", label: "Abrir financeiro" };
}

function WorksDashboardPage({ works, costsByWorkId, onNewWork, onOpenWork, onNavigate }: { works: WorkRecord[]; costsByWorkId: Record<string, WorkCostSummary>; onNewWork: () => void; onOpenWork: (work: WorkRecord, initialTab?: WorkDetailTab) => void; onNavigate: (page: Page) => void }) {
  const [propertyFilter, setPropertyFilter] = useState("Todos os imóveis");
  const [periodFilter, setPeriodFilter] = useState("Agosto de 2026");
  const properties = Array.from(new Set(works.map((work) => work.property))).sort((left, right) => left.localeCompare(right, "pt-BR"));
  const periodRange = periodFilter === "Agosto de 2026"
    ? { start: "2026-08-01", end: "2026-08-31" }
    : periodFilter === "Próximos 30 dias"
      ? { start: "2026-08-24", end: "2026-09-23" }
      : null;
  const matchesProperty = (property: string) => propertyFilter === "Todos os imóveis" || property === propertyFilter;
  const matchesDate = (start: string, end: string) => !periodRange || (start <= periodRange.end && end >= periodRange.start);
  const scopedWorks = works.filter((work) => matchesProperty(work.property) && matchesDate(work.startDateIso, work.endDateIso));
  const scopedWorkIds = new Set(scopedWorks.map((work) => work.id));
  const attentions = workAttentionRecords.filter((attention) => scopedWorkIds.has(attention.workId));
  const commitments = workCommitments.filter((commitment) => scopedWorkIds.has(commitment.workId) && (!periodRange || (commitment.dateIso >= periodRange.start && commitment.dateIso <= periodRange.end)));
  const activeWorks = scopedWorks.filter((work) => work.status === "Em andamento" || work.status === "Pausada").sort((left, right) => {
    const riskOrder = { "Em atraso": 0, Atenção: 1, "Dentro do prazo": 2, Concluída: 3 };
    return riskOrder[left.risk] - riskOrder[right.risk] || left.endDateIso.localeCompare(right.endDateIso);
  });
  const inProgress = scopedWorks.filter((work) => work.status === "Em andamento").length;
  const delayed = scopedWorks.filter((work) => work.risk === "Em atraso").length;
  const activeCostSummaries = scopedWorks.filter((work) => work.status !== "Cancelada").map((work) => costsByWorkId[work.id]);
  const teamCosts = activeCostSummaries.reduce((sum, costs) => sum + (costs?.teamCost ?? 0), 0);
  const supplierCosts = activeCostSummaries.reduce((sum, costs) => sum + (costs?.supplierContracted ?? 0), 0);
  const supplierPaid = activeCostSummaries.reduce((sum, costs) => sum + (costs?.supplierPaid ?? 0), 0);
  const supplierPending = Math.max(0, supplierCosts - supplierPaid);
  const totalOperationalCosts = teamCosts + supplierCosts;
  const featuredWork = activeWorks[0] ?? scopedWorks[0];
  const featuredAttention = attentions[0];
  const featuredCosts = featuredWork ? costsByWorkId[featuredWork.id] : undefined;
  const featuredSupplierPaid = featuredCosts?.supplierContracted ? Math.round((featuredCosts.supplierPaid / featuredCosts.supplierContracted) * 100) : 0;
  const averageProgress = activeWorks.length > 0 ? Math.round(activeWorks.reduce((sum, work) => sum + work.progress, 0) / activeWorks.length) : 0;
  const inProgressRatio = scopedWorks.length > 0 ? Math.round((inProgress / scopedWorks.length) * 100) : 0;
  const delayedRatio = scopedWorks.length > 0 ? Math.round((delayed / scopedWorks.length) * 100) : 0;
  const supplierShareRatio = totalOperationalCosts > 0 ? Math.round((supplierCosts / totalOperationalCosts) * 100) : 0;
  const supplierPendingRatio = supplierCosts > 0 ? Math.round((supplierPending / supplierCosts) * 100) : 0;
  const filtersActive = propertyFilter !== "Todos os imóveis" || periodFilter !== "Agosto de 2026";
  const openAttention = (attention: WorkAttention) => {
    const work = works.find((record) => record.id === attention.workId);
    if (work) onOpenWork(work, workAttentionDestination(attention.kind).tab);
  };

  return <div className="works-dashboard">
    <section className="works-dashboard-heading" aria-labelledby="works-dashboard-title">
      <div><p className="eyebrow">Módulo 2 · Gestão de Obras</p><h1 id="works-dashboard-title">Visão geral</h1><p>Acompanhe primeiro o que precisa de atenção e depois o andamento das obras.</p></div>
      <button type="button" className="primary-button button-with-icon works-new-button" onClick={onNewWork}><Plus aria-hidden="true" />Nova obra</button>
    </section>

    <section className="works-dashboard-toolbar" aria-label="Filtros da visão geral">
      <div className="works-dashboard-date"><span><CalendarClock aria-hidden="true" /></span><div><strong>Posição da operação</strong><small>24 de agosto de 2026 · dados demonstrativos</small></div></div>
      <div className="works-dashboard-filters">
        <label><span>Imóvel</span><select value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)} aria-label="Filtrar visão geral por imóvel"><option>Todos os imóveis</option>{properties.map((property) => <option key={property}>{property}</option>)}</select></label>
        <label><span>Período</span><select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} aria-label="Filtrar visão geral por período"><option>Agosto de 2026</option><option>Próximos 30 dias</option><option>Todo o período</option></select></label>
        <button type="button" className="secondary-button button-with-icon works-clear-filters" disabled={!filtersActive} onClick={() => { setPropertyFilter("Todos os imóveis"); setPeriodFilter("Agosto de 2026"); }}><RotateCcw aria-hidden="true" />Limpar</button>
      </div>
    </section>

    <section className="works-dashboard-stage" aria-label="Destaques da operação">
      {featuredWork ? <button type="button" className="works-featured-work" onClick={() => onOpenWork(featuredWork)}>
        <img src={propertyCoverImagesByName[featuredWork.property] ?? fallbackPropertyCover} alt={`Fachada de ${featuredWork.property}`} width="960" height="620" />
        <span className="works-featured-shade" aria-hidden="true" />
        <span className="works-featured-topline"><b>Obra em destaque</b><em className={`works-featured-risk works-featured-risk-${featuredWork.risk === "Em atraso" ? "danger" : featuredWork.risk === "Atenção" ? "warning" : "ok"}`}>{featuredWork.risk}</em></span>
        <span className="works-featured-content">
          <small>{featuredWork.id} · {featuredWork.property}{featuredWork.unit ? ` · ${featuredWork.unit}` : ""}</small>
          <strong>{featuredWork.title}</strong>
          <span className="works-featured-next"><i aria-hidden="true"><ClipboardList /></i><span><small>Próximo marco</small><b>{featuredWork.nextActivity}</b></span></span>
          <span className="works-featured-stats">
            <span><small>Progresso</small><b>{featuredWork.progress}%</b></span>
            <span><small>Prazo final</small><b>{featuredWork.endLabel}</b></span>
            <span><small>Fornecedores pagos</small><b>{featuredSupplierPaid}%</b></span>
          </span>
          <span className="works-featured-progress" role="progressbar" aria-valuenow={featuredWork.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${featuredWork.title}`}><i style={{ width: `${featuredWork.progress}%` }} /></span>
          <span className="works-featured-footer"><span>Responsável · {featuredWork.manager}</span><b>Ver obra <ArrowRight aria-hidden="true" /></b></span>
        </span>
      </button> : <article className="works-featured-empty"><CompactEmptyState mark="OB" title="Nenhuma obra neste filtro" description="Escolha outro imóvel ou período para visualizar os destaques." /></article>}

      <article className="works-priority-panel" aria-labelledby="works-attention-title">
        <header><div><p className="eyebrow">Prioridades do dia</p><h2 id="works-attention-title">O que pede ação agora</h2><span>Uma leitura rápida para decidir por onde começar.</span></div><b>{attentions.length}</b></header>
        {featuredAttention ? <>
          <button type="button" className={`works-priority-main works-priority-${featuredAttention.tone}`} onClick={() => openAttention(featuredAttention)} aria-label={`${featuredAttention.title}. ${workAttentionDestination(featuredAttention.kind).label} da obra ${featuredAttention.workId}`}>
            <span className="works-priority-icon"><WorkAttentionIcon kind={featuredAttention.kind} /></span>
            <span className="works-priority-copy"><small>Prioridade principal</small><strong>{featuredAttention.title}</strong><span className="works-priority-description">{featuredAttention.description}</span><em>{featuredAttention.workId} · {featuredAttention.meta}</em><span className="works-priority-action">{workAttentionDestination(featuredAttention.kind).label}</span></span>
            <ArrowRight aria-hidden="true" />
          </button>
          {attentions.length > 1 ? <div className="works-priority-list">{attentions.slice(1).map((attention) => {
            const destination = workAttentionDestination(attention.kind);
            return <button type="button" key={attention.id} className={`works-priority-item works-priority-${attention.tone}`} onClick={() => openAttention(attention)} aria-label={`${attention.title}. ${destination.label} da obra ${attention.workId}`}><i aria-hidden="true"><WorkAttentionIcon kind={attention.kind} /></i><span><strong>{attention.title}</strong><small>{attention.workId} · {attention.meta}</small><em>{destination.label}</em></span><ArrowRight aria-hidden="true" /></button>;
          })}</div> : null}
        </> : <CompactEmptyState mark="✓" tone="success" title="Nada exige atenção neste filtro" description="Troque o imóvel ou o período para consultar outras obras." />}
      </article>
    </section>

    <section className="works-metrics" aria-label="Indicadores essenciais das obras">
      <article className="works-metric works-metric-active"><span><ClipboardList aria-hidden="true" /></span><div><small>Obras em andamento</small><strong>{inProgress}</strong><p>{averageProgress}% de avanço médio nas obras ativas</p><i className="works-metric-track" role="progressbar" aria-valuenow={inProgressRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${inProgressRatio}% das obras estão em andamento`}><b style={{ width: `${inProgressRatio}%` }} /></i></div></article>
      <article className="works-metric works-metric-danger"><span><TriangleAlert aria-hidden="true" /></span><div><small>Obras em atraso</small><strong>{delayed}</strong><p>{delayed === 1 ? "1 obra requer ação hoje" : `${delayed} obras requerem ação hoje`}</p><i className="works-metric-track" role="progressbar" aria-valuenow={delayedRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${delayedRatio}% das obras estão em atraso`}><b style={{ width: `${delayedRatio}%` }} /></i></div></article>
      <article className="works-metric works-metric-spent"><span><HandCoins aria-hidden="true" /></span><div><small>Custos das obras</small><strong>{brl.format(totalOperationalCosts)}</strong><p>Equipe {brl.format(teamCosts)} · fornecedores {brl.format(supplierCosts)}</p><i className="works-metric-track" role="progressbar" aria-valuenow={supplierShareRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${supplierShareRatio}% dos custos são de fornecedores`}><b style={{ width: `${supplierShareRatio}%` }} /></i></div></article>
      <article className={`works-metric ${supplierPending > 0 ? "works-metric-balance" : "works-metric-active"}`}><span><WalletCards aria-hidden="true" /></span><div><small>Pendente a fornecedores</small><strong>{brl.format(supplierPending)}</strong><p>{brl.format(supplierPaid)} já pagos nos contratos</p><i className="works-metric-track" role="progressbar" aria-valuenow={supplierPendingRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${supplierPendingRatio}% dos contratos com fornecedores está pendente`}><b style={{ width: `${supplierPendingRatio}%` }} /></i></div></article>
    </section>

    <section className="works-dashboard-grid">
      <article className="works-active-panel" aria-labelledby="works-active-title">
        <header><div><p className="eyebrow">Execução</p><h2 id="works-active-title">Obras em andamento</h2><span>Progresso, próxima atividade e prazo em uma única leitura.</span></div><button type="button" className="works-section-link" onClick={() => onNavigate("Obras")}>Ver todas ({activeWorks.length})<ArrowRight aria-hidden="true" /></button></header>
        {activeWorks.length > 0 ? <div className="works-active-list">{activeWorks.slice(0, 5).map((work) => <button type="button" className="works-active-row" key={work.id} onClick={() => onOpenWork(work)}>
          <span className="works-active-identity"><small>{work.id} · {work.property}</small><strong>{work.title}</strong><em>{work.manager}</em></span>
          <span className="works-active-next"><small>Próxima atividade</small><strong>{work.nextActivity}</strong><em>{work.lastUpdateLabel}</em></span>
          <span className="works-active-progress"><span><small>Progresso</small><strong>{work.progress}%</strong></span><i role="progressbar" aria-valuenow={work.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${work.title}`}><b style={{ width: `${work.progress}%` }} /></i></span>
          <span className="works-active-deadline"><WorkStatusBadge status={work.status} /><small className={`work-risk work-risk-${work.risk === "Em atraso" ? "danger" : work.risk === "Atenção" ? "warning" : "ok"}`}>{work.risk}</small><strong>{work.endLabel}</strong></span>
          <ArrowRight aria-hidden="true" />
        </button>)}</div> : <CompactEmptyState mark="OB" title="Nenhuma obra ativa neste filtro" description="Escolha outro imóvel ou período para visualizar o andamento." />}
      </article>

      <aside className="works-commitments-panel" aria-labelledby="works-commitments-title">
        <header><div><p className="eyebrow">Próximas datas</p><h2 id="works-commitments-title">Agenda das obras</h2></div></header>
        {commitments.length > 0 ? <div className="works-commitments-list">{commitments.slice(0, 5).map((commitment) => {
          const work = works.find((record) => record.id === commitment.workId);
          return <button type="button" key={commitment.id} onClick={() => work && onOpenWork(work, "Planejamento")} aria-label={`${commitment.title}. Abrir planejamento da obra ${commitment.workId}`}><time dateTime={commitment.dateIso}><strong>{commitment.day}</strong><small>{commitment.month}</small></time><span><strong>{commitment.title}</strong><small>{commitment.description}</small><em className={`commitment-${commitment.status === "Atrasado" ? "danger" : commitment.status === "Hoje" ? "today" : "next"}`}>{commitment.status}</em></span><ArrowRight aria-hidden="true" /></button>;
        })}</div> : <CompactEmptyState mark="00" title="Sem compromissos neste período" description="As próximas atividades das obras aparecerão aqui." />}
      </aside>
    </section>
  </div>;
}

function WorksListPage({ works, costsByWorkId, onNewWork, onEditWork, onOpenWork }: { works: WorkRecord[]; costsByWorkId: Record<string, WorkCostSummary>; onNewWork: () => void; onEditWork: (work: WorkRecord) => void; onOpenWork: (work: WorkRecord) => void }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas as situações");
  const [propertyFilter, setPropertyFilter] = useState("Todos os imóveis");
  const [managerFilter, setManagerFilter] = useState("Todos os responsáveis");
  const [priorityFilter, setPriorityFilter] = useState("Todas as prioridades");
  const [periodFilter, setPeriodFilter] = useState("Todo o período");
  const [onlyDelayed, setOnlyDelayed] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sortBy, setSortBy] = useState("priority");
  const [view, setView] = useState<"cards" | "table">("cards");
  const properties = Array.from(new Set(works.map((work) => work.property))).sort((left, right) => left.localeCompare(right, "pt-BR"));
  const managers = Array.from(new Set(works.map((work) => work.manager))).sort((left, right) => left.localeCompare(right, "pt-BR"));
  const periodRange = periodFilter === "Agosto de 2026"
    ? { start: "2026-08-01", end: "2026-08-31" }
    : periodFilter === "Próximos 30 dias"
      ? { start: "2026-08-24", end: "2026-09-23" }
      : null;
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const normalizedQuery = normalizeSearch(query.trim());
  const priorityRank: Record<WorkRecord["priority"], number> = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };
  const filteredWorks = works.filter((work) => {
    const searchable = normalizeSearch([work.id, work.title, work.property, work.unit ?? "", work.manager, work.nextActivity].join(" "));
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
    const matchesStatus = statusFilter === "Todas as situações" || work.status === statusFilter;
    const matchesProperty = propertyFilter === "Todos os imóveis" || work.property === propertyFilter;
    const matchesManager = managerFilter === "Todos os responsáveis" || work.manager === managerFilter;
    const matchesPriority = priorityFilter === "Todas as prioridades" || work.priority === priorityFilter;
    const matchesPeriod = !periodRange || (work.startDateIso <= periodRange.end && work.endDateIso >= periodRange.start);
    const matchesDelay = !onlyDelayed || work.risk === "Em atraso";
    return matchesQuery && matchesStatus && matchesProperty && matchesManager && matchesPriority && matchesPeriod && matchesDelay;
  }).sort((left, right) => {
    if (sortBy === "due") return left.endDateIso.localeCompare(right.endDateIso) || priorityRank[left.priority] - priorityRank[right.priority];
    if (sortBy === "updated") return right.updatedAtIso.localeCompare(left.updatedAtIso);
    if (sortBy === "cost") return (costsByWorkId[right.id]?.totalCommitted ?? 0) - (costsByWorkId[left.id]?.totalCommitted ?? 0);
    return priorityRank[left.priority] - priorityRank[right.priority] || left.endDateIso.localeCompare(right.endDateIso);
  });
  const executionWorks = filteredWorks.filter((work) => work.status === "Em andamento");
  const filteredInProgress = executionWorks.length;
  const filteredPaused = filteredWorks.filter((work) => work.status === "Pausada").length;
  const filteredCompleted = filteredWorks.filter((work) => work.status === "Concluída").length;
  const filteredAttention = filteredWorks.filter((work) => work.status !== "Concluída" && work.status !== "Cancelada" && (work.risk === "Em atraso" || work.risk === "Atenção")).length;
  const advancedFilterCount = [managerFilter !== "Todos os responsáveis", priorityFilter !== "Todas as prioridades", periodFilter !== "Todo o período", onlyDelayed].filter(Boolean).length;
  const filtersActive = Boolean(query || statusFilter !== "Todas as situações" || propertyFilter !== "Todos os imóveis" || managerFilter !== "Todos os responsáveis" || priorityFilter !== "Todas as prioridades" || periodFilter !== "Todo o período" || onlyDelayed);
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("Todas as situações");
    setPropertyFilter("Todos os imóveis");
    setManagerFilter("Todos os responsáveis");
    setPriorityFilter("Todas as prioridades");
    setPeriodFilter("Todo o período");
    setOnlyDelayed(false);
    setSortBy("priority");
  };

  return <div className="works-list-page">
    <section className="works-dashboard-heading works-list-heading" aria-labelledby="works-list-title">
      <div><p className="eyebrow">Módulo 2 · Gestão de Obras</p><h1 id="works-list-title">Obras</h1><p>Localize obras, reparos e manutenções sem precisar abrir cada cadastro.</p></div>
      <button type="button" className="primary-button button-with-icon works-new-button" onClick={onNewWork}><Plus aria-hidden="true" />Nova obra</button>
    </section>

    <section className="works-list-summary" aria-label="Resumo das obras filtradas">
      <div className="works-list-summary-lead">
        <p className="works-list-summary-eyebrow">Resultado da consulta</p>
        <p className="works-list-summary-count"><strong>{filteredWorks.length}</strong><span>{filteredWorks.length === 1 ? "obra encontrada" : "obras encontradas"}</span></p>
        <small className="works-list-summary-note">{filtersActive ? "Considerando os filtros atuais" : "Considerando toda a base"}</small>
      </div>
      <div className="works-list-summary-stats">
        <span className="s-active"><small className="works-summary-stat-label">Em andamento</small><b>{filteredInProgress}</b><em>obras em execução</em></span>
        <span className={filteredAttention > 0 ? "attention" : ""}><small className="works-summary-stat-label">Requerem atenção</small><b>{filteredAttention}</b><em>com risco ou atraso</em></span>
        <span className="s-paused"><small className="works-summary-stat-label">Pausadas</small><b>{filteredPaused}</b><em>aguardam retomada</em></span>
        <span className="s-done"><small className="works-summary-stat-label">Concluídas</small><b>{filteredCompleted}</b><em>finalizadas</em></span>
      </div>
    </section>

    <section className="works-list-controls" aria-label="Busca e filtros de obras">
      <div className="works-list-primary-controls">
        <div className="works-list-search"><Search aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por obra, código, imóvel ou responsável" aria-label="Buscar obras" /></div>
        <label className={statusFilter !== "Todas as situações" ? "active" : ""}><span>Situação</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todas as situações</option><option>Planejada</option><option>Em andamento</option><option>Pausada</option><option>Concluída</option><option>Cancelada</option></select></label>
        <label className={propertyFilter !== "Todos os imóveis" ? "active" : ""}><span>Imóvel</span><select value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)}><option>Todos os imóveis</option>{properties.map((property) => <option key={property}>{property}</option>)}</select></label>
        <button type="button" className={`secondary-button button-with-icon works-more-filters ${advancedOpen ? "active" : ""}`} aria-expanded={advancedOpen} aria-controls="works-advanced-filters" onClick={() => setAdvancedOpen((current) => !current)}><SlidersHorizontal aria-hidden="true" />Mais filtros{advancedFilterCount > 0 ? <b aria-label={`${advancedFilterCount} filtros adicionais ativos`}>{advancedFilterCount}</b> : null}</button>
      </div>
      {advancedOpen && <div className="works-list-advanced" id="works-advanced-filters">
        <label className={managerFilter !== "Todos os responsáveis" ? "active" : ""}><span>Responsável</span><select value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)}><option>Todos os responsáveis</option>{managers.map((manager) => <option key={manager}>{manager}</option>)}</select></label>
        <label className={priorityFilter !== "Todas as prioridades" ? "active" : ""}><span>Prioridade</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option>Todas as prioridades</option><option>Urgente</option><option>Alta</option><option>Média</option><option>Baixa</option></select></label>
        <label className={periodFilter !== "Todo o período" ? "active" : ""}><span>Período</span><select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}><option>Todo o período</option><option>Agosto de 2026</option><option>Próximos 30 dias</option></select></label>
        <label className="works-delayed-check"><input type="checkbox" checked={onlyDelayed} onChange={(event) => setOnlyDelayed(event.target.checked)} /><span><strong>Somente obras atrasadas</strong><small>Mostra obras que já ultrapassaram o prazo.</small></span></label>
      </div>}
      <footer><span aria-live="polite"><strong>{filteredWorks.length}</strong> de {works.length} obras</span><button type="button" className="text-button button-with-icon" disabled={!filtersActive} onClick={clearFilters}><RotateCcw aria-hidden="true" />Limpar filtros</button></footer>
    </section>

    <section className="works-catalog" aria-labelledby="works-catalog-title">
      <header><div><p className="eyebrow">Consulta operacional</p><h2 id="works-catalog-title">Obras cadastradas</h2><span>Abra os detalhes ou edite os dados principais de uma obra.</span></div><div className="works-catalog-header-end"><label><ArrowUpDown aria-hidden="true" /><span className="works-catalog-sort-label">Ordenar por</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar obras"><option value="priority">Prioridade: maior primeiro</option><option value="due">Prazo: mais próximo</option><option value="updated">Atualização: mais recente</option><option value="cost">Custo total: maior valor</option></select></label><div className="works-catalog-view-switch" role="group" aria-label="Forma de visualização"><button type="button" aria-pressed={view === "cards"} aria-controls="works-catalog-results" onClick={() => setView("cards")}><LayoutDashboard aria-hidden="true" />Cards</button><button type="button" aria-pressed={view === "table"} aria-controls="works-catalog-results" onClick={() => setView("table")}><ClipboardList aria-hidden="true" />Tabela</button></div></div></header>
      <div id="works-catalog-results">
      {filteredWorks.length > 0 ? view === "cards" ? <div className="works-catalog-list" aria-label="Lista de obras">{filteredWorks.map((work) => {
        const costs = costsByWorkId[work.id];
        const riskClass = work.risk === "Em atraso" ? "danger" : work.risk === "Atenção" ? "warning" : "ok";
        const deadlineNote = work.status === "Concluída" ? "Obra concluída" : work.status === "Cancelada" ? "Obra cancelada" : work.risk === "Em atraso" ? "Prazo ultrapassado" : work.risk === "Atenção" ? "Prazo exige atenção" : "Dentro do prazo";
        return <article className={`works-catalog-card works-catalog-card-${riskClass}`} key={work.id}>
          <button type="button" className="works-catalog-cover" onClick={() => onOpenWork(work)} aria-label={`Abrir ${work.title}`}>
            <img src={propertyCoverImagesByName[work.property] ?? fallbackPropertyCover} alt={`Fachada de ${work.property}`} width="560" height="420" loading="lazy" />
            <span>{work.interventionType ?? "Obra"}</span>
          </button>
          <div className="works-catalog-card-body">
            <header>
              <div className="works-catalog-identity"><span><b className={`work-priority work-priority-${work.priority.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{work.priority}</b><small>{work.id}</small></span><h3>{work.title}</h3><em><Building2 aria-hidden="true" />{work.property}{work.unit ? ` · ${work.unit}` : ""}</em></div>
              <div className="works-catalog-badges"><span className="works-catalog-badge"><small>Situação</small><WorkStatusBadge status={work.status} /></span><span className="works-catalog-badge"><small>Prazo</small><span className={`works-catalog-risk works-catalog-risk-${riskClass}`}><i aria-hidden="true" />{work.risk}</span></span></div>
            </header>
            <div className="works-catalog-highlights">
              <span className="works-catalog-next"><small>Próxima atividade</small><strong>{work.nextActivity}</strong><em>{work.lastUpdateLabel}</em></span>
              <span className="works-catalog-progress"><span><small>Progresso</small><strong>{work.progress}%</strong></span><i role="progressbar" aria-valuenow={work.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${work.title}`}><b style={{ width: `${work.progress}%` }} /></i><em>{work.progress === 100 ? "Execução concluída" : `${100 - work.progress}% restante`}</em></span>
              <span className="works-catalog-deadline"><small>Prazo final</small><strong>{work.endLabel}</strong><em>{deadlineNote}</em></span>
              <span className="works-catalog-finance"><small>Equipe + fornecedores</small><strong>{brl.format(costs?.totalCommitted ?? 0)}</strong><em>{brl.format(costs?.teamCost ?? 0)} + {brl.format(costs?.supplierContracted ?? 0)}</em></span>
            </div>
            <footer>
              <span className="works-catalog-manager"><i aria-hidden="true"><UsersRound /></i><span><small>Responsável</small><strong>{work.manager}</strong></span></span>
              <span className="works-catalog-actions"><button type="button" className="works-catalog-edit" onClick={() => onEditWork(work)} aria-label={`Editar ${work.title}`} title="Editar obra"><PencilLine aria-hidden="true" /></button><button type="button" className="works-catalog-open" onClick={() => onOpenWork(work)} aria-label={`Abrir ${work.title}`}>Abrir obra<ArrowRight aria-hidden="true" /></button></span>
            </footer>
          </div>
        </article>;
      })}</div> : <div className="works-catalog-table-wrap"><table className="compact-table works-catalog-table">
        <caption className="sr-only">Obras cadastradas: situação, prazo, progresso, próxima atividade e responsável</caption>
        <thead><tr><th scope="col">Obra</th><th scope="col">Situação</th><th scope="col">Prazo</th><th scope="col">Progresso</th><th scope="col">Próxima atividade</th><th scope="col">Ações</th></tr></thead>
        <tbody>{filteredWorks.map((work) => {
          const riskClass = work.risk === "Em atraso" ? "danger" : work.risk === "Atenção" ? "warning" : "ok";
          return <tr key={work.id}>
            <td className="works-catalog-table-name"><strong>{work.title}</strong><small>{work.id} · {work.property}{work.unit ? ` · ${work.unit}` : ""}</small></td>
            <td><WorkStatusBadge status={work.status} /></td>
            <td className={`works-catalog-table-deadline works-catalog-table-${riskClass}`}><strong>{work.endLabel}</strong><small>{work.risk}</small></td>
            <td className="works-catalog-table-progress"><span>{work.progress}%</span><i aria-hidden="true"><b style={{ width: `${work.progress}%` }} /></i></td>
            <td className="works-catalog-table-next">{work.nextActivity}</td>
            <td><div className="works-catalog-table-actions"><button type="button" className="works-catalog-edit" onClick={() => onEditWork(work)} aria-label={`Editar ${work.title}`} title="Editar obra"><PencilLine aria-hidden="true" /></button><button type="button" className="row-action" onClick={() => onOpenWork(work)} aria-label={`Abrir ${work.title}`}>Abrir</button></div></td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="works-catalog-empty"><CompactEmptyState mark="00" title="Nenhuma obra encontrada" description="Ajuste a busca ou limpe os filtros para visualizar outros registros." /><button type="button" className="secondary-button button-with-icon" onClick={clearFilters}><RotateCcw aria-hidden="true" />Limpar filtros</button></div>}
      </div>
    </section>
  </div>;
}

function WorkDetailStatusBadge({ status }: { status: WorkActivityStatus }) {
  const slug = status.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  return <span className={`work-activity-status work-activity-${slug}`}><i aria-hidden="true" />{status}</span>;
}

function WorkActivityActions({ activity, onComplete, onBlock, onReprogram }: { activity: WorkActivity; onComplete: () => void; onBlock: () => void; onReprogram: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canComplete = activity.status !== "Conclu\u00edda";
  const canBlock = activity.status !== "Conclu\u00edda" && activity.status !== "Bloqueada";
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const closeOnOutside = (event: PointerEvent) => { if (menu && !menu.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key !== "Escape") return; setOpen(false); menu?.querySelector<HTMLElement>(":scope > button")?.focus(); };
    window.requestAnimationFrame(() => menu?.querySelector<HTMLElement>("[role='menuitem']")?.focus());
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  const run = (fn: () => void) => { setOpen(false); fn(); };
  if (!canComplete) return <div className="work-planning-actions"><button type="button" className="work-planning-action-reprogram" onClick={onReprogram} title="Reprogramar atividade"><CalendarClock aria-hidden="true" /><span>Reprogramar</span></button></div>;
  return <div className="work-planning-actions">
    <button type="button" className="work-planning-action-complete" onClick={onComplete} title="Concluir atividade"><Check aria-hidden="true" /><span>Concluir</span></button>
    <div className="work-planning-action-menu" ref={menuRef}>
      <button type="button" className="work-planning-action-more" aria-haspopup="menu" aria-expanded={open} aria-label={`Mais a\u00e7\u00f5es de ${activity.title}`} onClick={() => setOpen((current) => !current)}><MoreHorizontal aria-hidden="true" /></button>
      {open && <div role="menu">{canBlock && <button type="button" role="menuitem" onClick={() => run(onBlock)}><TriangleAlert aria-hidden="true" />Bloquear atividade</button>}<button type="button" role="menuitem" onClick={() => run(onReprogram)}><CalendarClock aria-hidden="true" />Reprogramar</button></div>}
    </div>
  </div>;
}

function WorkFinancialStatusBadge({ status }: { status: WorkFinancialEntry["status"] }) {
  const slug = status.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  return <span className={`work-financial-status work-financial-${slug}`}>{status}</span>;
}

function formatWorkDetailDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date).replace(".", "");
}

function summarizeWorkCosts(team: WorkTeamAllocation[], suppliers: WorkSupplier[], financialEntries: WorkFinancialEntry[]): WorkCostSummary {
  const teamCost = team.reduce((sum, allocation) => sum + allocation.quantity * allocation.unitRate, 0);
  const supplierContracted = suppliers.reduce((sum, supplier) => sum + supplier.contractedAmount, 0);
  const supplierPaid = suppliers.reduce((sum, supplier) => sum + supplier.paidAmount, 0);
  const contributionsReceived = financialEntries.filter((entry) => entry.kind === "Aporte").reduce((sum, entry) => sum + entry.amount, 0);
  const cashAdjustments = financialEntries.filter((entry) => entry.kind === "Ajuste").reduce((sum, entry) => sum + entry.amount, 0);
  const cashMovements = contributionsReceived + cashAdjustments;
  return {
    teamCost,
    supplierContracted,
    supplierPaid,
    supplierPending: Math.max(0, supplierContracted - supplierPaid),
    totalCommitted: teamCost + supplierContracted,
    contributionsReceived,
    cashAdjustments,
    cashMovements,
    availableCash: cashMovements - teamCost - supplierPaid,
  };
}

function WorkDetailPage({ work, initialTab, initialTeam, onTeamChange, suppliers, onSuppliersChange, partners, onPartnersChange, contributions, onContributionsChange, financialEntries: initialFinancialEntries, onFinancialEntriesChange, initialJournal, onJournalChange, initialPendingItems, onPendingItemsChange, onBack, onEdit, onUpdateWork, onNotify }: { work: WorkRecord; initialTab: WorkDetailTab; initialTeam: WorkTeamAllocation[]; onTeamChange: (team: WorkTeamAllocation[]) => void; suppliers: WorkSupplier[]; onSuppliersChange: (suppliers: WorkSupplier[]) => void; partners: WorkPartner[]; onPartnersChange: (partners: WorkPartner[]) => void; contributions: WorkContribution[]; onContributionsChange: (contributions: WorkContribution[]) => void; financialEntries: WorkFinancialEntry[]; onFinancialEntriesChange: (entries: WorkFinancialEntry[]) => void; initialJournal: WorkJournalEntry[]; onJournalChange: (entries: WorkJournalEntry[]) => void; initialPendingItems: WorkPendingItem[]; onPendingItemsChange: (items: WorkPendingItem[]) => void; onBack: () => void; onEdit: () => void; onUpdateWork: (work: WorkRecord, message: string) => void; onNotify: (message: string, reference: string) => void }) {
  const [tab, setTab] = useState<WorkDetailTab>(initialTab);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [action, setAction] = useState<WorkDetailAction>(null);
  const [confirmPrompt, setConfirmPrompt] = useState<ConfirmPrompt | null>(null);
  const [activities, setActivities] = useState<WorkActivity[]>(() => createWorkDetailMock(work).activities);
  const [team, setTeam] = useState<WorkTeamAllocation[]>(initialTeam);
  const [financialEntries, setFinancialEntries] = useState<WorkFinancialEntry[]>(initialFinancialEntries);
  const [contributionRequest, setContributionRequest] = useState(0);
  const [journal, setJournal] = useState<WorkJournalEntry[]>(initialJournal);
  const [pendingItems, setPendingItems] = useState<WorkPendingItem[]>(initialPendingItems);
  const tabs: Array<{ name: WorkDetailTab; icon: LucideIcon }> = [
    { name: "Resumo", icon: LayoutDashboard },
    { name: "Planejamento", icon: ClipboardList },
    { name: "Equipe", icon: UsersRound },
    { name: "Fornecedores", icon: Handshake },
    { name: "Sócios", icon: BriefcaseBusiness },
    { name: "Financeiro", icon: WalletCards },
    { name: "Diário e arquivos", icon: FileSignature },
  ];
  const changeTab = (nextTab: WorkDetailTab) => {
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      const tabsElement = document.querySelector<HTMLElement>(".work-detail-tabs");
      if (!tabsElement) return;
      window.scrollTo({ top: Math.max(0, tabsElement.getBoundingClientRect().top + window.scrollY - 76), behavior: "auto" });
    });
  };
  const requestContribution = () => {
    setContributionRequest((current) => current + 1);
    changeTab("Sócios");
  };
  const completedActivities = activities.filter((activity) => activity.status === "Concluída").length;
  const activityProgress = activities.length ? Math.round((completedActivities / activities.length) * 100) : work.progress;
  const blockedActivities = activities.filter((activity) => activity.status === "Bloqueada");
  const { teamCost, supplierContracted, supplierPaid, supplierPending, totalCommitted, contributionsReceived, cashAdjustments, availableCash } = summarizeWorkCosts(team, suppliers, financialEntries);
  const contributionPending = contributions.reduce((sum, contribution) => sum + contributionRemaining(contribution), 0);
  const partnerDistribution = participationTotal(partners);
  const totalPaidCosts = teamCost + supplierPaid;
  const supplierPaidRatio = supplierContracted > 0 ? Math.round((supplierPaid / supplierContracted) * 100) : 0;
  const openSupplierContracts = suppliers.filter((supplier) => supplier.status !== "Quitado");
  const nextSupplierDue = [...openSupplierContracts].sort((a, b) => a.dueDateIso.localeCompare(b.dueDateIso))[0];
  const pendingContributionCount = contributions.filter((contribution) => contributionRemaining(contribution) > 0).length;
  const financeHasOutlook = supplierPending > 0 || contributionPending > 0;
  const nextActivity = activities.find((activity) => activity.status === "Em andamento") ?? activities.find((activity) => activity.status === "Não iniciada" || activity.status === "Bloqueada");
  const displayPendingItems = [
    ...pendingItems.filter((item) => item.id !== "PEN-005"),
    ...(contributionPending > 0 ? [{ id: "PARTNER-APORTE-PENDING", title: "Aporte com saldo pendente", description: `Ainda faltam ${brl.format(contributionPending)} nos aportes solicitados aos sócios.`, tone: "warning" as const }] : []),
    ...blockedActivities.filter((activity) => !pendingItems.some((item) => item.id === `BLOCK-${activity.id}`)).map((activity) => ({ id: `BLOCK-${activity.id}`, title: "Atividade bloqueada", description: `${activity.title}${activity.blockedReason ? ` · ${activity.blockedReason}` : ""}`, tone: "danger" as const })),
  ];

  useEffect(() => {
    const activeButton = document.querySelector<HTMLElement>(".work-detail-tabs button.active");
    activeButton?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab]);

  useEffect(() => {
    const strip = document.querySelector<HTMLElement>(".work-detail-tabs");
    if (!strip) return;
    const updateScrollHints = () => {
      strip.classList.toggle("can-scroll-left", strip.scrollLeft > 4);
      strip.classList.toggle("can-scroll-right", Math.ceil(strip.scrollLeft + strip.clientWidth) < strip.scrollWidth - 4);
    };
    updateScrollHints();
    strip.addEventListener("scroll", updateScrollHints, { passive: true });
    window.addEventListener("resize", updateScrollHints);
    return () => {
      strip.removeEventListener("scroll", updateScrollHints);
      window.removeEventListener("resize", updateScrollHints);
    };
  }, []);

  useEffect(() => {
    if (!actionsOpen) return;
    const menu = actionsMenuRef.current;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (menu && !menu.contains(event.target as Node)) setActionsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActionsOpen(false);
      menu?.querySelector<HTMLElement>(":scope > button")?.focus();
    };
    window.requestAnimationFrame(() => menu?.querySelector<HTMLElement>("[role='menuitem']")?.focus());
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionsOpen]);

  const journalFileCount = journal.reduce((total, entry) => total + entry.files.length, 0);
  const appendJournal = (entry: Omit<WorkJournalEntry, "id" | "dateIso">) => {
    const nextEntry = { ...entry, id: nextRecordId("DIA", journal), dateIso: `${WORKS_DEMO_DATE_ISO}T12:00:00` };
    const nextJournal = [nextEntry, ...journal];
    setJournal(nextJournal);
    onJournalChange(nextJournal);
  };
  const applyWorkStatus = (status: WorkStatus) => {
    const progress = status === "Concluída" ? 100 : work.progress;
    const risk = status === "Concluída" ? "Concluída" : work.risk === "Concluída" ? "Dentro do prazo" : work.risk;
    onUpdateWork({ ...work, status, progress, risk, updatedAtIso: `${WORKS_DEMO_DATE_ISO}T12:00:00`, lastUpdateLabel: "Atualizada agora nesta sessão" }, `Situação alterada para ${status}.`);
    appendJournal({ kind: "Atualização", title: `Situação alterada para ${status}`, description: "Alteração manual registrada no detalhe da obra.", author: "Administrativo", progress, files: [] });
    setActionsOpen(false);
  };
  const updateWorkStatus = (status: WorkStatus) => {
    setActionsOpen(false);
    if (status === "Concluída" || status === "Cancelada") {
      setConfirmPrompt({
        title: status === "Concluída" ? "Concluir esta obra?" : "Cancelar esta obra?",
        message: status === "Concluída"
          ? "O progresso será fixado em 100% e a obra sai da lista de execução ativa. O histórico é preservado."
          : "A obra deixa de aparecer entre as obras em andamento. O histórico é preservado.",
        confirmLabel: status === "Concluída" ? "Concluir obra" : "Cancelar obra",
        cancelLabel: "Voltar",
        tone: "danger",
        onConfirm: () => applyWorkStatus(status),
      });
      return;
    }
    applyWorkStatus(status);
  };
  const completeActivity = (activity: WorkActivity) => {
    const nextActivities = activities.map((item) => item.id === activity.id ? { ...item, status: "Concluída" as const, blockedReason: undefined } : item);
    setActivities(nextActivities);
    const nextProgress = Math.round((nextActivities.filter((item) => item.status === "Concluída").length / Math.max(nextActivities.length, 1)) * 100);
    onUpdateWork({ ...work, progress: nextProgress, nextActivity: nextActivities.find((item) => item.status !== "Concluída")?.title ?? "Entrega concluída", lastUpdateLabel: "Atualizada agora nesta sessão" }, "Atividade concluída e progresso recalculado.");
    appendJournal({ kind: "Atualização", title: "Atividade concluída", description: activity.title, author: "Administrativo", progress: nextProgress, files: [] });
  };
  const removeTeamMember = (allocation: WorkTeamAllocation) => {
    setConfirmPrompt({
      title: "Remover da equipe?",
      message: `${allocation.name} deixa de ser contabilizada no custo de equipe desta obra. O histórico da obra é preservado.`,
      confirmLabel: "Remover pessoa",
      cancelLabel: "Voltar",
      tone: "danger",
      onConfirm: () => {
        const nextTeam = team.filter((item) => item.id !== allocation.id);
        setTeam(nextTeam);
        onTeamChange(nextTeam);
        onNotify("Pessoa removida da equipe nesta sessão.", allocation.id);
      },
    });
  };
  const registerPartnerPayment = (payment: PartnerPaymentEvent) => {
    const entry: WorkFinancialEntry = {
      id: nextRecordId("FIN", financialEntries),
      kind: "Aporte",
      description: `${payment.contributionDescription} · pagamento recebido`,
      party: payment.partnerName,
      amount: payment.amount,
      dateIso: payment.dateIso,
      status: "Registrado",
      sourceId: payment.contributionId,
    };
    const nextEntries = [entry, ...financialEntries];
    setFinancialEntries(nextEntries);
    onFinancialEntriesChange(nextEntries);
    appendJournal({ kind: "Atualização", title: "Aporte de sócio recebido", description: `${payment.partnerName} · ${brl.format(payment.amount)} · ${payment.contributionId}`, author: "Administrativo", files: [] });
    onNotify("Pagamento de sócio recebido no caixa da obra.", payment.paymentId);
  };
  const handleActionSubmit = (submittedAction: NonNullable<WorkDetailAction>, formData: FormData) => {
    const value = (name: string) => String(formData.get(name) ?? "").trim();
    const amount = (name: string) => Number(formData.get(name) ?? 0);
    if (submittedAction.type === "update") {
      const progress = Math.min(100, Math.max(0, amount("progress")));
      const kind = value("kind") as WorkJournalEntry["kind"];
      const files = formData.getAll("fileNames").map(String).filter(Boolean);
      const entry = { kind, title: value("title"), description: value("description"), author: "Administrativo", progress, files };
      appendJournal(entry);
      if (kind === "Pendência") {
        const nextPendingItems = [{ id: nextRecordId("PEN", pendingItems), title: entry.title, description: entry.description, tone: "warning" as const }, ...pendingItems];
        setPendingItems(nextPendingItems);
        onPendingItemsChange(nextPendingItems);
      }
      onUpdateWork({ ...work, progress, nextActivity: value("nextActivity") || work.nextActivity, updatedAtIso: `${WORKS_DEMO_DATE_ISO}T12:00:00`, lastUpdateLabel: "Atualizada agora nesta sessão" }, "Atualização registrada no diário.");
    }
    if (submittedAction.type === "activity") {
      const newActivity: WorkActivity = { id: nextRecordId("ATV", activities), stage: value("stage") as WorkActivity["stage"], title: value("title"), manager: value("manager"), startDateIso: value("startDateIso"), endDateIso: value("endDateIso"), status: "Não iniciada" };
      setActivities((current) => [...current, newActivity]);
      onNotify("Atividade adicionada ao planejamento.", newActivity.id);
    }
    if (submittedAction.type === "team") {
      const allocation: WorkTeamAllocation = { id: nextRecordId("EQP", team), name: value("name"), role: value("role"), startDateIso: value("startDateIso"), endDateIso: value("endDateIso"), workMode: value("workMode") as WorkTeamAllocation["workMode"], quantity: amount("quantity"), unitRate: amount("unitRate"), activityIds: [] };
      const nextTeam = [...team, allocation];
      setTeam(nextTeam);
      onTeamChange(nextTeam);
      onNotify("Pessoa adicionada à equipe da obra.", allocation.id);
    }
    if (submittedAction.type === "cash") {
      const entry: WorkFinancialEntry = { id: nextRecordId("FIN", financialEntries), kind: "Ajuste", description: value("description"), party: "Caixa administrativo", amount: amount("amount"), dateIso: value("dateIso"), status: "Registrado" };
      const nextEntries = [entry, ...financialEntries];
      setFinancialEntries(nextEntries);
      onFinancialEntriesChange(nextEntries);
      appendJournal({ kind: "Atualização", title: `${entry.kind} de caixa registrado`, description: `${entry.description} · ${brl.format(entry.amount)}`, author: "Administrativo", files: [] });
      onNotify("Movimento manual registrado no caixa da obra.", entry.id);
    }
    if (submittedAction.type === "block") {
      setActivities((current) => current.map((item) => item.id === submittedAction.activity.id ? { ...item, status: "Bloqueada", blockedReason: value("reason") } : item));
      appendJournal({ kind: "Pendência", title: "Atividade bloqueada", description: `${submittedAction.activity.title} · ${value("reason")}`, author: "Administrativo", files: [] });
      onNotify("Bloqueio registrado no planejamento.", submittedAction.activity.id);
    }
    if (submittedAction.type === "reprogram") {
      setActivities((current) => current.map((item) => item.id === submittedAction.activity.id ? { ...item, endDateIso: value("endDateIso") } : item));
      appendJournal({ kind: "Atualização", title: "Atividade reprogramada", description: `${submittedAction.activity.title} · novo prazo ${formatExpenseDate(value("endDateIso"))}. Motivo: ${value("reason")}`, author: "Administrativo", files: [] });
      onNotify("Nova data registrada no planejamento.", submittedAction.activity.id);
    }
    setAction(null);
  };

  return <>
    <div className="work-detail-page">
      <section className="work-detail-hero" aria-labelledby="work-detail-title">
        <div className="work-detail-hero-cover">
          <img src={propertyCoverImagesByName[work.property] ?? fallbackPropertyCover} alt={`Fachada de ${work.property}`} width="720" height="640" />
          <span className="work-detail-hero-cover-shade" aria-hidden="true" />
          <span className="work-detail-hero-cover-copy"><small>Local da intervenção</small><strong>{work.property}</strong><em>{work.unit ?? "Toda a área do imóvel"}</em></span>
        </div>
        <button type="button" className="work-detail-back" onClick={onBack}><ArrowRight aria-hidden="true" />Todas as obras</button>
        <div className="work-detail-title"><p className="eyebrow">{work.id} · {work.interventionType ?? "Obra"}</p><div><h1 id="work-detail-title">{work.title}</h1><WorkStatusBadge status={work.status} /></div><p><ClipboardList aria-hidden="true" />Próximo marco: <strong>{work.nextActivity}</strong></p></div>
        <div className="work-detail-actions"><button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: "update" })}><Plus aria-hidden="true" /><span className="work-update-label">Registrar atualização</span></button><div className="work-detail-actions-menu" ref={actionsMenuRef}><button type="button" className="secondary-button" aria-label="Mais ações da obra" aria-expanded={actionsOpen} onClick={() => setActionsOpen((current) => !current)}><MoreHorizontal aria-hidden="true" /><span>Mais ações</span></button>{actionsOpen && <div role="menu"><span role="presentation">Cadastro</span><button type="button" role="menuitem" onClick={() => { setActionsOpen(false); onEdit(); }}><PencilLine aria-hidden="true" />Editar cadastro</button>{work.status !== "Concluída" && work.status !== "Cancelada" && <span role="presentation">Situação da obra</span>}{work.status === "Planejada" ? <button type="button" role="menuitem" onClick={() => updateWorkStatus("Em andamento")}><Play aria-hidden="true" />Iniciar obra</button> : work.status === "Pausada" ? <button type="button" role="menuitem" onClick={() => updateWorkStatus("Em andamento")}><Play aria-hidden="true" />Retomar obra</button> : work.status === "Em andamento" ? <button type="button" role="menuitem" onClick={() => updateWorkStatus("Pausada")}><Pause aria-hidden="true" />Pausar obra</button> : null}{work.status !== "Concluída" && work.status !== "Cancelada" && <button type="button" role="menuitem" onClick={() => updateWorkStatus("Concluída")}><CircleCheck aria-hidden="true" />Concluir obra</button>}{work.status !== "Cancelada" && work.status !== "Concluída" && <button type="button" role="menuitem" className="danger" onClick={() => updateWorkStatus("Cancelada")}><Ban aria-hidden="true" />Cancelar obra</button>}</div>}</div></div>
        <dl className="work-detail-hero-metrics">
          <div><dt>Progresso</dt><dd>{work.progress}%</dd><i><b style={{ width: `${work.progress}%` }} /></i></div>
          <div><dt>Prazo final</dt><dd>{work.endLabel}</dd><small className={`work-risk work-risk-${work.risk === "Em atraso" ? "danger" : work.risk === "Atenção" ? "warning" : "ok"}`}>{work.risk}</small></div>
          <div><dt>Responsável</dt><dd>{work.manager}</dd><small>{team.length} pessoas alocadas</small></div>
          <div><dt>Custo consolidado</dt><dd>{brl.format(totalCommitted)}</dd><small>Equipe + fornecedores</small></div>
        </dl>
      </section>

      <nav className="work-detail-tabs" aria-label="Áreas da obra"><div>{tabs.map(({ name, icon: Icon }) => <button type="button" key={name} className={tab === name ? "active" : ""} aria-current={tab === name ? "page" : undefined} onClick={() => changeTab(name)}><Icon aria-hidden="true" /><span>{name}</span>{name === "Planejamento" && blockedActivities.length > 0 ? <b>{blockedActivities.length}</b> : name === "Resumo" && displayPendingItems.length > 0 ? <b>{displayPendingItems.length}</b> : name === "Sócios" && (partnerDistribution !== 100 || contributionPending > 0) ? <b>{partnerDistribution !== 100 ? "!" : contributions.filter((contribution) => contributionRemaining(contribution) > 0).length}</b> : null}</button>)}</div></nav>

      {tab === "Resumo" && <div className="work-detail-summary">
        <div className="work-detail-summary-col">
          <section className="work-detail-decision-card" aria-labelledby="work-next-decision-title"><header><div><p className="eyebrow">Próxima atividade</p><h2 id="work-next-decision-title">{nextActivity?.title ?? "Planejamento concluído"}</h2></div><CalendarClock aria-hidden="true" /></header><div className="work-detail-decision-progress"><span className="work-detail-progress-ring" style={{ "--work-progress": `${work.progress * 3.6}deg` } as CSSProperties}><strong>{work.progress}%</strong><small>concluído</small></span><div><span>Prazo da atividade</span><strong>{nextActivity ? `${formatExpenseDate(nextActivity.startDateIso)} — ${formatExpenseDate(nextActivity.endDateIso)}` : "Sem próxima atividade"}</strong><small>{nextActivity?.manager ?? work.manager}</small>{nextActivity && <WorkDetailStatusBadge status={nextActivity.status} />}</div></div><footer><button type="button" onClick={() => changeTab("Planejamento")}><ClipboardList aria-hidden="true" />Abrir planejamento</button><button type="button" onClick={() => changeTab("Fornecedores")}><Handshake aria-hidden="true" />Ver fornecedores</button><button type="button" onClick={requestContribution}><WalletCards aria-hidden="true" />Solicitar aporte</button></footer></section>
          <section className="work-detail-pending-card" aria-labelledby="work-pending-title"><header><div><p className="eyebrow">Atenção</p><h2 id="work-pending-title">Pendências e decisões</h2></div><b>{displayPendingItems.length}</b></header>{displayPendingItems.length ? <div>{displayPendingItems.map((item) => <article key={item.id} className={`work-detail-pending-${item.tone}`}><TriangleAlert aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.description}</small></span>{pendingItems.some((pending) => pending.id === item.id) && <button type="button" onClick={() => setPendingItems((current) => current.filter((pending) => pending.id !== item.id))} aria-label={`Resolver ${item.title}`}><Check aria-hidden="true" /><span>Resolver</span></button>}</article>)}</div> : <CompactEmptyState mark="✓" tone="success" title="Nenhuma pendência aberta" description="A obra não possui bloqueios ou decisões aguardando ação." />}</section>
        </div>
        <div className="work-detail-summary-col">
          <section className="work-detail-finance-card" aria-labelledby="work-summary-finance-title"><header><div><p className="eyebrow">Financeiro</p><h2 id="work-summary-finance-title">Posição da obra</h2></div><WalletCards aria-hidden="true" /></header><dl><div><dt>Custo com equipe</dt><dd>{brl.format(teamCost)}</dd></div><div><dt>Custo com fornecedores</dt><dd>{brl.format(supplierContracted)}</dd></div><div><dt>Custos pagos</dt><dd>{brl.format(totalPaidCosts)}</dd></div><div><dt>Caixa disponível</dt><dd className={availableCash < 0 ? "negative" : ""}>{brl.format(availableCash)}</dd></div></dl><div className="work-detail-finance-usage"><span><small>Fornecedores pagos</small><strong>{supplierPaidRatio}%</strong></span><i role="progressbar" aria-valuenow={supplierPaidRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${supplierPaidRatio}% dos valores de fornecedores foram pagos`}><b style={{ width: `${supplierPaidRatio}%` }} /></i></div><button type="button" onClick={() => changeTab("Financeiro")}>Ver financeiro completo<ArrowRight aria-hidden="true" /></button></section>
          <section className="work-detail-team-card" aria-labelledby="work-summary-team-title"><header><div><p className="eyebrow">Responsáveis</p><h2 id="work-summary-team-title">Equipe principal</h2></div><button type="button" onClick={() => changeTab("Equipe")}>Ver equipe</button></header><div>{team.slice(0, 4).map((member) => <article key={member.id}><span>{member.name.split(" ").slice(0, 2).map((name) => name[0]).join("")}</span><div><strong>{member.name}</strong><small>{member.role}</small></div><em>{member.activityIds.length} atividades</em></article>)}</div><footer><span>Custo estimado da mão de obra</span><strong>{brl.format(teamCost)}</strong></footer></section>
        </div>
        <section className="work-detail-timeline-card" aria-labelledby="work-summary-history-title"><header><div><p className="eyebrow">Últimos registros</p><h2 id="work-summary-history-title">Atualizações recentes</h2></div><button type="button" onClick={() => changeTab("Diário e arquivos")}>Ver diário</button></header><div>{journal.slice(0, 4).map((entry) => <article key={entry.id}><i aria-hidden="true" className={`journal-${entry.kind.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`} /><div><strong>{entry.title}</strong><p>{entry.description}</p><small>{formatWorkDetailDateTime(entry.dateIso)} · {entry.author}{entry.files.length ? ` · ${entry.files.length} arquivo(s)` : ""}</small></div>{entry.progress !== undefined && <b>{entry.progress}%</b>}</article>)}</div></section>
      </div>}

      {tab === "Planejamento" && <section className="work-detail-tab-panel work-planning-panel" aria-labelledby="work-planning-title"><header><div><p className="eyebrow">Cronograma desta obra</p><h2 id="work-planning-title">Planejamento</h2><span>O progresso calculado pelas atividades está em <strong>{activityProgress}%</strong>.</span></div><button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: "activity" })}><Plus aria-hidden="true" />Nova atividade</button></header><div className="work-planning-stages">{(["Preparação", "Execução", "Entrega"] as WorkActivity["stage"][]).map((stage, stageIndex) => { const stageActivities = activities.filter((activity) => activity.stage === stage); return <section key={stage}><header><span>0{stageIndex + 1}</span><div><strong>{stage}</strong><small>{stageActivities.filter((activity) => activity.status === "Concluída").length} de {stageActivities.length} concluídas</small></div></header><div>{stageActivities.map((activity) => <article key={activity.id} className={activity.status === "Bloqueada" ? "blocked" : ""}><span className="work-planning-check">{activity.status === "Concluída" ? <Check aria-hidden="true" /> : stageIndex + 1}</span><div className="work-planning-identity"><small>{activity.id} · {activity.manager}<span className="work-planning-inline-period"> · {formatExpenseDate(activity.startDateIso)} — {formatExpenseDate(activity.endDateIso)}</span></small><strong>{activity.title}</strong>{activity.blockedReason && <em><TriangleAlert aria-hidden="true" />{activity.blockedReason}</em>}</div><div className="work-planning-dates"><small>Período</small><strong>{formatExpenseDate(activity.startDateIso)} — {formatExpenseDate(activity.endDateIso)}</strong></div><WorkDetailStatusBadge status={activity.status} /><WorkActivityActions activity={activity} onComplete={() => completeActivity(activity)} onBlock={() => setAction({ type: "block", activity })} onReprogram={() => setAction({ type: "reprogram", activity })} /></article>)}</div></section>; })}</div></section>}

      {tab === "Equipe" && <section className="work-detail-tab-panel work-team-panel" aria-labelledby="work-team-title"><header><div><p className="eyebrow">Alocação nesta obra</p><h2 id="work-team-title">Equipe</h2><span>{team.length} pessoas · custo estimado de <strong>{brl.format(teamCost)}</strong></span></div><button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: "team" })}><Plus aria-hidden="true" />Adicionar pessoa</button></header><div className="work-team-list">{team.map((member) => {
        const hasMultipleRoles = team.filter((entry) => entry.name === member.name).length > 1;
        return <article key={member.id} className={hasMultipleRoles ? "work-team-multi-role" : undefined}><span className="work-team-avatar">{member.name.split(" ").slice(0, 2).map((name) => name[0]).join("")}</span><div className="work-team-identity"><small>{member.id}</small><strong>{member.name}</strong><em className={hasMultipleRoles ? "work-team-role-strong" : undefined}>{member.role}</em></div><div><small>Participação</small><strong>{formatExpenseDate(member.startDateIso)} — {formatExpenseDate(member.endDateIso)}</strong></div><div><small>Apontamento</small><strong>{member.quantity} {member.workMode.toLocaleLowerCase("pt-BR")}</strong><em>{brl.format(member.unitRate)} por unidade</em></div><div><small>Custo estimado</small><strong>{brl.format(member.quantity * member.unitRate)}</strong><em>{member.activityIds.length} atividades relacionadas</em></div><button type="button" className="work-team-remove" onClick={() => removeTeamMember(member)} aria-label={`Remover ${member.name}`} title={`Remover ${member.name}`}><Trash2 aria-hidden="true" /></button></article>;
      })}</div></section>}

      {tab === "Fornecedores" && <WorkSuppliersPanel suppliers={suppliers} onChange={onSuppliersChange} onNotify={onNotify} onEvent={(event) => appendJournal({ kind: "Atualização", title: event.title, description: event.description, author: "Administrativo", files: event.files })} />}

      {tab === "Sócios" && <WorkPartnersPanel partners={partners} contributions={contributions} openContributionRequest={contributionRequest} onContributionRequestConsumed={() => setContributionRequest(0)} onPartnersChange={onPartnersChange} onContributionsChange={onContributionsChange} onPayment={registerPartnerPayment} onNotify={onNotify} onEvent={(event) => appendJournal({ kind: "Atualização", title: event.title, description: event.description, author: "Administrativo", files: [] })} />}

      {tab === "Financeiro" && <section className="work-detail-tab-panel work-finance-panel" aria-labelledby="work-finance-title"><header><div><p className="eyebrow">Custos e caixa da obra</p><h2 id="work-finance-title">Financeiro da obra</h2><span>Custos consolidados entre equipe e fornecedores, com aportes dos sócios e ajustes manuais de caixa.</span></div><div><button type="button" className="secondary-button" onClick={() => setAction({ type: "cash" })}>Realizar ajuste de caixa</button><button type="button" className="primary-button button-with-icon" onClick={requestContribution}><Plus aria-hidden="true" />Solicitar aporte</button></div></header><div className="work-finance-metrics"><article><span>Custo com equipe</span><strong>{brl.format(teamCost)}</strong><small>{team.length} pessoas alocadas</small></article><article><span>Custo com fornecedores</span><strong>{brl.format(supplierContracted)}</strong><small>{brl.format(supplierPaid)} pagos · {brl.format(supplierPending)} pendentes</small></article><article><span>Aportes recebidos</span><strong>{brl.format(contributionsReceived)}</strong><small>{brl.format(contributionPending)} aguardando os sócios</small></article><article className={availableCash < 0 ? "work-finance-cash-negative" : ""}><span>Caixa disponível</span><strong className={availableCash < 0 ? "negative" : ""}>{brl.format(availableCash)}</strong><small>{brl.format(cashAdjustments)} em ajustes de caixa</small></article></div>{availableCash < 0 && <div className="work-finance-cash-alert" role="alert"><span className="work-finance-cash-alert-mark" aria-hidden="true"><TriangleAlert /></span><div><strong>Caixa negativo</strong><p>Os custos pagos superam as entradas em {brl.format(Math.abs(availableCash))}. Registre uma entrada para reequilibrar o caixa desta obra.</p></div><div className="work-finance-cash-alert-actions"><button type="button" className="primary-button button-with-icon" onClick={requestContribution}><Plus aria-hidden="true" />Solicitar aporte</button><button type="button" className="secondary-button" onClick={() => setAction({ type: "cash" })}>Registrar ajuste de caixa</button></div></div>}{financeHasOutlook && <div className="work-finance-outlook"><div className="work-finance-outlook-head"><p className="eyebrow">Projeção de caixa</p><h3>Compromissos previstos</h3></div><div className="work-finance-outlook-grid">{supplierPending > 0 && <article><small>A pagar a fornecedores</small><strong className="negative">{brl.format(supplierPending)}</strong><em>{openSupplierContracts.length} {openSupplierContracts.length === 1 ? "contrato em aberto" : "contratos em aberto"}</em></article>}{contributionPending > 0 && <article><small>Aportes a receber</small><strong className="positive">{brl.format(contributionPending)}</strong><em>{pendingContributionCount} {pendingContributionCount === 1 ? "sócio pendente" : "sócios pendentes"}</em></article>}{nextSupplierDue && <article><small>Próximo vencimento de fornecedor</small><strong>{formatExpenseDate(nextSupplierDue.dueDateIso)}</strong><em>{nextSupplierDue.name}</em></article>}</div></div>}<div className="work-finance-section-heading"><div><p className="eyebrow">Entradas e correções</p><h3>Movimentações de caixa</h3></div><span>{financialEntries.length} registro(s)</span></div>{financialEntries.length ? <div className="work-finance-list">{financialEntries.map((entry) => <article key={entry.id}><span className={`work-finance-kind work-finance-kind-${entry.kind.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}><WalletCards aria-hidden="true" /></span><div><small>{entry.id} · {formatExpenseDate(entry.dateIso)}{entry.sourceId ? ` · ${entry.sourceId}` : ""}</small><strong>{entry.description}</strong><em>{entry.party}</em></div><b className={entry.amount < 0 ? "negative" : ""}>{brl.format(entry.amount)}</b><WorkFinancialStatusBadge status={entry.status} /><span className="work-finance-row-action" /></article>)}</div> : <div className="work-finance-empty"><WalletCards aria-hidden="true" /><strong>Nenhuma movimentação de caixa</strong><p>Solicite um aporte aos sócios ou registre um ajuste quando houver correção manual do saldo.</p></div>}<aside className="work-finance-manual-note"><WifiOff aria-hidden="true" /><span><strong>Caixa por recebimento</strong>O aporte entra no caixa somente quando o pagamento do sócio é registrado. Ajustes e pagamentos de fornecedores permanecem manuais nesta demonstração.</span></aside></section>}

      {tab === "Diário e arquivos" && <section className="work-detail-tab-panel work-journal-panel" aria-labelledby="work-journal-title"><header><div><p className="eyebrow">Histórico da execução</p><h2 id="work-journal-title">Diário e arquivos</h2><span>Registros anteriores são preservados e exibidos em ordem cronológica.</span></div><button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: "update" })}><Plus aria-hidden="true" />Nova atualização</button></header><div className="work-journal-layout"><div className="work-journal-timeline">{journal.map((entry) => <article key={entry.id}><time dateTime={entry.dateIso}><strong>{formatWorkDetailDateTime(entry.dateIso).split(" ").slice(0, 2).join(" ")}</strong><small>{formatWorkDetailDateTime(entry.dateIso).split(" ").slice(-1)}</small></time><i aria-hidden="true" className={`journal-${entry.kind.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`} /><div><header><span>{entry.kind}</span>{entry.progress !== undefined && <b>{entry.progress}%</b>}</header><h3>{entry.title}</h3><p>{entry.description}</p><small>{entry.author}</small>{entry.files.length > 0 && <ul>{entry.files.map((file) => <li key={file}><Paperclip aria-hidden="true" />{file}</li>)}</ul>}</div></article>)}</div><aside className="work-journal-files"><header><Paperclip aria-hidden="true" /><div><strong>Arquivos da obra{journalFileCount > 0 && <b aria-hidden="true">{journalFileCount}</b>}</strong><small>{journalFileCount === 1 ? "1 referência no diário" : `${journalFileCount} referências no diário`}</small></div></header>{journal.flatMap((entry) => entry.files.map((file) => ({ file, entry }))).map(({ file, entry }) => <article key={`${entry.id}-${file}`}><FileSignature aria-hidden="true" /><span><strong>{file}</strong><small>{entry.title}</small></span></article>)}</aside></div></section>}
    </div>
    {action && <WorkDetailActionModal action={action} work={work} onClose={() => setAction(null)} onSubmit={handleActionSubmit} />}
    {confirmPrompt && <ConfirmDialog title={confirmPrompt.title} message={confirmPrompt.message} confirmLabel={confirmPrompt.confirmLabel} cancelLabel={confirmPrompt.cancelLabel ?? "Cancelar"} tone={confirmPrompt.tone ?? "default"} onConfirm={() => { confirmPrompt.onConfirm(); setConfirmPrompt(null); }} onCancel={() => setConfirmPrompt(null)} />}
  </>;
}

function WorkDetailActionModal({ action, work, onClose, onSubmit }: { action: NonNullable<WorkDetailAction>; work: WorkRecord; onClose: () => void; onSubmit: (action: NonNullable<WorkDetailAction>, data: FormData) => void }) {
  const modalRef = useRef<HTMLFormElement>(null);
  const targetActivity = "activity" in action ? action.activity : null;
  const presentation: Record<NonNullable<WorkDetailAction>["type"], { eyebrow: string; title: string; submit: string }> = {
    update: { eyebrow: "Diário da obra", title: "Registrar atualização", submit: "Salvar atualização" },
    activity: { eyebrow: "Planejamento", title: "Adicionar atividade", submit: "Adicionar atividade" },
    team: { eyebrow: "Equipe", title: "Adicionar pessoa", submit: "Adicionar à equipe" },
    cash: { eyebrow: "Caixa da obra", title: "Realizar ajuste de caixa", submit: "Registrar ajuste" },
    block: { eyebrow: targetActivity?.id ?? work.id, title: "Bloquear atividade", submit: "Registrar bloqueio" },
    reprogram: { eyebrow: targetActivity?.id ?? work.id, title: "Reprogramar atividade", submit: "Salvar nova data" },
  };
  const copy = presentation[action.type];
  const { onFormChange, requestClose, discardDialog } = useDiscardGuard(onClose, "Os dados preenchidos neste formulário não serão salvos.");
  const defaultActivityStartDate = WORKS_DEMO_DATE_ISO;
  const defaultActivityEndDate = work.endDateIso >= defaultActivityStartDate ? work.endDateIso : defaultActivityStartDate;
  const [activityStartDate, setActivityStartDate] = useState(defaultActivityStartDate);
  const [activityEndDate, setActivityEndDate] = useState(defaultActivityEndDate);
  const defaultTeamStartDate = WORKS_DEMO_DATE_ISO;
  const defaultTeamEndDate = work.endDateIso >= defaultTeamStartDate ? work.endDateIso : defaultTeamStartDate;
  const [teamStartDate, setTeamStartDate] = useState(defaultTeamStartDate);
  const [teamEndDate, setTeamEndDate] = useState(defaultTeamEndDate);
  const [reprogramEndDate, setReprogramEndDate] = useState(() => action.type === "reprogram" ? action.activity.endDateIso : WORKS_DEMO_DATE_ISO);
  const [updateFiles, setUpdateFiles] = useState<string[]>([]);

  useEffect(() => {
    const panel = modalRef.current;
    if (!panel) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstField = panel.querySelector<HTMLElement>("input:not([type='hidden']), select, textarea");
    (firstField ?? panel).focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS))
        .filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown, true);
      window.requestAnimationFrame(() => opener?.isConnected && opener.focus());
    };
  }, [requestClose]);
  return <ModalPortal><div className="modal-layer" role="dialog" aria-modal="true" aria-label={copy.title}><button type="button" className="drawer-backdrop" onClick={requestClose} aria-label="Fechar formulário" /><form ref={modalRef} tabIndex={-1} className="receipt-modal work-detail-modal" onChange={onFormChange} onSubmit={(event) => { event.preventDefault(); onSubmit(action, new FormData(event.currentTarget)); }}><ModalHeader eyebrow={copy.eyebrow} title={copy.title} onClose={requestClose} /><div className="work-detail-modal-body">
    {action.type === "update" && <div className="form-grid"><label>Tipo de registro<select name="kind" defaultValue="Atualização"><option>Atualização</option><option>Ocorrência</option><option>Pendência</option><option>Arquivo</option></select></label><label>Progresso atual (%)<input name="progress" type="number" min="0" max="100" defaultValue={work.progress} required /></label><label className="full-field">Título<input name="title" placeholder="Ex.: Setor B concluído" required /></label><label className="full-field">Descrição<textarea name="description" rows={4} placeholder="O que aconteceu e qual é o próximo passo?" required /></label><label className="full-field">Próxima atividade<input name="nextActivity" defaultValue={work.nextActivity} required /></label><FileField className="full-field" name="fileNames" multiple label="Fotos ou arquivos" hint="Somente os nomes dos arquivos são mantidos nesta demonstração." accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" value={updateFiles} onChange={setUpdateFiles} /></div>}
    {action.type === "activity" && <div className="form-grid"><label>Etapa<select name="stage" defaultValue="Execução"><option>Preparação</option><option>Execução</option><option>Entrega</option></select></label><label>Responsável<select name="manager" defaultValue={work.manager}>{WORK_TEAM_OPTIONS.map((member) => <option key={member.name}>{member.name}</option>)}</select></label><label className="full-field">Atividade<input name="title" placeholder="Ex.: Teste e conferência final" required /></label><label>Início<input name="startDateIso" type="date" value={activityStartDate} onChange={(event) => setActivityStartDate(event.target.value)} required /></label><label>Conclusão<input name="endDateIso" type="date" value={activityEndDate} min={activityStartDate || undefined} onChange={(event) => setActivityEndDate(event.target.value)} required /></label></div>}
    {action.type === "team" && <div className="form-grid"><label>Pessoa<select name="name" defaultValue="Lucas Rocha">{WORK_TEAM_OPTIONS.map((member) => <option key={member.name}>{member.name}</option>)}</select></label><label>Função<input name="role" placeholder="Ex.: Técnico de manutenção" required /></label><label>Início<input name="startDateIso" type="date" value={teamStartDate} onChange={(event) => { const nextStart = event.target.value; setTeamStartDate(nextStart); if (teamEndDate && nextStart > teamEndDate) setTeamEndDate(nextStart); }} required /></label><label>Fim<input name="endDateIso" type="date" value={teamEndDate} min={teamStartDate || undefined} onChange={(event) => setTeamEndDate(event.target.value)} required /></label><label>Forma de apontamento<select name="workMode"><option>Horas</option><option>Diárias</option></select></label><label>Quantidade<input name="quantity" type="number" min="0.5" step="0.5" required /></label><label>Valor por unidade<input name="unitRate" type="number" min="0" step="0.01" required /></label></div>}
    {action.type === "cash" && <div className="form-grid"><p className="work-detail-modal-context full-field"><strong>Ajuste manual</strong>Use um valor positivo ou negativo para corrigir o saldo após uma conferência. Aportes são registrados pelos pagamentos dos sócios.</p><label>Data<input name="dateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} required /></label><label className="full-field">Descrição<input name="description" placeholder="Ex.: Correção do saldo após conferência" required /></label><label>Valor do ajuste<input name="amount" type="number" step="0.01" required /></label></div>}
    {action.type === "block" && <div className="form-grid"><p className="work-detail-modal-context full-field"><strong>{action.activity.title}</strong>O motivo ficará visível no planejamento e no diário.</p><label className="full-field">Motivo do bloqueio<textarea name="reason" rows={4} placeholder="Explique o que impede a continuidade." required /></label></div>}
    {action.type === "reprogram" && <div className="form-grid"><p className="work-detail-modal-context full-field"><strong>{action.activity.title}</strong>Prazo atual: {formatExpenseDate(action.activity.endDateIso)}</p><label>Nova conclusão<input name="endDateIso" type="date" value={reprogramEndDate} min={action.activity.startDateIso} onChange={(event) => setReprogramEndDate(event.target.value)} required /></label><label className="full-field">Justificativa<textarea name="reason" rows={3} placeholder="Por que a data está sendo alterada?" required /></label></div>}
  </div><footer><button type="button" className="secondary-button" onClick={requestClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />{copy.submit}</button></footer></form>
    {discardDialog}
  </div></ModalPortal>;
}

function WorkFormPage({ work, works, properties, units, onCancel, onSave }: { work: WorkRecord | null; works: WorkRecord[]; properties: Property[]; units: Unit[]; onCancel: () => void; onSave: (work: WorkRecord) => void }) {
  const [step, setStep] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [errors, setErrors] = useState<WorkFormErrors>({});
  const [draft, setDraft] = useState<WorkFormDraft>(() => ({
    interventionType: work?.interventionType ?? "Obra",
    title: work?.title ?? "",
    property: work?.property ?? "",
    unit: work?.unit ?? "",
    description: work?.description ?? "",
    priority: work?.priority ?? "Média",
    manager: work?.manager ?? "",
    team: work?.team ?? [],
    startDateIso: work?.startDateIso ?? WORKS_DEMO_DATE_ISO,
    endDateIso: work?.endDateIso ?? "",
    status: work?.status ?? "Planejada",
    budget: work ? String(work.budget) : "",
    reserve: work?.reserve ? String(work.reserve) : "",
    notes: work?.notes ?? "",
    attachments: work?.attachments ?? [],
  }));
  const availableUnits = units.filter((unit) => unit.property === draft.property);
  const selectedProperty = properties.find((property) => property.name === draft.property);
  const isEditing = Boolean(work);
  const steps = [
    { number: 1, title: "Dados da obra", description: "O que será feito" },
    { number: 2, title: "Responsáveis e prazos", description: "Quem e quando" },
    { number: 3, title: "Valores e revisão", description: "Quanto e confirmação" },
  ];

  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".work-form-card .invalid")?.focus());
  }, [errors]);

  const clearErrors = (...keys: WorkFormErrorKey[]) => {
    setErrors((current) => {
      const next = { ...current };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  };
  const updateDraft = <K extends keyof WorkFormDraft>(key: K, value: WorkFormDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    clearErrors(key, ...(key === "startDateIso" || key === "endDateIso" ? ["dateRange" as const] : []));
  };
  const updateProperty = (property: string) => {
    setDraft((current) => ({ ...current, property, unit: units.some((unit) => unit.property === property && unit.name === current.unit) ? current.unit : "" }));
    setDirty(true);
    clearErrors("property", "unit");
  };
  const updateManager = (manager: string) => {
    setDraft((current) => ({ ...current, manager, team: current.team.filter((member) => member !== manager) }));
    setDirty(true);
    clearErrors("manager", "team");
  };
  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    setErrors({});
    window.requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(".work-form-card");
      if (!card) return;
      window.scrollTo({ top: Math.max(0, card.getBoundingClientRect().top + window.scrollY - 76), behavior: "auto" });
    });
  };
  const toggleTeamMember = (member: string) => {
    updateDraft("team", draft.team.includes(member) ? draft.team.filter((name) => name !== member) : [...draft.team, member]);
  };
  const validateStep = (targetStep: number) => {
    const nextErrors: WorkFormErrors = {};
    if (targetStep === 1) {
      if (!draft.title.trim()) nextErrors.title = "Informe um nome curto para identificar a obra.";
      if (!draft.property) nextErrors.property = "Selecione o imóvel onde o serviço será realizado.";
      if (draft.unit && !units.some((unit) => unit.property === draft.property && unit.name === draft.unit)) nextErrors.unit = "Selecione uma unidade pertencente ao imóvel escolhido.";
    }
    if (targetStep === 2) {
      if (!draft.manager) nextErrors.manager = "Selecione a pessoa responsável pela obra.";
      if (!draft.startDateIso) nextErrors.startDateIso = "Informe a data prevista para o início.";
      if (!draft.endDateIso) nextErrors.endDateIso = "Informe a data prevista para a conclusão.";
      if (draft.startDateIso && draft.endDateIso && draft.endDateIso < draft.startDateIso) nextErrors.dateRange = "A conclusão não pode ser anterior ao início.";
    }
    if (targetStep === 3) {
      const budget = Number(draft.budget);
      const reserve = draft.reserve ? Number(draft.reserve) : 0;
      if (!draft.budget || !Number.isFinite(budget) || budget <= 0) nextErrors.budget = "Informe um valor previsto maior que zero.";
      if (!Number.isFinite(reserve) || reserve < 0) nextErrors.reserve = "A reserva não pode ter valor negativo.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const handleCancel = () => {
    if (dirty) { setDiscardOpen(true); return; }
    onCancel();
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep(step)) return;
    if (step < 3) {
      goToStep(step + 1);
      return;
    }
    const budget = Number(draft.budget);
    const reserve = draft.reserve ? Number(draft.reserve) : 0;
    const spent = work?.spent ?? 0;
    const financesChanged = !work || budget !== work.budget || reserve !== (work.reserve ?? 0);
    const progress = draft.status === "Concluída" ? 100 : work?.progress ?? (draft.status === "Em andamento" ? 5 : 0);
    const risk = draft.status === "Concluída" ? "Concluída" : draft.endDateIso < WORKS_DEMO_DATE_ISO && draft.status !== "Cancelada" ? "Em atraso" : "Dentro do prazo";
    onSave({
      id: work?.id ?? nextRecordId("OBR", works),
      title: draft.title.trim(),
      property: draft.property,
      unit: draft.unit || undefined,
      manager: draft.manager,
      status: draft.status,
      priority: draft.priority,
      risk,
      progress,
      startDateIso: draft.startDateIso,
      endDateIso: draft.endDateIso,
      endLabel: formatExpenseDate(draft.endDateIso),
      updatedAtIso: `${WORKS_DEMO_DATE_ISO}T12:00:00`,
      budget,
      spent,
      projectedCashBalance: financesChanged ? budget + reserve - spent : work?.projectedCashBalance ?? budget + reserve - spent,
      nextActivity: work?.nextActivity ?? (draft.status === "Em andamento" ? "Registrar primeira atividade" : "Definir planejamento inicial"),
      lastUpdateLabel: isEditing ? "Atualizada agora nesta sessão" : "Cadastrada agora nesta sessão",
      interventionType: draft.interventionType,
      description: draft.description.trim() || undefined,
      reserve,
      team: draft.team,
      notes: draft.notes.trim() || undefined,
      attachments: draft.attachments,
    });
  };

  const firstError = Object.values(errors)[0];
  const draftInvestment = (Number(draft.budget) || 0) + (Number(draft.reserve) || 0);
  const formProgress = Math.round((step / steps.length) * 100);
  return <div className="work-form-page">
    <section className="work-form-heading" aria-labelledby="work-form-title">
      <button type="button" className="work-form-back" onClick={handleCancel}><ArrowRight aria-hidden="true" />Voltar para obras</button>
      <div><p className="eyebrow">Módulo 2 · Gestão de Obras</p><span className="work-form-mode">{isEditing ? work?.id : "Novo cadastro"}</span><h1 id="work-form-title">{isEditing ? "Editar obra" : "Nova obra"}</h1><p>{isEditing ? "Atualize somente o que mudou. Os dados ficam disponíveis durante esta sessão." : "Cadastre o essencial agora. O restante poderá ser detalhado dentro da obra."}</p></div>
    </section>

    <nav className="work-form-stepper" aria-label="Etapas do cadastro">
      <ol>{steps.map((item) => <li key={item.number} className={`${item.number === step ? "active" : ""} ${item.number < step ? "completed" : ""}`}><button type="button" disabled={item.number > step} aria-current={item.number === step ? "step" : undefined} onClick={() => { if (item.number < step) goToStep(item.number); }}><span>{item.number < step ? <Check aria-hidden="true" /> : item.number}</span><strong>{item.title}</strong><small>{item.description}</small></button></li>)}</ol>
    </nav>

    <form className="work-form-shell" onSubmit={handleSubmit} noValidate>
      <button type="button" className="work-form-preview-toggle" aria-pressed={!previewOpen} onClick={() => setPreviewOpen((open) => !open)}>{previewOpen ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}{previewOpen ? "Ocultar resumo" : "Mostrar resumo"}</button>
      <div className={`work-form-workspace ${previewOpen ? "" : "work-form-workspace-solo"}`}>
        <section className="work-form-card" aria-labelledby={`work-form-step-${step}`}>
        <header><span>0{step}</span><div><h2 id={`work-form-step-${step}`}>{steps[step - 1].title}</h2><p>{step === 1 ? "Comece pelas informações que ajudam a localizar e entender a obra." : step === 2 ? "Defina uma referência principal e o prazo planejado." : "Informe a previsão inicial e confira o resumo antes de salvar."}</p></div><small className="work-form-required-note"><b>*</b> campos obrigatórios</small></header>
        {firstError && <p className="work-form-alert" role="alert"><TriangleAlert aria-hidden="true" /><span><strong>Não foi possível continuar.</strong>{firstError}</span></p>}

        {step === 1 && <div className="work-form-grid">
          <label><span>Tipo de intervenção <b>*</b></span><select value={draft.interventionType} onChange={(event) => updateDraft("interventionType", event.target.value as WorkInterventionType)}>{WORK_INTERVENTION_OPTIONS.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Prioridade <b>*</b></span><select value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value as WorkPriority)}>{WORK_PRIORITY_OPTIONS.map((priority) => <option key={priority}>{priority}</option>)}</select><small>Use “Urgente” somente quando houver risco imediato ou interrupção da operação.</small></label>
          <label className="work-form-field-wide"><span>Nome da obra <b>*</b></span><input className={errors.title ? "invalid" : ""} value={draft.title} maxLength={100} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Ex.: Reforma da cobertura" autoFocus aria-invalid={Boolean(errors.title)} />{errors.title && <small className="work-form-error">{errors.title}</small>}</label>
          <label><span>Imóvel <b>*</b></span><select className={errors.property ? "invalid" : ""} value={draft.property} onChange={(event) => updateProperty(event.target.value)} aria-invalid={Boolean(errors.property)}><option value="">Selecione um imóvel</option>{properties.map((property) => <option key={property.id} value={property.name}>{property.name}</option>)}</select>{errors.property && <small className="work-form-error">{errors.property}</small>}{selectedProperty && <small>{selectedProperty.address}</small>}</label>
          <label><span>Unidade <em>opcional</em></span><select className={errors.unit ? "invalid" : ""} value={draft.unit} disabled={!draft.property || availableUnits.length === 0} onChange={(event) => updateDraft("unit", event.target.value)} aria-invalid={Boolean(errors.unit)}><option value="">{!draft.property ? "Selecione primeiro o imóvel" : availableUnits.length ? "Toda a área do imóvel" : "Este imóvel não possui unidades"}</option>{availableUnits.map((unit) => <option key={unit.id}>{unit.name}</option>)}</select>{errors.unit && <small className="work-form-error">{errors.unit}</small>}{draft.property && availableUnits.length > 0 && <small>Deixe em branco quando a obra abranger todo o imóvel.</small>}</label>
          <label className="work-form-field-wide"><span>Descrição curta <em>opcional</em></span><textarea value={draft.description} maxLength={240} rows={3} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Resuma o objetivo e o escopo principal." /><small>{draft.description.length}/240 caracteres</small></label>
        </div>}

        {step === 2 && <div className="work-form-grid">
          <label><span>Responsável principal <b>*</b></span><select className={errors.manager ? "invalid" : ""} value={draft.manager} onChange={(event) => updateManager(event.target.value)} aria-invalid={Boolean(errors.manager)}><option value="">Selecione uma pessoa</option>{WORK_TEAM_OPTIONS.map((member) => <option key={member.name}>{member.name}</option>)}</select>{errors.manager && <small className="work-form-error">{errors.manager}</small>}</label>
          {isEditing ? <label><span>Situação <b>*</b></span><select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as WorkStatus)}>{["Planejada", "Em andamento", "Pausada", "Concluída", "Cancelada"].map((status) => <option key={status}>{status}</option>)}</select></label> : <label className="work-form-status-toggle"><span>Situação inicial</span><span><input type="checkbox" checked={draft.status === "Em andamento"} onChange={(event) => updateDraft("status", event.target.checked ? "Em andamento" : "Planejada")} /><span><strong>A obra já começou</strong><small>{draft.status === "Em andamento" ? "Será cadastrada como Em andamento." : "Será cadastrada como Planejada."}</small></span></span></label>}
          <label><span>Início previsto <b>*</b></span><input type="date" className={errors.startDateIso ? "invalid" : ""} value={draft.startDateIso} onChange={(event) => updateDraft("startDateIso", event.target.value)} aria-invalid={Boolean(errors.startDateIso)} />{errors.startDateIso && <small className="work-form-error">{errors.startDateIso}</small>}</label>
          <label><span>Conclusão prevista <b>*</b></span><input type="date" className={errors.endDateIso || errors.dateRange ? "invalid" : ""} value={draft.endDateIso} min={draft.startDateIso || undefined} onChange={(event) => updateDraft("endDateIso", event.target.value)} aria-invalid={Boolean(errors.endDateIso || errors.dateRange)} />{errors.endDateIso && <small className="work-form-error">{errors.endDateIso}</small>}{errors.dateRange && <small className="work-form-error">{errors.dateRange}</small>}</label>
          <fieldset className="work-form-team work-form-field-full"><legend>Equipe adicional <em>opcional</em></legend><p>Selecione apenas quem precisa acompanhar a execução.</p><div>{WORK_TEAM_OPTIONS.filter((member) => member.name !== draft.manager).map((member) => <label key={member.name} className={draft.team.includes(member.name) ? "selected" : ""}><input type="checkbox" checked={draft.team.includes(member.name)} onChange={() => toggleTeamMember(member.name)} /><span><strong>{member.name}</strong><small>{member.role}</small></span><Check aria-hidden="true" /></label>)}</div></fieldset>
        </div>}

        {step === 3 && <>
          <div className="work-form-grid">
            <label><span>Valor previsto <b>*</b></span><div className="work-form-money"><b>R$</b><input type="number" min="0" step="0.01" className={errors.budget ? "invalid" : ""} value={draft.budget} onChange={(event) => updateDraft("budget", event.target.value)} placeholder="0,00" aria-invalid={Boolean(errors.budget)} /></div>{errors.budget && <small className="work-form-error">{errors.budget}</small>}</label>
            <label><span>Reserva de contingência <em>opcional</em></span><div className="work-form-money"><b>R$</b><input type="number" min="0" step="0.01" className={errors.reserve ? "invalid" : ""} value={draft.reserve} onChange={(event) => updateDraft("reserve", event.target.value)} placeholder="0,00" aria-invalid={Boolean(errors.reserve)} /></div>{errors.reserve && <small className="work-form-error">{errors.reserve}</small>}</label>
            <label className="work-form-field-wide"><span>Observações <em>opcional</em></span><textarea value={draft.notes} maxLength={500} rows={4} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="Registre restrições, acordos ou orientações importantes." /><small>{draft.notes.length}/500 caracteres</small></label>
            <div className="work-form-upload work-form-field-wide"><p className="work-form-upload-label">Anexos de referência <em>opcional</em></p><label className="work-form-upload-drop"><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={(event) => updateDraft("attachments", Array.from(event.target.files ?? []).map((file) => file.name))} /><span><ArrowDownToLine aria-hidden="true" /><strong>Escolher arquivos</strong><small>PDF, imagens ou documentos. Nesta demonstração, somente os nomes são mantidos.</small></span></label>{draft.attachments.length > 0 && <ul>{draft.attachments.map((attachment) => <li key={attachment}><FileSignature aria-hidden="true" /><span>{attachment}</span><button type="button" onClick={() => updateDraft("attachments", draft.attachments.filter((name) => name !== attachment))} aria-label={`Remover ${attachment}`}><X aria-hidden="true" /></button></li>)}</ul>}</div>
          </div>
          <section className="work-form-review" aria-labelledby="work-form-review-title"><header><div><p className="eyebrow">Conferência rápida</p><h3 id="work-form-review-title">Resumo da obra</h3></div><CircleCheck aria-hidden="true" /></header><dl><div><dt>Intervenção</dt><dd>{draft.interventionType} · {draft.priority}</dd><small>{draft.title}</small></div><div><dt>Local</dt><dd>{draft.property}</dd><small>{draft.unit || "Toda a área do imóvel"}</small></div><div><dt>Responsável</dt><dd>{draft.manager}</dd><small>{draft.team.length ? `+ ${draft.team.length} na equipe` : "Sem equipe adicional"}</small></div><div><dt>Prazo</dt><dd>{draft.startDateIso ? formatExpenseDate(draft.startDateIso) : "Não informado"}</dd><small>até {draft.endDateIso ? formatExpenseDate(draft.endDateIso) : "não informado"}</small></div><div><dt>Previsão total</dt><dd>{draft.budget ? brl.format(Number(draft.budget) + Number(draft.reserve || 0)) : "Não informada"}</dd><small>Valor previsto + reserva</small></div><div><dt>Situação</dt><dd><WorkStatusBadge status={draft.status} /></dd><small>{draft.attachments.length ? `${draft.attachments.length} anexo(s)` : "Sem anexos"}</small></div></dl></section>
        </>}
        </section>

        <aside className="work-form-context" aria-label="Visão resumida do cadastro">
          <div className={`work-form-context-image ${selectedProperty ? "selected" : "empty"}`}>
            <img src={selectedProperty ? propertyCoverImages[selectedProperty.id] ?? fallbackPropertyCover : fallbackPropertyCover} alt={selectedProperty ? `Fachada de ${selectedProperty.name}` : ""} width="640" height="440" />
            <span className="work-form-context-shade" aria-hidden="true" />
            <span className="work-form-context-copy"><small>Contexto da intervenção</small><strong>{selectedProperty?.name ?? "Escolha o imóvel da obra"}</strong><em>{selectedProperty?.address ?? "A imagem e os dados do local aparecerão aqui."}</em></span>
          </div>
          <div className="work-form-context-body">
            <header><div><p className="eyebrow">Visão do cadastro</p><h2>{draft.title.trim() || (isEditing ? "Atualização da obra" : "Nova intervenção")}</h2></div><b>Etapa {step}/3</b></header>
            <span className="work-form-context-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3} aria-label={`Etapa ${step} de 3 do cadastro`}><i style={{ width: `${formProgress}%` }} /></span>
            <dl>
              <div><dt><Building2 aria-hidden="true" />Local</dt><dd><strong>{draft.property || "Ainda não selecionado"}</strong><span>{draft.unit || (selectedProperty ? `${selectedProperty.units} ${selectedProperty.units === 1 ? "unidade cadastrada" : "unidades cadastradas"}` : "Defina na primeira etapa")}</span></dd></div>
              <div><dt><CalendarClock aria-hidden="true" />Prazo</dt><dd><strong>{draft.endDateIso ? formatExpenseDate(draft.endDateIso) : "A definir"}</strong><span>{draft.startDateIso ? `Início em ${formatExpenseDate(draft.startDateIso)}` : "Datas ainda não informadas"}</span></dd></div>
              <div><dt><HandCoins aria-hidden="true" />Investimento</dt><dd><strong>{draftInvestment > 0 ? brl.format(draftInvestment) : "A definir"}</strong><span>{draft.reserve ? "Inclui reserva de contingência" : "Valor previsto + eventual reserva"}</span></dd></div>
              <div><dt><ClipboardList aria-hidden="true" />Situação</dt><dd><WorkStatusBadge status={draft.status} /><span>{draft.manager ? `Responsável: ${draft.manager}` : "Responsável ainda não definido"}</span></dd></div>
            </dl>
            <p className="work-form-context-note"><WifiOff aria-hidden="true" /><span><strong>Cadastro demonstrativo</strong>Os dados permanecem somente nesta sessão.</span></p>
          </div>
        </aside>
      </div>

      <footer className="work-form-footer"><div><strong>Etapa {step} de 3</strong><span>{step === 3 ? "Revise e confirme o cadastro." : "Você poderá voltar sem perder o preenchimento."}</span></div><div className={step === 1 ? "single-action" : ""}>{step > 1 && <button type="button" className="secondary-button" onClick={() => goToStep(Math.max(1, step - 1))}>Voltar</button>}<button type="submit" className="primary-button button-with-icon">{step === 3 ? <><Check aria-hidden="true" />{isEditing ? "Salvar alterações" : "Cadastrar obra"}</> : <>{step === 1 ? "Continuar: responsáveis" : "Continuar: valores"}<ArrowRight aria-hidden="true" /></>}</button></div></footer>
    </form>
    {discardOpen && <ConfirmDialog title={isEditing ? "Descartar alterações?" : "Descartar cadastro?"} message="As informações preenchidas nesta obra não serão salvas." confirmLabel="Descartar" cancelLabel="Continuar editando" tone="danger" onConfirm={onCancel} onCancel={() => setDiscardOpen(false)} />}
  </div>;
}

function DashboardPage({ charges, negotiations, expenses, properties, units, contracts, onNavigate }: { charges: Charge[]; negotiations: Record<string, ChargeNegotiation>; expenses: Expense[]; properties: Property[]; units: Unit[]; contracts: Contract[]; onNavigate: (page: Page, status?: string) => void }) {
  const openCharges = charges.filter((charge) => charge.status !== "Recebida");
  const overdueCharges = charges.filter((charge) => charge.status === "Vencida");
  const partialCharges = charges.filter((charge) => charge.status === "Parcial");
  const openExpenses = expenses.filter((expense) => expense.status !== "Pago");
  const overdueExpenses = expenses.filter((expense) => expense.status === "Vencido");
  const receivableBalance = openCharges.reduce((sum, charge) => sum + operationalChargeBalance(charge, negotiations[charge.id]), 0);
  const overdueReceivable = overdueCharges.reduce((sum, charge) => sum + chargeBalance(charge), 0);
  const payableBalance = openExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const currentPeriodCharges = charges.filter((charge) => charge.competence === "08/2026");
  const currentPeriodBilled = currentPeriodCharges.reduce((sum, charge) => sum + chargeTotal(charge), 0);
  const currentPeriodReceived = currentPeriodCharges.reduce((sum, charge) => sum + receivedTotal(charge), 0);
  const currentPeriodExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const currentPeriodPaidExpenses = expenses.filter((expense) => expense.status === "Pago").reduce((sum, expense) => sum + expense.amount, 0);
  const projectedResult = currentPeriodBilled - currentPeriodExpenses;
  const realizedResult = currentPeriodReceived - currentPeriodPaidExpenses;
  const collectionRate = currentPeriodBilled ? Math.round((currentPeriodReceived / currentPeriodBilled) * 100) : 0;
  const monthlyContractedRevenue = contracts.reduce((sum, contract) => sum + contract.rent, 0);
  const priorityValue = overdueReceivable + overdueExpenses.reduce((sum, expense) => sum + expense.amount, 0) + partialCharges.reduce((sum, charge) => sum + chargeBalance(charge), 0);
  const occupiedUnits = units.filter((unit) => unit.occupied).length;
  const availableUnits = units.length - occupiedUnits;
  const occupancyRate = units.length ? Math.round((occupiedUnits / units.length) * 100) : 0;
  const statusRows = (["Vencida", "Parcial", "Negociada", "Próxima", "Em aberto", "Recebida"] as Status[]).map((status) => ({ status, count: charges.filter((charge) => charge.status === status).length }));
  const statusColors: Record<Status, string> = { Vencida: "#b44853", Parcial: "#c18424", Negociada: "#7657a5", "Próxima": "#4b78cf", "Em aberto": "#8693a5", Recebida: "#2d7b58" };
  const statusSegments = statusRows.filter((row) => row.count > 0);
  const monthlyMap = new Map<string, { billed: number; received: number }>();
  charges.forEach((charge) => {
    const current = monthlyMap.get(charge.competence) ?? { billed: 0, received: 0 };
    current.billed += chargeTotal(charge);
    current.received += receivedTotal(charge);
    monthlyMap.set(charge.competence, current);
  });
  const monthlyRows = Array.from(monthlyMap, ([competence, values]) => ({ competence, ...values })).sort((a, b) => {
    const [monthA, yearA] = a.competence.split("/").map(Number);
    const [monthB, yearB] = b.competence.split("/").map(Number);
    return yearA * 12 + monthA - (yearB * 12 + monthB);
  });
  const monthlyMax = Math.max(...monthlyRows.flatMap((row) => [row.billed, row.received]), 1);
  const chartBilledTotal = monthlyRows.reduce((sum, row) => sum + row.billed, 0);
  const chartReceivedTotal = monthlyRows.reduce((sum, row) => sum + row.received, 0);
  const chartCollectionRate = chartBilledTotal ? Math.round((chartReceivedTotal / chartBilledTotal) * 100) : 0;
  const chartLastCompetence = monthlyRows[monthlyRows.length - 1]?.competence ?? "08/2026";
  const portfolios = Array.from(new Set(units.map((unit) => unit.portfolio))).map((portfolio) => {
    const portfolioUnits = units.filter((unit) => unit.portfolio === portfolio);
    const occupied = portfolioUnits.filter((unit) => unit.occupied).length;
    return { portfolio, occupied, total: portfolioUnits.length, rate: portfolioUnits.length ? Math.round((occupied / portfolioUnits.length) * 100) : 0 };
  });
  const availabilityByProperty = Array.from(new Set(units.filter((unit) => !unit.occupied).map((unit) => unit.property))).map((property) => ({ property, units: units.filter((unit) => unit.property === property && !unit.occupied) })).sort((left, right) => right.units.length - left.units.length);
  const featuredAvailability = availabilityByProperty[0];
  const featuredProperty = featuredAvailability ? properties.find((property) => property.name === featuredAvailability.property) : undefined;
  return <>
    <section className="dashboard-executive-hero" aria-labelledby="dashboard-title">
      <div className="dashboard-executive-main">
        <header><div><span className="dashboard-live-dot" aria-hidden="true" /><span>Data-base demonstrativa · 12 ago 2026</span></div><b>Competência 08/2026</b></header>
        <div className="dashboard-executive-copy"><p>Painel executivo</p><h1 id="dashboard-title">Visão geral</h1><span>Uma leitura integrada da operação patrimonial e da posição financeira.</span></div>
        <div className="dashboard-result"><span>Projeção do resultado mensal</span><strong className={projectedResult >= 0 ? "positive" : "negative"}>{brl.format(projectedResult)}</strong><small>Recebíveis previstos menos todas as despesas cadastradas</small></div>
        <div className="dashboard-result-breakdown"><span><small>Recebíveis previstos</small><strong>{brl.format(currentPeriodBilled)}</strong></span><span><small>Despesas cadastradas</small><strong>{brl.format(currentPeriodExpenses)}</strong></span><span className="dashboard-realized-summary"><small>Realizado até a data-base</small><strong className={realizedResult >= 0 ? "positive" : "negative"}>{brl.format(realizedResult)}</strong><em>{brl.format(currentPeriodReceived)} recebidos − {brl.format(currentPeriodPaidExpenses)} pagos</em></span></div>
      </div>
      <aside className="dashboard-executive-pulse" aria-label="Pulso da operação">
        <header><div><span>Pulso da operação</span><h2>Indicadores essenciais</h2></div><small>Na data-base</small></header>
        <div className="dashboard-pulse-metrics">
          <button type="button" onClick={() => onNavigate("Cobranças")}><i className="dashboard-pulse-ring dashboard-pulse-collection" style={{ background: `conic-gradient(#4faf81 ${collectionRate}%,#e4e9e7 ${collectionRate}% 100%)` }} aria-hidden="true"><span>{collectionRate}%</span></i><span><strong>Recebimento</strong><small>{brl.format(currentPeriodReceived)} realizados</small></span><b aria-hidden="true"><ArrowRight /></b></button>
          <button type="button" onClick={() => onNavigate("Unidades")}><i className="dashboard-pulse-ring dashboard-pulse-occupancy" style={{ background: `conic-gradient(#638bd4 ${occupancyRate}%,#e4e8ee ${occupancyRate}% 100%)` }} aria-hidden="true"><span>{occupancyRate}%</span></i><span><strong>Ocupação</strong><small>{occupiedUnits} de {units.length} unidades</small></span><b aria-hidden="true"><ArrowRight /></b></button>
        </div>
        <footer><button type="button" onClick={() => onNavigate("Cobranças")}>Cobranças <span>→</span></button><button type="button" onClick={() => onNavigate("Despesas")}>Despesas <span>→</span></button><button type="button" onClick={() => onNavigate("Contratos")}>Contratos <span>→</span></button></footer>
      </aside>
    </section>
    <article className="dashboard-panel attention-panel financial-attention dashboard-priorities-first dashboard-priority-center">
      <header className="dashboard-panel-header"><div><p className="eyebrow">Central de prioridades</p><h2>Valores que exigem atenção</h2><span>{priorityValue ? `${brl.format(priorityValue)} concentrados em pendências financeiras` : "Nenhuma pendência crítica no momento"}</span></div><span className="attention-count">{overdueCharges.length + overdueExpenses.length + partialCharges.length}</span></header>
      <div className="attention-list">{overdueCharges.map((charge) => <button type="button" key={charge.id} onClick={() => onNavigate("Cobranças", "Vencida")}><i className="attention-danger" /><span><strong>{charge.tenant}</strong><small>{charge.id} · cobrança vencida</small></span><b>{brl.format(chargeBalance(charge))}</b></button>)}{overdueExpenses.map((expense) => <button type="button" key={expense.id} onClick={() => onNavigate("Despesas", "Vencido")}><i className="attention-danger" /><span><strong>{expense.supplier}</strong><small>{expense.id} · despesa vencida</small></span><b>{brl.format(expense.amount)}</b></button>)}{partialCharges.map((charge) => <button type="button" key={charge.id} onClick={() => onNavigate("Cobranças", "Parcial")}><i className="attention-warning" /><span><strong>{charge.tenant}</strong><small>{charge.id} · baixa parcial</small></span><b>{brl.format(chargeBalance(charge))}</b></button>)}{overdueCharges.length + overdueExpenses.length + partialCharges.length === 0 && <CompactEmptyState mark="✓" tone="success" title="Operação sem urgências" description="Novas pendências financeiras aparecerão aqui em ordem de prioridade." />}</div>
    </article>
    <section className="dashboard-domain dashboard-domain-operation" aria-labelledby="dashboard-operation-title">
      <header className="dashboard-domain-header"><span className="dashboard-domain-index" aria-hidden="true">01</span><div><p>Operação patrimonial</p><h2 id="dashboard-operation-title">Estrutura, contratos e ocupação</h2><small>Acompanhe o uso das unidades e a estrutura locável.</small></div></header>
      <div className="dashboard-domain-content">
        <section className="dashboard-kpis dashboard-kpis-three" aria-label="Indicadores da operação patrimonial">
          <button type="button" className="dashboard-kpi kpi-revenue" onClick={() => onNavigate("Contratos")}><span>Receita contratada / mês</span><strong>{brl.format(monthlyContractedRevenue)}</strong><small>Valor-base dos contratos vigentes</small><i aria-hidden="true"><ArrowRight /></i></button>
          <button type="button" className="dashboard-kpi kpi-available" onClick={() => onNavigate("Unidades")}><span>Unidades disponíveis</span><strong>{availableUnits}</strong><small>Espaços livres para locação</small><i aria-hidden="true"><ArrowRight /></i></button>
          <button type="button" className="dashboard-kpi kpi-contracts" onClick={() => onNavigate("Contratos")}><span>Contratos ativos</span><strong>{contracts.length}</strong><small>Vínculos vigentes na base</small><i aria-hidden="true"><ArrowRight /></i></button>
        </section>
        <section className="dashboard-grid dashboard-grid-operation"><article className="dashboard-panel occupancy-panel">
          <header className="dashboard-panel-header"><div><p className="eyebrow">Desempenho operacional</p><h2>Ocupação por carteira</h2></div></header>
          <div className="occupancy-list">{portfolios.map((row) => <div className="occupancy-row" key={row.portfolio}><div><strong>{row.portfolio}</strong><span>{row.occupied} de {row.total} unidades</span></div><div className="occupancy-track" role="progressbar" aria-valuenow={row.rate} aria-valuemin={0} aria-valuemax={100} aria-label={`Ocupação de ${row.portfolio}`}><i style={{ width: `${row.rate}%` }} /></div><b>{row.rate}%</b></div>)}{portfolios.length === 0 && <CompactEmptyState mark="OP" title="Ocupação ainda sem dados" description="Cadastre carteiras e unidades para formar este panorama operacional." />}</div>
          <button type="button" className="panel-link" onClick={() => onNavigate("Unidades")}>Ver todas as unidades <span aria-hidden="true"><ArrowRight /></span></button>
        </article>{featuredAvailability && featuredProperty ? <article className="dashboard-property-spotlight"><img src={propertyCoverImages[featuredProperty.id] ?? fallbackPropertyCover} alt={`Fachada de ${featuredProperty.name}`} width="720" height="520" /><div className="dashboard-property-spotlight-top"><span>Oportunidade do patrimônio</span><b>{featuredAvailability.units.length} {featuredAvailability.units.length === 1 ? "unidade disponível" : "unidades disponíveis"}</b></div><div className="dashboard-property-spotlight-copy"><span>{featuredProperty.portfolio}</span><h2>{featuredProperty.name}</h2><p>{featuredProperty.address}</p><div>{featuredAvailability.units.map((unit) => <b key={unit.id}>{unit.name} · {decimal.format(unit.area)} m²</b>)}</div><button type="button" onClick={() => onNavigate("Unidades")}>Explorar disponibilidade <span aria-hidden="true">→</span></button></div></article> : <article className="dashboard-availability-empty"><CompactEmptyState mark="✓" tone="success" title="Patrimônio totalmente ocupado" description="Quando uma unidade ficar disponível, ela ganhará destaque visual neste espaço." /></article>}</section>
      </div>
    </section>
    <section className="dashboard-domain dashboard-domain-financial" aria-labelledby="dashboard-financial-title">
      <header className="dashboard-domain-header"><span className="dashboard-domain-index" aria-hidden="true">02</span><div><p>Financeiro</p><h2 id="dashboard-financial-title">Recebíveis e despesas</h2><small>Compare entradas previstas, recebimentos e despesas.</small></div></header>
      <div className="dashboard-domain-content">
        <section className="dashboard-kpis dashboard-kpis-three" aria-label="Indicadores financeiros">
          <button type="button" className="dashboard-kpi kpi-receivable" onClick={() => onNavigate("Cobranças")}><span>Saldo a receber</span><strong>{brl.format(receivableBalance)}</strong><small>{openCharges.length} cobranças em aberto</small><i aria-hidden="true"><ArrowRight /></i></button>
          <button type="button" className="dashboard-kpi kpi-overdue" onClick={() => onNavigate("Cobranças", "Vencida")}><span>Recebíveis vencidos</span><strong>{brl.format(overdueReceivable)}</strong><small>{overdueCharges.length} {overdueCharges.length === 1 ? "cobrança exige" : "cobranças exigem"} atenção</small><i aria-hidden="true"><ArrowRight /></i></button>
          <button type="button" className="dashboard-kpi kpi-payable" onClick={() => onNavigate("Despesas")}><span>Despesas</span><strong>{brl.format(payableBalance)}</strong><small>{openExpenses.length} despesas em aberto</small><i aria-hidden="true"><ArrowRight /></i></button>
        </section>
        <section className="dashboard-grid dashboard-grid-main">
          <article className="dashboard-panel dashboard-cashflow">
            <header className="dashboard-panel-header"><div><p className="eyebrow">Recebíveis por competência</p><h2>Previsto x recebido</h2></div><div className="chart-header-meta"><small>{monthlyRows.length} competências · até {chartLastCompetence}</small><div className="chart-legend"><span><i className="legend-billed" />Previsto</span><span><i className="legend-received" />Recebido</span></div></div></header>
            <div className="competence-chart" role="img" aria-label={`Comparação entre valores previstos e recebidos por competência. ${monthlyRows.map((row) => `${row.competence}: previsto ${brl.format(row.billed)}, recebido ${brl.format(row.received)}`).join("; ")}`}><div className="chart-scale" aria-hidden="true"><span>{brlCompact(monthlyMax)}</span><span>{brlCompact(monthlyMax / 2)}</span><span>R$ 0</span></div><div className="chart-plot">{monthlyRows.map((row) => {
              const groupRate = row.billed ? Math.round((row.received / row.billed) * 100) : 0;
              return <div className="chart-group" key={row.competence} tabIndex={0} aria-label={`${row.competence}: previsto ${brl.format(row.billed)}, recebido ${brl.format(row.received)} (${groupRate}% recebido)`}><span className="chart-group-values" aria-hidden="true"><b>{brlCompact(row.billed)}</b><em>{brlCompact(row.received)}</em></span><div className="chart-bars"><i className="chart-bar chart-bar-billed" style={{ "--bar-height": `${(row.billed / monthlyMax) * 100}%` } as CSSProperties} /><i className="chart-bar chart-bar-received" style={{ "--bar-height": `${(row.received / monthlyMax) * 100}%` } as CSSProperties} /></div><strong>{row.competence}</strong><span className="chart-tooltip" role="tooltip" aria-hidden="true"><b>{row.competence}</b><span><i className="legend-billed" />Previsto<em>{brl.format(row.billed)}</em></span><span><i className="legend-received" />Recebido<em>{brl.format(row.received)}</em></span><span className="chart-tooltip-rate">{groupRate}% recebido</span></span></div>;
            })}</div></div>
            <footer className="dashboard-panel-footer"><span>Total previsto <strong>{brl.format(chartBilledTotal)}</strong></span><span>Total recebido <strong>{brl.format(chartReceivedTotal)}</strong></span><span>Taxa de recebimento <strong>{chartCollectionRate}%</strong></span></footer>
          </article>
          <article className="dashboard-panel dashboard-status-panel"><header className="dashboard-panel-header"><div><p className="eyebrow">Carteira de cobranças</p><h2>Situação atual</h2></div><span className="panel-meta">{openCharges.length} em aberto</span></header><div className="status-overview"><div className="status-bar-block"><div className="status-bar-total"><strong>{charges.length}</strong><span>{charges.length === 1 ? "cobrança na carteira" : "cobranças na carteira"}</span></div><div className="status-bar" role="img" aria-label={`Distribuição por situação: ${statusSegments.map((row) => `${row.count} ${row.status}`).join(", ") || "sem cobranças"}`}>{statusSegments.map((row) => <i key={row.status} style={{ flexGrow: row.count, background: statusColors[row.status] }} />)}{charges.length === 0 && <i className="status-bar-empty" />}</div></div><div className="status-breakdown">{statusSegments.map((row) => <button type="button" key={row.status} onClick={() => onNavigate("Cobranças", row.status)}><i aria-hidden="true" style={{ background: statusColors[row.status] }} /><span>{row.status}</span><strong>{row.count}</strong></button>)}{charges.length === 0 && <CompactEmptyState mark="CO" tone="charge" title="Sem cobranças no período" description="A distribuição por situação será formada após a primeira competência." />}</div></div></article>
        </section>
      </div>
    </section>
  </>;
}

function ChargesPage({ charges: rows, summaryCharges, negotiations, total, search, setSearch, portfolioFilter, setPortfolioFilter, statusFilter, setStatusFilter, onOpen, onNew, onReport }: { charges: Charge[]; summaryCharges: Charge[]; negotiations: Record<string, ChargeNegotiation>; total: number; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; onOpen: (charge: Charge) => void; onNew: () => void; onReport: () => void }) {
  const pendingCharges = summaryCharges.filter((charge) => charge.status !== "Recebida");
  const pending = pendingCharges.reduce((sum, charge) => sum + operationalChargeBalance(charge, negotiations[charge.id]), 0);
  const countByStatus = (status: Status) => pendingCharges.filter((charge) => charge.status === status).length;
  const toggleStatus = (status: Status) => setStatusFilter(statusFilter === status ? "Todas" : status);
  const totalBilled = summaryCharges.reduce((sum, charge) => sum + chargeTotal(charge), 0);
  const totalReceived = summaryCharges.reduce((sum, charge) => sum + receivedTotal(charge), 0);
  const collectionRate = totalBilled ? Math.round((totalReceived / totalBilled) * 100) : 0;
  const overdueBalance = pendingCharges.filter((charge) => charge.status === "Vencida").reduce((sum, charge) => sum + operationalChargeBalance(charge, negotiations[charge.id]), 0);
  const upcomingBalance = pendingCharges.filter((charge) => charge.status === "Próxima").reduce((sum, charge) => sum + operationalChargeBalance(charge, negotiations[charge.id]), 0);
  const negotiatedBalance = pendingCharges.filter((charge) => charge.status === "Negociada").reduce((sum, charge) => sum + operationalChargeBalance(charge, negotiations[charge.id]), 0);
  const hasChargeFilters = Boolean(search.trim() || portfolioFilter !== "Todas as carteiras" || statusFilter !== "Todas");
  const clearChargeFilters = () => { setSearch(""); setPortfolioFilter("Todas as carteiras"); setStatusFilter("Todas"); };
  const cardStatuses = ["Vencida", "Próxima", "Negociada"];

  return <>
    <PageHeading eyebrow="Gestão de recebíveis" title="Cobranças" description="Priorize valores em risco, acompanhe acordos e registre recebimentos por competência." action="Nova cobrança" onAction={onNew} />
    <section className="charge-command-overview" aria-label="Indicadores de cobranças">
      <div className="charge-command-balance"><span>Saldo em acompanhamento</span><strong>{brl.format(pending)}</strong><small>{pendingCharges.length} {pendingCharges.length === 1 ? "cobrança ativa" : "cobranças ativas"}</small><div><span><b>{collectionRate}% recebido</b><small>{brl.format(totalReceived)} de {brl.format(totalBilled)}</small></span><i aria-hidden="true"><b style={{ width: `${collectionRate}%` }} /></i></div></div>
      <button type="button" className="charge-command-card charge-command-overdue" aria-pressed={statusFilter === "Vencida"} onClick={() => toggleStatus("Vencida")} title="Filtrar cobranças vencidas"><span>Vencidas</span><strong>{countByStatus("Vencida")}</strong><small>{brl.format(overdueBalance)} em risco</small><i aria-hidden="true"><TriangleAlert /></i></button>
      <button type="button" className="charge-command-card charge-command-upcoming" aria-pressed={statusFilter === "Próxima"} onClick={() => toggleStatus("Próxima")} title="Filtrar cobranças próximas"><span>Próximas</span><strong>{countByStatus("Próxima")}</strong><small>{brl.format(upcomingBalance)} a vencer</small><i aria-hidden="true"><CalendarClock /></i></button>
      <button type="button" className="charge-command-card charge-command-negotiated" aria-pressed={statusFilter === "Negociada"} onClick={() => toggleStatus("Negociada")} title="Filtrar cobranças negociadas"><span>Em negociação</span><strong>{countByStatus("Negociada")}</strong><small>{brl.format(negotiatedBalance)} acordados</small><i aria-hidden="true"><Handshake /></i></button>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por contrato, unidade, locatário ou item" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><FilterSelect label="Filtrar por situação" value={cardStatuses.includes(statusFilter) ? "Todas" : statusFilter} onChange={setStatusFilter} active={statusFilter !== "Todas" && !cardStatuses.includes(statusFilter)}><option>Todas</option><option>Em aberto</option><option>Parcial</option><option>Recebida</option></FilterSelect>{hasChargeFilters && <button type="button" className="charge-clear-filters button-with-icon" onClick={clearChargeFilters}><X aria-hidden="true" />Limpar filtros</button>}<button type="button" className="secondary-button report-export-button button-with-icon" onClick={onReport}><span className="report-export-icon" aria-hidden="true"><ArrowDownToLine /></span>Exportar relatório</button><button type="button" className="primary-button charge-mobile-new button-with-icon" onClick={onNew}><Plus aria-hidden="true" />Nova cobrança</button></>} footer={<><span>{rows.length} de {total} cobranças</span><span>Inclusão, negociação e baixa manuais</span></>}>
      {rows.length > 0 ? <div className="charge-ledger" aria-label="Cobranças cadastradas">{rows.map((charge) => {
        const totalValue = chargeTotal(charge);
        const receivedValue = receivedTotal(charge);
        const balanceValue = operationalChargeBalance(charge, negotiations[charge.id]);
        const receivedRate = totalValue ? Math.min(100, Math.round((receivedValue / totalValue) * 100)) : 0;
        const statusName = charge.status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(" ", "-");

        return <button type="button" className={`charge-ledger-row charge-ledger-${statusName}`} key={charge.id} onClick={() => onOpen(charge)} aria-label={`Abrir cobrança ${charge.id}, ${charge.status}`}>
          <span className="charge-ledger-marker" aria-hidden="true" />
          <span className="charge-ledger-identity"><span><strong>{charge.id}</strong><small>{charge.portfolio}</small></span><StatusBadge status={charge.status} /></span>
          <span className="charge-ledger-context"><small>{charge.contract} · {charge.competence}</small><strong>{charge.tenant}</strong><span>{charge.property} · {charge.units.join(", ")}</span></span>
          <span className="charge-ledger-due"><small>Vencimento principal</small><strong>{charge.items[0]?.dueDate ?? "Não informado"}</strong><span>{charge.items.length} {charge.items.length === 1 ? "item" : "itens"} · {charge.items.map((item) => item.name).join(" · ")}</span></span>
          <span className="charge-ledger-values"><span><small>Total previsto</small><b>{brl.format(totalValue)}</b></span><span><small>{negotiations[charge.id] ? "Saldo acordado" : "Saldo atual"}</small><strong>{brl.format(balanceValue)}</strong></span><i aria-hidden="true"><b style={{ width: `${receivedRate}%` }} /></i></span>
          <span className="charge-ledger-arrow" aria-hidden="true"><b>Ver detalhes</b><ArrowRight /></span>
        </button>;
      })}</div> : <EmptyState filtered={hasChargeFilters} entity="cobrança" mark="CO" tone="charge" eyebrow="Primeira competência" title="Transforme contratos em recebíveis" description="Crie a primeira cobrança para acompanhar vencimentos, baixas e negociações em um único fluxo." action="Nova cobrança" onAction={onNew} onClear={clearChargeFilters} />}
    </TableSection>
  </>;
}

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <span className={`status status-${status.toLocaleLowerCase("pt-BR")}`}><i aria-hidden="true" />{status}</span>;
}

function expenseTiming(expense: Expense) {
  const daysUntilDue = Math.round((Date.parse(`${expense.dueIso}T00:00:00Z`) - Date.parse(`${DEMO_DATE_ISO}T00:00:00Z`)) / DAY_IN_MS);
  if (expense.status === "Vencido") {
    const daysOverdue = Math.abs(daysUntilDue);
    return `${daysOverdue} ${daysOverdue === 1 ? "dia" : "dias"} em atraso`;
  }
  if (expense.status === "Pago") return "";
  if (daysUntilDue === 0) return "Vence hoje";
  if (daysUntilDue > 0 && daysUntilDue <= UPCOMING_WINDOW_DAYS) return `Em ${daysUntilDue} ${daysUntilDue === 1 ? "dia" : "dias"}`;
  return "";
}

function isUpcomingExpense(expense: Expense) {
  const daysUntilDue = Math.round((Date.parse(`${expense.dueIso}T00:00:00Z`) - Date.parse(`${DEMO_DATE_ISO}T00:00:00Z`)) / DAY_IN_MS);
  return expense.status === "Pendente" && daysUntilDue >= 0 && daysUntilDue <= UPCOMING_WINDOW_DAYS;
}

function ExpensesPage({ rows, total, categories, search, setSearch, statusFilter, setStatusFilter, categoryFilter, setCategoryFilter, onOpen, onNew }: { rows: Expense[]; total: number; categories: string[]; search: string; setSearch: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; categoryFilter: string; setCategoryFilter: (value: string) => void; onOpen: (expense: Expense) => void; onNew: () => void }) {
  type ExpenseSortKey = "urgent" | "due" | "amount" | "supplier" | "status";
  type ExpenseSortDirection = "asc" | "desc";
  const [sortKey, setSortKey] = useState<ExpenseSortKey>("urgent");
  const [sortDirection, setSortDirection] = useState<ExpenseSortDirection>("asc");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const visibleRows = upcomingOnly ? rows.filter(isUpcomingExpense) : rows;
  const totalPayable = visibleRows.filter((expense) => expense.status !== "Pago").reduce((sum, expense) => sum + expense.amount, 0);
  const totalOverdue = visibleRows.filter((expense) => expense.status === "Vencido").reduce((sum, expense) => sum + expense.amount, 0);
  const totalPaid = visibleRows.filter((expense) => expense.status === "Pago").reduce((sum, expense) => sum + expense.amount, 0);
  const openAccounts = visibleRows.filter((expense) => expense.status !== "Pago").length;
  const overdueAccounts = visibleRows.filter((expense) => expense.status === "Vencido").length;
  const paidAccounts = visibleRows.filter((expense) => expense.status === "Pago").length;
  const nextDue = visibleRows.filter(isUpcomingExpense).length;
  const totalCommitted = totalPayable + totalPaid;
  const paymentRate = totalCommitted ? Math.round((totalPaid / totalCommitted) * 100) : 0;
  const hasExpenseFilters = Boolean(search.trim() || statusFilter !== "Todas" || categoryFilter !== "Todas as categorias" || upcomingOnly || sortKey !== "urgent" || sortDirection !== "asc");
  const toggleExpenseStatus = (status: ExpenseStatus) => { setUpcomingOnly(false); setStatusFilter(statusFilter === status ? "Todas" : status); };
  const toggleUpcoming = () => { setUpcomingOnly((current) => !current); setStatusFilter(upcomingOnly ? "Todas" : "Pendente"); };
  const handleExpenseStatusChange = (value: string) => { setUpcomingOnly(false); setStatusFilter(value); };
  const clearExpenseFilters = () => {
    setSearch("");
    setStatusFilter("Todas");
    setCategoryFilter("Todas as categorias");
    setSortKey("urgent");
    setSortDirection("asc");
    setUpcomingOnly(false);
  };
  const sortedRows = [...visibleRows].sort((first, second) => {
    if (sortKey === "urgent") {
      const statusDifference = expenseStatusPriority[first.status] - expenseStatusPriority[second.status];
      if (statusDifference) return statusDifference;
      const dueDifference = first.dueIso.localeCompare(second.dueIso);
      return first.status === "Pago" ? -dueDifference : dueDifference;
    }
    const comparison = sortKey === "due" ? first.dueIso.localeCompare(second.dueIso)
      : sortKey === "amount" ? first.amount - second.amount
      : sortKey === "supplier" ? first.supplier.localeCompare(second.supplier, "pt-BR")
      : expenseStatusPriority[first.status] - expenseStatusPriority[second.status];
    return (sortDirection === "asc" ? comparison : -comparison) || first.id.localeCompare(second.id);
  });
  const selectSort = (value: string) => {
    const [nextKey, nextDirection] = value.split(":") as [ExpenseSortKey, ExpenseSortDirection];
    setSortKey(nextKey);
    setSortDirection(nextDirection);
  };
  return <>
    <PageHeading eyebrow="Contas a pagar" title="Despesas" description="Antecipe vencimentos, controle compromissos e acompanhe pagamentos em uma visão financeira." action="Nova despesa" onAction={onNew} />
    <section className="expense-command-overview" aria-label="Resumo financeiro das despesas" aria-live="polite">
      <div className="expense-command-payable"><span>Total a pagar</span><strong>{brl.format(totalPayable)}</strong><small>{openAccounts} {openAccounts === 1 ? "compromisso em aberto" : "compromissos em aberto"}</small><div><span><b>{paymentRate}% pago</b><small>{brl.format(totalPaid)} de {brl.format(totalCommitted)}</small></span><i aria-hidden="true"><b style={{ width: `${paymentRate}%` }} /></i></div></div>
      <button type="button" className="expense-command-card expense-command-overdue" aria-pressed={statusFilter === "Vencido"} onClick={() => toggleExpenseStatus("Vencido")}><span>Em atraso</span><strong>{brl.format(totalOverdue)}</strong><small>{overdueAccounts} {overdueAccounts === 1 ? "despesa vencida" : "despesas vencidas"}</small><i aria-hidden="true"><TriangleAlert /></i></button>
      <button type="button" className="expense-command-card expense-command-paid" aria-pressed={statusFilter === "Pago"} onClick={() => toggleExpenseStatus("Pago")}><span>Total pago</span><strong>{brl.format(totalPaid)}</strong><small>{paidAccounts} {paidAccounts === 1 ? "despesa quitada" : "despesas quitadas"}</small><i aria-hidden="true"><CircleCheck /></i></button>
      <button type="button" className="expense-command-card expense-command-upcoming" aria-pressed={upcomingOnly} onClick={toggleUpcoming}><span>Próximos 7 dias</span><strong>{nextDue}</strong><small>vencimentos a priorizar</small><i aria-hidden="true"><CalendarClock /></i></button>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por fornecedor, descrição ou despesa" /><FilterSelect label="Filtrar despesas por status" value={statusFilter} onChange={handleExpenseStatusChange} active={statusFilter !== "Todas" || upcomingOnly}><option>Todas</option><option>Pendente</option><option>Pago</option><option>Vencido</option></FilterSelect><FilterSelect label="Filtrar despesas por categoria" value={categoryFilter} onChange={setCategoryFilter} active={categoryFilter !== "Todas as categorias"}><option>Todas as categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</FilterSelect><FilterSelect label="Ordenar despesas" value={`${sortKey}:${sortDirection}`} onChange={selectSort} active={`${sortKey}:${sortDirection}` !== "urgent:asc"} variant="sort" wide><option value="urgent:asc">Mais urgentes</option><option value="due:asc">Vencimento: mais próximo</option><option value="due:desc">Vencimento: mais distante</option><option value="amount:desc">Valor: maior primeiro</option><option value="amount:asc">Valor: menor primeiro</option><option value="supplier:asc">Fornecedor: A–Z</option><option value="supplier:desc">Fornecedor: Z–A</option><option value="status:asc">Status: críticos primeiro</option><option value="status:desc">Status: pagos primeiro</option></FilterSelect><button type="button" className="secondary-button expense-clear-filters button-with-icon" onClick={clearExpenseFilters} disabled={!hasExpenseFilters}><RotateCcw aria-hidden="true" />Limpar filtros</button><button type="button" className="primary-button expense-mobile-new button-with-icon" onClick={onNew}><Plus aria-hidden="true" />Nova despesa</button></>} footer={<><span>{sortedRows.length} de {total} despesas</span><span>{hasExpenseFilters ? "Resumo do resultado filtrado" : "Visão geral da base"}</span></>}>
      {sortedRows.length > 0 ? <div className="expense-ledger" aria-label="Despesas cadastradas">{sortedRows.map((expense) => {
        const timing = expenseTiming(expense);
        const stateClass = expense.status === "Vencido" ? "expense-ledger-overdue" : timing ? "expense-ledger-soon" : expense.status === "Pago" ? "expense-ledger-paid" : "expense-ledger-pending";
        return <button type="button" className={`expense-ledger-row ${stateClass}`} key={expense.id} onClick={() => onOpen(expense)} aria-label={`Abrir despesa ${expense.id}, ${expense.status}`}>
          <span className="expense-ledger-marker" aria-hidden="true" />
          <span className="expense-ledger-identity"><span><strong>{expense.id}</strong><small>{expense.category}</small></span><ExpenseStatusBadge status={expense.status} /></span>
          <span className="expense-ledger-context"><small>Fornecedor / beneficiário</small><strong>{expense.supplier}</strong><span>{expense.description}</span></span>
          <span className="expense-ledger-due"><small>Vencimento</small><strong>{expense.dueDate}</strong><span className={expense.status === "Vencido" ? "timing-overdue" : "timing-soon"}>{timing || (expense.status === "Pago" ? `Pago em ${expense.paidDate}` : "Dentro do prazo")}</span></span>
          <span className="expense-ledger-value"><small>Valor da despesa</small><strong>{brl.format(expense.amount)}</strong><span>{expense.status === "Pago" ? "Compromisso quitado" : "Pagamento pendente"}</span></span>
          <span className="expense-ledger-arrow" aria-hidden="true"><ArrowRight /></span>
        </button>;
      })}</div> : <EmptyState filtered={hasExpenseFilters} entity="despesa" mark="DE" tone="expense" eyebrow="Controle financeiro" title="Registre o primeiro compromisso" description="Inclua uma despesa para antecipar vencimentos e acompanhar o ciclo de pagamentos da operação." action="Nova despesa" onAction={onNew} onClear={clearExpenseFilters} />}
    </TableSection>
  </>;
}

function PortfoliosPage({ portfolios, properties, units, search, setSearch, onNew, onEdit, onViewProperties }: { portfolios: Portfolio[]; properties: Property[]; units: Unit[]; search: string; setSearch: (value: string) => void; onNew: () => void; onEdit: (portfolio: Portfolio) => void; onViewProperties: (portfolio: Portfolio) => void }) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const documentQuery = query.replace(/\D/g, "");
  const rows = portfolios.filter((portfolio) => `${portfolio.id} ${portfolio.name} ${portfolio.holder} ${portfolio.document}`.toLocaleLowerCase("pt-BR").includes(query) || (/^[\d.\s/-]+$/.test(query) && documentQuery.length > 0 && portfolio.document.replace(/\D/g, "").includes(documentQuery)));
  const occupiedUnits = units.filter((unit) => unit.occupied).length;
  const occupancy = units.length ? Math.round((occupiedUnits / units.length) * 100) : 0;

  return <div className="portfolios-page">
    <PageHeading eyebrow="Estrutura patrimonial" title="Carteiras" description="Organize a titularidade e acompanhe os imóveis e a ocupação de cada carteira." action="Nova carteira" onAction={onNew} />

    <section className="portfolio-overview" aria-label="Visão consolidada das carteiras">
      <div className="portfolio-overview-intro"><span>Visão consolidada</span><strong>{properties.length} {properties.length === 1 ? "imóvel" : "imóveis"} <b>em gestão</b></strong><small>Patrimônio distribuído em {portfolios.length} {portfolios.length === 1 ? "carteira" : "carteiras"}.</small></div>
      <div className="portfolio-overview-metric"><span>Carteiras</span><strong>{portfolios.length}</strong><small>cadastradas</small></div>
      <div className="portfolio-overview-metric"><span>Unidades</span><strong>{units.length}</strong><small>{units.length - occupiedUnits} disponíveis</small></div>
      <div className="portfolio-overview-occupancy"><span>Ocupação geral</span><strong>{units.length ? `${occupancy}%` : "—"}</strong><small>{units.length ? `${occupiedUnits} de ${units.length} unidades` : "Sem unidades"}</small><i aria-hidden="true"><b style={{ width: `${occupancy}%` }} /></i></div>
    </section>

    <section className="portfolio-controls" aria-label="Busca e visualização de carteiras">
      <div className="portfolio-search"><SearchBar value={search} onChange={setSearch} placeholder="Carteira, titular ou CPF/CNPJ" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca de carteiras"><X aria-hidden="true" /></button>}</div>
      <span role="status">{rows.length} de {portfolios.length} {portfolios.length === 1 ? "carteira" : "carteiras"}</span>
      <div className="portfolio-view-switch" role="group" aria-label="Forma de visualização"><button type="button" aria-pressed={view === "cards"} aria-controls="portfolio-results" onClick={() => setView("cards")}><LayoutDashboard aria-hidden="true" />Cards</button><button type="button" aria-pressed={view === "table"} aria-controls="portfolio-results" onClick={() => setView("table")}><ClipboardList aria-hidden="true" />Tabela</button></div>
    </section>

    <div id="portfolio-results">
    {rows.length > 0 ? view === "cards" ? <section className="portfolio-card-grid" aria-label="Carteiras cadastradas">{rows.map((portfolio) => {
      const portfolioProperties = properties.filter((property) => property.portfolio === portfolio.name);
      const portfolioUnits = units.filter((unit) => unit.portfolio === portfolio.name);
      const portfolioOccupied = portfolioUnits.filter((unit) => unit.occupied).length;
      const portfolioOccupancy = portfolioUnits.length ? Math.round((portfolioOccupied / portfolioUnits.length) * 100) : 0;
      const monogram = portfolio.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
      const tone = portfolios.indexOf(portfolio) % 2 === 0 ? "atlas" : "horizon";

      return <article className={`portfolio-card portfolio-card-${tone}`} key={portfolio.id} aria-labelledby={`portfolio-title-${portfolio.id}`}>
        {portfolioProperties.length > 0 ? <div className={`portfolio-gallery portfolio-gallery-${Math.min(portfolioProperties.length, 3)}`}>
          {portfolioProperties.slice(0, 3).map((property) => <span key={property.id}><img src={propertyCoverImages[property.id] ?? fallbackPropertyCover} alt={`${property.name}, imóvel de ${portfolio.name}`} width="640" height="400" loading="lazy" /></span>)}
          <span className="portfolio-card-id">{portfolio.id}</span>
          <span className="portfolio-card-monogram" aria-hidden="true">{monogram}</span>
        </div> : <div className="portfolio-empty-cover"><span>{monogram}</span><strong>Carteira pronta para receber imóveis</strong><small>Cadastre um imóvel e vincule-o a esta carteira.</small></div>}

        <div className="portfolio-card-body">
          <header><h2 id={`portfolio-title-${portfolio.id}`}>{portfolio.name}</h2><button type="button" className="secondary-button portfolio-edit button-with-icon" aria-label={`Editar ${portfolio.name}`} onClick={() => onEdit(portfolio)}><PencilLine aria-hidden="true" />Editar</button></header>
          <div className="portfolio-holder"><span>Titular</span><strong>{portfolio.holder}</strong><small>{portfolio.document.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ"} · {portfolio.document}</small></div>
          <div className="portfolio-card-metrics">
            <span>Imóveis<strong>{portfolioProperties.length}</strong></span>
            <span>Unidades<strong>{portfolioUnits.length}</strong></span>
            <span>Ocupação<strong>{portfolioUnits.length ? `${portfolioOccupancy}%` : "—"}</strong></span>
          </div>
          <div className="portfolio-occupancy-row"><span><strong>{portfolioUnits.length ? `${portfolioOccupied} ocupadas` : "Sem unidades cadastradas"}</strong><small>{portfolioUnits.length > 0 && `${portfolioUnits.length - portfolioOccupied} disponíveis`}</small></span>{portfolioUnits.length > 0 && <i role="progressbar" aria-label={`Ocupação de ${portfolio.name}`} aria-valuenow={portfolioOccupancy} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${portfolioOccupied} de ${portfolioUnits.length} unidades ocupadas`}><b style={{ width: `${portfolioOccupancy}%` }} /></i>}</div>
          <div className="portfolio-property-list"><header><span>Imóveis vinculados</span>{portfolioProperties.length > 0 && <button type="button" onClick={() => onViewProperties(portfolio)} aria-label={`Ver imóveis de ${portfolio.name}`}>Ver imóveis <ArrowRight aria-hidden="true" /></button>}</header><div>{portfolioProperties.map((property) => <small key={property.id}>{property.name}</small>)}{portfolioProperties.length === 0 && <small>Nenhum imóvel vinculado</small>}</div></div>
        </div>
      </article>;
    })}</section> : <section className="portfolio-table-view" aria-labelledby="portfolio-table-title">
      <header><div><h2 id="portfolio-table-title">Visão cadastral</h2><p>Titulares e estrutura das carteiras, lado a lado.</p></div><small>Deslize para ver todas as colunas</small></header>
      <div className="portfolio-table-scroll" role="region" aria-label="Tabela de carteiras, com rolagem horizontal" tabIndex={0}><table className="compact-table"><caption className="sr-only">Carteiras, titulares, documentos e imóveis vinculados</caption><thead><tr><th scope="col">Carteira</th><th scope="col">Titular</th><th scope="col">CPF / CNPJ</th><th scope="col">Imóveis</th><th scope="col">Unidades</th><th scope="col">Ações</th></tr></thead><tbody>{rows.map((portfolio) => <tr key={portfolio.id}><td><strong>{portfolio.name}</strong><small>{portfolio.id}</small></td><td>{portfolio.holder}</td><td>{portfolio.document}</td><td>{properties.filter((property) => property.portfolio === portfolio.name).length}</td><td>{units.filter((unit) => unit.portfolio === portfolio.name).length}</td><td><button type="button" className="row-action" aria-label={`Editar ${portfolio.name}`} onClick={() => onEdit(portfolio)}>Editar</button></td></tr>)}</tbody></table></div>
    </section> : <div className="portfolio-empty-result"><EmptyState filtered={Boolean(query)} entity="carteira" mark="CA" tone="portfolio" eyebrow="Estrutura patrimonial" title="Comece organizando o patrimônio" description="Crie uma carteira para reunir titularidade, imóveis e indicadores de ocupação em uma visão consolidada." action="Nova carteira" onAction={onNew} onClear={() => setSearch("")} /></div>}
    </div>
  </div>;
}

function PropertiesPage({ properties, units, search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen }: { properties: Property[]; units: Unit[]; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (property: Property) => void }) {
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const query = normalizeSearch(search);
  const hasFilters = Boolean(query || portfolioFilter !== "Todas as carteiras");
  const clearFilters = () => { setSearch(""); setPortfolioFilter("Todas as carteiras"); };
  const rows = properties.filter((property) => normalizeSearch(`${property.name} ${property.address} ${property.id} ${property.portfolio}`).includes(query) && (portfolioFilter === "Todas as carteiras" || property.portfolio === portfolioFilter));
  const visibleUnits = units.filter((unit) => rows.some((property) => property.name === unit.property && property.portfolio === unit.portfolio));
  const occupiedUnits = visibleUnits.filter((unit) => unit.occupied).length;
  const availableUnits = visibleUnits.length - occupiedUnits;
  const occupancy = visibleUnits.length ? Math.round((occupiedUnits / visibleUnits.length) * 100) : 0;
  const visiblePortfolios = new Set(rows.map((property) => property.portfolio)).size;
  const [view, setView] = useState<"cards" | "table">("cards");

  return <div className="properties-page"><PageHeading eyebrow="Estrutura patrimonial" title="Imóveis" description="Explore os empreendimentos, consulte a ocupação e acesse os dados de cada imóvel." action="Novo imóvel" onAction={onNew} />
    <section className="property-insight-strip" aria-label="Resumo dos imóveis exibidos">
      <div className="property-insight-main"><span>{hasFilters ? "Resultado dos filtros" : "Patrimônio em foco"}</span><strong>{rows.length} {rows.length === 1 ? "imóvel" : "imóveis"}</strong><small>Em {visiblePortfolios} {visiblePortfolios === 1 ? "carteira" : "carteiras"}</small></div>
      <div><span>Unidades</span><strong>{visibleUnits.length}</strong><small>estrutura locável</small></div>
      <div className="property-insight-available"><span>Disponíveis</span><strong>{availableUnits}</strong><small>unidades livres</small></div>
      <div className="property-insight-occupancy"><span>Ocupação</span><strong>{visibleUnits.length ? `${occupancy}%` : "—"}</strong><small>{visibleUnits.length ? `${occupiedUnits} de ${visibleUnits.length} ocupadas` : "sem unidades"}</small><i aria-hidden="true"><b style={{ width: `${occupancy}%` }} /></i></div>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar imóvel, endereço ou ID" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><div className="property-toolbar-end">{hasFilters && <button type="button" className="property-clear-filters" onClick={clearFilters}><X aria-hidden="true" />Limpar filtros</button>}<div className="property-view-switch" role="group" aria-label="Forma de visualização"><button type="button" aria-pressed={view === "cards"} aria-controls="property-results" onClick={() => setView("cards")}><LayoutDashboard aria-hidden="true" />Cards</button><button type="button" aria-pressed={view === "table"} aria-controls="property-results" onClick={() => setView("table")}><ClipboardList aria-hidden="true" />Tabela</button></div></div></>} footer={<><span>{rows.length} de {properties.length} imóveis</span><span>Imagens ilustrativas</span></>}>
      <div id="property-results">
      {rows.length > 0 ? view === "cards" ? <div className="property-card-grid" aria-label="Imóveis cadastrados">{rows.map((property) => {
        const propertyUnits = units.filter((unit) => unit.property === property.name && unit.portfolio === property.portfolio);
        const propertyOccupied = propertyUnits.filter((unit) => unit.occupied).length;
        const propertyAvailable = propertyUnits.length - propertyOccupied;
        const propertyOccupancy = propertyUnits.length ? Math.round((propertyOccupied / propertyUnits.length) * 100) : 0;

        return <button type="button" className="property-card" key={property.id} onClick={() => onOpen(property)} aria-label={`Abrir detalhes de ${property.name}. ${propertyUnits.length ? `Ocupação de ${propertyOccupancy}%` : "Sem unidades cadastradas"}`}>
          <span className="property-card-media">
            <img src={propertyCoverImages[property.id] ?? fallbackPropertyCover} alt={`Fachada ilustrativa de ${property.name}`} width="640" height="400" loading="lazy" />
            <span className="property-card-id">{property.id}</span>
            <span className={`property-card-availability ${!propertyUnits.length ? "property-card-no-units" : propertyAvailable === 0 ? "property-card-full" : ""}`}>{!propertyUnits.length ? "Sem unidades" : propertyAvailable === 0 ? "Ocupação total" : `${propertyAvailable} ${propertyAvailable === 1 ? "disponível" : "disponíveis"}`}</span>
          </span>
          <span className="property-card-body">
            <strong>{property.name}</strong>
            <span className="property-card-address"><i aria-hidden="true" />{property.address}</span>
            <span className="property-card-meta">
              <b>{property.portfolio}</b>
              <span>{propertyUnits.length} {propertyUnits.length === 1 ? "unidade" : "unidades"}</span>
            </span>
            <span className="property-card-occupancy">
              <span><strong>{propertyUnits.length ? `${propertyOccupancy}% de ocupação` : "Ocupação não calculada"}</strong><small>{propertyUnits.length ? `${propertyOccupied} de ${propertyUnits.length} ${propertyUnits.length === 1 ? "unidade ocupada" : "unidades ocupadas"}` : "Cadastre as unidades do imóvel"}</small></span>
              <i aria-hidden="true"><b style={{ width: `${propertyOccupancy}%` }} /></i>
            </span>
            <span className="property-card-link">Ver detalhes <ArrowRight aria-hidden="true" /></span>
          </span>
        </button>;
      })}</div> : <table className="compact-table properties-table">
        <caption className="sr-only">Imóveis cadastrados: endereço, carteira, unidades vinculadas e ocupação</caption>
        <thead><tr><th scope="col">Imóvel</th><th scope="col">Endereço</th><th scope="col">Carteira</th><th scope="col">Unidades</th><th scope="col">Ocupação</th><th scope="col">Ações</th></tr></thead>
        <tbody>{rows.map((property) => {
          const propertyUnits = units.filter((unit) => unit.property === property.name && unit.portfolio === property.portfolio);
          const propertyOccupied = propertyUnits.filter((unit) => unit.occupied).length;
          const propertyOccupancy = propertyUnits.length ? Math.round((propertyOccupied / propertyUnits.length) * 100) : 0;
          return <tr key={property.id}>
            <td className="properties-table-name"><strong>{property.name}</strong><small>{property.id}</small></td>
            <td>{property.address}</td>
            <td>{property.portfolio}</td>
            <td>{propertyUnits.length}</td>
            <td className="properties-table-occupancy">{propertyUnits.length ? `${propertyOccupancy}%` : "—"}</td>
            <td><button type="button" className="row-action" onClick={() => onOpen(property)} aria-label={`Ver detalhes de ${property.name}`}>Ver detalhes</button></td>
          </tr>;
        })}</tbody>
      </table> : <EmptyState filtered={Boolean(search.trim() || portfolioFilter !== "Todas as carteiras")} entity="imóvel" mark="IM" tone="property" eyebrow="Ativo imobiliário" title="Dê forma visual ao patrimônio" description="Cadastre o primeiro empreendimento para organizar localização, imagens, documentos e unidades vinculadas." action="Novo imóvel" onAction={onNew} onClear={() => { setSearch(""); setPortfolioFilter("Todas as carteiras"); }} />}
      </div>
    </TableSection>
  </div>;
}

function UnitsPage({ units, properties, search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen, onEdit }: { units: Unit[]; properties: Property[]; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (unit: Unit) => void; onEdit: (unit: Unit) => void }) {
  const [availabilityFilter, setAvailabilityFilter] = useState("Todas");
  const [view, setView] = useState<"cards" | "table">("cards");
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const query = normalizeSearch(search);
  const hasFilters = Boolean(query || portfolioFilter !== "Todas as carteiras" || availabilityFilter !== "Todas");
  const clearFilters = () => { setSearch(""); setPortfolioFilter("Todas as carteiras"); setAvailabilityFilter("Todas"); };
  const rows = units.filter((unit) => normalizeSearch(`${unit.name} ${unit.property} ${unit.id} ${unit.portfolio} ${unit.code ?? ""}`).includes(query) && (portfolioFilter === "Todas as carteiras" || unit.portfolio === portfolioFilter) && (availabilityFilter === "Todas" || (availabilityFilter === "Ocupadas" ? unit.occupied : !unit.occupied)));
  const occupiedUnits = rows.filter((unit) => unit.occupied).length;
  const availableUnits = rows.length - occupiedUnits;
  const occupancy = rows.length ? Math.round((occupiedUnits / rows.length) * 100) : 0;
  const totalArea = rows.reduce((total, unit) => total + unit.area, 0);
  const visibleProperties = new Set(rows.map((unit) => JSON.stringify([unit.portfolio, unit.property]))).size;

  return <div className="units-page"><PageHeading eyebrow="Estrutura locável" title="Unidades" description="Consulte os espaços disponíveis, suas áreas e os vínculos com cada imóvel." action="Nova unidade" onAction={onNew} />
    <section className="unit-overview" aria-label="Resumo das unidades exibidas">
      <div className="unit-overview-intro"><span>{hasFilters ? "Resultado dos filtros" : "Mapa de disponibilidade"}</span><strong>{rows.length} {rows.length === 1 ? "unidade" : "unidades"}</strong><small>Em {visibleProperties} {visibleProperties === 1 ? "imóvel" : "imóveis"}</small></div>
      <div><span>Área privativa</span><strong className="unit-overview-area"><b>{decimal.format(totalArea)}</b> <em>m²</em></strong><small>soma das unidades</small></div>
      <div className="unit-overview-available"><span>Disponíveis</span><strong>{availableUnits}</strong><small>unidades livres</small></div>
      <div className="unit-overview-occupancy"><span>Ocupação</span><strong>{rows.length ? `${occupancy}%` : "—"}</strong><small>{rows.length ? `${occupiedUnits} ${occupiedUnits === 1 ? "ocupada" : "ocupadas"}` : "sem unidades"}</small><i aria-hidden="true"><b style={{ width: `${occupancy}%` }} /></i></div>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar unidade, imóvel ou ID" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><label className="unit-availability-filter"><span className="sr-only">Filtrar por situação</span><select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}><option value="Todas">Todas as situações</option><option>Disponíveis</option><option>Ocupadas</option></select></label><div className="unit-toolbar-end">{hasFilters && <button type="button" className="unit-clear-filters" onClick={clearFilters}><X aria-hidden="true" />Limpar filtros</button>}<div className="unit-view-switch" role="group" aria-label="Forma de visualização"><button type="button" aria-pressed={view === "cards"} aria-controls="unit-results" onClick={() => setView("cards")}><LayoutDashboard aria-hidden="true" />Cards</button><button type="button" aria-pressed={view === "table"} aria-controls="unit-results" onClick={() => setView("table")}><ClipboardList aria-hidden="true" />Tabela</button></div></div></>} footer={<><span>{rows.length} de {units.length} unidades</span><span>Imagens ilustrativas dos imóveis</span></>}>
      <div id="unit-results">
      {rows.length > 0 ? view === "cards" ? <div className="unit-card-grid" aria-label="Unidades cadastradas">{rows.map((unit) => {
        const property = properties.find((record) => record.name === unit.property && record.portfolio === unit.portfolio);
        const propertyImage = property ? propertyCoverImages[property.id] : undefined;

        return <article className={`unit-card ${unit.occupied ? "unit-card-occupied" : "unit-card-available"}`} key={unit.id}>
          <button type="button" className="unit-card-open" onClick={() => onOpen(unit)} aria-label={`Abrir detalhes de ${unit.name} em ${unit.property}, ${unit.occupied ? "ocupada" : "disponível"}`}>
            <span className="unit-card-media">
              <img src={propertyImage ?? fallbackPropertyCover} alt="" width="520" height="260" loading="lazy" />
              <span className="unit-card-id">{unit.id}</span>
              <span className={`unit-status ${unit.occupied ? "occupied" : "available"}`}>{unit.occupied ? "Ocupada" : "Disponível"}</span>
            </span>
            <span className="unit-card-body">
              <span className="unit-card-property">{unit.property}</span>
              <strong>{unit.name}</strong>
              <span className="unit-card-metrics">
                <span><small>Área privativa</small><b>{decimal.format(unit.area)} m²</b></span>
                <span><small>Carteira</small><b>{unit.portfolio}</b></span>
              </span>
            </span>
          </button>
          <footer><button type="button" className="unit-card-detail" onClick={() => onOpen(unit)} aria-label={`Ver detalhes de ${unit.name} em ${unit.property}`}>Ver detalhes <ArrowRight aria-hidden="true" /></button><button type="button" className="unit-card-edit" onClick={() => onEdit(unit)} aria-label={`Editar ${unit.name} em ${unit.property}`}><PencilLine aria-hidden="true" />Editar</button></footer>
        </article>;
      })}</div> : <table className="compact-table units-table">
        <caption className="sr-only">Unidades cadastradas: imóvel, carteira, área privativa e situação</caption>
        <thead><tr><th scope="col">Unidade</th><th scope="col">Imóvel</th><th scope="col">Carteira</th><th scope="col">Área privativa</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead>
        <tbody>{rows.map((unit) => <tr key={unit.id}>
          <td className="units-table-name"><strong>{unit.name}</strong><small>{unit.id}</small></td>
          <td>{unit.property}</td>
          <td>{unit.portfolio}</td>
          <td className="units-table-area">{decimal.format(unit.area)} m²</td>
          <td><span className={`unit-status ${unit.occupied ? "occupied" : "available"}`}>{unit.occupied ? "Ocupada" : "Disponível"}</span></td>
          <td><div className="units-table-actions"><button type="button" className="row-action" onClick={() => onOpen(unit)} aria-label={`Ver detalhes de ${unit.name} em ${unit.property}`}>Ver detalhes</button><button type="button" className="row-action row-action-quiet" onClick={() => onEdit(unit)} aria-label={`Editar ${unit.name} em ${unit.property}`}>Editar</button></div></td>
        </tr>)}</tbody>
      </table> : <EmptyState filtered={hasFilters} entity="unidade" mark="UN" tone="unit" eyebrow="Mapa de disponibilidade" title="Mapeie os espaços locáveis" description="Adicione unidades para visualizar metragem, ocupação e disponibilidade dentro de cada empreendimento." action="Nova unidade" onAction={onNew} onClear={clearFilters} />}
      </div>
    </TableSection>
  </div>;
}

function TenantsPage({ tenants, agencies, contracts, charges, search, setSearch, onNew, onNewAgency, onOpen, onEdit }: { tenants: Tenant[]; agencies: RealEstateAgency[]; contracts: Contract[]; charges: Charge[]; search: string; setSearch: (value: string) => void; onNew: () => void; onNewAgency: () => void; onOpen: (tenant: Tenant) => void; onEdit: (tenant: Tenant) => void }) {
  const [relationshipFilter, setRelationshipFilter] = useState("Todos");
  const [agencyFilter, setAgencyFilter] = useState("Todas as imobiliárias");
  const [agencyExpanded, setAgencyExpanded] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const query = normalizeSearch(search);
  const documentQuery = /^[\d.\/\-\s]+$/.test(query) ? documentDigits(query) : "";
  const hasFilters = Boolean(query || relationshipFilter !== "Todos" || agencyFilter !== "Todas as imobiliárias");
  const clearFilters = () => { setSearch(""); setRelationshipFilter("Todos"); setAgencyFilter("Todas as imobiliárias"); };
  const activeTenantNames = new Set(contracts.map((contract) => contract.tenant));
  const activeTenants = tenants.filter((tenant) => activeTenantNames.has(tenant.name));
  const unlinkedTenants = tenants.filter((tenant) => !activeTenantNames.has(tenant.name));
  const tenantsWithoutAgency = tenants.filter((tenant) => !tenant.responsibleAgencyId);
  const monthlyRevenue = contracts.reduce((total, contract) => total + contract.rent, 0);
  const rows = tenants.filter((tenant) => {
    const agency = agencies.find((record) => record.id === tenant.responsibleAgencyId);
    const matchesSearch = normalizeSearch(`${tenant.name} ${tenant.tradeName ?? ""} ${tenant.document} ${tenant.id} ${agency?.name ?? ""} ${agency?.tradeName ?? ""}`).includes(query) || Boolean(documentQuery && documentDigits(tenant.document).includes(documentQuery));
    const hasContract = activeTenantNames.has(tenant.name);
    const matchesRelationship = relationshipFilter === "Todos" || (relationshipFilter === "Com contrato" ? hasContract : !hasContract);
    const matchesAgency = agencyFilter === "Todas as imobiliárias" || (agencyFilter === "Sem imobiliária" ? !tenant.responsibleAgencyId : tenant.responsibleAgencyId === agencyFilter);
    return matchesSearch && matchesRelationship && matchesAgency;
  });
  const toggleRelationship = (filter: "Com contrato" | "Sem contrato") => setRelationshipFilter(relationshipFilter === filter ? "Todos" : filter);

  return <div className="tenants-page"><PageHeading eyebrow="Relacionamentos de locação" title="Locatários" description="Acompanhe vínculos, ocupação e situação financeira de cada relacionamento." action="Novo locatário" onAction={onNew} />
    <section className="tenant-overview" aria-label="Resumo dos locatários">
      <div className="tenant-overview-intro"><span>Base completa</span><strong>{tenants.length} {tenants.length === 1 ? "locatário" : "locatários"}</strong><small>total cadastrado</small></div>
      <div className="tenant-overview-revenue"><span>Aluguel contratado / mês</span><strong>{brl.format(monthlyRevenue)}</strong><small>todos os contratos ativos</small></div>
      <button type="button" className="tenant-overview-active" aria-pressed={relationshipFilter === "Com contrato"} onClick={() => toggleRelationship("Com contrato")}><span>Com contrato</span><strong>{activeTenants.length}</strong><small>{relationshipFilter === "Com contrato" ? "Filtro aplicado" : "Filtrar locatários"}</small><i aria-hidden="true"><CircleCheck /></i></button>
      <button type="button" className="tenant-overview-unlinked" aria-pressed={relationshipFilter === "Sem contrato"} onClick={() => toggleRelationship("Sem contrato")}><span>Sem contrato</span><strong>{unlinkedTenants.length}</strong><small>{relationshipFilter === "Sem contrato" ? "Filtro aplicado" : "Filtrar locatários"}</small><i aria-hidden="true"><Plus /></i></button>
    </section>
    <section className={`tenant-agency-hub ${tenantsWithoutAgency.length > 0 ? "tenant-agency-hub-alert" : ""}`} aria-labelledby="tenant-agency-title">
      <header><span className="tenant-agency-hub-icon" aria-hidden="true"><Building2 /></span><div><h2 id="tenant-agency-title">Imobiliárias responsáveis</h2><span>{agencies.length} {agencies.length === 1 ? "cadastrada" : "cadastradas"}{tenantsWithoutAgency.length > 0 ? ` · ${tenantsWithoutAgency.length} ${tenantsWithoutAgency.length === 1 ? "locatário sem responsável" : "locatários sem responsável"}` : " · todos os locatários vinculados"}</span></div><div className="tenant-agency-actions"><button type="button" className="secondary-button" aria-expanded={agencyExpanded} aria-controls="tenant-agency-list tenant-agency-summary" onClick={() => setAgencyExpanded(!agencyExpanded)}>{agencyExpanded ? "Recolher rede" : "Ver imobiliárias"}</button><button type="button" className="secondary-button button-with-icon" onClick={onNewAgency}><Plus aria-hidden="true" />Nova imobiliária</button></div></header>
      <div className="tenant-agency-grid" id="tenant-agency-list" hidden={!agencyExpanded}>{agencies.map((agency) => {
        const linkedTenants = tenants.filter((tenant) => tenant.responsibleAgencyId === agency.id);
        const selected = agencyFilter === agency.id;
        return <button type="button" className="tenant-agency-card" aria-pressed={selected} onClick={() => setAgencyFilter(selected ? "Todas as imobiliárias" : agency.id)} key={agency.id}><span className="tenant-agency-monogram" aria-hidden="true">{tenantInitials(agency.tradeName || agency.name)}</span><span className="tenant-agency-copy"><small>{agency.id} · {agency.creci}</small><strong>{agency.tradeName || agency.name}</strong><span>{agency.contactName} · {agency.phone || agency.email}</span></span><span className="tenant-agency-count"><strong>{linkedTenants.length}</strong><small>{linkedTenants.length === 1 ? "locatário" : "locatários"}</small></span></button>;
      })}</div>
      <footer id="tenant-agency-summary" hidden={!agencyExpanded}><span><CircleCheck aria-hidden="true" />{tenants.length - tenantsWithoutAgency.length} de {tenants.length} locatários possuem imobiliária responsável</span>{tenantsWithoutAgency.length > 0 && <button type="button" onClick={() => setAgencyFilter(agencyFilter === "Sem imobiliária" ? "Todas as imobiliárias" : "Sem imobiliária")} aria-pressed={agencyFilter === "Sem imobiliária"}><TriangleAlert aria-hidden="true" />{tenantsWithoutAgency.length} sem responsável</button>}</footer>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar nome, CPF/CNPJ ou ID" /><FilterSelect label="Filtrar por vínculo" value={relationshipFilter} onChange={setRelationshipFilter} active={relationshipFilter !== "Todos"}><option value="Todos">Todos os vínculos</option><option>Com contrato</option><option>Sem contrato</option></FilterSelect><FilterSelect label="Filtrar por imobiliária" value={agencyFilter} onChange={setAgencyFilter} active={agencyFilter !== "Todas as imobiliárias"}><option>Todas as imobiliárias</option>{agencies.map((agency) => <option value={agency.id} key={agency.id}>{agency.tradeName || agency.name}</option>)}<option>Sem imobiliária</option></FilterSelect><div className="tenant-toolbar-end">{hasFilters && <button type="button" className="tenant-clear-filters" onClick={clearFilters}><X aria-hidden="true" />Limpar filtros</button>}<div className="tenant-view-switch" role="group" aria-label="Forma de visualização"><button type="button" aria-pressed={view === "cards"} aria-controls="tenant-results" onClick={() => setView("cards")}><LayoutDashboard aria-hidden="true" />Cards</button><button type="button" aria-pressed={view === "table"} aria-controls="tenant-results" onClick={() => setView("table")}><ClipboardList aria-hidden="true" />Tabela</button></div></div></>} footer={<><span>{rows.length} de {tenants.length} locatários</span><span>{hasFilters ? "Resultados filtrados" : "Base completa"}</span></>}>
      <div id="tenant-results">
      {rows.length > 0 ? view === "cards" ? <div className="tenant-card-grid" aria-label="Locatários cadastrados">{rows.map((tenant) => {
        const tenantContracts = contracts.filter((contract) => contract.tenant === tenant.name);
        const tenantCharges = charges.filter((charge) => charge.tenant === tenant.name);
        const attentionCharges = tenantCharges.filter((charge) => charge.status === "Vencida" || charge.status === "Parcial");
        const openBalance = tenantCharges.filter((charge) => charge.status !== "Recebida").reduce((total, charge) => total + chargeBalance(charge), 0);
        const tenantRevenue = tenantContracts.reduce((total, contract) => total + contract.rent, 0);
        const mainContract = tenantContracts[0];
        const relationshipStatus = attentionCharges.length ? "Pendências" : !mainContract ? "Sem contrato" : "Ativo";
        const relationshipClass = attentionCharges.length ? "attention" : !mainContract ? "unlinked" : "active";
        const responsibleAgency = agencies.find((agency) => agency.id === tenant.responsibleAgencyId);

        return <article className={`tenant-card tenant-card-${relationshipClass}`} key={tenant.id}>
          <button type="button" className="tenant-card-open" onClick={() => onOpen(tenant)} aria-label={`Abrir detalhes de ${tenant.name}`}>
            <span className="tenant-card-head"><span className="tenant-card-avatar" aria-hidden="true">{tenantInitials(tenant.name)}</span><span className="tenant-card-identity"><span><b>{tenant.type === "PJ" ? "Pessoa jurídica" : "Pessoa física"}</b><small>{tenant.id}</small></span><strong>{tenant.name}</strong><small>{tenant.document}</small></span><span className={`tenant-relationship-badge tenant-relationship-${relationshipClass}`}><i aria-hidden="true" />{relationshipStatus}</span></span>
            <span className={`tenant-card-agency ${responsibleAgency ? "" : "tenant-card-agency-missing"}`}><span aria-hidden="true"><Building2 /></span><span><small>Imobiliária responsável</small><strong>{responsibleAgency ? responsibleAgency.tradeName || responsibleAgency.name : "Não definida"}</strong></span>{responsibleAgency && <b>{responsibleAgency.creci}</b>}</span>
            {mainContract ? <>
              <span className="tenant-card-contract"><span><small>{tenantContracts.length > 1 ? `1 de ${tenantContracts.length} contratos` : "Contrato vigente"}</small><strong>{mainContract.id}</strong></span><span><small>Empreendimento</small><strong>{mainContract.property}</strong></span><span><small>{mainContract.units.length === 1 ? "Unidade" : "Unidades"}</small><strong>{mainContract.units.join(" · ")}</strong></span></span>
            </> : <span className="tenant-card-empty-link"><i aria-hidden="true"><Plus /></i><span><strong>Sem contrato ativo</strong><small>Cadastro pronto para um novo vínculo de locação.</small></span></span>}
            {(mainContract || tenantCharges.length > 0) && <span className="tenant-card-financial"><span><small>Aluguel contratado / mês</small><strong>{brl.format(tenantRevenue)}</strong></span><span><small>Saldo em aberto</small><strong className={attentionCharges.length ? "tenant-value-attention" : ""}>{brl.format(openBalance)}</strong></span><span><small>Cobranças</small><strong>{tenantCharges.length}</strong></span></span>}
          </button>
          <footer><span>{mainContract ? `${tenantContracts.length} ${tenantContracts.length === 1 ? "contrato ativo" : "contratos ativos"}` : "Sem contrato ativo"}</span><button type="button" className="tenant-card-edit" aria-label={`Editar cadastro de ${tenant.name}`} onClick={() => onEdit(tenant)}>Editar cadastro</button></footer>
        </article>;
      })}</div> : <table className="compact-table tenants-table">
        <caption className="sr-only">Locatários: tipo, imobiliária responsável, contrato, saldo em aberto e situação</caption>
        <thead><tr><th scope="col">Locatário</th><th scope="col">Tipo</th><th scope="col">Imobiliária</th><th scope="col">Contrato</th><th scope="col">Saldo em aberto</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead>
        <tbody>{rows.map((tenant) => {
          const tenantContracts = contracts.filter((contract) => contract.tenant === tenant.name);
          const tenantCharges = charges.filter((charge) => charge.tenant === tenant.name);
          const attentionCharges = tenantCharges.filter((charge) => charge.status === "Vencida" || charge.status === "Parcial");
          const openBalance = tenantCharges.filter((charge) => charge.status !== "Recebida").reduce((total, charge) => total + chargeBalance(charge), 0);
          const mainContract = tenantContracts[0];
          const responsibleAgency = agencies.find((agency) => agency.id === tenant.responsibleAgencyId);
          const relationshipStatus = attentionCharges.length ? "Pendências" : !mainContract ? "Sem contrato" : "Ativo";
          const relationshipClass = attentionCharges.length ? "attention" : !mainContract ? "unlinked" : "active";
          return <tr key={tenant.id}>
            <td className="tenants-table-name"><strong>{tenant.name}</strong><small>{tenant.id} · {tenant.document}</small></td>
            <td>{tenant.type === "PJ" ? "Pessoa jurídica" : "Pessoa física"}</td>
            <td>{responsibleAgency ? responsibleAgency.tradeName || responsibleAgency.name : "—"}</td>
            <td>{mainContract ? `${mainContract.id} · ${mainContract.property}` : "Sem contrato"}</td>
            <td className={`tenants-table-balance ${attentionCharges.length ? "tenant-value-attention" : ""}`}>{brl.format(openBalance)}</td>
            <td><span className={`tenant-relationship-badge tenant-relationship-${relationshipClass}`}><i aria-hidden="true" />{relationshipStatus}</span></td>
            <td><div className="tenants-table-actions"><button type="button" className="row-action" onClick={() => onOpen(tenant)} aria-label={`Ver detalhes de ${tenant.name}`}>Ver detalhes</button><button type="button" className="row-action row-action-quiet" onClick={() => onEdit(tenant)} aria-label={`Editar cadastro de ${tenant.name}`}>Editar</button></div></td>
          </tr>;
        })}</tbody>
      </table> : <EmptyState filtered={hasFilters} entity="locatário" mark="LO" tone="tenant" eyebrow="Base de relacionamentos" title="Cadastre o primeiro locatário" description="Construa uma base pronta para conectar pessoas e empresas aos contratos e à operação financeira." action="Novo locatário" onAction={onNew} onClear={clearFilters} />}
      </div>
    </TableSection>
  </div>;
}

function AgencyModal({ agencies, onClose, onSave }: { agencies: RealEstateAgency[]; onClose: () => void; onSave: (agency: Omit<RealEstateAgency, "id">) => void }) {
  const [document, setDocument] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const closeModal = () => { if (!saving) onClose(); };
  const { onFormChange, requestClose, discardDialog } = useDiscardGuard(closeModal, "Os dados desta imobiliária não serão salvos.");
  const validateDocument = (value: string) => {
    if (documentDigits(value).length !== 14) return "Informe um CNPJ completo.";
    if (!hasValidCnpj(value)) return "CNPJ inválido. Confira os dígitos.";
    return agencies.some((agency) => documentDigits(agency.document) === documentDigits(value)) ? "CNPJ já cadastrado para outra imobiliária." : "";
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextDocumentError = validateDocument(document);
    if (nextDocumentError) {
      setDocumentError(nextDocumentError);
      const documentField = event.currentTarget.elements.namedItem("agencyDocument");
      if (documentField instanceof HTMLElement) documentField.focus();
      return;
    }
    if (!String(data.get("agencyPhone") ?? "").trim() && !String(data.get("agencyEmail") ?? "").trim()) {
      setFormError("Informe ao menos um canal de contato da imobiliária.");
      return;
    }
    const invalidField = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")).find((field) => !field.checkValidity());
    if (invalidField) {
      setFormError("Revise os campos obrigatórios antes de salvar.");
      invalidField.focus();
      return;
    }
    setFormError("");
    setSaving(true);
    window.setTimeout(() => onSave({ name: String(data.get("agencyName") ?? "").trim(), tradeName: String(data.get("agencyTradeName") ?? "").trim(), document, creci: String(data.get("agencyCreci") ?? "").trim(), contactName: String(data.get("agencyContactName") ?? "").trim(), phone: String(data.get("agencyPhone") ?? "").trim(), email: String(data.get("agencyEmail") ?? "").trim(), notes: String(data.get("agencyNotes") ?? "").trim() }), 450);
  };

  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Nova imobiliária"><button type="button" className="drawer-backdrop" onClick={requestClose} aria-label="Fechar formulário" /><form className="receipt-modal entity-modal agency-modal" noValidate onSubmit={handleSubmit} onInputCapture={() => formError && setFormError("")} onChange={onFormChange}><header className="entity-form-hero"><span className="entity-form-mark" aria-hidden="true">IM</span><div><p>Rede de administração</p><h2>Nova imobiliária</h2><span>Cadastre a empresa que será responsável pelo relacionamento com locatários.</span></div><b>Novo cadastro</b><button type="button" className="close-button" onClick={requestClose} aria-label="Fechar formulário"><X aria-hidden="true" /></button></header><div className="entity-modal-body"><InlineFieldError message={formError} /><div className="form-grid entity-grid">
    <EntityFormSection index="01" title="Identificação da imobiliária" description="Use os dados jurídicos e comerciais que identificam a empresa."><label className="full-field">Razão social<input name="agencyName" placeholder="Ex.: Nexo Administração de Imóveis Ltda." required /></label><label>Nome fantasia<input name="agencyTradeName" placeholder="Ex.: Nexo Imóveis" /></label><label>CNPJ<input name="agencyDocument" inputMode="numeric" maxLength={18} value={document} onChange={(event) => { setDocument(maskTenantDocument(event.target.value, "PJ")); setDocumentError(""); }} onBlur={() => document && setDocumentError(validateDocument(document))} aria-invalid={documentError ? "true" : undefined} required /><small className={documentError ? "field-error" : "field-help"}>{documentError || "O CNPJ será validado contra duplicidades."}</small></label><label>Registro CRECI<input name="agencyCreci" placeholder="Ex.: CRECI-MG 12.345-J" required /></label></EntityFormSection>
    <EntityFormSection index="02" title="Contato responsável" description="Defina quem receberá as comunicações operacionais."><label className="full-field">Responsável na imobiliária<input name="agencyContactName" placeholder="Nome do contato principal" required /></label><label>Telefone / WhatsApp<input name="agencyPhone" type="tel" placeholder="(31) 99999-9999" /></label><label>E-mail<input name="agencyEmail" type="email" placeholder="atendimento@imobiliaria.com.br" /></label></EntityFormSection>
    <EntityFormSection index="03" title="Observações" description="Registre orientações úteis para a rotina de administração."><label className="full-field">Observações internas<textarea name="agencyNotes" rows={3} placeholder="Carteiras atendidas, horários ou instruções de contato" /></label></EntityFormSection>
  </div></div><footer className="entity-form-footer"><div><span aria-hidden="true"><Check /></span><p><strong>Cadastro independente</strong><small>A imobiliária ficará disponível no cadastro dos locatários.</small></p></div><button type="button" className="secondary-button" onClick={requestClose} disabled={saving}>Cancelar</button><button type="submit" className="primary-button button-with-icon" disabled={saving} aria-busy={saving}><Check aria-hidden="true" />{saving ? "Salvando…" : "Salvar imobiliária"}</button></footer></form>
    {discardDialog}
  </div>;
}

function ContractsPage({ contracts: contractOptions, charges, search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen }: { contracts: Contract[]; charges: Charge[]; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (contract: Contract) => void }) {
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const query = normalizeSearch(search);
  const hasFilters = Boolean(query || portfolioFilter !== "Todas as carteiras");
  const clearFilters = () => { setSearch(""); setPortfolioFilter("Todas as carteiras"); };
  const rows = contractOptions.filter((contract) => normalizeSearch(`${contract.id} ${contract.property} ${contract.tenant} ${contract.portfolio} ${contract.units.join(" ")}`).includes(query) && (portfolioFilter === "Todas as carteiras" || contract.portfolio === portfolioFilter));
  const monthlyRevenue = rows.reduce((total, contract) => total + contract.rent, 0);
  const linkedUnits = rows.reduce((total, contract) => total + contract.units.length, 0);
  const visibleContractIds = new Set(rows.map((contract) => contract.id));
  const generatedCharges = charges.filter((charge) => visibleContractIds.has(charge.contract)).length;
  const [view, setView] = useState<"cards" | "table">("cards");

  return <div className="contracts-page"><PageHeading eyebrow="Locações" title="Contratos" description="Consulte vigências, unidades locadas e condições de cada contrato." action="Novo contrato" onAction={onNew} />
    <section className="contract-overview" aria-label="Resumo dos contratos exibidos">
      <div className="contract-overview-intro"><span>{hasFilters ? "Resultado dos filtros" : "Carteira contratual"}</span><strong>{rows.length} {rows.length === 1 ? "contrato" : "contratos"}</strong><small>{hasFilters ? "nesta seleção" : "nesta base"}</small></div>
      <div className="contract-overview-rent"><span>Aluguel contratado / mês</span><strong>{brl.format(monthlyRevenue)}</strong><small>sem encargos adicionais</small></div>
      <div><span>Unidades</span><strong>{linkedUnits}</strong><small>vinculadas aos contratos</small></div>
      <div className="contract-overview-billing"><span>Cobranças</span><strong>{generatedCharges}</strong><small>lançamentos cadastrados</small></div>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar contrato, imóvel ou locatário" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><div className="contract-toolbar-end">{hasFilters && <button type="button" className="contract-clear-filters" onClick={clearFilters}><X aria-hidden="true" />Limpar filtros</button>}<div className="contract-view-switch" role="group" aria-label="Forma de visualização"><button type="button" aria-pressed={view === "cards"} aria-controls="contract-results" onClick={() => setView("cards")}><LayoutDashboard aria-hidden="true" />Cards</button><button type="button" aria-pressed={view === "table"} aria-controls="contract-results" onClick={() => setView("table")}><ClipboardList aria-hidden="true" />Tabela</button></div></div></>} footer={<><span>{rows.length} de {contractOptions.length} contratos</span><span>{hasFilters ? "Resultados filtrados" : "Base completa"}</span></>}>
      <div id="contract-results">
      {rows.length > 0 ? view === "cards" ? <div className="contract-card-grid" aria-label="Contratos ativos">{rows.map((contract) => {
        const term = contractTermInfo(contract.period);
        const contractCharges = charges.filter((charge) => charge.contract === contract.id).length;

        return <button type="button" className="contract-card" key={contract.id} onClick={() => onOpen(contract)} aria-label={`Abrir ${contract.id}, contrato de ${contract.tenant}`}>
          <span className="contract-card-accent" aria-hidden="true" />
          <span className="contract-card-head"><span><b>{contract.id}</b><small>{contract.portfolio}</small></span><span className={`contract-active-badge contract-badge-${term.tone}`}>{contractTermBadgeLabel(term)}</span></span>
          <span className="contract-card-tenant"><small>Locatário</small><strong>{contract.tenant}</strong><span>{contract.property}</span></span>
          <span className="contract-card-units"><small>{contract.units.length} {contract.units.length === 1 ? "unidade vinculada" : "unidades vinculadas"}</small><span>{contract.units.map((unit) => <b key={unit}>{unit}</b>)}</span></span>
          <span className="contract-card-value"><span><small>Aluguel base / mês</small><strong>{brl.format(contract.rent)}</strong></span><span><small>Vencimento</small><strong>Dia {contract.due}</strong></span></span>
          <span className="contract-card-period"><span className="contract-card-period-start"><small>Desde</small><b>{term.startLabel || "Não informado"}</b></span><span className={`contract-card-period-end contract-term-${term.tone}`}><small>Vigência até</small><b>{term.endLabel}</b></span></span>
          <span className="contract-card-billing">{contractCharges} {contractCharges === 1 ? "cobrança vinculada" : "cobranças vinculadas"} · {contract.adjustmentIndex === "Sem reajuste" ? "Sem reajuste" : `Reajuste: ${contract.adjustment}`}</span>
          <span className="contract-card-footer"><span>Ver detalhes</span><ArrowRight aria-hidden="true" /></span>
        </button>;
      })}</div> : <table className="compact-table contracts-table">
        <caption className="sr-only">Contratos: locatário, imóvel, unidades vinculadas, aluguel e vigência</caption>
        <thead><tr><th scope="col">Contrato</th><th scope="col">Locatário</th><th scope="col">Unidades</th><th scope="col">Aluguel / mês</th><th scope="col">Vigência</th><th scope="col">Ações</th></tr></thead>
        <tbody>{rows.map((contract) => {
          const term = contractTermInfo(contract.period);
          return <tr key={contract.id}>
            <td className="contracts-table-id"><strong>{contract.id}</strong><small>{contract.portfolio}</small></td>
            <td className="contracts-table-tenant"><strong>{contract.tenant}</strong><small>{contract.property}</small></td>
            <td>{contract.units.length}</td>
            <td className="contracts-table-rent">{brl.format(contract.rent)}</td>
            <td className={`contracts-table-term contract-term-${term.tone}`}><strong>{term.endShort}</strong>{term.monthsLeft !== null && <small>{contractTermBadgeLabel(term)}</small>}</td>
            <td><button type="button" className="row-action" onClick={() => onOpen(contract)} aria-label={`Ver detalhes do contrato ${contract.id}`}>Ver detalhes</button></td>
          </tr>;
        })}</tbody>
      </table> : <EmptyState filtered={hasFilters} entity="contrato" mark="CT" tone="contract" eyebrow="Instrumento de locação" title="Conecte patrimônio e locatário" description="Crie o primeiro contrato para definir unidades, vigência, valores e a composição das futuras cobranças." action="Novo contrato" onAction={onNew} onClear={clearFilters} />}
      </div>
    </TableSection>
    <InfoNote text="Os itens e valores ficam previstos no contrato, enquanto cada competência continua sendo incluída manualmente em Cobranças." />
  </div>;
}

function InfoNote({ text }: { text: string }) { return <aside className="info-note"><span>i</span><p>{text}</p></aside>; }

function RegistryDetailDrawer({ detail, properties, units, contracts, charges, documents, categorizedDocuments, onCategorizedDocumentsChange, onClose, onEdit }: { detail: RegistryDetail; properties: Property[]; units: Unit[]; contracts: Contract[]; charges: Charge[]; documents: LocalDocument[]; categorizedDocuments?: CategorizedDocuments; onCategorizedDocumentsChange: (documents: CategorizedDocuments) => void; onClose: () => void; onEdit: () => void }) {
  let eyebrow = "Detalhes do cadastro";
  const title = detail.record.name;
  let fields: Array<{ label: string; value: ReactNode }>;
  const propertyUnits = detail.kind === "property" ? units.filter((unit) => unit.property === detail.record.name && unit.portfolio === detail.record.portfolio) : [];
  const propertyOccupied = propertyUnits.filter((unit) => unit.occupied).length;
  const propertyAvailable = propertyUnits.length - propertyOccupied;
  const propertyOccupancy = propertyUnits.length ? Math.round((propertyOccupied / propertyUnits.length) * 100) : 0;
  const unitProperty = detail.kind === "unit" ? properties.find((property) => property.name === detail.record.property && property.portfolio === detail.record.portfolio) : undefined;
  const unitContract = detail.kind === "unit" ? contracts.find((contract) => contract.property === detail.record.property && contract.portfolio === detail.record.portfolio && contract.units.includes(detail.record.name)) : undefined;
  const tenantContracts = detail.kind === "tenant" ? contracts.filter((contract) => contract.tenant === detail.record.name) : [];
  const tenantCharges = detail.kind === "tenant" ? charges.filter((charge) => charge.tenant === detail.record.name) : [];
  const tenantMonthlyRevenue = tenantContracts.reduce((total, contract) => total + contract.rent, 0);
  const tenantLinkedUnits = tenantContracts.reduce((total, contract) => total + contract.units.length, 0);
  const tenantOpenCharges = tenantCharges.filter((charge) => charge.status !== "Recebida");
  const tenantOpenBalance = tenantOpenCharges.reduce((total, charge) => total + chargeBalance(charge), 0);
  const tenantAttentionCharges = tenantCharges.filter((charge) => charge.status === "Vencida" || charge.status === "Parcial");

  if (detail.kind === "property") {
    eyebrow = "Detalhes do imóvel";
    fields = [
      { label: "Tipo de imóvel", value: detail.record.propertyType || "Não informado" },
      { label: "Gestor responsável", value: detail.record.manager || "Não definido" },
      { label: "Inscrição municipal", value: detail.record.municipalRegistration || "Não informada" },
      { label: "Matrícula", value: detail.record.registryNumber || "Não informada" },
      { label: "Cartório", value: detail.record.registryOffice || "Não informado" },
      { label: "Observações", value: detail.record.notes || "Nenhuma observação" },
    ];
  } else if (detail.kind === "unit") {
    eyebrow = "Detalhes da unidade";
    fields = [
      { label: "Tipo", value: detail.record.unitType || "Não informado" },
      { label: "Código", value: detail.record.code || detail.record.name },
      { label: "Bloco / pavimento", value: [detail.record.block, detail.record.floor].filter(Boolean).join(" · ") || "Não informado" },
      { label: "Área total", value: detail.record.totalArea ? `${decimal.format(detail.record.totalArea)} m²` : "Não informada" },
      { label: "Inscrição municipal", value: detail.record.municipalRegistration || "Não informada" },
      { label: "Observações", value: detail.record.notes || "Nenhuma observação" },
    ];
  } else {
    eyebrow = "Detalhes do locatário";
    fields = [
      { label: detail.record.type === "PJ" ? "CNPJ" : "CPF", value: detail.record.document },
      ...(detail.record.type === "PJ" ? [{ label: "Nome fantasia", value: detail.record.tradeName || "Não informado" }] : []),
      { label: "Contato", value: detail.record.contactName || "Não informado" },
      { label: "Telefone / WhatsApp", value: detail.record.phone || "Não informado" },
      { label: "E-mail", value: detail.record.email || "Não informado" },
      { label: "Canal preferencial", value: detail.record.preferredChannel || "Não definido" },
      { label: "Endereço de cobrança", value: detail.record.billingAddress || "Não informado" },
      { label: "Observações internas", value: detail.record.notes || "Nenhuma observação" },
    ];
  }

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${eyebrow}: ${title}`}><button type="button" className="drawer-backdrop" onClick={onClose} /><aside className={`drawer wide-drawer registry-detail-drawer ${detail.kind === "property" ? "property-detail-drawer" : detail.kind === "unit" ? "unit-detail-drawer" : "tenant-detail-drawer"}`}>{detail.kind === "property" ? <header className="property-detail-hero">
    <img src={propertyCoverImages[detail.record.id] ?? fallbackPropertyCover} alt={`Fachada ilustrativa de ${detail.record.name}`} width="800" height="520" />
    <div className="property-detail-hero-top"><div><p className="eyebrow eyebrow-light">Detalhes do imóvel</p><small>Imagem ilustrativa</small></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
    <div className="property-detail-hero-copy"><span>{detail.record.id}</span><h2 title={detail.record.name}>{detail.record.name}</h2><p title={detail.record.address}>{detail.record.address}</p></div>
  </header> : detail.kind === "unit" ? <header className="unit-detail-hero">
    <img src={(unitProperty && propertyCoverImages[unitProperty.id]) ?? fallbackPropertyCover} alt="" width="800" height="480" />
    <div className="property-detail-hero-top"><div><p className="eyebrow eyebrow-light">Detalhes da unidade</p><small>Imagem ilustrativa do imóvel</small></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
    <div className="property-detail-hero-copy unit-detail-hero-copy"><div><span>{detail.record.id}</span><span className={`unit-detail-hero-status ${detail.record.occupied ? "occupied" : "available"}`}>{detail.record.occupied ? "Ocupada" : "Disponível"}</span></div><h2 title={detail.record.name}>{detail.record.name}</h2><p title={detail.record.property}>{detail.record.property}</p></div>
  </header> : <header className={`tenant-detail-hero ${tenantContracts.length ? tenantAttentionCharges.length ? "tenant-detail-hero-attention" : "tenant-detail-hero-active" : "tenant-detail-hero-unlinked"}`}>
    <div className="tenant-detail-hero-top"><p className="eyebrow eyebrow-light">Relacionamento de locação</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
    <div className="tenant-detail-hero-copy"><span className="tenant-detail-avatar" aria-hidden="true">{tenantInitials(detail.record.name)}</span><div><span>{detail.record.id} · {detail.record.type === "PJ" ? "Pessoa jurídica" : "Pessoa física"}</span><h2 title={detail.record.name}>{detail.record.name}</h2><p>{tenantContracts.length ? `${tenantContracts.length} ${tenantContracts.length === 1 ? "contrato ativo" : "contratos ativos"} · ${tenantLinkedUnits} ${tenantLinkedUnits === 1 ? "unidade vinculada" : "unidades vinculadas"}` : "Cadastro disponível para novo vínculo"}</p></div></div>
    <i className="tenant-detail-status" aria-hidden="true">{tenantContracts.length ? tenantAttentionCharges.length ? "!" : "✓" : "+"}</i>
  </header>}<div className="drawer-body">
    {detail.kind === "property" && <section className="property-detail-summary" aria-label={`Ocupação de ${detail.record.name}`}>
      <div><span>Carteira</span><strong title={detail.record.portfolio}>{detail.record.portfolio}</strong></div>
      <div><span>Unidades</span><strong>{propertyUnits.length}</strong></div>
      <div><span>Ocupadas</span><strong>{propertyOccupied}</strong></div>
      <div className="property-detail-availability"><span>Disponíveis</span><strong>{propertyAvailable}</strong></div>
      <div className="property-detail-progress"><span><strong>{propertyUnits.length ? `${propertyOccupancy}% de ocupação` : "Ocupação não calculada"}</strong><small>{!propertyUnits.length ? "Este imóvel ainda não possui unidades cadastradas." : propertyAvailable ? `${propertyAvailable} ${propertyAvailable === 1 ? "unidade disponível" : "unidades disponíveis"}` : "Empreendimento totalmente ocupado"}</small></span><i role="progressbar" aria-label="Ocupação do imóvel" aria-valuemin={0} aria-valuemax={100} aria-valuenow={propertyUnits.length ? propertyOccupancy : undefined} aria-valuetext={propertyUnits.length ? `${propertyOccupancy}%` : "Sem unidades cadastradas"}><b style={{ width: `${propertyOccupancy}%` }} /></i></div>
    </section>}
    {detail.kind === "unit" && <>
      <section className="unit-detail-summary" aria-label={`Resumo de ${detail.record.name}`}>
        <div className={detail.record.occupied ? "unit-detail-occupied" : "unit-detail-available"}><span>Situação atual</span><strong>{detail.record.occupied ? "Ocupada" : "Disponível"}</strong><small>{detail.record.occupied ? "espaço em utilização" : "pronta para locação"}</small></div>
        <div><span>Área privativa</span><strong>{decimal.format(detail.record.area)} <small>m²</small></strong><small>metragem cadastrada</small></div>
        <div><span>Empreendimento</span><strong title={detail.record.property}>{detail.record.property}</strong><small title={unitProperty?.address ?? "Endereço não informado"}>{unitProperty?.address ?? "Endereço não informado"}</small></div>
        <div><span>Carteira</span><strong title={detail.record.portfolio}>{detail.record.portfolio}</strong><small>vínculo patrimonial</small></div>
      </section>
      {unitContract ? <section className="unit-current-lease" aria-label={`Locação vigente ${unitContract.id}`}>
        <header><span>Locação vigente</span><b>{unitContract.id}</b></header>
        <div><span>Locatário<strong>{unitContract.tenant}</strong></span><span>Aluguel do contrato / mês<strong>{brl.format(unitContract.rent)}</strong></span></div>
        {unitContract.units.length > 1 && <p className="unit-contract-scope">Valor total do contrato, que abrange {unitContract.units.length} unidades: {unitContract.units.join(", ")}. Não representa o aluguel individual desta unidade.</p>}
        <footer><span>{unitContract.period}</span><span>Vencimento no dia {unitContract.due}</span></footer>
      </section> : <aside className="unit-availability-note"><span aria-hidden="true">{detail.record.occupied ? <Info /> : <Plus />}</span><div><strong>{detail.record.occupied ? "Ocupada no cadastro" : "Disponível para nova locação"}</strong><p>{detail.record.occupied ? "Nenhum contrato vinculado a esta unidade foi localizado nesta base." : "Esta unidade pode ser selecionada ao cadastrar um novo contrato."}</p></div></aside>}
      <div className="unit-detail-section-title"><span>Dados cadastrais</span><small>Informações estruturais da unidade</small></div>
    </>}
    {detail.kind === "tenant" && <>
      <section className="tenant-detail-summary" aria-label={`Resumo do relacionamento com ${detail.record.name}`}>
        <div className="tenant-detail-revenue"><span>Aluguel contratado / mês</span><strong>{brl.format(tenantMonthlyRevenue)}</strong><small>soma dos contratos ativos</small></div>
        <div><span>Contratos ativos</span><strong>{tenantContracts.length}</strong><small>{tenantContracts.length ? "vínculos em andamento" : "sem vínculo vigente"}</small></div>
        <div><span>Unidades vinculadas</span><strong>{tenantLinkedUnits}</strong><small>espaços ocupados</small></div>
        <div className={tenantAttentionCharges.length ? "tenant-detail-attention" : ""}><span>Saldo em aberto</span><strong>{brl.format(tenantOpenBalance)}</strong><small>{tenantAttentionCharges.length ? `${tenantAttentionCharges.length} ${tenantAttentionCharges.length === 1 ? "cobrança exige" : "cobranças exigem"} atenção` : `${tenantOpenCharges.length} ${tenantOpenCharges.length === 1 ? "cobrança aberta" : "cobranças abertas"}`}</small></div>
      </section>
      {tenantContracts.length ? <section className="tenant-contract-panel" aria-labelledby="tenant-contracts-title"><header><div><span>Relacionamentos ativos</span><h3 id="tenant-contracts-title">Contratos e ocupação</h3></div><b>{tenantContracts.length}</b></header><div>{tenantContracts.map((contract) => <article key={contract.id}><span className="tenant-contract-id"><small>Contrato</small><strong>{contract.id}</strong></span><span><small>Empreendimento</small><strong title={contract.property}>{contract.property}</strong></span><span><small>Aluguel base</small><strong>{brl.format(contract.rent)}</strong></span><footer><span>{contract.units.join(" · ")}</span><span>Vence dia {contract.due}</span></footer></article>)}</div></section> : <aside className="tenant-unlinked-note"><span aria-hidden="true"><Plus /></span><div><strong>Pronto para um novo contrato</strong><p>Este locatário está cadastrado, mas ainda não possui uma unidade vinculada.</p></div></aside>}
      <section className="tenant-financial-panel" aria-labelledby="tenant-financial-title"><header><div><span>Saúde financeira</span><h3 id="tenant-financial-title">Cobranças do relacionamento</h3></div><b className={tenantAttentionCharges.length ? "has-attention" : ""}>{tenantAttentionCharges.length ? "Requer atenção" : tenantCharges.length ? "Sem atrasos" : "Sem histórico"}</b></header>{tenantCharges.length ? <><p className="tenant-balance-caption">{tenantCharges.length} {tenantCharges.length === 1 ? "cobrança" : "cobranças"} · valores representam o saldo a receber</p><div>{tenantCharges.map((charge) => <span key={charge.id}><StatusBadge status={charge.status} /><strong>{charge.id}</strong><small>{charge.competence}</small><b>{brl.format(chargeBalance(charge))}</b></span>)}</div></> : <CompactEmptyState mark="CO" tone="tenant" title="Relacionamento sem histórico financeiro" description="As cobranças vinculadas a este locatário aparecerão aqui por competência." />}</section>
      <div className="tenant-detail-section-title"><span>Dados cadastrais</span><small>Identificação do relacionamento</small></div>
    </>}
    {detail.kind === "property" && <h3 className="property-data-heading">Dados cadastrais</h3>}
    <dl className="detail-list registry-detail-list">{fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
    {categorizedDocuments ? <CategorizedDocumentManager documents={categorizedDocuments} onChange={onCategorizedDocumentsChange} /> : <section className="registry-documents" aria-labelledby="registry-documents-title"><div className="section-title"><h3 id="registry-documents-title">Documentos e imagens</h3><span>{documents.length ? `${documents.length} ${documents.length === 1 ? "anexo" : "anexos"}` : "Sem anexos"}</span></div><DocumentCollection documents={documents} emptyDescription="Nenhuma imagem ou arquivo foi anexado a este registro nesta sessão." /></section>}
  </div><footer className={`drawer-footer ${detail.kind === "tenant" ? "tenant-detail-footer" : ""}`}><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button button-with-icon" onClick={onEdit}><PencilLine aria-hidden="true" />Editar cadastro</button></footer></aside></div>;
}

function ChargeDrawer({ charge, negotiation, receipts, onClose, onReceipt, onNegotiate }: { charge: Charge; negotiation?: ChargeNegotiation; receipts: ReceiptDraft[]; onClose: () => void; onReceipt: () => void; onNegotiate: () => void }) {
  const lastInstallment = negotiation?.schedule.at(-1);
  const totalValue = chargeTotal(charge);
  const receivedValue = receivedTotal(charge);
  const balanceValue = operationalChargeBalance(charge, negotiation);
  const receivedRate = totalValue ? Math.min(100, Math.round((receivedValue / totalValue) * 100)) : 0;
  const statusName = charge.status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(" ", "-");

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Detalhes da cobrança ${charge.id}`}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer wide-drawer charge-detail-drawer">
    <header className={`charge-detail-hero charge-detail-hero-${statusName}`}>
      <div className="charge-detail-hero-top"><p className="eyebrow eyebrow-light">Cobrança {charge.id}</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
      <div className="charge-detail-hero-copy"><div><StatusBadge status={charge.status} /><span>{charge.competence}</span></div><h2 title={charge.tenant}>{charge.tenant}</h2><p title={`${charge.contract} · ${charge.property}`}>{charge.contract} · {charge.property}</p></div>
      <i className="charge-detail-orbit" aria-hidden="true">R$</i>
    </header>
    <div className="drawer-body">
    <section className="charge-detail-summary" aria-label={`Resumo financeiro de ${charge.id}`}>
      <div><span>Total previsto</span><strong>{brl.format(totalValue)}</strong><small>{charge.items.length} {charge.items.length === 1 ? "item lançado" : "itens lançados"}</small></div>
      <div className="charge-detail-received"><span>Recebido</span><strong>{brl.format(receivedValue)}</strong><small>{receivedRate}% do total</small></div>
      <div className="charge-detail-balance"><span>{negotiation ? "Saldo acordado" : "Saldo atual"}</span><strong>{brl.format(balanceValue)}</strong><small>{negotiation ? "valor da negociação" : "a receber"}</small></div>
      <div className="charge-detail-progress"><span><b>{receivedRate}% recebido</b><small>{charge.status === "Recebida" ? "Cobrança integralmente quitada" : "Progresso das baixas registradas"}</small></span><i aria-hidden="true"><b style={{ width: `${receivedRate}%` }} /></i></div>
    </section>
    {negotiation && <section className="negotiation-card" aria-labelledby="negotiation-card-title"><div className="section-title"><h3 id="negotiation-card-title">Acordo de negociação</h3><span>{negotiation.id}</span></div><div className="negotiation-card-values"><span>Total acordado<strong>{brl.format(negotiation.negotiatedTotal)}</strong></span><span>Entrada prevista<strong>{brl.format(negotiation.downPayment)}</strong></span><span>Parcelamento<strong>{negotiation.installmentCount}× de {brl.format(negotiation.schedule[0]?.amount ?? 0)}</strong></span></div><dl className="negotiation-card-meta"><div><dt>Motivo</dt><dd>{negotiation.reason === "Outro" ? negotiation.otherReason || "Outro" : negotiation.reason}</dd></div><div><dt>Forma de pagamento</dt><dd>{negotiation.paymentMethod}</dd></div><div><dt>Período</dt><dd>{formatExpenseDate(negotiation.firstDueDate)}{lastInstallment && negotiation.installmentCount > 1 ? ` — ${formatExpenseDate(lastInstallment.dueDate)}` : ""}</dd></div>{negotiation.contactName && <div><dt>Contato</dt><dd>{negotiation.contactName} · {negotiation.contactChannel}</dd></div>}{negotiation.agreementDocumentName && <div><dt>Documento</dt><dd>{negotiation.agreementDocumentName}</dd></div>}</dl>{negotiation.notes && <p>{negotiation.notes}</p>}</section>}
    <section className="charge-detail-context" aria-labelledby="charge-context-title"><header><div><span>Origem da cobrança</span><h3 id="charge-context-title">Vínculos e competência</h3></div><b>{charge.competence}</b></header><div><span>Contrato<strong title={charge.contract}>{charge.contract}</strong></span><span>Carteira<strong title={charge.portfolio}>{charge.portfolio}</strong></span><span>Locatário<strong title={charge.tenant}>{charge.tenant}</strong></span><span>Imóvel<strong title={charge.property}>{charge.property}</strong></span><span>Tipo<strong>{charge.inclusionType || "Normal"}</strong></span><span>Pagamento<strong>{charge.paymentMethod || "Não definido"}</strong></span></div><footer>{charge.units.map((unit) => <span key={unit}>{unit}</span>)}</footer></section>
    <section className="charge-items-block"><div className="section-title"><h3>Composição da cobrança</h3><span>{charge.items.length} itens</span></div><div className="charge-items">{charge.items.map((item) => <article className="charge-item" key={`${item.name}-${item.dueDate}`}><div className="charge-item-head"><strong>{item.name}</strong><span>Vence {item.dueDate}</span></div>{(item.reference || item.supportDocumentName) && <p className="charge-item-reference-line">{[item.reference, item.supportDocumentName].filter(Boolean).join(" · ")}</p>}<div className="charge-item-values"><span>Previsto <b>{brl.format(item.amount)}</b></span><span>Recebido <b>{brl.format(item.received)}</b></span><span>Saldo <b>{brl.format(item.amount - item.received)}</b></span></div></article>)}</div></section>
    <section className="history-block"><div className="section-title"><h3>Histórico de recebimentos</h3><span>{receipts.length ? `${receipts.length} ${receipts.length === 1 ? "registro" : "registros"}` : receivedTotal(charge) ? "Registro demonstrativo" : "Sem registros"}</span></div>{receipts.length ? receipts.map((receipt) => <div className="history-entry" key={receipt.id}><i aria-hidden="true" /><div><strong>{brl.format(receipt.amount)}</strong><span>{formatExpenseDate(receipt.receiptDate)} · {receipt.paymentMethod} · {receipt.financialAccount}</span>{receipt.reference && <small>Referência {receipt.reference}</small>}</div></div>) : receivedTotal(charge) ? <div className="history-entry"><i aria-hidden="true" /><div><strong>{brl.format(receivedTotal(charge))}</strong><span>10 ago 2026 · Baixa manual distribuída por item</span></div></div> : <CompactEmptyState mark="↓" tone="charge" title="Aguardando a primeira baixa" description="Recebimentos parciais ou integrais serão organizados aqui em ordem cronológica." />}</section>
  </div><footer className="drawer-footer charge-drawer-footer charge-detail-footer"><button type="button" className="secondary-button drawer-footer-close" onClick={onClose}>Fechar</button>{charge.status !== "Recebida" && <><button type="button" className="secondary-button negotiation-action-button button-with-icon" onClick={onNegotiate}><Handshake aria-hidden="true" />{negotiation ? "Editar negociação" : "Negociar cobrança"}</button><button type="button" className="primary-button button-with-icon" onClick={onReceipt}><HandCoins aria-hidden="true" />Registrar recebimento</button></>}</footer></aside></div>;
}

function ContractDrawer({ contract, charges, onClose, onCharge }: { contract: Contract; charges: Charge[]; onClose: () => void; onCharge: () => void }) {
  const [startDate, endDate] = contract.period.split(" — ");
  const contractCharges = charges.filter((charge) => charge.contract === contract.id);

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Detalhes do contrato ${contract.id}`}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer wide-drawer contract-detail-drawer">
    <header className="contract-detail-hero">
      <div className="contract-detail-hero-top"><p className="eyebrow eyebrow-light">Instrumento de locação</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
      <div className="contract-detail-hero-copy"><div><span>{contract.id}</span><b>Contrato ativo</b></div><h2 title={contract.tenant}>{contract.tenant}</h2><p title={`${contract.property} · ${contract.portfolio}`}>{contract.property} · {contract.portfolio}</p></div>
      <i className="contract-detail-seal" aria-hidden="true"><Check /></i>
    </header>
    <div className="drawer-body">
      <section className="contract-detail-summary" aria-label={`Resumo financeiro de ${contract.id}`}>
        <div className="contract-detail-rent"><span>Aluguel base</span><strong>{brl.format(contract.rent)}</strong><small>valor mensal contratado</small></div>
        <div><span>Vencimento</span><strong>Dia {contract.due}</strong><small>de cada competência</small></div>
        <div><span>Reajuste</span><strong>{contract.adjustmentIndex === "Sem reajuste" ? "Sem reajuste" : contract.adjustment}</strong><small>{contract.adjustmentIndex === "Sem reajuste" ? "conforme cadastro" : "mês de referência"}</small></div>
        <div><span>Cobranças</span><strong>{contractCharges.length}</strong><small>lançamentos vinculados</small></div>
      </section>
      <section className="contract-period-panel" aria-labelledby="contract-period-title">
        <header><div><span>Vigência contratual</span><h3 id="contract-period-title">Período do acordo</h3></div></header>
        <div className="contract-period-line"><span><i aria-hidden="true" /><small>Início</small><strong>{startDate}</strong></span><i aria-hidden="true" /><span><i aria-hidden="true" /><small>Término</small><strong>{endDate}</strong></span></div>
      </section>
      <section className="contract-relationships" aria-labelledby="contract-relationships-title">
        <header><div><span>Vínculos do contrato</span><h3 id="contract-relationships-title">Estrutura locada</h3></div><small>{contract.units.length} {contract.units.length === 1 ? "unidade" : "unidades"}</small></header>
        <div className="contract-relationship-main"><span>Imóvel<strong title={contract.property}>{contract.property}</strong></span><span>Locatário<strong title={contract.tenant}>{contract.tenant}</strong></span></div>
        <div className="contract-relationship-units">{contract.units.map((unit) => <span key={unit}>{unit}</span>)}</div>
      </section>
      <section className="contract-composition" aria-labelledby="contract-composition-title"><div className="section-title"><h3 id="contract-composition-title">Composição prevista</h3><span>{contract.charges.length} itens</span></div><div>{contract.charges.map((item, index) => <span key={item}><i>{String(index + 1).padStart(2, "0")}</i><strong title={item}>{item}</strong></span>)}</div></section>
      <dl className="detail-list registry-detail-list"><div><dt>Finalidade</dt><dd>{contract.purpose || "Não informada"}</dd></div><div><dt>Índice de reajuste</dt><dd>{contract.adjustmentIndex || "Não informado"}{contract.adjustmentPeriod ? ` · ${contract.adjustmentPeriod} meses` : ""}</dd></div><div><dt>Encargos por atraso</dt><dd>{contract.lateFee == null ? "Multa não informada" : `${contract.lateFee}% de multa`} · {contract.monthlyInterest == null ? "Juros não informados" : `${contract.monthlyInterest}% a.m.`}</dd></div><div><dt>Pagamento</dt><dd>{contract.paymentMethod || "Não definido"}{contract.paymentReference ? ` · ${contract.paymentReference}` : ""}</dd></div><div><dt>Garantia</dt><dd>{contract.guaranteeType || "Não informada"}{contract.guaranteeDetails ? ` · ${contract.guaranteeDetails}` : ""}</dd></div><div><dt>Documento</dt><dd>{contract.documentName || "Não anexado"}</dd></div></dl>
      {contract.notes && <section className="contract-notes"><h3>Observações internas</h3><p>{contract.notes}</p></section>}
      <section className="contract-linked-charges" aria-labelledby="contract-linked-charges-title"><header><h3 id="contract-linked-charges-title">Cobranças vinculadas</h3><span>{contractCharges.length}</span></header>{contractCharges.length ? <><p>Valores abaixo representam o saldo a receber de cada lançamento.</p><div>{contractCharges.map((charge) => <article key={charge.id}><span><strong>{charge.id}</strong><small>Competência {charge.competence}</small></span><StatusBadge status={charge.status} /><b>{brl.format(chargeBalance(charge))}</b></article>)}</div></> : <p>Nenhuma cobrança foi cadastrada para este contrato. Use “Criar cobrança” para incluir uma competência.</p>}</section>
      <aside className="contract-edit-policy" aria-label="Disponibilidade de alterações"><span aria-hidden="true"><Info /></span><div><strong>Cadastro disponível para consulta</strong><p>A edição e o encerramento de contratos ainda não estão disponíveis nesta versão.</p></div></aside>
      <InfoNote text="Consultar o contrato não cria competências automaticamente. Use “Criar cobrança” quando quiser faturar um novo período." />
    </div>
    <footer className="drawer-footer contract-detail-footer"><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button button-with-icon" onClick={onCharge}><BadgeDollarSign aria-hidden="true" />Criar cobrança</button></footer>
  </aside></div>;
}

function ExpenseDrawer({ expense, onClose, onStatusChange }: { expense: Expense; onClose: () => void; onStatusChange: (status: ExpenseStatus, paidIso: string) => void }) {
  const timing = expenseTiming(expense);
  const [status, setStatus] = useState<ExpenseStatus>(expense.status);
  const [paidIso, setPaidIso] = useState(expense.status === "Pago" ? DEMO_DATE_ISO : "");
  const statusChanged = status !== expense.status || (status === "Pago" && !expense.paidDate);
  const statusName = expense.status.toLowerCase();

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Detalhes da despesa ${expense.id}`}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer wide-drawer expense-detail-drawer">
    <header className={`expense-detail-hero expense-detail-hero-${statusName}`}>
      <div className="expense-detail-hero-top"><p className="eyebrow eyebrow-light">Compromisso financeiro</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
      <div className="expense-detail-hero-copy"><div><span>{expense.id}</span><ExpenseStatusBadge status={expense.status} /></div><h2 title={expense.supplier}>{expense.supplier}</h2><p title={expense.description}>{expense.description}</p></div>
      <i className="expense-detail-orbit" aria-hidden="true"><ArrowDownToLine /></i>
    </header>
    <div className="drawer-body">
      <section className="expense-detail-summary" aria-label={`Resumo financeiro de ${expense.id}`}>
        <div className="expense-detail-amount"><span>Valor da despesa</span><strong>{brl.format(expense.amount)}</strong><small>{expense.status === "Pago" ? "compromisso quitado" : "valor a desembolsar"}</small></div>
        <div><span>Categoria</span><strong title={expense.category}>{expense.category}</strong><small>classificação financeira</small></div>
        <div><span>Situação</span><strong>{expense.status}</strong><small>{timing || (expense.status === "Pago" ? "Pagamento concluído" : "Dentro do prazo")}</small></div>
      </section>
      <section className="expense-detail-timeline" aria-labelledby="expense-timeline-title"><header><div><span>Agenda financeira</span><h3 id="expense-timeline-title">Vencimento e pagamento</h3></div>{timing && <b className={expense.status === "Vencido" ? "expense-timeline-overdue" : "expense-timeline-soon"}>{timing}</b>}</header><div><span className="expense-timeline-due"><i aria-hidden="true" /><small>Vencimento</small><strong>{expense.dueDate}</strong></span><i aria-hidden="true" /><span className={expense.status === "Pago" ? "expense-timeline-complete" : ""}><i aria-hidden="true" /><small>Pagamento</small><strong>{expense.paidDate ?? "Ainda não realizado"}</strong></span></div></section>
      <dl className="detail-list registry-detail-list"><div><dt>Competência</dt><dd>{expense.competence || "Não informada"}</dd></div><div><dt>Alocação</dt><dd>{expense.allocationType || "Geral da operação"}{expense.allocationId ? ` · ${expense.allocationId}` : ""}</dd></div><div><dt>Documento</dt><dd>{[expense.documentType, expense.documentNumber].filter(Boolean).join(" · ") || "Não informado"}</dd></div><div><dt>Lançamento</dt><dd>{expense.entryType || "Única"}{expense.recurrence ? ` · ${expense.recurrence}` : ""}</dd></div><div><dt>Pagamento</dt><dd>{[expense.paymentMethod, expense.financialAccount].filter(Boolean).join(" · ") || "Ainda não realizado"}</dd></div><div><dt>Anexo</dt><dd>{expense.attachmentName || "Não anexado"}</dd></div></dl>
      {expense.status === "Vencido" && <aside className="expense-alert"><span>!</span><div><strong>Pagamento em atraso</strong><p>Esta despesa está vencida e precisa de acompanhamento.</p></div></aside>}
      {expense.status === "Pendente" && timing && <aside className="expense-alert expense-alert-soon"><span>•</span><div><strong>Vencimento próximo</strong><p>Priorize a conferência desta despesa.</p></div></aside>}
      <section className="expense-status-editor" aria-labelledby="expense-status-title"><div><h3 id="expense-status-title">Atualizar situação</h3><p>Registre a evolução operacional deste compromisso.</p></div><label>Status<select value={status} onChange={(event) => { const nextStatus = event.target.value as ExpenseStatus; setStatus(nextStatus); if (nextStatus === "Pago" && !paidIso) setPaidIso(DEMO_DATE_ISO); }}><option>Pendente</option><option>Vencido</option><option>Pago</option></select></label>{status === "Pago" && <label>Data do pagamento<input type="date" value={paidIso} onChange={(event) => setPaidIso(event.target.value)} required /></label>}</section>
    </div>
    <footer className="drawer-footer expense-detail-footer"><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button button-with-icon" disabled={!statusChanged || (status === "Pago" && !paidIso)} onClick={() => onStatusChange(status, paidIso)}><CircleCheck aria-hidden="true" />Salvar status</button></footer>
  </aside></div>;
}

function ReportExportModal({ initialPortfolio, portfolioOptions, propertyOptions, tenantOptions, chargeOptions, onClose, onExported }: { initialPortfolio: string; portfolioOptions: Portfolio[]; propertyOptions: Property[]; tenantOptions: Tenant[]; chargeOptions: Charge[]; onClose: () => void; onExported: (filename: string) => void }) {
  const latestCompetence = useMemo(() => Array.from(new Set(chargeOptions.map((charge) => charge.competence))).sort((left, right) => {
    const [leftMonth, leftYear] = left.split("/").map(Number);
    const [rightMonth, rightYear] = right.split("/").map(Number);
    return leftYear * 12 + leftMonth - (rightYear * 12 + rightMonth);
  }).at(-1) ?? "08/2026", [chargeOptions]);
  const initialScope = portfolioOptions.some((portfolio) => portfolio.name === initialPortfolio) ? initialPortfolio : ALL_REPORT_PORTFOLIOS;
  const [portfolioScope, setPortfolioScope] = useState(initialScope);
  const [competenceInput, setCompetenceInput] = useState(competenceToInputValue(latestCompetence));
  const competence = inputValueToCompetence(competenceInput);
  const selectedPortfolio = portfolioOptions.find((portfolio) => portfolio.name === portfolioScope);
  const automaticFilename = suggestedAccountingReportFilename(competence || latestCompetence, selectedPortfolio?.name);
  const [filenameOverride, setFilenameOverride] = useState<string | null>(null);
  const filename = filenameOverride ?? automaticFilename;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [generatedDownload, setGeneratedDownload] = useState<AccountingReportDownload | null>(null);

  useEffect(() => () => {
    if (generatedDownload) URL.revokeObjectURL(generatedDownload.objectUrl);
  }, [generatedDownload]);

  const preview = useMemo(() => {
    try {
      return {
        model: buildAccountingReportModel({
          competence,
          portfolioScope,
          portfolios: portfolioOptions,
          properties: propertyOptions,
          tenants: tenantOptions,
          charges: chargeOptions,
        }),
        error: "",
      };
    } catch (error) {
      return { model: null, error: error instanceof Error ? error.message : "Não foi possível preparar o relatório." };
    }
  }, [chargeOptions, competence, portfolioOptions, portfolioScope, propertyOptions, tenantOptions]);

  const noRowsMessage = preview.model && preview.model.rows.length === 0
    ? "Não há cobranças com item de aluguel para esse escopo e competência."
    : "";

  const handleExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!preview.model || preview.model.rows.length === 0) return;
    const safeFilename = filename.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
    if (!safeFilename) {
      setExportError("Informe um nome válido para o arquivo.");
      return;
    }

    setExportError("");
    setExporting(true);
    try {
      const { createAccountingReportWorkbook, downloadAccountingReport } = await import("./accounting-report-workbook");
      const bytes = await createAccountingReportWorkbook(preview.model);
      const finalFilename = safeFilename.toLowerCase().endsWith(".xlsx") ? safeFilename : `${safeFilename}.xlsx`;
      const download = downloadAccountingReport(bytes, finalFilename);
      setGeneratedDownload(download);
      setExporting(false);
      onExported(download.filename);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Não foi possível gerar o relatório. Tente novamente.");
      setExporting(false);
    }
  };

  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Exportar relatório contábil"><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar exportação" /><form className="receipt-modal report-modal" onSubmit={handleExport}><ModalHeader eyebrow="Relatório contábil" title="Exportar relação de aluguéis" onClose={onClose} /><div className="report-modal-body"><p className="report-intro">Gere uma planilha no mesmo formato do modelo contábil, por carteira ou com todas as carteiras reunidas.</p><InlineFieldError message={exportError || preview.error || noRowsMessage} /><div className="form-grid report-form-grid"><label className="full-field">Escopo do relatório<select value={portfolioScope} onChange={(event) => { setPortfolioScope(event.target.value); setGeneratedDownload(null); setExportError(""); }}><option value={ALL_REPORT_PORTFOLIOS}>Todas as carteiras · relatório geral</option>{portfolioOptions.map((portfolio) => <option value={portfolio.name} key={portfolio.id}>{portfolio.name} · {portfolio.holder}</option>)}</select></label><label>Competência<input type="month" value={competenceInput} onChange={(event) => { setCompetenceInput(event.target.value); setGeneratedDownload(null); setExportError(""); }} required /></label><label>Nome do arquivo<input value={filename} onChange={(event) => { setFilenameOverride(event.target.value); setGeneratedDownload(null); setExportError(""); }} spellCheck={false} required /></label></div>{preview.model && <section className="report-preview" aria-live="polite"><div className="section-title"><h3>Prévia da exportação</h3><span>{preview.model.isGeneral ? "Relatório geral" : "Carteira específica"}</span></div><div className="report-preview-values"><span>Competência<strong>{preview.model.month.toLocaleLowerCase("pt-BR")} de {preview.model.year}</strong></span><span>Locações<strong>{preview.model.rows.length}</strong></span><span>Total de aluguéis<strong>{brl.format(preview.model.total)}</strong></span></div><p><span aria-hidden="true">i</span> Somente o item <strong>Aluguel</strong> entra no relatório. O arquivo é criado e baixado localmente, sem envio de dados.</p></section>}{generatedDownload && <aside className="report-download-ready" role="status"><span aria-hidden="true">✓</span><div><strong>Arquivo gerado com sucesso</strong><p>{generatedDownload.filename}</p></div><a className="secondary-button" href={generatedDownload.objectUrl} download={generatedDownload.filename}>Baixar novamente</a></aside>}</div><footer><button type="button" className="secondary-button" onClick={onClose} disabled={exporting}>{generatedDownload ? "Fechar" : "Cancelar"}</button><button className="primary-button" disabled={exporting || !preview.model || preview.model.rows.length === 0} aria-busy={exporting}>{exporting ? "Gerando planilha…" : generatedDownload ? "Gerar novamente" : "Gerar e baixar .xlsx"}</button></footer></form></div>;
}

function NegotiationModal({ charge, negotiation, onClose, onSave }: { charge: Charge; negotiation?: ChargeNegotiation; onClose: () => void; onSave: (negotiation: ChargeNegotiation) => void }) {
  const originalBalance = chargeBalance(charge);
  const moneyInput = (value: number | undefined) => value ? String(value) : "";
  const [discount, setDiscount] = useState(moneyInput(negotiation?.discount));
  const [fine, setFine] = useState(moneyInput(negotiation?.surchargeBreakdown?.fine ?? negotiation?.surcharge));
  const [interest, setInterest] = useState(moneyInput(negotiation?.surchargeBreakdown?.interest));
  const [correction, setCorrection] = useState(moneyInput(negotiation?.surchargeBreakdown?.correction));
  const [downPayment, setDownPayment] = useState(moneyInput(negotiation?.downPayment));
  const [downPaymentDueDate, setDownPaymentDueDate] = useState(negotiation?.downPaymentDueDate ?? DEMO_DATE_ISO);
  const [installmentCount, setInstallmentCount] = useState(String(negotiation?.installmentCount ?? 3));
  const [firstDueDate, setFirstDueDate] = useState(negotiation?.firstDueDate ?? "2026-09-10");
  const [reason, setReason] = useState(negotiation?.reason ?? "");
  const [otherReason, setOtherReason] = useState(negotiation?.otherReason ?? "");
  const [paymentMethod, setPaymentMethod] = useState(negotiation?.paymentMethod ?? "Boleto bancário");
  const [contactName, setContactName] = useState(negotiation?.contactName ?? "");
  const [contactChannel, setContactChannel] = useState(negotiation?.contactChannel ?? "WhatsApp");
  const [agreementDocumentName, setAgreementDocumentName] = useState(negotiation?.agreementDocumentName ?? "");
  const [notes, setNotes] = useState(negotiation?.notes ?? "");
  const [formError, setFormError] = useState("");
  const { onFormChange, requestClose, discardDialog } = useDiscardGuard(onClose, "Os termos da negociação não serão salvos.");
  const surcharge = Number(fine || 0) + Number(interest || 0) + Number(correction || 0);
  const terms: NegotiationTerms = {
    originalBalance,
    discount: discount === "" ? 0 : Number(discount),
    surcharge,
    downPayment: downPayment === "" ? 0 : Number(downPayment),
    installmentCount: Number(installmentCount),
    firstDueDate,
  };
  const totals = calculateNegotiationTotals(terms);
  const termsError = validateNegotiationTerms(terms, DEMO_DATE_ISO);
  const schedule = termsError ? [] : buildNegotiationSchedule(firstDueDate, terms.installmentCount, totals.financedAmount);
  const firstInstallment = schedule[0]?.amount ?? 0;
  const clearError = () => setFormError("");
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = termsError || (!reason ? "Selecione o motivo da negociação." : "") || (reason === "Outro" && !otherReason.trim() ? "Descreva o motivo da negociação." : "") || (terms.downPayment > 0 && !downPaymentDueDate ? "Informe o vencimento da entrada." : "") || (!paymentMethod ? "Selecione a forma de pagamento." : "");
    if (error) {
      setFormError(error);
      return;
    }
    onSave({
      ...terms,
      id: negotiation?.id ?? `NEG-${charge.id.replace("COB-", "")}`,
      chargeId: charge.id,
      negotiatedTotal: totals.negotiatedTotal,
      financedAmount: totals.financedAmount,
      schedule,
      reason,
      otherReason: otherReason.trim(),
      paymentMethod,
      downPaymentDueDate: terms.downPayment > 0 ? downPaymentDueDate : "",
      contactName: contactName.trim(),
      contactChannel,
      surchargeBreakdown: { fine: Number(fine || 0), interest: Number(interest || 0), correction: Number(correction || 0) },
      agreementDocumentName,
      notes: notes.trim(),
      createdAt: negotiation?.createdAt ?? DEMO_DATE_ISO,
      updatedAt: DEMO_DATE_ISO,
    });
  };

  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Negociar cobrança ${charge.id}`}><button type="button" className="drawer-backdrop" onClick={requestClose} aria-label="Fechar negociação" /><form className="receipt-modal negotiation-modal" noValidate onSubmit={handleSubmit} onChange={onFormChange}><ModalHeader eyebrow={negotiation ? "Revisão do acordo" : "Cobrança em aberto"} title={negotiation ? `Editar negociação ${charge.id}` : `Negociar ${charge.id}`} onClose={requestClose} /><div className="negotiation-modal-body">
    <div className="negotiation-context"><div><span>Locatário</span><strong>{charge.tenant}</strong></div><div><span>Competência</span><strong>{charge.competence}</strong></div><div><span>Saldo atual</span><strong>{brl.format(originalBalance)}</strong></div></div>
    <InlineFieldError message={formError || termsError} />
    <section className="negotiation-section" aria-labelledby="negotiation-values-title"><div className="negotiation-section-heading"><span aria-hidden="true">01</span><div><h3 id="negotiation-values-title">Condições financeiras</h3><p>Separe desconto, encargos e uma entrada prevista para manter a memória de cálculo.</p></div></div><div className="negotiation-fields-grid">
      <label>Desconto<input type="number" inputMode="decimal" min="0" max={originalBalance} step="0.01" placeholder="0,00" value={discount} onChange={(event) => { setDiscount(event.target.value); clearError(); }} /><small>Reduz o saldo original.</small></label>
      <label>Multa<input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={fine} onChange={(event) => { setFine(event.target.value); clearError(); }} /></label>
      <label>Juros<input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={interest} onChange={(event) => { setInterest(event.target.value); clearError(); }} /></label>
      <label>Correção monetária<input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={correction} onChange={(event) => { setCorrection(event.target.value); clearError(); }} /></label>
      <label>Entrada prevista<input type="number" inputMode="decimal" min="0" max={Math.max(0, totals.negotiatedTotal - 0.01)} step="0.01" placeholder="0,00" value={downPayment} onChange={(event) => { setDownPayment(event.target.value); clearError(); }} /><small>Não será registrada como recebida automaticamente.</small></label>
      {terms.downPayment > 0 && <label>Vencimento da entrada<input type="date" min={DEMO_DATE_ISO} value={downPaymentDueDate} onChange={(event) => { setDownPaymentDueDate(event.target.value); clearError(); }} required /></label>}
    </div></section>
    <section className="negotiation-section" aria-labelledby="negotiation-installments-title"><div className="negotiation-section-heading"><span aria-hidden="true">02</span><div><h3 id="negotiation-installments-title">Parcelamento e vencimentos</h3><p>Monte o calendário mensal para o saldo após a entrada.</p></div></div><div className="negotiation-fields-grid negotiation-installment-fields">
      <label>Número de parcelas<input type="number" inputMode="numeric" min="1" max="24" step="1" value={installmentCount} onChange={(event) => { setInstallmentCount(event.target.value); clearError(); }} required /></label>
      <label>Primeiro vencimento<input type="date" min={DEMO_DATE_ISO} value={firstDueDate} onChange={(event) => { setFirstDueDate(event.target.value); clearError(); }} required /></label>
      <label>Forma de pagamento<select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); clearError(); }} required><option>Boleto bancário</option><option>Pix</option><option>Transferência bancária</option><option>Débito automático</option></select></label>
      <label>Motivo da negociação<select value={reason} onChange={(event) => { setReason(event.target.value); clearError(); }} required><option value="" disabled>Selecione o motivo</option><option>Atraso temporário</option><option>Readequação de fluxo</option><option>Contestação parcial</option><option>Acordo comercial</option><option>Outro</option></select></label>
      {reason === "Outro" && <label className="full-field">Descrição do motivo<input value={otherReason} onChange={(event) => { setOtherReason(event.target.value); clearError(); }} required /></label>}
    </div></section>
    <section className="negotiation-preview" aria-labelledby="negotiation-preview-title"><div className="section-title"><h3 id="negotiation-preview-title">Resumo do acordo</h3><span>{schedule.length ? `${schedule.length} ${schedule.length === 1 ? "parcela" : "parcelas"}` : "Revise as condições"}</span></div><div className="negotiation-preview-values"><span>Saldo original<strong>{brl.format(originalBalance)}</strong></span><span>Desconto<strong className="negotiation-discount">− {brl.format(terms.discount)}</strong></span><span>Acréscimos<strong>+ {brl.format(terms.surcharge)}</strong></span><span>Total acordado<strong>{brl.format(totals.negotiatedTotal)}</strong></span><span>Entrada prevista<strong>{brl.format(terms.downPayment)}</strong></span><span>Saldo parcelado<strong>{brl.format(totals.financedAmount)}</strong></span></div>{schedule.length > 0 && <div className="negotiation-schedule"><div className="negotiation-schedule-heading"><span>Calendário previsto</span><strong>{terms.installmentCount}× a partir de {brl.format(firstInstallment)}</strong></div><ol>{schedule.map((installment) => <li key={installment.number}><span>{String(installment.number).padStart(2, "0")}</span><strong>{formatExpenseDate(installment.dueDate)}</strong><b>{brl.format(installment.amount)}</b></li>)}</ol></div>}</section>
    <section className="negotiation-section" aria-labelledby="negotiation-record-title"><div className="negotiation-section-heading"><span aria-hidden="true">03</span><div><h3 id="negotiation-record-title">Contato e formalização</h3><p>Registre com quem o acordo foi tratado e a evidência correspondente.</p></div></div><div className="negotiation-fields-grid"><label>Contato responsável<input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Nome da pessoa que aprovou" /></label><label>Canal do acordo<select value={contactChannel} onChange={(event) => setContactChannel(event.target.value)}><option>WhatsApp</option><option>E-mail</option><option>Telefone</option><option>Presencial</option><option>Portal</option></select></label><FileField className="full-field" label="Documento do acordo" optional hint="Termo, e-mail ou evidência do aceite." accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" value={agreementDocumentName ? [agreementDocumentName] : []} onChange={(names) => setAgreementDocumentName(names[0] ?? "")} /></div></section>
    <label className="standalone-label negotiation-notes">Observações<textarea rows={3} maxLength={500} placeholder="Registre condições adicionais ou o histórico do contato." value={notes} onChange={(event) => { setNotes(event.target.value); clearError(); }} /><small>{notes.length}/500 caracteres</small></label>
  </div><footer><button type="button" className="secondary-button" onClick={requestClose}>Cancelar</button><button className="primary-button" disabled={Boolean(termsError)}>{negotiation ? "Salvar alterações" : "Confirmar negociação"}</button></footer></form>
    {discardDialog}
  </div>;
}

function ReceiptModal({ charge, onClose, onSave }: { charge: Charge; onClose: () => void; onSave: (receipt: ReceiptDraft) => void }) {
  const pendingItems = charge.items.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => item.amount > item.received);
  const currentBalance = chargeBalance(charge);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [allocations, setAllocations] = useState(pendingItems.map(() => 0));
  const [receiptDate, setReceiptDate] = useState(DEMO_DATE_ISO);
  const [creditDate, setCreditDate] = useState(DEMO_DATE_ISO);
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [financialAccount, setFinancialAccount] = useState(FINANCIAL_ACCOUNT_OPTIONS[0]);
  const [reference, setReference] = useState("");
  const [discount, setDiscount] = useState("");
  const [interest, setInterest] = useState("");
  const [thirdPartyPayer, setThirdPartyPayer] = useState("");
  const [proofName, setProofName] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const { onFormChange, requestClose, discardDialog } = useDiscardGuard(onClose, "Os dados do recebimento não serão salvos.");
  const receivedValue = Number(receivedAmount);
  const discountValue = Number(discount || 0);
  const interestValue = Number(interest || 0);
  const principalToSettle = receivedValue + discountValue - interestValue;
  const allocationTotal = allocations.reduce((sum, value) => sum + Number(value || 0), 0);
  const invalidAllocation = allocations.some((value, index) => value < 0 || value > pendingItems[index].item.amount - pendingItems[index].item.received);
  const receiptError = receivedAmount === "" ? ""
    : !Number.isFinite(receivedValue) || receivedValue <= 0 ? "Informe um valor recebido maior que zero."
    : discountValue < 0 || interestValue < 0 ? "Desconto e acréscimo não podem ser negativos."
    : principalToSettle <= 0 ? "Os ajustes resultam em uma baixa inválida."
    : principalToSettle > currentBalance ? `O valor liquidado não pode superar o saldo de ${brl.format(currentBalance)}.`
    : invalidAllocation ? "A distribuição não pode superar o saldo de nenhum item."
    : allocationTotal <= 0 ? "Distribua um valor maior que zero entre os itens."
    : allocationTotal > currentBalance ? `O total distribuído não pode superar o saldo de ${brl.format(currentBalance)}.`
    : Math.abs(allocationTotal - principalToSettle) > 0.009 ? "A soma distribuída deve ser igual ao valor liquidado após os ajustes."
    : "";
  const canConfirm = receivedAmount !== "" && allocationTotal > 0 && allocationTotal <= currentBalance && !receiptError;
  const canAdvance = receivedAmount !== "" && Number.isFinite(receivedValue) && receivedValue > 0
    && discountValue >= 0 && interestValue >= 0
    && Number.isFinite(principalToSettle) && principalToSettle > 0 && principalToSettle <= currentBalance;
  const distributeAmount = (amount: number) => {
    let remainingCents = Math.round(Math.max(0, Math.min(amount, currentBalance)) * 100);
    return pendingItems.map(({ item }) => {
      const itemBalanceCents = Math.round((item.amount - item.received) * 100);
      const allocatedCents = Math.min(remainingCents, itemBalanceCents);
      remainingCents -= allocatedCents;
      return allocatedCents / 100;
    });
  };
  const changeReceivedAmount = (value: string) => {
    const amount = Number(value) + discountValue - interestValue;
    setReceivedAmount(value);
    setAllocations(value === "" || !Number.isFinite(amount) ? pendingItems.map(() => 0) : distributeAmount(amount));
  };
  const changeAdjustment = (kind: "discount" | "interest", value: string) => {
    const nextDiscount = kind === "discount" ? Number(value || 0) : discountValue;
    const nextInterest = kind === "interest" ? Number(value || 0) : interestValue;
    if (kind === "discount") setDiscount(value); else setInterest(value);
    const amount = Number(receivedAmount || 0) + nextDiscount - nextInterest;
    setAllocations(receivedAmount === "" || !Number.isFinite(amount) ? pendingItems.map(() => 0) : distributeAmount(amount));
  };
  const handleReceiptSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) {
      if (canAdvance) { setAllocations(distributeAmount(principalToSettle)); setStep(2); }
      return;
    }
    if (!canConfirm) return;
    onSave({
      id: `REC-${charge.id.replace(/\D/g, "")}-${String(receivedTotal(charge) + receivedValue).replace(/\D/g, "")}`,
      chargeId: charge.id,
      receiptDate,
      creditDate,
      amount: receivedValue,
      discount: discountValue,
      interest: interestValue,
      paymentMethod,
      financialAccount,
      reference,
      thirdPartyPayer,
      proofName,
      note,
      allocations: allocations.map((amount, index) => ({ itemIndex: pendingItems[index].itemIndex, amount })).filter((allocation) => allocation.amount > 0),
    });
  };
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Registrar recebimento"><button type="button" className="drawer-backdrop" onClick={requestClose} aria-label="Fechar formulário" /><form className="receipt-modal allocation-modal" onSubmit={handleReceiptSubmit} onChange={onFormChange}><ModalHeader eyebrow="Baixa manual" title="Registrar recebimento" onClose={requestClose} />
    <ol className="receipt-steps" aria-label={`Etapa ${step} de 2`}>
      <li className={step === 1 ? "is-active" : "is-done"} aria-current={step === 1 ? "step" : undefined}><b>{step === 1 ? "1" : <Check aria-hidden="true" />}</b>Dados do recebimento</li>
      <li className={step === 2 ? "is-active" : ""} aria-current={step === 2 ? "step" : undefined}><b>2</b>Revisão da distribuição</li>
    </ol>
    <div className="receipt-summary"><div><span>Valor da cobrança</span><strong>{brl.format(chargeTotal(charge))}</strong></div><div><span>Já recebido</span><strong>{brl.format(receivedTotal(charge))}</strong></div><div><span>Saldo atual</span><strong>{brl.format(currentBalance)}</strong></div></div><InlineFieldError message={receiptError} />
    {step === 1 && <>
    <section className="receipt-form-section"><div className="section-title"><h3>Dados do recebimento</h3><span>Informações para conciliação e auditoria</span></div><div className="form-grid"><label>Data do recebimento<input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} required /></label><label>Data do crédito<input type="date" value={creditDate} onChange={(event) => setCreditDate(event.target.value)} required /></label><label>Valor recebido<input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0,00" value={receivedAmount} onChange={(event) => changeReceivedAmount(event.target.value)} required autoFocus /></label><label>Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} required>{PAYMENT_METHOD_OPTIONS.map((method) => <option key={method}>{method}</option>)}</select></label><label>Conta financeira<select value={financialAccount} onChange={(event) => setFinancialAccount(event.target.value)} required>{FINANCIAL_ACCOUNT_OPTIONS.map((account) => <option key={account}>{account}</option>)}</select></label><label>Identificador / referência<input value={reference} placeholder="NSU, E2E do Pix ou código bancário" onChange={(event) => setReference(event.target.value)} /></label></div></section>
    <section className="receipt-form-section"><div className="section-title"><h3>Ajustes</h3><span>O valor liquidado será distribuído nos itens</span></div><div className="form-grid"><label>Desconto concedido<input type="number" min="0" step="0.01" value={discount} placeholder="0,00" onChange={(event) => changeAdjustment("discount", event.target.value)} /></label><label>Juros / acréscimo<input type="number" min="0" step="0.01" value={interest} placeholder="0,00" onChange={(event) => changeAdjustment("interest", event.target.value)} /></label></div><div className="receipt-adjustment-total"><span>Valor liquidado na cobrança</span><strong>{brl.format(Number.isFinite(principalToSettle) ? Math.max(0, principalToSettle) : 0)}</strong></div></section>
    <section className="receipt-form-section"><div className="section-title"><h3>Comprovação e observações</h3><span>Campos complementares</span></div><div className="form-grid"><label>Pagador diferente do locatário<input value={thirdPartyPayer} placeholder="Nome ou documento, se aplicável" onChange={(event) => setThirdPartyPayer(event.target.value)} /></label><FileField label="Comprovante" optional accept=".pdf,.jpg,.jpeg,.png" value={proofName ? [proofName] : []} onChange={(names) => setProofName(names[0] ?? "")} /><label className="full-field">Observação<textarea placeholder="Ex.: pagamento parcial, complemento..." rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label></div></section>
    </>}
    {step === 2 && <>
    <section className="allocation-block"><div className="section-title"><h3>Revisão da distribuição</h3><span>Ajuste quanto cada item recebe · {brl.format(principalToSettle)} a liquidar</span></div>{pendingItems.map(({ item }, index) => <label className="allocation-row" key={`${item.name}-${index}`}><span><strong>{item.name}</strong><small>Saldo {brl.format(item.amount - item.received)}</small></span><input aria-label={`Valor para ${item.name}`} type="number" min="0" step="0.01" max={item.amount - item.received} placeholder="0,00" value={allocations[index] || ""} onChange={(event) => setAllocations((values) => values.map((value, position) => position === index ? Number(event.target.value) : value))} /></label>)}<div className="allocation-total"><span>Total distribuído</span><strong>{brl.format(allocationTotal)}</strong></div></section>
    <div className="receipt-adjustment-total"><span>Valor liquidado na cobrança</span><strong>{brl.format(Math.max(0, principalToSettle))}</strong></div>
    <div className="post-balance"><span>Saldo após esta baixa</span><strong>{brl.format(Math.max(0, currentBalance - allocationTotal))}</strong></div>
    <aside className="receipt-review" role="status"><span aria-hidden="true"><Check /></span><div><strong>Confira antes de confirmar</strong><p>{brl.format(receivedValue)} recebido via {paymentMethod}, liquidando {brl.format(allocationTotal)} em {allocations.filter((value) => value > 0).length} {allocations.filter((value) => value > 0).length === 1 ? "item" : "itens"}. O saldo ficará em {brl.format(Math.max(0, currentBalance - allocationTotal))}.</p></div></aside>
    </>}
    <footer>{step === 1 ? <button type="button" className="secondary-button" onClick={requestClose}>Cancelar</button> : <button type="button" className="secondary-button" onClick={() => setStep(1)}><ArrowRight aria-hidden="true" style={{ transform: "rotate(180deg)" }} />Voltar aos dados</button>}<button className="primary-button button-with-icon" disabled={step === 1 ? !canAdvance : !canConfirm}>{step === 1 ? <>Continuar<ArrowRight aria-hidden="true" /></> : <><CircleCheck aria-hidden="true" />Confirmar recebimento</>}</button></footer></form>
    {discardDialog}
  </div>;
}

function ModalHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) { return <header><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header>; }
function ModalFooter({ onClose, action, pending = false, disabled = false, disabledReason }: { onClose: () => void; action: string; pending?: boolean; disabled?: boolean; disabledReason?: string }) { return <footer className="entity-form-footer"><div><span aria-hidden="true"><Check /></span><p><strong>Cadastro protegido</strong><small>Os campos obrigatórios são validados antes de salvar.</small></p></div><button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button><button className="primary-button button-with-icon" disabled={pending || disabled} aria-busy={pending} title={disabled ? disabledReason : undefined}>{pending ? <><span className="spinner button-spinner" aria-hidden="true" />Salvando…</> : <><CircleCheck aria-hidden="true" />{action}</>}</button></footer>; }

function EntityFormSection({ index, title, description, children, className = "" }: { index: string; title: string; description: string; children: ReactNode; className?: string }) {
  return <section className={`entity-form-section full-field ${className}`}><header><span>{index}</span><div><h3>{title}</h3><p>{description}</p></div></header><div className="entity-form-section-fields">{children}</div></section>;
}

function EntityForm({ kind, portfolio, property, unit, tenant, documents: initialDocuments = [], categorizedDocuments: initialCategorizedDocuments = createEmptyCategorizedDocuments(), chargeSourceContract, portfolioOptions, propertyOptions, unitOptions, tenantOptions, agencyOptions, contractOptions, chargeOptions, onClose, onSave }: { kind: Exclude<FormKind, null>; portfolio?: Portfolio | null; property?: Property | null; unit?: Unit | null; tenant?: Tenant | null; documents?: LocalDocument[]; categorizedDocuments?: CategorizedDocuments; chargeSourceContract?: Contract | null; portfolioOptions: Portfolio[]; propertyOptions: Property[]; unitOptions: Unit[]; tenantOptions: Tenant[]; agencyOptions: RealEstateAgency[]; contractOptions: Contract[]; chargeOptions: Charge[]; onClose: () => void; onSave: (data: FormData, documents?: FormDocuments) => void }) {
  const initialUnitType = unit?.unitType || UNIT_TYPE_OPTIONS.find((type) => unit?.name.startsWith(`${type.replace(" comercial", "")} `)) || "Sala comercial";
  const initialUnitCode = unit?.code ?? unit?.name.replace(new RegExp(`^${initialUnitType.replace(" comercial", "")}\\s+`, "i"), "") ?? "";
  const initialChargeContract = chargeSourceContract ?? contractOptions[0];
  const baseConfig = {
    portfolio: ["Estrutura patrimonial", "Nova carteira", "Salvar carteira"], property: ["Estrutura patrimonial", "Novo imóvel", "Salvar imóvel"], unit: ["Estrutura locável", "Nova unidade", "Salvar unidade"], tenant: ["Cadastro essencial", "Novo locatário", "Salvar locatário"], contract: ["Locação", "Novo contrato", "Salvar contrato"], charge: ["Inclusão manual", "Nova cobrança", "Salvar cobrança"], expense: ["Controle financeiro", "Nova despesa", "Salvar despesa"],
  }[kind];
  const config = kind === "portfolio" && portfolio ? [baseConfig[0], `Editar ${portfolio.name}`, "Salvar alterações"] : kind === "property" && property ? [baseConfig[0], `Editar ${property.name}`, "Salvar alterações"] : kind === "unit" && unit ? [baseConfig[0], `Editar ${unit.name}`, "Salvar alterações"] : kind === "tenant" && tenant ? [baseConfig[0], `Editar ${tenant.name}`, "Salvar alterações"] : baseConfig;
  const presentation = {
    portfolio: { mark: "CA", label: "Organização patrimonial", description: "Centralize a titularidade e a estrutura que reúne imóveis e unidades." },
    property: { mark: "IM", label: "Ativo imobiliário", description: "Identifique o empreendimento e mantenha seu acervo documental organizado." },
    unit: { mark: "UN", label: "Estrutura locável", description: "Cadastre o espaço, sua metragem e a disponibilidade para locação." },
    tenant: { mark: "LO", label: "Relacionamento", description: "Registre a pessoa ou empresa que poderá ser vinculada aos contratos." },
    contract: { mark: "CT", label: "Instrumento de locação", description: "Conecte patrimônio, locatário, vigência e condições financeiras." },
    charge: { mark: "CO", label: "Gestão de recebíveis", description: "Gere uma competência e confira cada item antes da inclusão." },
    expense: { mark: "DE", label: "Compromisso financeiro", description: "Registre origem, vencimento, valor e situação da obrigação." },
  }[kind];
  const [portfolioOwnerType, setPortfolioOwnerType] = useState<Tenant["type"]>(documentDigits(portfolio?.document ?? "").length === 11 ? "PF" : "PJ");
  const [portfolioDocument, setPortfolioDocument] = useState(portfolio?.document ?? "");
  const [tenantType, setTenantType] = useState<Tenant["type"]>(tenant?.type ?? "PJ");
  const [tenantDocument, setTenantDocument] = useState(tenant?.document ?? "");
  const [tenantDocumentError, setTenantDocumentError] = useState("");
  const [contractPortfolio, setContractPortfolio] = useState(portfolioOptions[0]?.name ?? "");
  const [contractProperty, setContractProperty] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [contractStart, setContractStart] = useState("");
  const [contractRent, setContractRent] = useState("");
  const [contractGuaranteeType, setContractGuaranteeType] = useState("Sem garantia");
  const [contractDocumentName, setContractDocumentName] = useState("");
  const [contractRules, setContractRules] = useState<ContractChargeRule[]>([
    { name: "Aluguel", responsibility: "Locatário", calculation: "Valor fixo", amount: 0, dueRule: "Mesmo dia do aluguel", recurrence: "Mensal", proofRequired: false },
    { name: "IPTU", responsibility: "Locatário", calculation: "Valor variável", amount: 0, dueRule: "Mesmo dia do aluguel", recurrence: "Mensal", proofRequired: true },
    { name: "Condomínio", responsibility: "Locatário", calculation: "Valor variável", amount: 0, dueRule: "Conforme documento", recurrence: "Mensal", proofRequired: true },
  ]);
  const [chargeContractId, setChargeContractId] = useState(initialChargeContract?.id ?? "");
  const [chargeCompetence, setChargeCompetence] = useState("2026-08");
  const [chargeItems, setChargeItems] = useState<ChargeDraftItem[]>(() => initialChargeContract ? buildChargeItemsFromContract(initialChargeContract, "2026-08") : []);
  const [chargeItemsDirty, setChargeItemsDirty] = useState(false);
  const [chargeInclusionType, setChargeInclusionType] = useState("Normal");
  const [expenseAllocationType, setExpenseAllocationType] = useState("Geral da operação");
  const [expenseEntryType, setExpenseEntryType] = useState("Única");
  const [expenseAlreadyPaid, setExpenseAlreadyPaid] = useState(false);
  const [expenseAttachmentName, setExpenseAttachmentName] = useState("");
  const [documents, setDocuments] = useState<LocalDocument[]>(initialDocuments);
  const [categorizedDocuments, setCategorizedDocuments] = useState<CategorizedDocuments>(initialCategorizedDocuments);
  const initialDocumentIds = useRef(new Set([...initialDocuments, ...flattenCategorizedDocuments(initialCategorizedDocuments)].map((document) => document.id)));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState<ConfirmPrompt | null>(null);
  const contractProperties = propertyOptions.filter((record) => record.portfolio === contractPortfolio);
  const contractUnits = unitOptions.filter((record) => record.property === contractProperty && record.portfolio === contractPortfolio && !record.occupied);
  const selectedChargeContract = contractOptions.find((contract) => contract.id === chargeContractId);
  const chargeCompetenceParts = chargeCompetence.match(/^(\d{4})-(\d{2})$/);
  const chargeCompetenceLabel = chargeCompetenceParts ? `${chargeCompetenceParts[2]}/${chargeCompetenceParts[1]}` : "";
  const duplicateCharge = chargeCompetenceLabel ? chargeOptions.find((charge) => charge.contract === chargeContractId && charge.competence === chargeCompetenceLabel) : undefined;
  const expenseAllocationOptions = expenseAllocationType === "Carteira" ? portfolioOptions.map((record) => ({ id: record.id, name: record.name }))
    : expenseAllocationType === "Imóvel" ? propertyOptions.map((record) => ({ id: record.id, name: record.name }))
    : expenseAllocationType === "Unidade" ? unitOptions.map((record) => ({ id: record.id, name: `${record.name} · ${record.property}` }))
    : expenseAllocationType === "Contrato" ? contractOptions.map((record) => ({ id: record.id, name: `${record.id} · ${record.tenant}` }))
    : [];
  const chargeBusinessError = kind !== "charge" ? ""
    : !selectedChargeContract ? "Selecione um contrato válido para a cobrança."
    : !chargeCompetenceParts ? "Informe uma competência válida."
    : duplicateCharge && chargeInclusionType === "Normal" ? `Já existe a cobrança ${duplicateCharge.id} para ${chargeContractId} na competência ${chargeCompetenceLabel}. Escolha reemissão ou lançamento extraordinário se for uma exceção.`
    : chargeItems.length === 0 ? "Adicione ao menos um item à cobrança."
    : !chargeItems.some((item) => Number.isFinite(item.amount) && item.amount > 0) ? "A cobrança precisa ter ao menos um item com valor positivo."
    : chargeItems.some((item) => !item.name.trim() || !Number.isFinite(item.amount) || item.amount <= 0) ? "Todos os itens devem ter descrição e valor maior que zero."
    : chargeItems.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.due)) ? "Todos os vencimentos devem ser datas válidas."
    : "";
  const supportsDocuments = kind === "property" || kind === "unit" || kind === "tenant";
  const supportsDocumentTopics = kind === "property";
  const closeForm = () => {
    if (saving) return;
    const currentDocuments = supportsDocumentTopics ? flattenCategorizedDocuments(categorizedDocuments) : documents;
    revokeDocumentUrls(currentDocuments.filter((document) => !initialDocumentIds.current.has(document.id)));
    onClose();
  };
  const { onFormChange, requestClose, discardDialog } = useDiscardGuard(closeForm, "Os dados preenchidos neste cadastro não serão salvos.");
  const handleDocumentRemoval = (document: LocalDocument) => {
    if (!initialDocumentIds.current.has(document.id)) revokeDocumentUrls([document]);
  };
  const toggleUnit = (unitId: string) => {
    setSelectedUnits((current) => current.includes(unitId) ? current.filter((value) => value !== unitId) : [...current, unitId]);
    setFormError("");
  };
  const addContractRule = () => setContractRules((current) => [...current, { name: "Outro", responsibility: "Locatário", calculation: "Valor variável", amount: 0, dueRule: "Mesmo dia do aluguel", recurrence: "Mensal", proofRequired: false }]);
  const addChargeItem = () => {
    const selectedContract = contractOptions.find((contract) => contract.id === chargeContractId);
    setChargeItems((current) => [...current, { name: "Outro", reference: "", due: selectedContract ? contractDueDate(chargeCompetence, selectedContract.due, selectedContract.paymentReference) : "", amount: 0 }]);
    setChargeItemsDirty(true);
  };
  const guardChargeItemsReplacement = (source: "contrato" | "competência", apply: () => void) => {
    if (!chargeItemsDirty) { apply(); return; }
    setConfirmPrompt({
      title: "Substituir os itens da cobrança?",
      message: `Os itens foram editados manualmente. Trocar ${source === "contrato" ? "o contrato" : "a competência"} recria a lista a partir das regras vigentes e descarta os ajustes feitos aqui.`,
      confirmLabel: "Substituir itens",
      cancelLabel: "Manter itens atuais",
      tone: "danger",
      onConfirm: apply,
    });
  };
  const changeChargeContract = (nextContractId: string) => {
    if (nextContractId === chargeContractId) return;
    const nextContract = contractOptions.find((contract) => contract.id === nextContractId);
    if (!nextContract) return;
    guardChargeItemsReplacement("contrato", () => {
      setChargeContractId(nextContractId);
      setChargeItems(buildChargeItemsFromContract(nextContract, chargeCompetence));
      setChargeItemsDirty(false);
    });
  };
  const changeChargeCompetence = (nextCompetence: string) => {
    if (nextCompetence === chargeCompetence) return;
    const selectedContract = contractOptions.find((contract) => contract.id === chargeContractId);
    guardChargeItemsReplacement("competência", () => {
      setChargeCompetence(nextCompetence);
      if (selectedContract) setChargeItems(buildChargeItemsFromContract(selectedContract, nextCompetence));
      setChargeItemsDirty(false);
    });
  };
  const getTenantDocumentError = (value: string, type: Tenant["type"]) => {
    if (tenant && type === tenant.type && documentDigits(value) === documentDigits(tenant.document)) return "";
    const label = type === "PF" ? "CPF" : "CNPJ";
    const expectedLength = type === "PF" ? 11 : 14;
    if (documentDigits(value).length !== expectedLength) return `Informe um ${label} completo.`;
    if (!(type === "PF" ? hasValidCpf(value) : hasValidCnpj(value))) return `${label} inválido. Confira os dígitos.`;
    const duplicate = tenantOptions.some((record) => record.id !== tenant?.id && documentDigits(record.document) === documentDigits(value));
    return duplicate ? `${label} já cadastrado para outro locatário.` : "";
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (kind === "portfolio") {
      const documentChanged = !portfolio || documentDigits(portfolioDocument) !== documentDigits(portfolio.document);
      const documentError = documentChanged && portfolioDocument && !(portfolioOwnerType === "PF" ? hasValidCpf(portfolioDocument) : hasValidCnpj(portfolioDocument));
      if (documentError) {
        setFormError(`Informe um ${portfolioOwnerType === "PF" ? "CPF" : "CNPJ"} válido para o titular.`);
        return;
      }
    }
    if (kind === "tenant") {
      const documentError = getTenantDocumentError(tenantDocument, tenantType);
      if (documentError) {
        setTenantDocumentError(documentError);
        const documentField = event.currentTarget.elements.namedItem("tenantDocument");
        if (documentField instanceof HTMLElement) documentField.focus();
        return;
      }
      if (!String(data.get("tenantPhone") ?? "").trim() && !String(data.get("tenantEmail") ?? "").trim()) {
        setFormError("Informe ao menos um canal de contato: telefone/WhatsApp ou e-mail.");
        return;
      }
    }
    if (kind === "charge" && chargeBusinessError) {
      setFormError(chargeBusinessError);
      return;
    }
    const invalidField = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")).find((field) => !field.checkValidity());
    if (invalidField) {
      const fieldName = invalidField.closest("label")?.childNodes[0]?.textContent?.trim() || "campo obrigatório";
      invalidField.setAttribute("aria-invalid", "true");
      invalidField.setAttribute("aria-describedby", "entity-form-error");
      setFormError(`Revise “${fieldName}” antes de salvar.`);
      invalidField.focus();
      return;
    }
    if (kind === "contract" && selectedUnits.length === 0) {
      setFormError("Selecione ao menos uma unidade pertencente ao imóvel escolhido.");
      return;
    }
    if (kind === "contract") {
      const startIso = String(data.get("contractStart") ?? "");
      const endIso = String(data.get("contractEnd") ?? "");
      if (startIso >= endIso) {
        setFormError("O fim da vigência deve ser posterior ao início do contrato.");
        return;
      }
      if (Number(data.get("contractRent")) <= 0) {
        setFormError("O aluguel base deve ser maior que zero.");
        return;
      }
      if (contractGuaranteeType !== "Sem garantia" && !String(data.get("contractGuaranteeDetails") ?? "").trim()) {
        setFormError("Detalhe a garantia selecionada antes de salvar o contrato.");
        return;
      }
      if (contractRules.length === 0 || contractRules.some((rule) => !rule.name.trim() || (rule.calculation === "Valor fixo" && rule.name !== "Aluguel" && rule.amount <= 0))) {
        setFormError("Revise a composição financeira: cada item precisa de categoria e valor quando for fixo.");
        return;
      }
      data.set("contractRulesJson", JSON.stringify(contractRules.map((rule) => rule.name === "Aluguel" ? { ...rule, amount: Number(data.get("contractRent")) } : rule)));
      data.set("contractDocumentName", contractDocumentName);
    }
    if (kind === "charge") data.set("chargeItemsJson", JSON.stringify(chargeItems));
    if (kind === "expense") data.set("expenseAttachmentName", expenseAttachmentName);
    if (!navigator.onLine) {
      setFormError("Não foi possível salvar sem conexão. Reconecte e tente novamente.");
      return;
    }
    setFormError("");
    setSaving(true);
    window.setTimeout(() => onSave(data, supportsDocumentTopics ? categorizedDocuments : supportsDocuments ? documents : undefined), 450);
  };
  const clearFieldError = (event: FormEvent<HTMLFormElement>) => {
    const field = event.target;
    if (field instanceof HTMLElement && field.hasAttribute("aria-invalid")) {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    }
    if (formError) setFormError("");
  };
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={config[1]}><button type="button" className="drawer-backdrop" onClick={requestClose} aria-label="Fechar formulário" /><form className={`receipt-modal entity-modal entity-${kind}-modal`} noValidate onSubmit={handleSubmit} onInputCapture={clearFieldError} onChange={onFormChange}><header className="entity-form-hero"><span className="entity-form-mark" aria-hidden="true">{presentation.mark}</span><div><p>{presentation.label}</p><h2>{config[1]}</h2><span>{presentation.description}</span></div><b>{portfolio || property || unit || tenant ? "Modo de edição" : "Novo cadastro"}</b><button type="button" className="close-button" onClick={requestClose} aria-label="Fechar formulário"><X aria-hidden="true" /></button></header><div className="entity-modal-body"><InlineFieldError message={formError || chargeBusinessError} /><div className="form-grid entity-grid">
    {kind === "portfolio" && <>
      <EntityFormSection index="01" title="Identificação da carteira" description="O nome é obrigatório para identificar a carteira."><label className="full-field">Nome da carteira<input name="portfolioName" placeholder="Ex.: Carteira Atlas" defaultValue={portfolio?.name ?? ""} required /></label></EntityFormSection>
      <EntityFormSection index="02" title="Titularidade" description="Titular e CPF/CNPJ são obrigatórios. Escolha o tipo de pessoa."><label>Tipo de titular<select value={portfolioOwnerType} onChange={(event) => { const type = event.target.value as Tenant["type"]; setPortfolioOwnerType(type); setPortfolioDocument(maskTenantDocument(portfolioDocument, type)); }}><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></label><label>Titular<input name="portfolioHolder" list="portfolio-holder-options" placeholder="Razão social ou nome" defaultValue={portfolio?.holder ?? ""} required /><datalist id="portfolio-holder-options">{Array.from(new Set(portfolioOptions.map((record) => record.holder))).map((holder) => <option value={holder} key={holder} />)}</datalist></label><label className="full-field">{portfolioOwnerType === "PJ" ? "CNPJ" : "CPF"} do titular<input name="portfolioDocument" inputMode="numeric" value={portfolioDocument} onChange={(event) => setPortfolioDocument(maskTenantDocument(event.target.value, portfolioOwnerType))} placeholder={portfolioOwnerType === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} required /></label></EntityFormSection>
      <EntityFormSection index="03" title="Administração (opcional)" description="Estas informações podem ser preenchidas depois."><label>Gestor responsável<select name="portfolioManager" defaultValue={portfolio?.manager ?? ""}><option value="">Não definido</option>{MANAGER_OPTIONS.map((manager) => <option key={manager}>{manager}</option>)}</select></label><label className="full-field">Descrição<textarea name="portfolioDescription" rows={2} placeholder="Objetivo e escopo desta carteira" defaultValue={portfolio?.description ?? ""} /></label><label className="full-field">Observações internas<textarea name="portfolioNotes" rows={3} defaultValue={portfolio?.notes ?? ""} /></label></EntityFormSection>
    </>}
    {kind === "property" && <>
      <EntityFormSection index="01" title="Identificação do imóvel" description="Todos os campos desta seção são obrigatórios."><label>Carteira<select name="propertyPortfolio" defaultValue={property?.portfolio ?? portfolioOptions[0]?.name} required>{portfolioOptions.map((option) => <option key={option.id}>{option.name}</option>)}</select></label><label>Tipo de empreendimento<select name="propertyType" defaultValue={property?.propertyType ?? "Edifício comercial"} required>{PROPERTY_TYPE_OPTIONS.map((type) => <option key={type}>{type}</option>)}</select></label><label className="full-field">Nome do imóvel<input name="propertyName" placeholder="Ex.: Centro Empresarial Nexo" defaultValue={property?.name ?? ""} required /></label></EntityFormSection>
      <EntityFormSection index="02" title="Localização" description="Informe o endereço completo. Apenas o complemento é opcional."><label>CEP<input name="propertyCep" inputMode="numeric" placeholder="00000-000" defaultValue={property?.cep ?? ""} required /></label><label>Logradouro<input name="propertyStreet" placeholder="Rua, avenida ou rodovia" defaultValue={property?.street ?? property?.address ?? ""} required /></label><label>Número<input name="propertyNumber" placeholder="Número ou S/N" defaultValue={property?.number ?? ""} required /></label><label>Complemento (opcional)<input name="propertyComplement" placeholder="Torre, bloco ou referência" defaultValue={property?.complement ?? ""} /></label><label>Bairro<input name="propertyDistrict" defaultValue={property?.district ?? ""} required /></label><label>Cidade<input name="propertyCity" defaultValue={property?.city ?? ""} required /></label><label>UF<input name="propertyState" maxLength={2} placeholder="MG" defaultValue={property?.state ?? ""} required /></label></EntityFormSection>
      <EntityFormSection index="03" title="Dados registrais e administração" description="Campos opcionais. Você pode completar estas informações depois."><label>Inscrição imobiliária / IPTU<input name="propertyMunicipalRegistration" defaultValue={property?.municipalRegistration ?? ""} /></label><label>Matrícula<input name="propertyRegistryNumber" defaultValue={property?.registryNumber ?? ""} /></label><label>Cartório de registro<input name="propertyRegistryOffice" defaultValue={property?.registryOffice ?? ""} /></label><label>Gestor responsável<select name="propertyManager" defaultValue={property?.manager ?? ""}><option value="">Não definido</option>{MANAGER_OPTIONS.map((manager) => <option key={manager}>{manager}</option>)}</select></label><label className="full-field">Observações<textarea name="propertyNotes" rows={3} defaultValue={property?.notes ?? ""} /></label></EntityFormSection>
    </>}
    {kind === "unit" && <>
      <EntityFormSection index="01" title="Vínculo e identificação" description="Imóvel, tipo e código são obrigatórios. Novas unidades são cadastradas como disponíveis.">
        {unit?.occupied && <p className="form-help full-field" id="unit-identity-help">Unidade ocupada: imóvel, tipo e código estão protegidos para preservar os vínculos. Os demais dados podem ser atualizados.</p>}
        <label>Imóvel<select name="unitProperty" defaultValue={unit?.property ?? propertyOptions[0]?.name} required disabled={unit?.occupied} aria-describedby={unit?.occupied ? "unit-identity-help" : undefined}>{propertyOptions.map((option) => <option key={option.id}>{option.name}</option>)}</select></label>
        <label>Tipo de unidade<select name="unitType" defaultValue={initialUnitType} required disabled={unit?.occupied} aria-describedby={unit?.occupied ? "unit-identity-help" : undefined}>{UNIT_TYPE_OPTIONS.map((type) => <option key={type}>{type}</option>)}</select></label>
        {unit?.occupied && <><input type="hidden" name="unitProperty" value={unit.property} /><input type="hidden" name="unitType" value={initialUnitType} /></>}
        <label>Código / número<input name="unitCode" placeholder="Ex.: 101, A, 04" defaultValue={initialUnitCode} required readOnly={unit?.occupied} aria-describedby={unit?.occupied ? "unit-identity-help" : undefined} /></label>
        <label>Bloco / torre / setor (opcional)<input name="unitBlock" defaultValue={unit?.block ?? ""} /></label><label>Pavimento (opcional)<input name="unitFloor" defaultValue={unit?.floor ?? ""} /></label>
      </EntityFormSection>
      <EntityFormSection index="02" title="Características cadastrais" description="A área privativa é obrigatória. Os demais campos são opcionais."><label>Área privativa<span className="input-with-suffix"><input name="unitArea" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={unit?.area ?? ""} required /><span className="input-suffix" aria-hidden="true">m²</span></span></label><label>Área total (opcional)<span className="input-with-suffix"><input name="unitTotalArea" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={unit?.totalArea ?? ""} /><span className="input-suffix" aria-hidden="true">m²</span></span></label><label>Inscrição imobiliária própria<input name="unitMunicipalRegistration" defaultValue={unit?.municipalRegistration ?? ""} /></label><label className="full-field">Observações<textarea name="unitNotes" rows={3} defaultValue={unit?.notes ?? ""} /></label></EntityFormSection>
    </>}
    {kind === "tenant" && <>
      <EntityFormSection index="01" title="Identificação do locatário" description="Informe tipo, nome e CPF/CNPJ. Os campos opcionais estão identificados."><label>Tipo de pessoa<select name="tenantType" value={tenantType} onChange={(event) => { const nextType = event.target.value as Tenant["type"]; setTenantType(nextType); setTenantDocument(maskTenantDocument(tenantDocument, nextType)); setTenantDocumentError(""); }} required><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></label><label>{tenantType === "PJ" ? "Razão social" : "Nome completo"}<input name="tenantName" defaultValue={tenant?.name ?? ""} required /></label>{tenantType === "PJ" && <label>Nome fantasia (opcional)<input name="tenantTradeName" defaultValue={tenant?.tradeName ?? ""} /></label>}<label>{tenantType === "PJ" ? "CNPJ" : "CPF"}<input name="tenantDocument" inputMode="numeric" aria-label={tenantType === "PJ" ? "CNPJ" : "CPF"} aria-describedby="tenant-document-help" maxLength={tenantType === "PJ" ? 18 : 14} value={tenantDocument} onChange={(event) => { const masked = maskTenantDocument(event.target.value, tenantType); setTenantDocument(masked); setTenantDocumentError(""); }} onBlur={() => tenantDocument && setTenantDocumentError(getTenantDocumentError(tenantDocument, tenantType))} aria-invalid={tenantDocumentError ? "true" : undefined} required /><small id="tenant-document-help" className={tenantDocumentError ? "field-error" : "field-help"}>{tenantDocumentError || "O documento será validado e verificado contra duplicidades."}</small></label></EntityFormSection>
      <EntityFormSection index="02" title="Contato" description="É necessário informar ao menos um canal para comunicação e cobrança.">{tenantType === "PJ" && <label>Pessoa de contato<input name="tenantContactName" defaultValue={tenant?.contactName ?? ""} /></label>}<label>Telefone / WhatsApp<input name="tenantPhone" type="tel" placeholder="(31) 99999-9999" defaultValue={tenant?.phone ?? ""} /></label><label>E-mail<input name="tenantEmail" type="email" placeholder="financeiro@empresa.com.br" defaultValue={tenant?.email ?? ""} /></label><label>Canal preferencial<select name="tenantPreferredChannel" defaultValue={tenant?.preferredChannel ?? "E-mail"}><option>E-mail</option><option>WhatsApp</option><option>Telefone</option><option>Correspondência</option></select></label></EntityFormSection>
      <EntityFormSection index="03" title="Imobiliária responsável" description="Vínculo opcional com a empresa que administra este relacionamento."><label className="full-field">Imobiliária<select name="tenantResponsibleAgency" aria-label="Imobiliária" aria-describedby="tenant-agency-help" defaultValue={tenant?.responsibleAgencyId ?? ""}><option value="">Sem imobiliária responsável</option>{agencyOptions.map((agency) => <option value={agency.id} key={agency.id}>{agency.tradeName || agency.name} · {agency.creci}</option>)}</select><small id="tenant-agency-help" className="field-help">Novas imobiliárias podem ser cadastradas diretamente na aba de locatários.</small></label></EntityFormSection>
      <EntityFormSection index="04" title="Endereço de cobrança" description="Campos opcionais. Preencha quando precisar de correspondência ou comunicação formal.">{tenant?.billingAddress && <p className="form-help full-field">Endereço atual: {tenant.billingAddress}. Deixe os campos de endereço vazios para mantê-lo ou preencha o novo endereço completo para substituí-lo.</p>}<label>CEP<input name="tenantBillingCep" inputMode="numeric" placeholder="00000-000" /></label><label>Logradouro<input name="tenantBillingStreet" /></label><label>Número<input name="tenantBillingNumber" /></label><label>Complemento<input name="tenantBillingComplement" /></label><label>Bairro<input name="tenantBillingDistrict" /></label><label>Cidade<input name="tenantBillingCity" /></label><label>UF<input name="tenantBillingState" maxLength={2} /></label>{tenantType === "PJ" && <label>Inscrição municipal<input name="tenantMunicipalRegistration" defaultValue={tenant?.municipalRegistration ?? ""} /></label>}<label className="full-field">Observações internas<textarea name="tenantNotes" rows={3} defaultValue={tenant?.notes ?? ""} /></label></EntityFormSection>
    </>}
    {supportsDocumentTopics && <CategorizedDocumentManager documents={categorizedDocuments} onChange={setCategorizedDocuments} onRemove={handleDocumentRemoval} />}
    {(kind === "tenant" || kind === "unit") && <DocumentManager title={kind === "unit" ? "Documentos da unidade" : "Documentos do locatário"} description={kind === "unit" ? "Fotos, plantas, vistorias e manutenções específicas desta unidade." : "Anexe somente documentos necessários ao relacionamento e ao contrato."} documents={documents} onChange={setDocuments} onRemove={handleDocumentRemoval} />}
    {kind === "expense" && <>
      <EntityFormSection index="01" title="Origem e classificação" description="Vincule a obrigação a um fornecedor e a uma classificação consistente."><label>Fornecedor / beneficiário<input name="expenseSupplier" list="expense-supplier-options" placeholder="Busque ou informe o fornecedor" required /><datalist id="expense-supplier-options">{Array.from(new Set(expenses.map((expense) => expense.supplier))).map((supplier) => <option value={supplier} key={supplier} />)}</datalist></label><label>Categoria<select name="expenseCategory" required>{EXPENSE_CATEGORY_OPTIONS.map((category) => <option key={category}>{category}</option>)}</select></label><label className="full-field">Descrição<input name="expenseDescription" placeholder="Origem ou finalidade da despesa" required /></label><label>Alocação<select name="expenseAllocationType" value={expenseAllocationType} onChange={(event) => setExpenseAllocationType(event.target.value)}><option>Geral da operação</option><option>Carteira</option><option>Imóvel</option><option>Unidade</option><option>Contrato</option></select></label>{expenseAllocationOptions.length > 0 && <label>Registro vinculado<select name="expenseAllocationId" required><option value="" disabled>Selecione</option>{expenseAllocationOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}</EntityFormSection>
      <EntityFormSection index="02" title="Condições financeiras" description="Competência e vencimento são controles diferentes."><label>Valor<input name="expenseAmount" type="number" inputMode="decimal" min="0.01" step="0.01" required /></label><label>Competência<input name="expenseCompetence" type="month" defaultValue="2026-08" required /></label><label>Data de vencimento<input name="expenseDueDate" type="date" required /></label><label>Previsão de pagamento<input name="expensePlannedDate" type="date" /></label><label>Tipo de lançamento<select name="expenseEntryType" value={expenseEntryType} onChange={(event) => setExpenseEntryType(event.target.value)}><option>Única</option><option>Parcelada</option><option>Recorrente</option></select></label>{expenseEntryType !== "Única" && <label>{expenseEntryType === "Parcelada" ? "Quantidade de parcelas" : "Periodicidade"}<input name="expenseRecurrence" type={expenseEntryType === "Parcelada" ? "number" : "text"} min={expenseEntryType === "Parcelada" ? 2 : undefined} placeholder={expenseEntryType === "Parcelada" ? "Ex.: 6" : "Ex.: Mensal"} required /></label>}</EntityFormSection>
      <EntityFormSection index="03" title="Documento e pagamento" description="Guarde referências para auditoria e revele a baixa somente quando necessário."><label>Tipo de documento<select name="expenseDocumentType"><option value="">Não informado</option>{DOCUMENT_TYPE_OPTIONS.map((type) => <option key={type}>{type}</option>)}</select></label><label>Número do documento<input name="expenseDocumentNumber" /></label><label>Data de emissão<input name="expenseIssueDate" type="date" /></label><FileField label="Anexo" optional hint="Nota, guia, boleto ou contrato relacionado." accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" value={expenseAttachmentName ? [expenseAttachmentName] : []} onChange={(names) => setExpenseAttachmentName(names[0] ?? "")} /><label className="full-field check-inline"><input name="expenseAlreadyPaid" type="checkbox" checked={expenseAlreadyPaid} onChange={(event) => setExpenseAlreadyPaid(event.target.checked)} />Esta despesa já foi paga</label>{expenseAlreadyPaid && <><label>Data do pagamento<input name="expensePaidDate" type="date" defaultValue={DEMO_DATE_ISO} required /></label><label>Forma de pagamento<select name="expensePaymentMethod" required>{PAYMENT_METHOD_OPTIONS.map((method) => <option key={method}>{method}</option>)}</select></label><label>Conta financeira<select name="expenseFinancialAccount" required>{FINANCIAL_ACCOUNT_OPTIONS.map((account) => <option key={account}>{account}</option>)}</select></label></>}<label className="full-field">Observações<textarea name="expenseNotes" rows={3} /></label><p className="form-help full-field">O status será calculado pela data de vencimento e pelas baixas registradas.</p></EntityFormSection>
    </>}
    {kind === "contract" && <>
      <section className="contract-form-section full-field" aria-labelledby="contract-links-title">
        <header className="contract-section-heading"><span>01</span><div><h3 id="contract-links-title">Vínculos</h3><p>Selecione carteira, imóvel, ao menos uma unidade disponível e locatário.</p></div></header>
        <div className="contract-section-grid">
          <label>Carteira<select name="contractPortfolio" value={contractPortfolio} onChange={(event) => { setContractPortfolio(event.target.value); setContractProperty(""); setSelectedUnits([]); setFormError(""); }} required>{portfolioOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
          <label>Imóvel<select name="contractProperty" value={contractProperty} onChange={(event) => { setContractProperty(event.target.value); setSelectedUnits([]); setFormError(""); }} required><option value="" disabled>Selecione o imóvel</option>{contractProperties.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
          <fieldset className="full-field check-field" aria-describedby="contract-units-help"><legend>Unidades vinculadas</legend>{contractUnits.map((option) => <label key={option.id}><input type="checkbox" name="contractUnits" value={option.id} checked={selectedUnits.includes(option.id)} onChange={() => toggleUnit(option.id)} />{option.name}</label>)}<p className="selection-hint" id="contract-units-help">{!contractProperty ? "Selecione um imóvel para ver suas unidades disponíveis." : contractUnits.length === 0 ? "Nenhuma unidade disponível ou elegível para este imóvel." : `${contractUnits.length} unidade${contractUnits.length === 1 ? " disponível" : "s disponíveis"} para o imóvel selecionado.`}</p></fieldset>
          <label>Locatário<select name="contractTenant" defaultValue="" required><option value="" disabled>Selecione o locatário</option>{tenantOptions.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.document}</option>)}</select></label>
          <label>Finalidade<select name="contractPurpose" defaultValue="Comercial"><option>Comercial</option><option>Residencial</option><option>Industrial</option><option>Mista</option><option>Outra</option></select></label>
        </div>
      </section>
      <section className="contract-form-section full-field" aria-labelledby="contract-terms-title">
        <header className="contract-section-heading"><span>02</span><div><h3 id="contract-terms-title">Vigência</h3><p>Início e fim são obrigatórios. O término deve ser posterior ao início.</p></div></header>
        <div className="contract-section-grid">
          <label>Início da vigência<input name="contractStart" type="date" value={contractStart} onChange={(event) => setContractStart(event.target.value)} required /></label>
          <label>Fim da vigência<input name="contractEnd" type="date" min={contractStart || undefined} required /></label>
          <label>Data de ocupação (opcional)<input name="contractOccupancyDate" type="date" /></label>
          <label>Data de assinatura (opcional)<input name="contractSignatureDate" type="date" /></label>
          <label className="full-field">Primeira cobrança<select name="contractFirstChargeRule" defaultValue="Proporcional desde a ocupação"><option>Proporcional desde a ocupação</option><option>Mês integral da vigência</option><option>Competência seguinte</option><option>Definida manualmente</option></select></label>
        </div>
      </section>
      <EntityFormSection index="03" title="Condições financeiras" description="Centralize as regras usadas na geração e comunicação das cobranças.">
        <label>Aluguel base mensal (R$)<input name="contractRent" type="number" inputMode="decimal" min="0.01" step="0.01" value={contractRent} onChange={(event) => setContractRent(event.target.value)} required /></label>
        <label>Dia de vencimento<input name="contractDueDay" type="number" min="1" max="31" defaultValue={10} required /></label>
        <label>Referência do pagamento<select name="contractPaymentReference" defaultValue="Mês corrente"><option>Mês corrente</option><option>Mês vencido</option><option>Mês antecipado</option></select></label>
        <label>Forma preferencial<select name="contractPaymentMethod" defaultValue="Boleto"><option>Boleto</option><option>Pix</option><option>Transferência</option><option>Débito automático</option><option>Outra</option></select></label>
        <label className="full-field">Canal de envio<select name="contractDeliveryChannel" defaultValue="E-mail"><option>E-mail</option><option>WhatsApp</option><option>Portal</option><option>Correspondência</option></select></label>
      </EntityFormSection>
      <EntityFormSection index="04" title="Reajuste e encargos" description="Regras objetivas evitam cálculos manuais e divergências futuras.">
        <label>Índice de reajuste<select name="contractAdjustmentIndex" defaultValue="IPCA"><option>IPCA</option><option>IGP-M</option><option>INPC</option><option>Índice contratual</option><option>Sem reajuste</option></select></label>
        <label>Periodicidade (meses)<input name="contractAdjustmentPeriod" type="number" min="1" max="60" defaultValue={12} required /></label>
        <label>Mês-base<select name="contractAdjustmentMonth" defaultValue="Janeiro">{["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((month) => <option key={month}>{month}</option>)}</select></label>
        <label>Multa por atraso (%)<input name="contractLateFee" type="number" min="0" step="0.01" defaultValue={2} /></label>
        <label>Juros ao mês (%)<input name="contractMonthlyInterest" type="number" min="0" step="0.01" defaultValue={1} /></label>
      </EntityFormSection>
      <section className="contract-form-section contract-items-section full-field" aria-labelledby="contract-items-title">
        <header className="contract-section-heading"><span>05</span><div><h3 id="contract-items-title">Composição financeira</h3><p>Defina responsabilidade, cálculo, vencimento e comprovação de cada item.</p></div></header>
        <div className="repeatable-block"><div className="section-title"><h3>Itens previstos</h3><button type="button" className="text-button" onClick={addContractRule}>+ Adicionar item</button></div>{contractRules.map((item, index) => <fieldset className="contract-rule-row" key={index}><legend>Item {index + 1}</legend>
          <label>Categoria<input value={item.name} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, name: event.target.value } : value))} required /></label>
          <label>Responsável<select value={item.responsibility} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, responsibility: event.target.value } : value))}><option>Locatário</option><option>Locador</option><option>Compartilhado</option></select></label>
          <label>Cálculo<select value={item.calculation} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, calculation: event.target.value } : value))}><option>Valor fixo</option><option>Valor variável</option><option>Percentual</option><option>Conforme documento</option></select></label>
          <label>{item.calculation === "Percentual" ? "Percentual (%)" : "Valor (R$)"}<input type="number" min="0" step="0.01" value={item.name === "Aluguel" ? contractRent : item.calculation === "Valor variável" || item.calculation === "Conforme documento" ? "" : item.amount} placeholder="Na cobrança" onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, amount: Number(event.target.value) } : value))} disabled={item.name === "Aluguel" || item.calculation === "Valor variável" || item.calculation === "Conforme documento"} />{item.name === "Aluguel" && <small className="field-help">Usa o aluguel base mensal informado acima.</small>}</label>
          <label>Vencimento<select value={item.dueRule} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, dueRule: event.target.value } : value))}><option>Mesmo dia do aluguel</option><option>Conforme documento</option><option>Último dia útil</option><option>Definido na cobrança</option></select></label>
          <label>Recorrência<select value={item.recurrence} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, recurrence: event.target.value } : value))}><option>Mensal</option><option>Anual</option><option>Única</option><option>Eventual</option></select></label>
          <label className="check-inline"><input type="checkbox" checked={item.proofRequired} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, proofRequired: event.target.checked } : value))} />Exigir comprovante</label>
          <button type="button" className="remove-button" aria-label={`Remover item ${index + 1}: ${item.name}`} onClick={() => setContractRules((items) => items.filter((_, position) => position !== index))} disabled={contractRules.length === 1}>Remover item</button>
        </fieldset>)}</div>
        <p className="form-help">Salvar o contrato define as regras, mas não cria cobranças automaticamente.</p>
      </section>
      <EntityFormSection index="06" title="Garantia" description="Solicite detalhes apenas quando houver uma modalidade de garantia.">
        <label>Modalidade<select name="contractGuaranteeType" value={contractGuaranteeType} onChange={(event) => setContractGuaranteeType(event.target.value)}><option>Sem garantia</option><option>Caução</option><option>Fiador</option><option>Seguro-fiança</option><option>Título de capitalização</option><option>Outra</option></select></label>
        {contractGuaranteeType !== "Sem garantia" && <label className="full-field">Detalhes da garantia<textarea name="contractGuaranteeDetails" rows={3} placeholder="Valor, garantidor, validade ou referência da apólice" required /></label>}
      </EntityFormSection>
      <EntityFormSection index="07" title="Documento e observações" description="Campos opcionais. O arquivo selecionado registra apenas seu nome nesta demonstração.">
        <FileField className="full-field" label="Contrato assinado" optional hint="PDF ou imagem do instrumento contratual." accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" value={contractDocumentName ? [contractDocumentName] : []} onChange={(names) => setContractDocumentName(names[0] ?? "")} />
        <label className="full-field">Observações internas<textarea name="contractNotes" rows={3} /></label>
      </EntityFormSection>
    </>}
    {kind === "charge" && <>
      <EntityFormSection index="01" title="Origem e competência" description="Selecione o contrato e classifique corretamente o lançamento." className="charge-origin-section">
      {chargeSourceContract && <div className="edit-record-banner full-field"><span>Contrato de origem fixado</span><strong>{chargeSourceContract.id}</strong></div>}
      <label>Contrato
        <select name="chargeContract" value={chargeContractId} onChange={(event) => changeChargeContract(event.target.value)} disabled={Boolean(chargeSourceContract)} aria-describedby={chargeSourceContract ? "charge-contract-help" : undefined} required>
          <option value="" disabled>Selecione o contrato</option>{contractOptions.map((contract) => <option key={contract.id} value={contract.id}>{contract.id} · {contract.tenant}</option>)}
        </select>
        {chargeSourceContract && <><input type="hidden" name="chargeContract" value={chargeSourceContract.id} /><small id="charge-contract-help" className="field-help">Vínculo preservado a partir do contrato selecionado.</small></>}
      </label>
      <label>Competência<input name="chargeCompetence" type="month" required value={chargeCompetence} onChange={(event) => changeChargeCompetence(event.target.value)} /></label>
      <label>Tipo de lançamento<select name="chargeInclusionType" value={chargeInclusionType} onChange={(event) => setChargeInclusionType(event.target.value)}><option>Normal</option><option>Reemissão</option><option>Extraordinário</option><option>Ajuste</option></select></label>
      <label>Forma de pagamento<select name="chargePaymentMethod" defaultValue={selectedChargeContract?.paymentMethod ?? "Boleto"}>{PAYMENT_METHOD_OPTIONS.map((method) => <option key={method}>{method}</option>)}</select></label>
      {chargeInclusionType !== "Normal" && <label className="full-field">Motivo da exceção / observações<textarea name="chargeNotes" rows={3} placeholder="Explique por que este lançamento não segue o fluxo normal" required /></label>}
      </EntityFormSection>
      <section className="entity-form-section charge-items-form-section full-field"><header><span>02</span><div><h3>Composição da cobrança</h3><p>Confira categoria, referência, vencimento, valor e documento de suporte.</p></div></header><div className="charge-builder">
        <div className="section-title"><h3>Itens da cobrança</h3><button type="button" className="text-button" onClick={addChargeItem}>+ Adicionar item</button></div>
        {chargeItems.map((item, index) => <div className="charge-builder-row" key={index}>
          <span className="item-index">{String(index + 1).padStart(2, "0")}</span>
          <label>Categoria<input value={item.name} onChange={(event) => { setChargeItems((items) => items.map((value, position) => position === index ? { ...value, name: event.target.value } : value)); setChargeItemsDirty(true); }} aria-invalid={!item.name.trim() ? "true" : undefined} required /></label>
          <label className="charge-item-reference">Referência<input value={item.reference ?? ""} placeholder="Ex.: Parcela 08/12" onChange={(event) => { setChargeItems((items) => items.map((value, position) => position === index ? { ...value, reference: event.target.value } : value)); setChargeItemsDirty(true); }} /></label>
          <label>Vencimento<input type="date" value={item.due} onChange={(event) => { setChargeItems((items) => items.map((value, position) => position === index ? { ...value, due: event.target.value } : value)); setChargeItemsDirty(true); }} aria-invalid={!/^\d{4}-\d{2}-\d{2}$/.test(item.due) ? "true" : undefined} required /></label>
          <label>Valor<input type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => { setChargeItems((items) => items.map((value, position) => position === index ? { ...value, amount: Number(event.target.value) } : value)); setChargeItemsDirty(true); }} aria-invalid={!Number.isFinite(item.amount) || item.amount <= 0 ? "true" : undefined} required /></label>
          <FileField className="charge-item-proof" label="Documento de suporte" optional hint="Para itens variáveis." accept=".pdf,.jpg,.jpeg,.png" value={item.supportDocumentName ? [item.supportDocumentName] : []} onChange={(names) => { const supportDocumentName = names[0] ?? ""; setChargeItems((items) => items.map((value, position) => position === index ? { ...value, supportDocumentName } : value)); setChargeItemsDirty(true); }} />
          <button type="button" className="remove-button" onClick={() => { setChargeItems((items) => items.filter((_, position) => position !== index)); setChargeItemsDirty(true); }}>Remover</button>
        </div>)}
        <div className="builder-total"><span>Total previsto</span><strong>{brl.format(chargeItems.reduce((sum, item) => sum + item.amount, 0))}</strong></div>
      </div><p className="form-help">Os vencimentos podem ficar fora do mês de competência quando a regra contratual exigir, como no pagamento em mês vencido.</p></section>
    </>}
  </div></div><ModalFooter onClose={requestClose} action={config[2]} pending={saving} disabled={kind === "charge" && Boolean(chargeBusinessError)} disabledReason={chargeBusinessError} /></form>
    {confirmPrompt && <ConfirmDialog title={confirmPrompt.title} message={confirmPrompt.message} confirmLabel={confirmPrompt.confirmLabel} cancelLabel={confirmPrompt.cancelLabel ?? "Cancelar"} tone={confirmPrompt.tone ?? "default"} onConfirm={() => { confirmPrompt.onConfirm(); setConfirmPrompt(null); }} onCancel={() => setConfirmPrompt(null)} />}
    {discardDialog}
  </div>;
}
