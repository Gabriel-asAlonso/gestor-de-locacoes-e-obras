"use client";

import type { CSSProperties, ReactNode } from "react";
import { createContext, FormEvent, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpDown,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
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
  type WorkFinancialEntry,
  type WorkJournalEntry,
  type WorkPendingItem,
  type WorkTeamAllocation,
} from "./work-detail-mocks";
import {
  createWorkTeamPeople,
  type WorkCostMode,
  type WorkPerson,
  type WorkPersonAllocation,
  type WorkPersonStatus,
  type WorkPersonType,
} from "./work-team-mocks";
import {
  createWorkFinancialMock,
  type WorkBudgetQuote,
  type WorkBudgetStatus,
  type WorkCashMovement,
  type WorkCashMovementStatus,
  type WorkCashMovementType,
  type WorkExpense as WorkModuleExpense,
  type WorkExpenseStatus,
} from "./work-financial-mocks";
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
type Page = "Visão geral" | "Carteiras" | "Imóveis" | "Unidades" | "Locatários" | "Contratos" | "Cobranças" | "Despesas" | "Obras" | "Nova obra" | "Detalhe da obra" | "Cronograma" | "Equipe" | "Financeiro";
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
type WorkDetailTab = "Resumo" | "Planejamento" | "Equipe" | "Financeiro" | "Diário e arquivos";
type WorkDetailAction =
  | { type: "update" | "activity" | "expense" | "budget" | "team" | "cash" }
  | { type: "block" | "reprogram"; activity: WorkActivity }
  | null;
type WorkScheduleActivity = WorkActivity & {
  workId: string;
  workTitle: string;
  property: string;
  reprogramReason?: string;
};
type WorkScheduleAction = { type: "new" } | { type: "reprogram"; activity: WorkScheduleActivity } | null;
type WorkTeamPageAction = { type: "new" } | { type: "edit" | "allocate"; person: WorkPerson } | null;
type WorkFinanceTab = "Orçamentos" | "Gastos" | "Caixa";
type WorkFinanceAction =
  | { type: "budget" | "expense" | "cash" }
  | { type: "select"; budget: WorkBudgetQuote }
  | { type: "pay"; expense: WorkModuleExpense }
  | null;
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
  { id: "LOC-018", type: "PJ", name: "Estúdio Vereda Ltda.", document: "23.456.789/0001-95", contracts: 1 },
  { id: "LOC-021", type: "PJ", name: "Clínica Lumina Ltda.", document: "34.567.890/0001-30", contracts: 1 },
  { id: "LOC-009", type: "PJ", name: "Logística Prisma Ltda.", document: "45.678.901/0001-75", contracts: 1 },
  { id: "LOC-014", type: "PJ", name: "Oficina Sete Ltda.", document: "12.345.678/0001-95", contracts: 1 },
  { id: "LOC-004", type: "PF", name: "Marina Duarte", document: "123.456.789-09", contracts: 0 },
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
  const name = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(" ", "-");
  return <span className={`status status-${name}`}><i />{status}</span>;
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
  const [editingWork, setEditingWork] = useState<WorkRecord | null>(null);
  const [selectedWork, setSelectedWork] = useState<WorkRecord | null>(null);
  const [selectedWorkTab, setSelectedWorkTab] = useState<WorkDetailTab>("Resumo");
  const [workFormOrigin, setWorkFormOrigin] = useState<"Obras" | "Detalhe da obra">("Obras");
  const [financeWorkFilter, setFinanceWorkFilter] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [contentState, setContentState] = useState<ContentState>("ready");
  const [online, setOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => { documentsByOwnerRef.current = documentsByOwner; }, [documentsByOwner]);
  useEffect(() => { categorizedDocumentsByOwnerRef.current = categorizedDocumentsByOwner; }, [categorizedDocumentsByOwner]);
  useEffect(() => () => revokeDocumentUrls(Object.values(documentsByOwnerRef.current).flat()), []);
  useEffect(() => () => revokeDocumentUrls(Object.values(categorizedDocumentsByOwnerRef.current).flatMap(flattenCategorizedDocuments)), []);
  useEffect(() => () => { if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current); }, []);

  useEffect(() => {
    const handleOffline = () => { setOnline(false); setContentState("error"); };
    const handleOnline = () => {
      setOnline(true);
      setContentState("loading");
      window.setTimeout(() => setContentState("ready"), 450);
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
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [expense.id, expense.supplier, expense.description, expense.category].some((value) => value.toLowerCase().includes(query));
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
    if (next !== page) setContentState("loading");
    setPage(next);
    setSearch("");
    setPortfolioFilter("Todas as carteiras");
    setStatusFilter("Todas");
    setCategoryFilter("Todas as categorias");
    if (next !== "Financeiro") setFinanceWorkFilter(null);
    setMenuOpen(false);
    setSidebarCollapsed(activeModule === "Módulo 1");
    if (next !== page) window.setTimeout(() => setContentState(navigator.onLine ? "ready" : "error"), 450);
  };
  const changeModule = (next: AppModule) => {
    if (next === activeModule) return;
    setContentState("loading");
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
    setForm(null);
    setEditingWork(null);
    setSelectedWork(null);
    setFinanceWorkFilter(null);
    setMenuOpen(false);
    setSidebarCollapsed(false);
    window.setTimeout(() => setContentState(navigator.onLine ? "ready" : "error"), 300);
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
    setEditingWork(null);
    setSelectedWork(nextWork);
    setSelectedWorkTab("Resumo");
    notify(isEditing ? "Obra atualizada nesta sessão." : "Obra adicionada à demonstração.", nextWork.id);
    changePage("Detalhe da obra");
  };
  const openWorkDetail = (work: WorkRecord, initialTab: WorkDetailTab = "Resumo") => {
    setSelectedWork(work);
    setSelectedWorkTab(initialTab);
    changePage("Detalhe da obra");
  };
  const openWorkFinance = (work: WorkRecord) => {
    setFinanceWorkFilter(work.id);
    changePage("Financeiro");
  };
  const updateWorkFromDetail = (nextWork: WorkRecord, message: string) => {
    setWorkRecordState((current) => current.map((work) => work.id === nextWork.id ? nextWork : work));
    setSelectedWork(nextWork);
    notify(message, nextWork.id);
  };
  const updateWorkFromSchedule = (nextWork: WorkRecord, message: string) => {
    setWorkRecordState((current) => current.map((work) => work.id === nextWork.id ? nextWork : work));
    notify(message, nextWork.id);
  };
  const retryContent = () => {
    setContentState("loading");
    window.setTimeout(() => {
      const connected = navigator.onLine;
      setOnline(connected);
      setContentState(connected ? "ready" : "error");
    }, 650);
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
      const unitProperty = String(data.get("unitProperty") ?? "");
      const selectedProperty = propertyRecords.find((record) => record.name === unitProperty);
      const unitType = String(data.get("unitType") ?? "");
      const code = String(data.get("unitCode") ?? "");
      const values = {
        property: unitProperty,
        portfolio: selectedProperty?.portfolio ?? editingUnit?.portfolio ?? portfolioRecords[0]?.name ?? "",
        unitType,
        code,
        name: `${unitType.replace(" comercial", "")} ${code}`.trim(),
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
        notes: String(data.get("tenantNotes") ?? ""),
      };
      if (editingTenant) {
        setTenantRecords((records) => records.map((record) => record.id === editingTenant.id ? { ...record, ...values } : record));
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
    <Sidebar module={activeModule} page={page} attentionCount={chargeAttentionCount} onModuleChange={changeModule} onNavigate={changePage} onLogout={() => setAuthenticated(false)} open={menuOpen} onClose={() => setMenuOpen(false)} collapsed={sidebarCollapsed} onExpand={() => setSidebarCollapsed(false)} />
    <section className="workspace" onClick={() => !sidebarCollapsed && setSidebarCollapsed(true)}>
      <header className="topbar">
        <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir navegação"><Menu aria-hidden="true" /></button>
        <div><span className="breadcrumb">{activeModule} /</span> {page}</div>
        <div className="topbar-context"><span className="context-dot" /> Dados fictícios</div>
      </header>
      <div className="content">
        {!online && <ConnectionBanner onRetry={retryContent} />}
        {contentState === "loading" && <AuthenticatedPageSkeleton />}
        {contentState === "error" && <SystemError onRetry={retryContent} />}
        {contentState === "ready" && <FilterStateContext.Provider value={Boolean(search || portfolioFilter !== "Todas as carteiras" || statusFilter !== "Todas" || categoryFilter !== "Todas as categorias")}><div className="page-enter" key={`${activeModule}-${page}`}>
          {activeModule === "Módulo 1" && page === "Visão geral" && <DashboardPage charges={chargeRecords} negotiations={negotiationsByCharge} expenses={expenseRecords} properties={propertyRecords} units={unitRecords} contracts={contractRecords} onNavigate={(next, status) => { changePage(next); if (status) setStatusFilter(status); }} />}
          {activeModule === "Módulo 2" && page === "Visão geral" && <WorksDashboardPage works={workRecordState} onNewWork={beginNewWork} onOpenWork={openWorkDetail} onNavigate={changePage} />}
          {activeModule === "Módulo 2" && page === "Obras" && <WorksListPage works={workRecordState} onNewWork={beginNewWork} onEditWork={beginEditWork} onOpenWork={openWorkDetail} />}
          {activeModule === "Módulo 2" && page === "Nova obra" && <WorkFormPage work={editingWork} works={workRecordState} properties={propertyRecords} units={unitRecords} onCancel={leaveWorkForm} onSave={saveWork} />}
          {activeModule === "Módulo 2" && page === "Detalhe da obra" && selectedWork && <WorkDetailPage key={selectedWork.id} work={selectedWork} initialTab={selectedWorkTab} onBack={() => { setSelectedWork(null); changePage("Obras"); }} onEdit={() => beginEditWork(selectedWork)} onOpenFinance={() => openWorkFinance(selectedWork)} onUpdateWork={updateWorkFromDetail} onNotify={notify} />}
          {activeModule === "Módulo 2" && page === "Cronograma" && <WorksSchedulePage works={workRecordState} onOpenWork={openWorkDetail} onUpdateWork={updateWorkFromSchedule} onNotify={notify} />}
          {activeModule === "Módulo 2" && page === "Equipe" && <WorksTeamPage works={workRecordState} onOpenWork={openWorkDetail} onNotify={notify} />}
          {activeModule === "Módulo 2" && page === "Financeiro" && <WorksFinancialPage works={workRecordState} initialWorkId={financeWorkFilter} onOpenWork={openWorkDetail} onNotify={notify} />}
          {activeModule === "Módulo 1" && page === "Cobranças" && <ChargesPage charges={filteredCharges} summaryCharges={chargesInScope} negotiations={negotiationsByCharge} total={chargeRecords.length} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onOpen={setSelectedCharge} onNew={() => { setChargeSourceContract(null); setForm("charge"); }} onReport={() => setReportOpen(true)} />}
          {activeModule === "Módulo 1" && page === "Carteiras" && <PortfoliosPage portfolios={portfolioRecords} properties={propertyRecords} units={unitRecords} search={search} setSearch={setSearch} onNew={() => { setEditingPortfolio(null); setForm("portfolio"); }} onEdit={(portfolio) => { setEditingPortfolio(portfolio); setForm("portfolio"); }} />}
          {activeModule === "Módulo 1" && page === "Imóveis" && <PropertiesPage properties={propertyRecords} units={unitRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => { setEditingProperty(null); setForm("property"); }} onOpen={(property) => setRegistryDetail({ kind: "property", record: property })} />}
          {activeModule === "Módulo 1" && page === "Unidades" && <UnitsPage units={unitRecords} properties={propertyRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => { setEditingUnit(null); setForm("unit"); }} onOpen={(unit) => setRegistryDetail({ kind: "unit", record: unit })} onEdit={(unit) => { setEditingUnit(unit); setForm("unit"); }} />}
          {activeModule === "Módulo 1" && page === "Locatários" && <TenantsPage tenants={tenantRecords} contracts={contractRecords} charges={chargeRecords} search={search} setSearch={setSearch} onNew={() => { setEditingTenant(null); setForm("tenant"); }} onOpen={(tenant) => setRegistryDetail({ kind: "tenant", record: tenant })} onEdit={(tenant) => { setEditingTenant(tenant); setForm("tenant"); }} />}
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
    {form && <EntityForm kind={form} portfolio={form === "portfolio" ? editingPortfolio : null} property={form === "property" ? editingProperty : null} unit={form === "unit" ? editingUnit : null} tenant={form === "tenant" ? editingTenant : null} documents={(form === "tenant" && editingTenant) || (form === "unit" && editingUnit) ? documentsByOwner[(editingTenant ?? editingUnit)!.id] ?? [] : []} categorizedDocuments={form === "property" && editingProperty ? categorizedDocumentsByOwner[editingProperty.id] ?? createEmptyCategorizedDocuments() : undefined} chargeSourceContract={form === "charge" ? chargeSourceContract : null} portfolioOptions={portfolioRecords} propertyOptions={propertyRecords} unitOptions={unitRecords} tenantOptions={tenantRecords} contractOptions={contractRecords} chargeOptions={chargeRecords} onClose={() => { setForm(null); setEditingPortfolio(null); setEditingProperty(null); setEditingUnit(null); setEditingTenant(null); setChargeSourceContract(null); }} onSave={saveForm} />}
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
        <div className="login-footer"><span /> Ambiente demonstrativo</div>
        <div className="login-property-caption"><strong>Centro Empresarial Nexo</strong><span>Patrimônio em destaque</span></div>
      </div>
    </section>
    <section className="login-panel" aria-label="Acesso administrativo">
      <div className="login-panel-inner">
        <div className="login-panel-context"><span>LR</span><p><strong>Módulo administrativo</strong><small>Ambiente seguro de demonstração</small></p></div>
        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-heading"><p className="eyebrow">Acesso administrativo</p><h2>Boas-vindas</h2><p>Entre para visualizar a operação patrimonial e financeira em um único painel.</p></div>
          <label>E-mail<input type="email" defaultValue="administrativo@exemplo.com.br" autoComplete="email" required /></label>
          <label>Senha<input type="password" defaultValue="demonstracao" autoComplete="current-password" required /></label>
          <button className="primary-button login-button" disabled={loading} aria-busy={loading}>{loading ? <><span className="spinner" /> Preparando ambiente</> : <><span>Acessar demonstração</span><span className="login-button-arrow" aria-hidden="true"><ArrowRight /></span></>}</button>
          <div className="login-trust-note"><span aria-hidden="true"><Check /></span><p><strong>Dados exclusivamente demonstrativos</strong><small>Nenhuma informação real do cliente é exibida nesta versão.</small></p></div>
        </form>
        <p className="login-panel-version">Locações &amp; Recebíveis · Módulo 1</p>
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

function Sidebar({ module, page, attentionCount, onModuleChange, onNavigate, onLogout, open, onClose, collapsed, onExpand }: { module: AppModule; page: Page; attentionCount: number; onModuleChange: (module: AppModule) => void; onNavigate: (page: Page) => void; onLogout: () => void; open: boolean; onClose: () => void; collapsed: boolean; onExpand: () => void }) {
  const [openTheme, setOpenTheme] = useState<string | null>("Operação");
  const groups: Array<{ name: string; description: string; pages: Array<{ name: Page; count?: number }> }> = [
    { name: "Operação", description: "Acompanhamento diário", pages: [{ name: "Visão geral" }] },
    { name: "Estrutura", description: "Cadastros e patrimônio", pages: [{ name: "Carteiras" }, { name: "Imóveis" }, { name: "Unidades" }, { name: "Locatários" }] },
    { name: "Locação", description: "Contratos e recebíveis", pages: [{ name: "Contratos" }, { name: "Cobranças", count: attentionCount }] },
    { name: "Financeiro", description: "Obrigações financeiras", pages: [{ name: "Despesas" }] },
  ];
  const worksItems: Array<{ name: string; description: string; page?: Page }> = [
    { name: "Visão geral", description: "Prioridades e andamento", page: "Visão geral" },
    { name: "Obras", description: "Cadastros e execução", page: "Obras" },
    { name: "Cronograma", description: "Agenda e calendário", page: "Cronograma" },
    { name: "Equipe", description: "Pessoas e alocações", page: "Equipe" },
    { name: "Financeiro", description: "Orçamentos, gastos e caixa", page: "Financeiro" },
  ];
  const compact = collapsed && !open;
  const item = (name: Page, count?: number) => <button type="button" onClick={() => onNavigate(name)} className={`nav-item ${page === name ? "active" : ""}`} aria-current={page === name ? "page" : undefined} title={compact ? name : undefined}><SidebarGlyph name={name} /><span className="nav-item-label">{name}</span>{count !== undefined && <b>{count}</b>}</button>;
  return <>
    {open && <button className="mobile-backdrop" onClick={onClose} aria-label="Fechar navegação" />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""} ${compact ? "sidebar-collapsed" : ""}`} aria-label={`Navegação do ${module}`} onClick={() => { if (compact) onExpand(); }}>
      <div className="sidebar-main">
        <div className="sidebar-brand">
          <div className="brand-mark sidebar-logo"><span>L</span><i /><span>R</span></div>
          <div className="sidebar-brand-copy"><strong>Locações & Recebíveis</strong><span>Gestão operacional · {module}</span></div>
          <button type="button" className="sidebar-mobile-close" onClick={onClose} aria-label="Fechar navegação"><X aria-hidden="true" /></button>
        </div>
        <div className="module-switcher" role="group" aria-label="Selecionar módulo">
          <button type="button" className={module === "Módulo 1" ? "active" : ""} aria-pressed={module === "Módulo 1"} onClick={() => onModuleChange("Módulo 1")}><b>01</b><span><strong>Locações</strong><small>Patrimônio e recebíveis</small></span></button>
          <button type="button" className={module === "Módulo 2" ? "active" : ""} aria-pressed={module === "Módulo 2"} onClick={() => onModuleChange("Módulo 2")}><b>02</b><span><strong>Obras</strong><small>Planejamento e execução</small></span></button>
        </div>
        <nav aria-label={`Navegação principal do ${module}`}>
          {module === "Módulo 1" ? <div className="theme-list">{groups.map((group, index) => {
            const expanded = openTheme === group.name;
            const hasActivePage = group.pages.some((entry) => entry.name === page);
            const regionId = `sidebar-theme-${index}`;
            return <section className="theme-group" key={group.name}>
              <button type="button" className={`theme-toggle ${expanded ? "open" : ""} ${hasActivePage ? "has-active-page" : ""}`} onClick={() => setOpenTheme(expanded && !collapsed ? null : group.name)} aria-expanded={expanded && !compact} aria-controls={regionId} title={compact ? group.name : undefined}>
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
        <div className="sidebar-environment"><span className="environment-dot" /><div><strong>Base demonstrativa</strong><small>Dados fictícios</small></div></div>
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
  return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action && onAction && <button className="primary-button button-with-icon" onClick={onAction}><Plus aria-hidden="true" />{action}</button>}</section>;
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="search-field"><Search aria-hidden="true" /><input aria-label="Buscar" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
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

function AuthenticatedPageSkeleton() {
  return <div className="page-skeleton" role="status" aria-live="polite"><span className="sr-only">Carregando conteúdo</span><div className="skeleton-heading"><i /><i /></div><div className="skeleton-cards">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div><div className="skeleton-table"><i />{Array.from({ length: 5 }, (_, index) => <span key={index}><b /><b /><b /><b /></span>)}</div></div>;
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
      <span className="empty-state-orbit"><i /></span>
      <span className="empty-state-sheet empty-state-sheet-back"><i /><i /><i /></span>
      <span className="empty-state-sheet empty-state-sheet-front"><b>{isFiltered ? "?" : mark}</b><i /><i /><em>{isFiltered ? <Search /> : <Plus />}</em></span>
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
  if (kind === "payment" || kind === "cost" || kind === "budget") return <HandCoins aria-hidden="true" />;
  return <TriangleAlert aria-hidden="true" />;
}

function workAttentionDestination(kind: WorkAttention["kind"]): { tab: WorkDetailTab; label: string } {
  if (kind === "schedule") return { tab: "Planejamento", label: "Abrir planejamento" };
  if (kind === "update") return { tab: "Diário e arquivos", label: "Ver atualizações" };
  return { tab: "Financeiro", label: "Abrir financeiro" };
}

function WorksDashboardPage({ works, onNewWork, onOpenWork, onNavigate }: { works: WorkRecord[]; onNewWork: () => void; onOpenWork: (work: WorkRecord, initialTab?: WorkDetailTab) => void; onNavigate: (page: Page) => void }) {
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
  const spent = scopedWorks.filter((work) => work.status !== "Cancelada").reduce((sum, work) => sum + work.spent, 0);
  const totalBudget = scopedWorks.filter((work) => work.status !== "Cancelada").reduce((sum, work) => sum + work.budget, 0);
  const projectedBalance = scopedWorks.filter((work) => work.status !== "Cancelada").reduce((sum, work) => sum + work.projectedCashBalance, 0);
  const featuredWork = activeWorks[0] ?? scopedWorks[0];
  const featuredAttention = attentions[0];
  const featuredBudgetUse = featuredWork?.budget ? Math.min(100, Math.round((featuredWork.spent / featuredWork.budget) * 100)) : 0;
  const averageProgress = activeWorks.length > 0 ? Math.round(activeWorks.reduce((sum, work) => sum + work.progress, 0) / activeWorks.length) : 0;
  const inProgressRatio = scopedWorks.length > 0 ? Math.round((inProgress / scopedWorks.length) * 100) : 0;
  const delayedRatio = scopedWorks.length > 0 ? Math.round((delayed / scopedWorks.length) * 100) : 0;
  const spentRatio = totalBudget > 0 ? Math.min(100, Math.round((spent / totalBudget) * 100)) : 0;
  const balanceRatio = totalBudget > 0 ? Math.min(100, Math.round((Math.abs(projectedBalance) / totalBudget) * 100)) : 0;
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
          <span className="works-featured-next"><i><ClipboardList aria-hidden="true" /></i><span><small>Próximo marco</small><b>{featuredWork.nextActivity}</b></span></span>
          <span className="works-featured-stats">
            <span><small>Progresso</small><b>{featuredWork.progress}%</b></span>
            <span><small>Prazo final</small><b>{featuredWork.endLabel}</b></span>
            <span><small>Orçamento usado</small><b>{featuredBudgetUse}%</b></span>
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
            return <button type="button" key={attention.id} className={`works-priority-item works-priority-${attention.tone}`} onClick={() => openAttention(attention)} aria-label={`${attention.title}. ${destination.label} da obra ${attention.workId}`}><i><WorkAttentionIcon kind={attention.kind} /></i><span><strong>{attention.title}</strong><small>{attention.workId} · {attention.meta}</small><em>{destination.label}</em></span><ArrowRight aria-hidden="true" /></button>;
          })}</div> : null}
        </> : <CompactEmptyState mark="✓" tone="success" title="Nada exige atenção neste filtro" description="Troque o imóvel ou o período para consultar outras obras." />}
      </article>
    </section>

    <section className="works-metrics" aria-label="Indicadores essenciais das obras">
      <article className="works-metric works-metric-active"><span><ClipboardList aria-hidden="true" /></span><div><small>Obras em andamento</small><strong>{inProgress}</strong><p>{averageProgress}% de avanço médio nas obras ativas</p><i className="works-metric-track" role="progressbar" aria-valuenow={inProgressRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${inProgressRatio}% das obras estão em andamento`}><b style={{ width: `${inProgressRatio}%` }} /></i></div></article>
      <article className="works-metric works-metric-danger"><span><TriangleAlert aria-hidden="true" /></span><div><small>Obras em atraso</small><strong>{delayed}</strong><p>{delayed === 1 ? "1 obra requer ação hoje" : `${delayed} obras requerem ação hoje`}</p><i className="works-metric-track" role="progressbar" aria-valuenow={delayedRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${delayedRatio}% das obras estão em atraso`}><b style={{ width: `${delayedRatio}%` }} /></i></div></article>
      <article className="works-metric works-metric-spent"><span><HandCoins aria-hidden="true" /></span><div><small>Total gasto</small><strong>{brl.format(spent)}</strong><p>{spentRatio}% do orçamento previsto no filtro</p><i className="works-metric-track" role="progressbar" aria-valuenow={spentRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${spentRatio}% do orçamento foi utilizado`}><b style={{ width: `${spentRatio}%` }} /></i></div></article>
      <article className={`works-metric ${projectedBalance < 0 ? "works-metric-danger" : "works-metric-balance"}`}><span><WalletCards aria-hidden="true" /></span><div><small>Saldo projetado</small><strong>{brl.format(projectedBalance)}</strong><p>{projectedBalance < 0 ? "Projeção exige recomposição financeira" : "Margem projetada sobre o orçamento"}</p><i className="works-metric-track" role="progressbar" aria-valuenow={balanceRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${balanceRatio}% do orçamento em saldo projetado`}><b style={{ width: `${balanceRatio}%` }} /></i></div></article>
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
        <header><div><p className="eyebrow">Próximas datas</p><h2 id="works-commitments-title">Agenda das obras</h2></div><button type="button" className="works-section-link works-section-link-inverse" onClick={() => onNavigate("Cronograma")}>Abrir cronograma<ArrowRight aria-hidden="true" /></button></header>
        {commitments.length > 0 ? <div className="works-commitments-list">{commitments.slice(0, 5).map((commitment) => {
          const work = works.find((record) => record.id === commitment.workId);
          return <button type="button" key={commitment.id} onClick={() => work && onOpenWork(work, "Planejamento")} aria-label={`${commitment.title}. Abrir planejamento da obra ${commitment.workId}`}><time dateTime={commitment.dateIso}><strong>{commitment.day}</strong><small>{commitment.month}</small></time><span><strong>{commitment.title}</strong><small>{commitment.description}</small><em className={`commitment-${commitment.status === "Atrasado" ? "danger" : commitment.status === "Hoje" ? "today" : "next"}`}>{commitment.status}</em></span><ArrowRight aria-hidden="true" /></button>;
        })}</div> : <CompactEmptyState mark="00" title="Sem compromissos neste período" description="As próximas atividades das obras aparecerão aqui." />}
      </aside>
    </section>
  </div>;
}

function WorksListPage({ works, onNewWork, onEditWork, onOpenWork }: { works: WorkRecord[]; onNewWork: () => void; onEditWork: (work: WorkRecord) => void; onOpenWork: (work: WorkRecord) => void }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas as situações");
  const [propertyFilter, setPropertyFilter] = useState("Todos os imóveis");
  const [managerFilter, setManagerFilter] = useState("Todos os responsáveis");
  const [priorityFilter, setPriorityFilter] = useState("Todas as prioridades");
  const [periodFilter, setPeriodFilter] = useState("Todo o período");
  const [onlyDelayed, setOnlyDelayed] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sortBy, setSortBy] = useState("priority");
  const properties = Array.from(new Set(works.map((work) => work.property))).sort((left, right) => left.localeCompare(right, "pt-BR"));
  const managers = Array.from(new Set(works.map((work) => work.manager))).sort((left, right) => left.localeCompare(right, "pt-BR"));
  const periodRange = periodFilter === "Agosto de 2026"
    ? { start: "2026-08-01", end: "2026-08-31" }
    : periodFilter === "Próximos 30 dias"
      ? { start: "2026-08-24", end: "2026-09-23" }
      : null;
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const priorityRank: Record<WorkRecord["priority"], number> = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };
  const filteredWorks = works.filter((work) => {
    const searchable = [work.id, work.title, work.property, work.unit ?? "", work.manager, work.nextActivity].join(" ").toLocaleLowerCase("pt-BR");
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
    if (sortBy === "budget") return right.budget - left.budget;
    return priorityRank[left.priority] - priorityRank[right.priority] || left.endDateIso.localeCompare(right.endDateIso);
  });
  const executionWorks = filteredWorks.filter((work) => work.status === "Em andamento");
  const filteredInProgress = executionWorks.length;
  const filteredPaused = filteredWorks.filter((work) => work.status === "Pausada").length;
  const filteredCompleted = filteredWorks.filter((work) => work.status === "Concluída").length;
  const filteredAttention = filteredWorks.filter((work) => work.status !== "Concluída" && work.status !== "Cancelada" && (work.risk === "Em atraso" || work.risk === "Atenção")).length;
  const filteredAverageProgress = executionWorks.length > 0 ? Math.round(executionWorks.reduce((sum, work) => sum + work.progress, 0) / executionWorks.length) : 0;
  const filteredBudget = filteredWorks.filter((work) => work.status !== "Cancelada").reduce((sum, work) => sum + work.budget, 0);
  const filteredSpent = filteredWorks.filter((work) => work.status !== "Cancelada").reduce((sum, work) => sum + work.spent, 0);
  const filteredBudgetUse = filteredBudget > 0 ? Math.round((filteredSpent / filteredBudget) * 100) : 0;
  const filteredBudgetBalance = filteredBudget - filteredSpent;
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
  };

  return <div className="works-list-page">
    <section className="works-dashboard-heading works-list-heading" aria-labelledby="works-list-title">
      <div><p className="eyebrow">Módulo 2 · Gestão de Obras</p><h1 id="works-list-title">Obras</h1><p>Localize obras, reparos e manutenções sem precisar abrir cada cadastro.</p></div>
      <button type="button" className="primary-button button-with-icon works-new-button" onClick={onNewWork}><Plus aria-hidden="true" />Nova obra</button>
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

    <section className="works-list-insights" aria-label="Resumo das obras filtradas">
      <article className="works-list-insight works-list-insight-portfolio">
        <header><span>Resultado da consulta</span><ClipboardList aria-hidden="true" /></header>
        <div><strong>{filteredWorks.length}</strong><small>{filteredWorks.length === 1 ? "obra encontrada" : "obras encontradas"}</small></div>
        <div className="works-list-status-summary"><span><b>{filteredInProgress}</b><small>Em andamento</small></span><span className={filteredAttention > 0 ? "attention" : ""}><b>{filteredAttention}</b><small>Pedem atenção</small></span><span><b>{filteredPaused}</b><small>Pausadas</small></span><span><b>{filteredCompleted}</b><small>Concluídas</small></span></div>
      </article>
      <article className="works-list-insight works-list-insight-progress">
        <header><span>Avanço médio</span><CalendarClock aria-hidden="true" /></header>
        <div className="works-list-progress-ring" style={{ "--works-list-progress": `${filteredAverageProgress * 3.6}deg` } as CSSProperties}><span><strong>{filteredAverageProgress}%</strong><small>executado</small></span></div>
        <p>Média das obras em andamento exibidas.</p>
      </article>
      <article className="works-list-insight works-list-insight-budget">
        <header><span>Execução financeira</span><HandCoins aria-hidden="true" /></header>
        <div><strong>{brl.format(filteredSpent)}</strong><small>de {brl.format(filteredBudget)} previstos</small></div>
        <span className="works-list-budget-track" role="progressbar" aria-valuenow={Math.min(100, filteredBudgetUse)} aria-valuemin={0} aria-valuemax={100} aria-label={`${filteredBudgetUse}% do orçamento filtrado foi utilizado`}><i style={{ width: `${Math.min(100, filteredBudgetUse)}%` }} /></span>
        <footer><b>{filteredBudgetUse}% utilizado</b><span>{filteredBudgetBalance >= 0 ? `${brl.format(filteredBudgetBalance)} disponível` : `${brl.format(Math.abs(filteredBudgetBalance))} acima do previsto`}</span></footer>
      </article>
    </section>

    <section className="works-catalog" aria-labelledby="works-catalog-title">
      <header><div><p className="eyebrow">Consulta operacional</p><h2 id="works-catalog-title">Obras cadastradas</h2><span>Abra os detalhes ou edite os dados principais de uma obra.</span></div><label><ArrowUpDown aria-hidden="true" /><span className="works-catalog-sort-label">Ordenar por</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar obras"><option value="priority">Prioridade: maior primeiro</option><option value="due">Prazo: mais próximo</option><option value="updated">Atualização: mais recente</option><option value="budget">Orçamento: maior valor</option></select></label></header>
      {filteredWorks.length > 0 ? <div className="works-catalog-list" aria-label="Lista de obras">{filteredWorks.map((work) => {
        const budgetUse = work.budget > 0 ? Math.round((work.spent / work.budget) * 100) : 0;
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
              <div className="works-catalog-badges"><span className="works-catalog-badge"><small>Situação</small><WorkStatusBadge status={work.status} /></span><span className="works-catalog-badge"><small>Prazo</small><span className={`works-catalog-risk works-catalog-risk-${riskClass}`}><i />{work.risk}</span></span></div>
            </header>
            <div className="works-catalog-highlights">
              <span className="works-catalog-next"><small>Próxima atividade</small><strong>{work.nextActivity}</strong><em>{work.lastUpdateLabel}</em></span>
              <span className="works-catalog-progress"><span><small>Progresso</small><strong>{work.progress}%</strong></span><i role="progressbar" aria-valuenow={work.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${work.title}`}><b style={{ width: `${work.progress}%` }} /></i><em>{work.progress === 100 ? "Execução concluída" : `${100 - work.progress}% restante`}</em></span>
              <span className="works-catalog-deadline"><small>Prazo final</small><strong>{work.endLabel}</strong><em>{deadlineNote}</em></span>
              <span className="works-catalog-finance"><small>Gasto / previsto</small><strong>{brl.format(work.spent)}</strong><em>{budgetUse}% de {brl.format(work.budget)}</em></span>
            </div>
            <footer>
              <span className="works-catalog-manager"><i><UsersRound aria-hidden="true" /></i><span><small>Responsável</small><strong>{work.manager}</strong></span></span>
              <span className="works-catalog-actions"><button type="button" className="works-catalog-edit" onClick={() => onEditWork(work)} aria-label={`Editar ${work.title}`}><PencilLine aria-hidden="true" />Editar</button><button type="button" className="works-catalog-open" onClick={() => onOpenWork(work)} aria-label={`Abrir ${work.title}`}>Abrir obra<ArrowRight aria-hidden="true" /></button></span>
            </footer>
          </div>
        </article>;
      })}</div> : <div className="works-catalog-empty"><CompactEmptyState mark="00" title="Nenhuma obra encontrada" description="Ajuste a busca ou limpe os filtros para visualizar outros registros." /><button type="button" className="secondary-button button-with-icon" onClick={clearFilters}><RotateCcw aria-hidden="true" />Limpar filtros</button></div>}
    </section>
  </div>;
}

function WorkPersonStatusBadge({ status }: { status: WorkPersonStatus }) {
  return <span className={`work-person-status work-person-${status === "Ativa" ? "active" : "inactive"}`}><i />{status}</span>;
}

function WorksTeamPage({ works, onOpenWork, onNotify }: { works: WorkRecord[]; onOpenWork: (work: WorkRecord) => void; onNotify: (message: string, reference: string) => void }) {
  const [people, setPeople] = useState<WorkPerson[]>(() => createWorkTeamPeople(works));
  const [query, setQuery] = useState("");
  const [workFilter, setWorkFilter] = useState("Todas as obras");
  const [typeFilter, setTypeFilter] = useState("Todos os tipos");
  const [statusFilter, setStatusFilter] = useState("Todas as situações");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [action, setAction] = useState<WorkTeamPageAction>(null);
  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredPeople = people.filter((person) => {
    const matchesQuery = !normalizedQuery || [person.id, person.name, person.role, person.contact].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    const matchesWork = workFilter === "Todas as obras" || person.allocations.some((allocation) => allocation.workId === workFilter);
    const matchesType = typeFilter === "Todos os tipos" || person.type === typeFilter;
    const matchesStatus = statusFilter === "Todas as situações" || person.status === statusFilter;
    return matchesQuery && matchesWork && matchesType && matchesStatus;
  }).sort((left, right) => Number(right.status === "Ativa") - Number(left.status === "Ativa") || right.lateActivities - left.lateActivities || left.name.localeCompare(right.name, "pt-BR"));
  const filtersActive = Boolean(query || workFilter !== "Todas as obras" || typeFilter !== "Todos os tipos" || statusFilter !== "Todas as situações");
  const activePeople = people.filter((person) => person.status === "Ativa");
  const employees = activePeople.filter((person) => person.type === "Funcionário");
  const contractors = activePeople.filter((person) => person.type === "Prestador");
  const withLateActivities = activePeople.filter((person) => person.lateActivities > 0).sort((left, right) => right.lateActivities - left.lateActivities);
  const activeAllocations = activePeople.flatMap((person) => person.allocations.filter((allocation) => allocation.status === "Atual"));
  const unallocated = activePeople.filter((person) => !person.allocations.some((allocation) => allocation.status === "Atual"));
  const allocatedPeople = activePeople.filter((person) => person.allocations.some((allocation) => allocation.status === "Atual"));
  const employeeShare = activePeople.length ? Math.round((employees.length / activePeople.length) * 100) : 0;
  const contractorShare = activePeople.length ? 100 - employeeShare : 0;
  const allocationCoverage = activePeople.length ? Math.round((allocatedPeople.length / activePeople.length) * 100) : 0;
  const teamAttentionItems = [
    ...withLateActivities.map((person) => ({ person, tone: "danger", label: `${person.lateActivities} ${person.lateActivities === 1 ? "atividade atrasada" : "atividades atrasadas"}` })),
    ...unallocated.filter((person) => !withLateActivities.some((latePerson) => latePerson.id === person.id)).map((person) => ({ person, tone: "neutral", label: "Sem alocação atual" })),
  ];
  const openRelatedWork = (workId: string) => {
    const work = works.find((record) => record.id === workId);
    if (work) onOpenWork(work);
  };
  const clearFilters = () => {
    setQuery("");
    setWorkFilter("Todas as obras");
    setTypeFilter("Todos os tipos");
    setStatusFilter("Todas as situações");
  };
  const savePerson = (formData: FormData, person?: WorkPerson) => {
    const value = (name: string) => String(formData.get(name) ?? "").trim();
    const costRate = Number(formData.get("costRate") ?? 0);
    const nextPerson: WorkPerson = {
      id: person?.id ?? nextRecordId("PES", people),
      name: value("name"),
      type: value("type") as WorkPersonType,
      role: value("role"),
      contact: value("contact"),
      costMode: value("costMode") ? value("costMode") as WorkCostMode : undefined,
      costRate: costRate > 0 ? costRate : undefined,
      status: value("status") as WorkPersonStatus,
      notes: value("notes") || undefined,
      activeActivities: person?.activeActivities ?? 0,
      lateActivities: person?.lateActivities ?? 0,
      allocations: person?.allocations ?? [],
    };
    setPeople((current) => person ? current.map((item) => item.id === person.id ? nextPerson : item) : [nextPerson, ...current]);
    setSelectedPersonId(nextPerson.id);
    setAction(null);
    onNotify(person ? "Dados da pessoa atualizados nesta sessão." : "Pessoa adicionada à equipe demonstrativa.", nextPerson.id);
  };
  const allocatePerson = (person: WorkPerson, formData: FormData) => {
    const value = (name: string) => String(formData.get(name) ?? "").trim();
    const allocation: WorkPersonAllocation = { id: nextRecordId("ALO", people.flatMap((item) => item.allocations)), workId: value("workId"), role: value("role"), startDateIso: value("startDateIso"), endDateIso: value("endDateIso"), status: "Atual" };
    setPeople((current) => current.map((item) => item.id === person.id ? { ...item, status: "Ativa", activeActivities: item.activeActivities + 1, allocations: [allocation, ...item.allocations] } : item));
    setAction(null);
    onNotify("Nova alocação registrada nesta sessão.", allocation.id);
  };
  const togglePersonStatus = (person: WorkPerson) => {
    if (person.status === "Ativa" && !window.confirm(`Inativar ${person.name} sem apagar o histórico?`)) return;
    const nextStatus: WorkPersonStatus = person.status === "Ativa" ? "Inativa" : "Ativa";
    setPeople((current) => current.map((item) => item.id === person.id ? { ...item, status: nextStatus, activeActivities: nextStatus === "Inativa" ? 0 : item.activeActivities, allocations: nextStatus === "Inativa" ? item.allocations.map((allocation) => allocation.status === "Atual" ? { ...allocation, status: "Encerrada" as const } : allocation) : item.allocations } : item));
    onNotify(nextStatus === "Inativa" ? "Pessoa inativada; histórico preservado." : "Pessoa reativada na equipe.", person.id);
  };

  return <>
    <div className="works-team-page">
      <section className="works-dashboard-heading team-page-heading" aria-labelledby="team-page-title"><div><p className="eyebrow">Módulo 2 · Gestão de Obras</p><h1 id="team-page-title">Equipe</h1><p>Veja quem está alocado, quais atividades estão atrasadas e onde cada pessoa atua.</p></div><button type="button" className="primary-button button-with-icon works-new-button" onClick={() => setAction({ type: "new" })}><Plus aria-hidden="true" />Adicionar pessoa</button></section>

      <section className="team-overview" aria-label="Visão operacional da equipe">
        <article className="team-capacity-card">
          <header><div><p className="eyebrow">Capacidade operacional</p><h2>Equipe em campo</h2></div><span><UsersRound aria-hidden="true" /></span></header>
          <div className="team-capacity-main"><div className="team-avatar-stack" aria-label={`${activePeople.length} pessoas ativas`}>{activePeople.slice(0, 6).map((person) => <span key={person.id} className={person.type === "Funcionário" ? "employee" : "contractor"}>{person.name.split(" ").slice(0, 2).map((name) => name[0]).join("")}</span>)}{activePeople.length > 6 && <b>+{activePeople.length - 6}</b>}</div><div><strong>{allocatedPeople.length} de {activePeople.length}</strong><small>pessoas com alocação atual</small></div><em>{allocationCoverage}%</em></div>
          <div className="team-composition"><header><span>Composição da equipe</span><strong>{employees.length} internos · {contractors.length} externos</strong></header><div role="img" aria-label={`${employeeShare}% funcionários e ${contractorShare}% prestadores`}><span style={{ width: `${employeeShare}%` }} /><i style={{ width: `${contractorShare}%` }} /></div><footer><span><i className="employee" />Funcionários</span><span><i className="contractor" />Prestadores</span></footer></div>
          <p><BriefcaseBusiness aria-hidden="true" />{activeAllocations.length} frentes de trabalho vinculadas à equipe ativa</p>
        </article>
        <section className="team-metrics" aria-label="Indicadores da equipe"><article><span><UsersRound aria-hidden="true" /></span><div><small>Pessoas ativas</small><strong>{activePeople.length}</strong><p>{activeAllocations.length} alocações atuais</p></div></article><article><span><BriefcaseBusiness aria-hidden="true" /></span><div><small>Funcionários</small><strong>{employees.length}</strong><p>Equipe interna demonstrativa</p></div></article><article><span><Handshake aria-hidden="true" /></span><div><small>Prestadores</small><strong>{contractors.length}</strong><p>Especialistas externos ativos</p></div></article><article className={withLateActivities.length ? "team-metric-danger" : ""}><span><TriangleAlert aria-hidden="true" /></span><div><small>Com atividades atrasadas</small><strong>{withLateActivities.length}</strong><p>{withLateActivities.reduce((total, person) => total + person.lateActivities, 0)} atividades exigem atenção</p></div></article></section>
      </section>

      <aside className="team-scope-note"><UsersRound aria-hidden="true" /><span><strong>Gestão operacional da equipe</strong>Esta página não controla folha, benefícios, férias, ponto legal ou documentos pessoais sensíveis.</span></aside>

      {teamAttentionItems.length > 0 && <section className="team-attention-panel" aria-labelledby="team-attention-title"><header><div><p className="eyebrow">Prioridades de alocação</p><h2 id="team-attention-title">O que precisa de atenção</h2></div><b>{teamAttentionItems.length}</b></header><div>{teamAttentionItems.slice(0, 6).map(({ person, tone, label }, index) => <button type="button" key={person.id} className={`${tone === "danger" ? "team-attention-danger" : ""} ${index === 0 ? "team-attention-featured" : ""}`.trim()} onClick={() => setSelectedPersonId(person.id)}>{tone === "danger" ? <TriangleAlert aria-hidden="true" /> : <UsersRound aria-hidden="true" />}<span><strong>{person.name}</strong><small>{label} · {person.role}</small></span><ArrowRight aria-hidden="true" /></button>)}</div></section>}

      <section className="team-list-controls" aria-label="Busca e filtros da equipe"><div className="team-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, função ou contato" aria-label="Buscar pessoas" /></div><label><span>Obra</span><select value={workFilter} onChange={(event) => setWorkFilter(event.target.value)}><option>Todas as obras</option>{works.map((work) => <option key={work.id} value={work.id}>{work.id} · {work.title}</option>)}</select></label><label><span>Tipo</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>Todos os tipos</option><option>Funcionário</option><option>Prestador</option></select></label><label><span>Situação</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todas as situações</option><option>Ativa</option><option>Inativa</option></select></label><button type="button" className="secondary-button button-with-icon" disabled={!filtersActive} onClick={clearFilters}><RotateCcw aria-hidden="true" />Limpar</button><footer><span><strong>{filteredPeople.length}</strong> de {people.length} pessoas</span><small>Selecione uma pessoa para ver contatos, custos e histórico.</small></footer></section>

      <section className="team-people-panel" aria-labelledby="team-people-title"><header><div><p className="eyebrow">Pessoas cadastradas</p><h2 id="team-people-title">Equipe das obras</h2></div><span>{activePeople.length} ativas · {people.length - activePeople.length} inativas</span></header>{filteredPeople.length > 0 ? <div className="team-people-list">{filteredPeople.map((person) => { const currentAllocations = person.allocations.filter((allocation) => allocation.status === "Atual"); return <article key={person.id} className={`team-person-card ${person.status === "Inativa" ? "inactive" : ""} ${person.lateActivities ? "has-late-activities" : ""}`.trim()}><header className="team-person-card-header"><span className={`team-person-avatar ${person.type === "Funcionário" ? "employee" : "contractor"}`}>{person.name.split(" ").slice(0, 2).map((name) => name[0]).join("")}</span><div className="team-person-identity"><small><b>{person.id}</b><i>{person.type}</i></small><strong>{person.name}</strong><em>{person.role}</em></div><WorkPersonStatusBadge status={person.status} /></header><div className="team-person-card-details"><span><small>Contato</small><strong>{person.contact}</strong></span><span><small>Custo de referência</small><strong>{person.costRate ? `${brl.format(person.costRate)} / ${person.costMode === "Hora" ? "h" : "dia"}` : "Não informado"}</strong></span></div><div className="team-person-works"><small>Obras atuais</small>{currentAllocations.length ? <span>{currentAllocations.slice(0, 2).map((allocation) => { const work = works.find((record) => record.id === allocation.workId); return <button type="button" key={allocation.id} onClick={() => openRelatedWork(allocation.workId)}><b>{allocation.workId}</b><em>{work?.title}</em></button>; })}{currentAllocations.length > 2 && <b>+{currentAllocations.length - 2}</b>}</span> : <strong>Sem alocação atual</strong>}</div><footer className="team-person-card-footer"><div className="team-person-activities"><span><small>Em andamento</small><strong>{person.activeActivities}</strong></span><span className={person.lateActivities ? "late" : ""}><small>Atrasadas</small><strong>{person.lateActivities}</strong></span></div><button type="button" className="team-person-open" onClick={() => setSelectedPersonId(person.id)}>Ver perfil completo<ArrowRight aria-hidden="true" /></button></footer></article>; })}</div> : <div className="team-empty"><CompactEmptyState mark="00" title="Nenhuma pessoa encontrada" description="Ajuste os filtros para consultar outras pessoas da equipe." /><button type="button" className="secondary-button button-with-icon" onClick={clearFilters}><RotateCcw aria-hidden="true" />Limpar filtros</button></div>}</section>
    </div>
    {selectedPerson && <WorkPersonDrawer person={selectedPerson} works={works} onClose={() => setSelectedPersonId(null)} onEdit={() => setAction({ type: "edit", person: selectedPerson })} onAllocate={() => setAction({ type: "allocate", person: selectedPerson })} onToggleStatus={() => togglePersonStatus(selectedPerson)} onOpenWork={openRelatedWork} />}
    {action?.type === "new" && <WorkPersonFormDrawer onClose={() => setAction(null)} onSave={(data) => savePerson(data)} />}
    {action?.type === "edit" && <WorkPersonFormDrawer person={action.person} onClose={() => setAction(null)} onSave={(data) => savePerson(data, action.person)} />}
    {action?.type === "allocate" && <WorkPersonAllocationModal person={action.person} works={works} onClose={() => setAction(null)} onSave={(data) => allocatePerson(action.person, data)} />}
  </>;
}

function WorkPersonDrawer({ person, works, onClose, onEdit, onAllocate, onToggleStatus, onOpenWork }: { person: WorkPerson; works: WorkRecord[]; onClose: () => void; onEdit: () => void; onAllocate: () => void; onToggleStatus: () => void; onOpenWork: (workId: string) => void }) {
  const currentAllocations = person.allocations.filter((allocation) => allocation.status === "Atual");
  const history = person.allocations.filter((allocation) => allocation.status === "Encerrada");
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Detalhes de ${person.name}`}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer wide-drawer work-person-drawer"><header className="work-person-drawer-header"><span>{person.name.split(" ").slice(0, 2).map((name) => name[0]).join("")}</span><div><p>{person.id} · {person.type}</p><h2>{person.name}</h2><small>{person.role}</small></div><WorkPersonStatusBadge status={person.status} /><button type="button" className="close-button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header><div className="drawer-body work-person-drawer-body"><section className="work-person-stats"><article><small>Obras atuais</small><strong>{currentAllocations.length}</strong></article><article><small>Atividades</small><strong>{person.activeActivities}</strong></article><article className={person.lateActivities ? "danger" : ""}><small>Atrasadas</small><strong>{person.lateActivities}</strong></article></section><dl className="work-person-details"><div><dt>Contato</dt><dd>{person.contact}</dd></div><div><dt>Custo de referência</dt><dd>{person.costRate ? `${brl.format(person.costRate)} por ${person.costMode?.toLocaleLowerCase("pt-BR")}` : "Não informado"}</dd></div>{person.notes && <div className="full"><dt>Observações</dt><dd>{person.notes}</dd></div>}</dl><section className="work-person-allocations"><header><div><h3>Alocações atuais</h3><span>{currentAllocations.length} {currentAllocations.length === 1 ? "obra" : "obras"}</span></div><button type="button" onClick={onAllocate} disabled={person.status === "Inativa"}><Plus aria-hidden="true" />Alocar em obra</button></header>{currentAllocations.length ? <div>{currentAllocations.map((allocation) => { const work = works.find((record) => record.id === allocation.workId); return <article key={allocation.id}><span><Building2 aria-hidden="true" /></span><div><small>{allocation.workId}</small><strong>{work?.title ?? "Obra não localizada"}</strong><em>{allocation.role}</em><p>{formatExpenseDate(allocation.startDateIso)} — {formatExpenseDate(allocation.endDateIso)}</p></div><button type="button" onClick={() => onOpenWork(allocation.workId)}>Abrir<ArrowRight aria-hidden="true" /></button></article>; })}</div> : <CompactEmptyState mark="00" title="Sem alocação atual" description="Use o botão acima para relacionar esta pessoa a uma obra." />}</section>{history.length > 0 && <section className="work-person-history"><header><h3>Histórico de participação</h3><span>{history.length} encerrada(s)</span></header><div>{history.map((allocation) => { const work = works.find((record) => record.id === allocation.workId); return <article key={allocation.id}><i /><span><strong>{work?.title ?? allocation.workId}</strong><small>{allocation.role} · {formatExpenseDate(allocation.startDateIso)} — {formatExpenseDate(allocation.endDateIso)}</small></span></article>; })}</div></section>}</div><footer className="drawer-footer work-person-drawer-footer"><button type="button" className={person.status === "Ativa" ? "secondary-button work-person-inactivate" : "secondary-button"} onClick={onToggleStatus}>{person.status === "Ativa" ? "Inativar pessoa" : "Reativar pessoa"}</button><button type="button" className="secondary-button button-with-icon" onClick={onEdit}><PencilLine aria-hidden="true" />Editar</button><button type="button" className="primary-button button-with-icon" onClick={onAllocate} disabled={person.status === "Inativa"}><Plus aria-hidden="true" />Nova alocação</button></footer></aside></div>;
}

function WorkPersonFormDrawer({ person, onClose, onSave }: { person?: WorkPerson; onClose: () => void; onSave: (data: FormData) => void }) {
  const [costMode, setCostMode] = useState(person?.costMode ?? "");
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={person ? `Editar ${person.name}` : "Adicionar pessoa"}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar formulário" /><form className="drawer work-person-form-drawer" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}><header className="drawer-header"><div><p className="eyebrow">{person ? person.id : "Equipe das obras"}</p><h2>{person ? "Editar pessoa" : "Adicionar pessoa"}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header><div className="drawer-body"><p className="work-person-form-intro">Cadastre somente informações operacionais necessárias para as obras.</p><div className="form-grid work-person-form-grid"><label className="full-field">Nome<input name="name" defaultValue={person?.name} placeholder="Nome da pessoa" autoFocus required /></label><label>Tipo<select name="type" defaultValue={person?.type ?? "Funcionário"}><option>Funcionário</option><option>Prestador</option></select></label><label>Situação<select name="status" defaultValue={person?.status ?? "Ativa"}><option>Ativa</option><option>Inativa</option></select></label><label className="full-field">Função ou especialidade<input name="role" defaultValue={person?.role} placeholder="Ex.: Supervisor de campo" required /></label><label className="full-field">Telefone ou e-mail<input name="contact" defaultValue={person?.contact} placeholder="Contato operacional" required /></label><label>Custo por<select name="costMode" value={costMode} onChange={(event) => setCostMode(event.target.value as WorkCostMode | "")}><option value="">Não informar</option><option>Hora</option><option>Diária</option></select></label><label>Valor de referência<input name="costRate" type="number" min="0" step="0.01" defaultValue={person?.costRate} disabled={!costMode} placeholder="0,00" /></label><label className="full-field">Observações<textarea name="notes" rows={4} maxLength={400} defaultValue={person?.notes} placeholder="Informações úteis para a operação, sem dados sensíveis." /></label></div></div><footer className="drawer-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />{person ? "Salvar alterações" : "Adicionar pessoa"}</button></footer></form></div>;
}

function WorkPersonAllocationModal({ person, works, onClose, onSave }: { person: WorkPerson; works: WorkRecord[]; onClose: () => void; onSave: (data: FormData) => void }) {
  const [workId, setWorkId] = useState(works.find((work) => !person.allocations.some((allocation) => allocation.workId === work.id && allocation.status === "Atual"))?.id ?? works[0]?.id ?? "");
  const [endDateIso, setEndDateIso] = useState(works.find((work) => work.id === workId)?.endDateIso ?? "");
  const [error, setError] = useState("");
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const start = String(data.get("startDateIso") ?? "");
    const end = String(data.get("endDateIso") ?? "");
    if (end < start) { setError("O fim da alocação não pode ser anterior ao início."); return; }
    if (person.allocations.some((allocation) => allocation.workId === workId && allocation.status === "Atual")) { setError("Esta pessoa já possui uma alocação atual nessa obra."); return; }
    setError("");
    onSave(data);
  };
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Alocar ${person.name}`}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar alocação" /><form className="receipt-modal work-detail-modal work-allocation-modal" onSubmit={handleSubmit}><ModalHeader eyebrow={person.id} title="Alocar em uma obra" onClose={onClose} /><div className="work-detail-modal-body">{error && <InlineFieldError message={error} />}<div className="form-grid"><p className="work-detail-modal-context full-field"><strong>{person.name}</strong>{person.role}</p><label className="full-field">Obra<select name="workId" value={workId} onChange={(event) => { const nextWorkId = event.target.value; setWorkId(nextWorkId); setEndDateIso(works.find((work) => work.id === nextWorkId)?.endDateIso ?? ""); setError(""); }} required>{works.map((work) => <option key={work.id} value={work.id}>{work.id} · {work.title}</option>)}</select></label><label className="full-field">Função nesta obra<input name="role" defaultValue={person.role} required /></label><label>Início<input name="startDateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} onChange={() => setError("")} required /></label><label>Fim<input name="endDateIso" type="date" value={endDateIso} onChange={(event) => { setEndDateIso(event.target.value); setError(""); }} required /></label></div></div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />Salvar alocação</button></footer></form></div>;
}

function WorkModuleFinanceStatus({ status }: { status: WorkBudgetStatus | WorkExpenseStatus | WorkCashMovementStatus }) {
  const slug = status.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  return <span className={`module-finance-status module-finance-status-${slug}`}><i />{status}</span>;
}

function WorksFinancialPage({ works, initialWorkId, onOpenWork, onNotify }: { works: WorkRecord[]; initialWorkId: string | null; onOpenWork: (work: WorkRecord) => void; onNotify: (message: string, reference: string) => void }) {
  const [data, setData] = useState(() => createWorkFinancialMock(works));
  const [tab, setTab] = useState<WorkFinanceTab>("Orçamentos");
  const [action, setAction] = useState<WorkFinanceAction>(null);
  const [comparisonKey, setComparisonKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [workFilter, setWorkFilter] = useState(initialWorkId ?? "Todas as obras");
  const [propertyFilter, setPropertyFilter] = useState("Todos os imóveis");
  const [periodFilter, setPeriodFilter] = useState("Todo o período");
  const [budgetStatus, setBudgetStatus] = useState("Todas as situações");
  const [providerFilter, setProviderFilter] = useState("Todos os fornecedores");
  const [expenseStatus, setExpenseStatus] = useState("Todas as situações");
  const [expenseCategory, setExpenseCategory] = useState("Todas as categorias");
  const [cashType, setCashType] = useState("Todos os tipos");
  const [cashStatus, setCashStatus] = useState("Todas as situações");

  const properties = Array.from(new Set(works.map((work) => work.property))).sort((left, right) => left.localeCompare(right, "pt-BR"));
  const providers = Array.from(new Set(data.budgets.map((budget) => budget.provider))).sort((left, right) => left.localeCompare(right, "pt-BR"));
  const categories = Array.from(new Set(data.expenses.map((expense) => expense.category))).sort((left, right) => left.localeCompare(right, "pt-BR"));
  const scopedWorkIds = new Set(works.filter((work) => (workFilter === "Todas as obras" || work.id === workFilter) && (propertyFilter === "Todos os imóveis" || work.property === propertyFilter)).map((work) => work.id));
  const periodStart = periodFilter === "Agosto de 2026" ? "2026-08-01" : periodFilter === "Setembro de 2026" ? "2026-09-01" : null;
  const periodMatches = (dateIso: string) => periodFilter === "Todo o período" || (periodFilter === "Agosto de 2026" ? dateIso >= "2026-08-01" && dateIso <= "2026-08-31" : dateIso >= "2026-09-01" && dateIso <= "2026-09-30");
  const inScope = (workId: string, dateIso: string) => scopedWorkIds.has(workId) && periodMatches(dateIso);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const matchesQuery = (...values: string[]) => !normalizedQuery || values.join(" ").toLocaleLowerCase("pt-BR").includes(normalizedQuery);

  const scopedBudgets = data.budgets.filter((budget) => inScope(budget.workId, budget.receivedDateIso));
  const scopedExpenses = data.expenses.filter((expense) => inScope(expense.workId, expense.dateIso));
  const scopedCash = data.cashMovements.filter((movement) => inScope(movement.workId, movement.dateIso));
  const filteredBudgets = scopedBudgets.filter((budget) => (budgetStatus === "Todas as situações" || budget.status === budgetStatus) && (providerFilter === "Todos os fornecedores" || budget.provider === providerFilter) && matchesQuery(budget.id, budget.service, budget.provider, budget.workId));
  const budgetGroups = Object.values(scopedBudgets.reduce<Record<string, WorkBudgetQuote[]>>((groups, budget) => {
    const key = `${budget.workId}::${budget.service}`;
    groups[key] = [...(groups[key] ?? []), budget];
    return groups;
  }, {}));
  const budgetDecisionGroups = budgetGroups.filter((group) => !group.some((budget) => budget.status === "Selecionado") && group.filter((budget) => budget.status === "Recebido").length >= 2);
  const budgetsAwaitingReturn = scopedBudgets.filter((budget) => budget.status === "Solicitado").length;
  const budgetsNearExpiry = scopedBudgets.filter((budget) => budget.status !== "Expirado" && budget.status !== "Rejeitado" && budget.validityDateIso >= WORKS_DEMO_DATE_ISO && budget.validityDateIso <= "2026-08-31").length;
  const filteredExpenses = scopedExpenses.filter((expense) => (expenseStatus === "Todas as situações" || expense.status === expenseStatus) && (expenseCategory === "Todas as categorias" || expense.category === expenseCategory) && matchesQuery(expense.id, expense.description, expense.supplier, expense.category, expense.workId));
  const filteredCash = scopedCash.filter((movement) => (cashType === "Todos os tipos" || movement.type === cashType) && (cashStatus === "Todas as situações" || movement.status === cashStatus) && matchesQuery(movement.id, movement.description, movement.type, movement.workId));
  const selectedBudgetTotal = scopedBudgets.filter((budget) => budget.status === "Selecionado").reduce((sum, budget) => sum + budget.amount, 0);
  const expectedExpenseTotal = scopedExpenses.reduce((sum, expense) => sum + expense.expectedAmount, 0);
  const expenseTotal = scopedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const paidExpenseTotal = scopedExpenses.filter((expense) => expense.status === "Pago").reduce((sum, expense) => sum + expense.amount, 0);
  const expenseBalance = selectedBudgetTotal - expenseTotal;
  const expensesOverExpected = scopedExpenses.filter((expense) => expense.amount > expense.expectedAmount).sort((left, right) => (right.amount - right.expectedAmount) - (left.amount - left.expectedAmount));
  const expenseOverrunTotal = expensesOverExpected.reduce((sum, expense) => sum + expense.amount - expense.expectedAmount, 0);
  const paymentsDueSoon = scopedExpenses.filter((expense) => expense.status === "Pendente" && expense.dateIso >= WORKS_DEMO_DATE_ISO && expense.dateIso <= "2026-08-31").sort((left, right) => left.dateIso.localeCompare(right.dateIso));
  const workScopedCash = data.cashMovements.filter((movement) => scopedWorkIds.has(movement.workId));
  const initialBalance = periodStart
    ? workScopedCash.filter((movement) => movement.status === "Realizado" && movement.dateIso < periodStart).reduce((sum, movement) => sum + (movement.direction === "Entrada" ? movement.amount : -movement.amount), 0)
    : scopedCash.filter((movement) => movement.type === "Aporte" && movement.description.startsWith("Saldo inicial") && movement.status === "Realizado").reduce((sum, movement) => sum + movement.amount, 0);
  const realizedEntries = scopedCash.filter((movement) => movement.direction === "Entrada" && movement.status === "Realizado" && (periodStart || !movement.description.startsWith("Saldo inicial"))).reduce((sum, movement) => sum + movement.amount, 0);
  const realizedOutputs = scopedCash.filter((movement) => movement.direction === "Saída" && movement.status === "Realizado").reduce((sum, movement) => sum + movement.amount, 0);
  const currentCash = initialBalance + realizedEntries - realizedOutputs;
  const projectedCash = (periodStart ? initialBalance : 0) + scopedCash.reduce((sum, movement) => sum + (movement.direction === "Entrada" ? movement.amount : -movement.amount), 0);
  const cashPositions = works.filter((work) => scopedWorkIds.has(work.id)).map((work) => {
    const allMovements = data.cashMovements.filter((movement) => movement.workId === work.id);
    const periodMovements = allMovements.filter((movement) => periodMatches(movement.dateIso));
    const opening = periodStart ? allMovements.filter((movement) => movement.status === "Realizado" && movement.dateIso < periodStart).reduce((sum, movement) => sum + (movement.direction === "Entrada" ? movement.amount : -movement.amount), 0) : 0;
    const current = opening + periodMovements.filter((movement) => movement.status === "Realizado").reduce((sum, movement) => sum + (movement.direction === "Entrada" ? movement.amount : -movement.amount), 0);
    const projected = opening + periodMovements.reduce((sum, movement) => sum + (movement.direction === "Entrada" ? movement.amount : -movement.amount), 0);
    const plannedCount = periodMovements.filter((movement) => movement.status === "Previsto").length;
    return { work, current, projected, plannedCount };
  }).filter((position) => position.current !== 0 || position.projected !== 0 || position.plannedCount > 0).sort((left, right) => Number(left.projected >= 0) - Number(right.projected >= 0) || left.projected - right.projected);
  const negativeCashPositions = cashPositions.filter((position) => position.projected < 0).length;
  const plannedCashMovements = scopedCash.filter((movement) => movement.status === "Previsto");
  const activeFilterCount = [workFilter !== "Todas as obras", propertyFilter !== "Todos os imóveis", periodFilter !== "Todo o período", Boolean(query)].filter(Boolean).length;
  const comparisonQuotes = comparisonKey ? data.budgets.filter((budget) => `${budget.workId}::${budget.service}` === comparisonKey).sort((left, right) => left.amount - right.amount) : [];

  const workName = (workId: string) => works.find((work) => work.id === workId)?.title ?? workId;
  const openWork = (workId: string) => { const work = works.find((record) => record.id === workId); if (work) onOpenWork(work); };
  const clearSharedFilters = () => { setQuery(""); setWorkFilter("Todas as obras"); setPropertyFilter("Todos os imóveis"); setPeriodFilter("Todo o período"); };
  const saveBudget = (formData: FormData) => {
    const file = formData.get("attachment");
    const budget: WorkBudgetQuote = {
      id: nextRecordId("ORC", data.budgets), workId: String(formData.get("workId")), stage: String(formData.get("stage") ?? "") || undefined,
      service: String(formData.get("service")), provider: String(formData.get("provider")), amount: Number(formData.get("amount")),
      receivedDateIso: String(formData.get("receivedDateIso")), validityDateIso: String(formData.get("validityDateIso")), status: String(formData.get("status")) as WorkBudgetStatus,
      attachmentName: file instanceof File && file.size ? file.name : undefined,
    };
    setData((current) => ({ ...current, budgets: [budget, ...current.budgets] }));
    setAction(null);
    onNotify("Orçamento adicionado à demonstração.", budget.id);
  };
  const saveExpense = (formData: FormData) => {
    const file = formData.get("attachment");
    const expense: WorkModuleExpense = {
      id: nextRecordId("GAS", data.expenses), workId: String(formData.get("workId")), description: String(formData.get("description")), category: String(formData.get("category")), supplier: String(formData.get("supplier")),
      amount: Number(formData.get("amount")), expectedAmount: Number(formData.get("expectedAmount")), dateIso: String(formData.get("dateIso")), status: String(formData.get("status")) as WorkExpenseStatus,
      attachmentName: file instanceof File && file.size ? file.name : undefined,
    };
    setData((current) => ({ ...current, expenses: [expense, ...current.expenses], cashMovements: [{ id: nextRecordId("CXA", current.cashMovements), workId: expense.workId, type: "Saída de gasto", direction: "Saída", description: expense.description, amount: expense.amount, dateIso: expense.dateIso, status: expense.status === "Pago" ? "Realizado" : "Previsto", linkedExpenseId: expense.id }, ...current.cashMovements] }));
    setAction(null);
    onNotify("Gasto registrado manualmente.", expense.id);
  };
  const saveCashMovement = (formData: FormData) => {
    const linkedExpenseId = String(formData.get("linkedExpenseId") ?? "") || undefined;
    const existingMovement = linkedExpenseId ? data.cashMovements.find((movement) => movement.linkedExpenseId === linkedExpenseId) : undefined;
    if (linkedExpenseId && existingMovement) {
      const status = String(formData.get("status")) as WorkCashMovementStatus;
      const amount = Number(formData.get("amount"));
      setData((current) => ({
        ...current,
        expenses: status === "Realizado" ? current.expenses.map((expense) => expense.id === linkedExpenseId ? { ...expense, status: "Pago" as const } : expense) : current.expenses,
        cashMovements: current.cashMovements.map((movement) => movement.id === existingMovement.id ? { ...movement, description: String(formData.get("description")), amount, dateIso: String(formData.get("dateIso")), status } : movement),
      }));
      setAction(null);
      onNotify(status === "Realizado" ? "Saída prevista confirmada sem duplicidade." : "Movimento previsto atualizado.", existingMovement.id);
      return;
    }
    const movement: WorkCashMovement = {
      id: nextRecordId("CXA", data.cashMovements), workId: String(formData.get("workId")), type: String(formData.get("type")) as WorkCashMovementType,
      direction: String(formData.get("direction")) as "Entrada" | "Saída", description: String(formData.get("description")), amount: Number(formData.get("amount")),
      dateIso: String(formData.get("dateIso")), status: String(formData.get("status")) as WorkCashMovementStatus, linkedExpenseId,
    };
    setData((current) => ({
      ...current,
      expenses: linkedExpenseId && movement.status === "Realizado" ? current.expenses.map((expense) => expense.id === linkedExpenseId ? { ...expense, status: "Pago" } : expense) : current.expenses,
      cashMovements: [movement, ...current.cashMovements],
    }));
    setAction(null);
    onNotify("Movimento de caixa registrado manualmente.", movement.id);
  };
  const selectBudget = (budget: WorkBudgetQuote, formData: FormData) => {
    const createExpense = formData.get("createExpense") === "on";
    const reason = String(formData.get("reason"));
    setData((current) => {
      const alreadyHasExpense = current.expenses.some((expense) => expense.sourceBudgetId === budget.id);
      const expense: WorkModuleExpense | null = createExpense && !alreadyHasExpense ? { id: nextRecordId("GAS", current.expenses), workId: budget.workId, description: budget.service, category: "Serviços", supplier: budget.provider, amount: budget.amount, expectedAmount: budget.amount, dateIso: WORKS_DEMO_DATE_ISO, status: "Previsto", sourceBudgetId: budget.id } : null;
      return {
        ...current,
        budgets: current.budgets.map((item) => item.workId === budget.workId && item.service === budget.service ? { ...item, status: item.id === budget.id ? "Selecionado" : item.status === "Selecionado" ? "Recebido" : item.status, selectionReason: item.id === budget.id ? reason : item.selectionReason } : item),
        expenses: expense ? [expense, ...current.expenses] : current.expenses,
        cashMovements: expense ? [{ id: nextRecordId("CXA", current.cashMovements), workId: expense.workId, type: "Saída de gasto", direction: "Saída", description: expense.description, amount: expense.amount, dateIso: expense.dateIso, status: "Previsto", linkedExpenseId: expense.id }, ...current.cashMovements] : current.cashMovements,
      };
    });
    setAction(null);
    onNotify(createExpense ? "Proposta selecionada e gasto previsto criado." : "Proposta selecionada para o serviço.", budget.id);
  };
  const markExpensePaid = (expense: WorkModuleExpense) => {
    setData((current) => {
      const existingMovement = current.cashMovements.find((movement) => movement.linkedExpenseId === expense.id);
      const cashMovements = existingMovement
        ? current.cashMovements.map((movement) => movement.linkedExpenseId === expense.id ? { ...movement, status: "Realizado" as const, dateIso: WORKS_DEMO_DATE_ISO, amount: expense.amount } : movement)
        : [{ id: nextRecordId("CXA", current.cashMovements), workId: expense.workId, type: "Saída de gasto" as const, direction: "Saída" as const, description: expense.description, amount: expense.amount, dateIso: WORKS_DEMO_DATE_ISO, status: "Realizado" as const, linkedExpenseId: expense.id }, ...current.cashMovements];
      return { ...current, expenses: current.expenses.map((item) => item.id === expense.id ? { ...item, status: "Pago" as const } : item), cashMovements };
    });
    setAction(null);
    onNotify("Pagamento confirmado e saída registrada uma única vez.", expense.id);
  };

  const tabs: Array<{ name: WorkFinanceTab; icon: LucideIcon; count: number }> = [
    { name: "Orçamentos", icon: ClipboardList, count: scopedBudgets.length },
    { name: "Gastos", icon: HandCoins, count: scopedExpenses.length },
    { name: "Caixa", icon: WalletCards, count: scopedCash.length },
  ];
  const monthComparison = [
    { key: "2026-08", label: "Agosto", planned: scopedCash.filter((movement) => movement.direction === "Saída" && movement.dateIso.startsWith("2026-08")).reduce((sum, movement) => sum + movement.amount, 0), realized: scopedCash.filter((movement) => movement.direction === "Saída" && movement.status === "Realizado" && movement.dateIso.startsWith("2026-08")).reduce((sum, movement) => sum + movement.amount, 0) },
    { key: "2026-09", label: "Setembro", planned: scopedCash.filter((movement) => movement.direction === "Saída" && movement.dateIso.startsWith("2026-09")).reduce((sum, movement) => sum + movement.amount, 0), realized: scopedCash.filter((movement) => movement.direction === "Saída" && movement.status === "Realizado" && movement.dateIso.startsWith("2026-09")).reduce((sum, movement) => sum + movement.amount, 0) },
  ];
  const budgetUsage = selectedBudgetTotal > 0 ? Math.round((expenseTotal / selectedBudgetTotal) * 100) : 0;
  const projectedDelta = projectedCash - currentCash;
  const totalFinanceAlerts = budgetDecisionGroups.length + expensesOverExpected.length + negativeCashPositions;

  return <>
    <div className="works-financial-page">
      <section className="works-dashboard-heading finance-page-heading" aria-labelledby="finance-page-title">
        <div><p className="eyebrow">Módulo 2 · Gestão de Obras</p><h1 id="finance-page-title">Financeiro</h1><p>Compare propostas, registre gastos e acompanhe o caixa de forma manual e simples.</p></div>
        <button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: tab === "Orçamentos" ? "budget" : tab === "Gastos" ? "expense" : "cash" })}><Plus aria-hidden="true" />{tab === "Orçamentos" ? "Novo orçamento" : tab === "Gastos" ? "Registrar gasto" : "Novo movimento"}</button>
      </section>

      <section className="finance-executive-overview" aria-label="Resumo executivo financeiro">
        <article className="finance-pulse-card">
          <header><div><p className="eyebrow">Resumo executivo</p><h2>Pulso financeiro das obras</h2></div><span><WalletCards aria-hidden="true" /></span></header>
          <div className="finance-pulse-balance"><small>Saldo atual realizado</small><strong className={currentCash < 0 ? "negative" : ""}>{brl.format(currentCash)}</strong><span className={projectedDelta < 0 ? "negative" : ""}><ArrowUpDown aria-hidden="true" />{projectedDelta >= 0 ? "+ " : "− "}{brl.format(Math.abs(projectedDelta))} até o saldo projetado</span></div>
          <div className="finance-budget-usage"><header><span>Uso da referência selecionada</span><strong className={budgetUsage > 100 ? "negative" : ""}>{budgetUsage}%</strong></header><div role="img" aria-label={`${budgetUsage}% da referência orçamentária utilizada`}><i className={budgetUsage > 100 ? "danger" : ""} style={{ width: `${Math.min(100, budgetUsage)}%` }} /></div><footer><span>{brl.format(expenseTotal)} em gastos</span><span>{brl.format(selectedBudgetTotal)} de referência</span></footer></div>
          <footer><span><ClipboardList aria-hidden="true" /><small>Selecionado</small><strong>{brl.format(selectedBudgetTotal)}</strong></span><span><CircleCheck aria-hidden="true" /><small>Realizado</small><strong>{brl.format(paidExpenseTotal)}</strong></span><span className={projectedCash < 0 ? "danger" : ""}><WalletCards aria-hidden="true" /><small>Projetado</small><strong>{brl.format(projectedCash)}</strong></span></footer>
        </article>
        <aside className="finance-risk-board">
          <header><div><p className="eyebrow">Atenção financeira</p><h2>Decisões e riscos</h2></div><b className={totalFinanceAlerts ? "has-alerts" : ""}>{totalFinanceAlerts}</b></header>
          <div><button type="button" onClick={() => setTab("Orçamentos")}><span><ArrowUpDown aria-hidden="true" /></span><div><small>Orçamentos</small><strong>{budgetDecisionGroups.length ? `${budgetDecisionGroups.length} serviços para comparar` : "Comparações em dia"}</strong><em>{budgetsAwaitingReturn} proposta(s) aguardando retorno</em></div><ArrowRight aria-hidden="true" /></button><button type="button" className={expensesOverExpected.length ? "danger" : ""} onClick={() => setTab("Gastos")}><span><HandCoins aria-hidden="true" /></span><div><small>Gastos</small><strong>{expensesOverExpected.length ? `${expensesOverExpected.length} acima do esperado` : "Gastos dentro do previsto"}</strong><em>{expensesOverExpected.length ? `${brl.format(expenseOverrunTotal)} de diferença` : `${brl.format(expenseTotal)} lançados`}</em></div><ArrowRight aria-hidden="true" /></button><button type="button" className={negativeCashPositions ? "danger" : ""} onClick={() => setTab("Caixa")}><span><WalletCards aria-hidden="true" /></span><div><small>Caixa</small><strong>{negativeCashPositions ? `${negativeCashPositions} projeção(ões) negativa(s)` : "Projeções equilibradas"}</strong><em>{plannedCashMovements.length} movimento(s) ainda previsto(s)</em></div><ArrowRight aria-hidden="true" /></button></div>
        </aside>
      </section>

      <aside className="finance-manual-banner"><WifiOff aria-hidden="true" /><span><strong>Controle manual, sem integração bancária</strong>Os valores são demonstrativos, ficam somente nesta sessão e não representam movimentações reais.</span></aside>

      <section className="finance-command-panel" aria-label="Filtros financeiros">
        <div className="finance-shared-filters">
          <div className="finance-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar descrição, fornecedor ou código" aria-label="Buscar no financeiro" /></div>
          <label><span>Obra</span><select value={workFilter} onChange={(event) => setWorkFilter(event.target.value)}><option>Todas as obras</option>{works.map((work) => <option key={work.id} value={work.id}>{work.id} · {work.title}</option>)}</select></label>
          <label><span>Imóvel</span><select value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)}><option>Todos os imóveis</option>{properties.map((property) => <option key={property}>{property}</option>)}</select></label>
          <label><span>Período</span><select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}><option>Todo o período</option><option>Agosto de 2026</option><option>Setembro de 2026</option></select></label>
          <button type="button" className="secondary-button button-with-icon" onClick={clearSharedFilters} disabled={!activeFilterCount}><RotateCcw aria-hidden="true" />Limpar</button>
        </div>
        <footer><span><SlidersHorizontal aria-hidden="true" />Os filtros permanecem ativos ao trocar de aba.</span><strong>{activeFilterCount ? `${activeFilterCount} filtro(s) ativo(s)` : "Visão de todas as obras"}</strong></footer>
      </section>

      <nav className="finance-tabs" aria-label="Áreas financeiras">{tabs.map(({ name, icon: Icon, count }) => <button type="button" key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}><Icon aria-hidden="true" /><span>{name}</span><b>{count}</b></button>)}</nav>

      {tab === "Orçamentos" && <section className="finance-tab-panel" aria-labelledby="finance-budgets-title">
        <header className="finance-panel-heading"><div><p className="eyebrow">Cotações e escolhas</p><h2 id="finance-budgets-title">Orçamentos</h2><span>Orçamento selecionado: <strong>{brl.format(selectedBudgetTotal)}</strong></span></div><div className="finance-inline-filters"><select value={budgetStatus} onChange={(event) => setBudgetStatus(event.target.value)} aria-label="Filtrar situação do orçamento"><option>Todas as situações</option><option>Solicitado</option><option>Recebido</option><option>Selecionado</option><option>Rejeitado</option><option>Expirado</option></select><select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} aria-label="Filtrar fornecedor"><option>Todos os fornecedores</option>{providers.map((provider) => <option key={provider}>{provider}</option>)}</select></div></header>
        <div className="finance-budget-overview">
          <div className="finance-budget-metrics"><article><span><ClipboardList aria-hidden="true" /></span><div><small>Serviços cotados</small><strong>{budgetGroups.length}</strong><p>{scopedBudgets.length} propostas registradas</p></div></article><article className={budgetDecisionGroups.length ? "attention" : ""}><span><ArrowUpDown aria-hidden="true" /></span><div><small>Prontos para escolha</small><strong>{budgetDecisionGroups.length}</strong><p>Com duas ou mais propostas</p></div></article><article className={budgetsAwaitingReturn ? "warning" : ""}><span><CalendarClock aria-hidden="true" /></span><div><small>Aguardando retorno</small><strong>{budgetsAwaitingReturn}</strong><p>Propostas ainda solicitadas</p></div></article><article className={budgetsNearExpiry ? "warning" : ""}><span><TriangleAlert aria-hidden="true" /></span><div><small>Validade próxima</small><strong>{budgetsNearExpiry}</strong><p>Vencem até 31 de agosto</p></div></article></div>
          {budgetDecisionGroups.length > 0 && <section className="finance-budget-decisions" aria-labelledby="budget-decisions-title"><header><div><p className="eyebrow">Decisões rápidas</p><h3 id="budget-decisions-title">Serviços prontos para comparação</h3></div><b>{budgetDecisionGroups.length}</b></header><div>{budgetDecisionGroups.map((group) => { const received = group.filter((budget) => budget.status === "Recebido"); const lowest = Math.min(...received.map((budget) => budget.amount)); const highest = Math.max(...received.map((budget) => budget.amount)); const work = works.find((record) => record.id === group[0].workId); return <article key={`${group[0].workId}-${group[0].service}`}><span><ArrowUpDown aria-hidden="true" /></span><div><small>{group[0].workId} · {work?.property}</small><strong>{group[0].service}</strong><em>{received.length} propostas · diferença de {brl.format(highest - lowest)}</em></div><div><small>A partir de</small><strong>{brl.format(lowest)}</strong></div><button type="button" onClick={() => setComparisonKey(`${group[0].workId}::${group[0].service}`)}>Comparar agora<ArrowRight aria-hidden="true" /></button></article>; })}</div></section>}
        </div>
        <div className="finance-records-caption"><span><strong>{filteredBudgets.length}</strong> {filteredBudgets.length === 1 ? "proposta encontrada" : "propostas encontradas"}</span><small>Selecionar uma proposta não registra pagamento.</small></div>
        {filteredBudgets.length ? <div className="finance-record-list finance-budget-list">{filteredBudgets.map((budget) => { const work = works.find((record) => record.id === budget.workId); const quoteCount = data.budgets.filter((item) => item.workId === budget.workId && item.service === budget.service).length; const isLowest = budget.amount === Math.min(...data.budgets.filter((item) => item.workId === budget.workId && item.service === budget.service).map((item) => item.amount)); return <article key={budget.id} className={budget.status === "Selecionado" ? "selected" : ""}><span className="finance-record-icon"><ClipboardList aria-hidden="true" /></span><div className="finance-record-main"><small>{budget.id} · {budget.workId}{budget.stage ? ` · ${budget.stage}` : ""}</small><strong>{budget.service}</strong><em>{budget.provider}</em>{budget.selectionReason && <p className="finance-selection-reason"><Check aria-hidden="true" />Escolhida por: {budget.selectionReason}</p>}<button type="button" onClick={() => openWork(budget.workId)}>{work?.property}<ArrowRight aria-hidden="true" /></button></div><div className="finance-record-value"><small>Proposta</small><strong>{brl.format(budget.amount)}</strong>{isLowest && quoteCount > 1 && <em>Menor valor</em>}</div><div className="finance-record-date"><small>Validade</small><strong>{formatExpenseDate(budget.validityDateIso)}</strong><span>Recebida em {formatExpenseDate(budget.receivedDateIso)}</span>{budget.attachmentName && <em><Paperclip aria-hidden="true" />{budget.attachmentName}</em>}</div><WorkModuleFinanceStatus status={budget.status} /><div className="finance-record-actions">{quoteCount > 1 && <button type="button" onClick={() => setComparisonKey(`${budget.workId}::${budget.service}`)}>Comparar {quoteCount}</button>}{budget.status !== "Selecionado" && budget.status !== "Expirado" && budget.status !== "Rejeitado" && <button type="button" className="primary" onClick={() => setAction({ type: "select", budget })}>Selecionar</button>}</div></article>; })}</div> : <FinanceEmptyState onClear={() => { clearSharedFilters(); setBudgetStatus("Todas as situações"); setProviderFilter("Todos os fornecedores"); }} />}
      </section>}

      {tab === "Gastos" && <section className="finance-tab-panel" aria-labelledby="finance-expenses-title">
        <header className="finance-panel-heading"><div><p className="eyebrow">Compromissos da execução</p><h2 id="finance-expenses-title">Gastos</h2><span>Previsto é planejamento; somente Pago afeta o caixa realizado.</span></div><div className="finance-inline-filters"><select value={expenseStatus} onChange={(event) => setExpenseStatus(event.target.value)} aria-label="Filtrar situação do gasto"><option>Todas as situações</option><option>Previsto</option><option>Pendente</option><option>Pago</option></select><select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} aria-label="Filtrar categoria"><option>Todas as categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div></header>
        <div className="finance-summary-grid finance-expense-summary"><article><span><ClipboardList aria-hidden="true" /></span><div><small>Valor de referência</small><strong>{brl.format(selectedBudgetTotal)}</strong><p>Propostas selecionadas</p></div></article><article><span><HandCoins aria-hidden="true" /></span><div><small>Gastos lançados</small><strong>{brl.format(expenseTotal)}</strong><p>{brl.format(expectedExpenseTotal)} planejado nos itens</p></div></article><article><span><CircleCheck aria-hidden="true" /></span><div><small>Já pago</small><strong>{brl.format(paidExpenseTotal)}</strong><p>Com saída realizada no caixa</p></div></article><article className={expenseBalance < 0 ? "danger" : ""}><span><WalletCards aria-hidden="true" /></span><div><small>Saldo previsto</small><strong>{brl.format(expenseBalance)}</strong><p>Referência menos gastos lançados</p></div></article></div>
        {(expensesOverExpected.length > 0 || paymentsDueSoon.length > 0) && <div className="finance-expense-priorities">
          <section className="expense-overrun-panel" aria-labelledby="expense-overrun-title"><header><div><p className="eyebrow">Atenção ao previsto</p><h3 id="expense-overrun-title">Gastos acima do esperado</h3></div><span><strong>{expensesOverExpected.length}</strong><small>{brl.format(expenseOverrunTotal)} acima</small></span></header>{expensesOverExpected.length ? <div>{expensesOverExpected.slice(0, 3).map((expense) => { const work = works.find((record) => record.id === expense.workId); return <article key={expense.id}><span><TriangleAlert aria-hidden="true" /></span><div><small>{expense.id} · {expense.workId}</small><strong>{expense.description}</strong><em>{work?.property}</em></div><div><small>Diferença</small><strong>+ {brl.format(expense.amount - expense.expectedAmount)}</strong></div><button type="button" onClick={() => openWork(expense.workId)}>Abrir obra<ArrowRight aria-hidden="true" /></button></article>; })}</div> : <CompactEmptyState mark="✓" tone="success" title="Dentro do previsto" description="Nenhum gasto está acima do valor planejado." />}</section>
          <section className="expense-payments-panel" aria-labelledby="expense-payments-title"><header><div><p className="eyebrow">Próximos pagamentos</p><h3 id="expense-payments-title">Pendentes até 31 de agosto</h3></div><b>{paymentsDueSoon.length}</b></header>{paymentsDueSoon.length ? <div>{paymentsDueSoon.slice(0, 3).map((expense) => <article key={expense.id}><time dateTime={expense.dateIso}><strong>{expense.dateIso.slice(8, 10)}</strong><small>AGO</small></time><div><small>{expense.id} · {expense.supplier}</small><strong>{expense.description}</strong><em>{brl.format(expense.amount)}</em></div><button type="button" onClick={() => setAction({ type: "pay", expense })}>Confirmar<Check aria-hidden="true" /></button></article>)}</div> : <CompactEmptyState mark="✓" tone="success" title="Nenhum pagamento próximo" description="Não há gastos pendentes nesta janela." />}</section>
        </div>}
        <div className="finance-records-caption finance-expense-caption"><span><strong>{filteredExpenses.length}</strong> {filteredExpenses.length === 1 ? "gasto encontrado" : "gastos encontrados"}</span><small>Pago gera uma única saída realizada; Previsto e Pendente ficam somente na projeção.</small></div>
        {filteredExpenses.length ? <div className="finance-record-list finance-expense-list">{filteredExpenses.map((expense) => { const work = works.find((record) => record.id === expense.workId); const difference = expense.amount - expense.expectedAmount; const overExpected = difference > 0; return <article key={expense.id} className={overExpected ? "over-budget" : ""}><span className="finance-record-icon"><HandCoins aria-hidden="true" /></span><div className="finance-record-main"><small>{expense.id} · {expense.category}{expense.sourceBudgetId ? ` · origem ${expense.sourceBudgetId}` : ""}</small><strong>{expense.description}</strong><em>{expense.supplier}</em><button type="button" onClick={() => openWork(expense.workId)}>{expense.workId} · {work?.title}<ArrowRight aria-hidden="true" /></button></div><div className="finance-record-value"><small>Valor lançado</small><strong>{brl.format(expense.amount)}</strong><span className="expense-expected-value">Previsto: {brl.format(expense.expectedAmount)}</span><em className={overExpected ? "danger" : "within-budget"}>{overExpected ? <TriangleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}{difference > 0 ? `+ ${brl.format(difference)}` : difference < 0 ? `${brl.format(Math.abs(difference))} abaixo` : "Conforme previsto"}</em></div><div className="finance-record-date"><small>{expense.status === "Pago" ? "Pagamento" : "Data prevista"}</small><strong>{formatExpenseDate(expense.dateIso)}</strong>{expense.attachmentName ? <em><Paperclip aria-hidden="true" />{expense.attachmentName}</em> : <span>Sem comprovante anexado</span>}</div><WorkModuleFinanceStatus status={expense.status} /><div className="finance-record-actions">{expense.status !== "Pago" ? <button type="button" className="primary" onClick={() => setAction({ type: "pay", expense })}>Marcar pago</button> : <span><Check aria-hidden="true" />Saída registrada</span>}</div></article>; })}</div> : <FinanceEmptyState onClear={() => { clearSharedFilters(); setExpenseStatus("Todas as situações"); setExpenseCategory("Todas as categorias"); }} />}
      </section>}

      {tab === "Caixa" && <section className="finance-tab-panel" aria-labelledby="finance-cash-title">
        <header className="finance-panel-heading"><div><p className="eyebrow">Fluxo manual</p><h2 id="finance-cash-title">Caixa</h2><span>Realizado altera o saldo atual; Previsto aparece apenas na projeção.</span></div><div className="finance-inline-filters"><select value={cashType} onChange={(event) => setCashType(event.target.value)} aria-label="Filtrar tipo de movimento"><option>Todos os tipos</option><option>Aporte</option><option>Reembolso</option><option>Ajuste</option><option>Saída de gasto</option></select><select value={cashStatus} onChange={(event) => setCashStatus(event.target.value)} aria-label="Filtrar situação do movimento"><option>Todas as situações</option><option>Previsto</option><option>Realizado</option></select></div></header>
        <div className="finance-cash-metrics"><article><small>Saldo inicial</small><strong>{brl.format(initialBalance)}</strong><p>Aportes ou saldo anterior</p></article><article><small>Entradas</small><strong className="positive">+ {brl.format(realizedEntries)}</strong><p>Movimentos realizados</p></article><article><small>Saídas</small><strong className="negative">− {brl.format(realizedOutputs)}</strong><p>Pagamentos realizados</p></article><article><small>Saldo atual</small><strong className={currentCash < 0 ? "negative" : ""}>{brl.format(currentCash)}</strong><p>Somente movimentos realizados</p></article><article><small>Saldo projetado</small><strong className={projectedCash < 0 ? "negative" : ""}>{brl.format(projectedCash)}</strong><p>{plannedCashMovements.length} movimento(s) ainda previsto(s)</p></article></div>
        <aside className="finance-cash-equation"><span><strong>Saldo atual</strong>somente movimentos realizados</span><i aria-hidden="true">+</i><span><strong>Movimentos previstos</strong>entradas e saídas planejadas</span><i aria-hidden="true">=</i><span className={projectedCash < 0 ? "danger" : ""}><strong>Saldo projetado</strong>{brl.format(projectedCash)}</span></aside>
        <section className="finance-month-comparison" aria-label="Comparação mensal de saídas"><header><div><strong>Saídas previstas x realizadas</strong><span>Comparação simples por mês</span></div></header><div>{monthComparison.map((month) => { const percent = month.planned ? Math.min(100, Math.round((month.realized / month.planned) * 100)) : 0; return <article key={month.key}><div><strong>{month.label}</strong><span>{percent}% realizado</span></div><dl><div><dt>Previsto</dt><dd>{brl.format(month.planned)}</dd></div><div><dt>Realizado</dt><dd>{brl.format(month.realized)}</dd></div></dl><i><b style={{ width: `${percent}%` }} /></i></article>; })}</div></section>
        <section className={`finance-cash-positions ${negativeCashPositions ? "has-danger" : ""}`} aria-labelledby="cash-positions-title"><header><div><p className="eyebrow">Visão por obra</p><h3 id="cash-positions-title">Posição do caixa</h3><span>Veja onde os movimentos previstos podem exigir ajuste.</span></div><span><strong>{cashPositions.length}</strong><small>{negativeCashPositions ? `${negativeCashPositions} com projeção negativa` : "Nenhuma projeção negativa"}</small></span></header><div>{cashPositions.map(({ work, current, projected, plannedCount }) => <article key={work.id} className={projected < 0 ? "danger" : plannedCount ? "attention" : ""}><span><Building2 aria-hidden="true" /></span><div className="cash-position-work"><small>{work.id} · {work.property}</small><strong>{work.title}</strong></div><div><small>Saldo atual</small><strong className={current < 0 ? "negative" : ""}>{brl.format(current)}</strong></div><div><small>Projetado</small><strong className={projected < 0 ? "negative" : ""}>{brl.format(projected)}</strong></div><div><small>Previstos</small><strong>{plannedCount}</strong></div><span className="cash-position-status"><i />{projected < 0 ? "Projeção negativa" : plannedCount ? "Com movimentos previstos" : "Somente realizado"}</span><button type="button" onClick={() => openWork(work.id)}>Abrir<ArrowRight aria-hidden="true" /></button></article>)}</div></section>
        <div className="finance-records-caption finance-cash-caption"><span><strong>{filteredCash.length}</strong> {filteredCash.length === 1 ? "movimento encontrado" : "movimentos encontrados"}</span><small>Nenhum valor desta demonstração foi consultado ou enviado a um banco.</small></div>
        {filteredCash.length ? <div className="finance-record-list finance-cash-list">{filteredCash.slice().sort((left, right) => right.dateIso.localeCompare(left.dateIso)).map((movement) => { const work = works.find((record) => record.id === movement.workId); return <article key={movement.id}><span className={`finance-record-icon ${movement.direction === "Entrada" ? "entry" : "output"}`}>{movement.direction === "Entrada" ? <ArrowDownToLine aria-hidden="true" /> : <ArrowUpDown aria-hidden="true" />}</span><div className="finance-record-main"><small>{movement.id} · {movement.type}</small><strong>{movement.description}</strong><button type="button" onClick={() => openWork(movement.workId)}>{movement.workId} · {work?.title}<ArrowRight aria-hidden="true" /></button></div><div className={`finance-record-value ${movement.direction === "Entrada" ? "entry" : "output"}`}><small>{movement.direction}</small><strong>{movement.direction === "Entrada" ? "+" : "−"} {brl.format(movement.amount)}</strong>{movement.linkedExpenseId && <em>Gasto {movement.linkedExpenseId}</em>}</div><div className="finance-record-date"><small>{movement.status === "Realizado" ? "Realizado em" : "Previsto para"}</small><strong>{formatExpenseDate(movement.dateIso)}</strong></div><WorkModuleFinanceStatus status={movement.status} /><div className="finance-record-actions"><span>{movement.status === "Realizado" ? <Check aria-hidden="true" /> : <CalendarClock aria-hidden="true" />}{movement.status}</span></div></article>; })}</div> : <FinanceEmptyState onClear={() => { clearSharedFilters(); setCashType("Todos os tipos"); setCashStatus("Todas as situações"); }} />}
      </section>}
    </div>

    {action?.type === "budget" && <WorkBudgetFormModal works={works} initialWorkId={workFilter} onClose={() => setAction(null)} onSave={saveBudget} />}
    {action?.type === "expense" && <WorkExpenseFormModal works={works} initialWorkId={workFilter} onClose={() => setAction(null)} onSave={saveExpense} />}
    {action?.type === "cash" && <WorkCashFormModal works={works} expenses={data.expenses} initialWorkId={workFilter} onClose={() => setAction(null)} onSave={saveCashMovement} />}
    {action?.type === "select" && <WorkBudgetSelectionModal budget={action.budget} currentSelection={data.budgets.find((budget) => budget.workId === action.budget.workId && budget.service === action.budget.service && budget.status === "Selecionado")} onClose={() => setAction(null)} onSave={(formData) => selectBudget(action.budget, formData)} />}
    {action?.type === "pay" && <WorkExpensePaymentModal expense={action.expense} hasCashMovement={data.cashMovements.some((movement) => movement.linkedExpenseId === action.expense.id)} onClose={() => setAction(null)} onConfirm={() => markExpensePaid(action.expense)} />}
    {comparisonQuotes.length > 0 && <WorkBudgetComparisonDrawer quotes={comparisonQuotes} workTitle={workName(comparisonQuotes[0].workId)} onClose={() => setComparisonKey(null)} onSelect={(budget) => { setComparisonKey(null); setAction({ type: "select", budget }); }} />}
  </>;
}

function FinanceEmptyState({ onClear }: { onClear: () => void }) {
  return <div className="finance-empty"><CompactEmptyState mark="00" title="Nenhum registro encontrado" description="Ajuste os filtros para consultar outros lançamentos financeiros." /><button type="button" className="secondary-button button-with-icon" onClick={onClear}><RotateCcw aria-hidden="true" />Limpar filtros</button></div>;
}

function WorkBudgetFormModal({ works, initialWorkId, onClose, onSave }: { works: WorkRecord[]; initialWorkId: string; onClose: () => void; onSave: (data: FormData) => void }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Adicionar orçamento"><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar orçamento" /><form className="receipt-modal work-detail-modal work-finance-form-modal" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}><ModalHeader eyebrow="Financeiro das obras" title="Adicionar orçamento" onClose={onClose} /><div className="work-detail-modal-body"><p className="finance-form-help">A proposta será apenas registrada para comparação. Isso não cria pagamento.</p><div className="form-grid"><label className="full-field">Obra<select name="workId" defaultValue={initialWorkId !== "Todas as obras" ? initialWorkId : works[0]?.id} required>{works.map((work) => <option key={work.id} value={work.id}>{work.id} · {work.title}</option>)}</select></label><label>Etapa opcional<input name="stage" placeholder="Ex.: Execução" /></label><label>Situação<select name="status" defaultValue="Recebido"><option>Solicitado</option><option>Recebido</option></select></label><label className="full-field">Serviço ou escopo<input name="service" placeholder="O que está sendo cotado" required /></label><label className="full-field">Fornecedor ou prestador<input name="provider" placeholder="Nome do fornecedor" required /></label><label>Valor<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Recebido em<input name="receivedDateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} required /></label><label>Validade<input name="validityDateIso" type="date" defaultValue="2026-09-24" required /></label><label className="file-field"><span>Arquivo demonstrativo</span><input name="attachment" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" /></label></div></div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />Adicionar orçamento</button></footer></form></div>;
}

function WorkExpenseFormModal({ works, initialWorkId, onClose, onSave }: { works: WorkRecord[]; initialWorkId: string; onClose: () => void; onSave: (data: FormData) => void }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Registrar gasto"><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar gasto" /><form className="receipt-modal work-detail-modal work-finance-form-modal" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}><ModalHeader eyebrow="Financeiro das obras" title="Registrar gasto" onClose={onClose} /><div className="work-detail-modal-body"><p className="finance-form-help">Use Previsto para planejamento, Pendente para cobrança aberta e Pago somente quando confirmado.</p><div className="form-grid"><label className="full-field">Obra<select name="workId" defaultValue={initialWorkId !== "Todas as obras" ? initialWorkId : works[0]?.id} required>{works.map((work) => <option key={work.id} value={work.id}>{work.id} · {work.title}</option>)}</select></label><label className="full-field">Descrição<input name="description" placeholder="Descrição curta do gasto" required /></label><label>Categoria<select name="category"><option>Materiais</option><option>Mão de obra</option><option>Equipamentos</option><option>Serviços técnicos</option><option>Taxas</option><option>Outros</option></select></label><label>Fornecedor<input name="supplier" required /></label><label>Valor lançado<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Valor previsto<input name="expectedAmount" type="number" min="0.01" step="0.01" required /></label><label>Data<input name="dateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} required /></label><label>Situação<select name="status" defaultValue="Previsto"><option>Previsto</option><option>Pendente</option><option>Pago</option></select></label><label className="file-field full-field"><span>Comprovante demonstrativo</span><input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" /></label></div></div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />Registrar gasto</button></footer></form></div>;
}

function WorkCashFormModal({ works, expenses, initialWorkId, onClose, onSave }: { works: WorkRecord[]; expenses: WorkModuleExpense[]; initialWorkId: string; onClose: () => void; onSave: (data: FormData) => void }) {
  const [type, setType] = useState<WorkCashMovementType>("Aporte");
  const [direction, setDirection] = useState<"Entrada" | "Saída">("Entrada");
  const [workId, setWorkId] = useState(initialWorkId !== "Todas as obras" ? initialWorkId : works[0]?.id ?? "");
  const [linkedExpenseId, setLinkedExpenseId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const availableExpenses = expenses.filter((expense) => expense.workId === workId && expense.status !== "Pago");
  const selectedExpense = availableExpenses.find((expense) => expense.id === linkedExpenseId);
  const resetLinkedExpense = () => { setLinkedExpenseId(""); setDescription(""); setAmount(""); };
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Registrar movimento de caixa"><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar movimento" /><form className="receipt-modal work-detail-modal work-finance-form-modal" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}><ModalHeader eyebrow="Caixa manual" title="Registrar movimento" onClose={onClose} /><div className="work-detail-modal-body"><p className="finance-form-help">Somente movimentos realizados alteram o saldo atual. Movimentos previstos afetam apenas a projeção.</p><div className="form-grid"><label className="full-field">Obra<select name="workId" value={workId} onChange={(event) => { setWorkId(event.target.value); resetLinkedExpense(); }} required>{works.map((work) => <option key={work.id} value={work.id}>{work.id} · {work.title}</option>)}</select></label><label>Tipo<select name="type" value={type} onChange={(event) => { const next = event.target.value as WorkCashMovementType; setType(next); setDirection(next === "Saída de gasto" ? "Saída" : "Entrada"); resetLinkedExpense(); }}><option>Aporte</option><option>Reembolso</option><option>Ajuste</option><option>Saída de gasto</option></select></label><label>Direção<select name="direction" value={direction} onChange={(event) => setDirection(event.target.value as "Entrada" | "Saída")} disabled={type === "Saída de gasto"}><option>Entrada</option><option>Saída</option></select>{type === "Saída de gasto" && <input type="hidden" name="direction" value="Saída" />}</label>{type === "Saída de gasto" && <><label className="full-field">Gasto relacionado<select name="linkedExpenseId" value={linkedExpenseId} onChange={(event) => { const nextId = event.target.value; const expense = availableExpenses.find((item) => item.id === nextId); setLinkedExpenseId(nextId); setDescription(expense?.description ?? ""); setAmount(expense ? String(expense.amount) : ""); }} required><option value="">Selecione um gasto pendente ou previsto</option>{availableExpenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.id} · {expense.description}</option>)}</select></label>{selectedExpense && <aside className="finance-linked-expense-preview full-field"><HandCoins aria-hidden="true" /><span><small>{selectedExpense.status} · {selectedExpense.supplier}</small><strong>{brl.format(selectedExpense.amount)}</strong><em>A movimentação existente será atualizada, sem criar uma saída duplicada.</em></span></aside>}</>}<label className="full-field">Descrição<input name="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Motivo do movimento" required /></label><label>Valor<input name="amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label>Data<input name="dateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} required /></label><label>Situação<select name="status" defaultValue="Realizado"><option>Previsto</option><option>Realizado</option></select></label></div></div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />Registrar movimento</button></footer></form></div>;
}

function WorkBudgetSelectionModal({ budget, currentSelection, onClose, onSave }: { budget: WorkBudgetQuote; currentSelection?: WorkBudgetQuote; onClose: () => void; onSave: (data: FormData) => void }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Selecionar orçamento"><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar seleção" /><form className="receipt-modal work-detail-modal work-finance-selection-modal" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}><ModalHeader eyebrow={budget.id} title="Selecionar proposta" onClose={onClose} /><div className="work-detail-modal-body"><div className="finance-selection-summary"><span><small>Fornecedor</small><strong>{budget.provider}</strong></span><span><small>Valor</small><strong>{brl.format(budget.amount)}</strong></span></div>{currentSelection && currentSelection.id !== budget.id && <div className="finance-replacement-warning"><TriangleAlert aria-hidden="true" /><span><strong>Esta escolha substituirá a proposta atual.</strong>{currentSelection.provider} · {brl.format(currentSelection.amount)}</span></div>}<div className="form-grid"><label className="full-field">Motivo da escolha<textarea name="reason" rows={4} placeholder="Explique brevemente prazo, valor ou condição escolhida" required /></label><label className="full-field finance-create-expense"><input name="createExpense" type="checkbox" /><span><strong>Criar também um gasto previsto</strong><small>Isso cria apenas um planejamento, não um pagamento.</small></span></label></div></div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />{currentSelection && currentSelection.id !== budget.id ? "Substituir e selecionar" : "Selecionar proposta"}</button></footer></form></div>;
}

function WorkExpensePaymentModal({ expense, hasCashMovement, onClose, onConfirm }: { expense: WorkModuleExpense; hasCashMovement: boolean; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Confirmar pagamento"><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar confirmação" /><div className="receipt-modal work-detail-modal finance-payment-modal"><ModalHeader eyebrow={expense.id} title="Confirmar pagamento" onClose={onClose} /><div className="work-detail-modal-body"><div className="finance-payment-icon"><HandCoins aria-hidden="true" /></div><h3>{expense.description}</h3><strong>{brl.format(expense.amount)}</strong><p>O gasto será marcado como Pago e sua saída de caixa ficará como Realizada.</p>{hasCashMovement && <span><Check aria-hidden="true" />A movimentação prevista existente será atualizada, sem duplicar a saída.</span>}</div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="button" className="primary-button button-with-icon" onClick={onConfirm}><Check aria-hidden="true" />Confirmar pagamento</button></footer></div></div>;
}

function WorkBudgetComparisonDrawer({ quotes, workTitle, onClose, onSelect }: { quotes: WorkBudgetQuote[]; workTitle: string; onClose: () => void; onSelect: (budget: WorkBudgetQuote) => void }) {
  const lowest = Math.min(...quotes.map((quote) => quote.amount));
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Comparar propostas"><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar comparação" /><aside className="drawer wide-drawer finance-comparison-drawer"><header className="drawer-header"><div><p className="eyebrow">{quotes[0].workId} · {workTitle}</p><h2>Comparar propostas</h2><span>{quotes[0].service}</span></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header><div className="drawer-body"><p className="finance-form-help">Compare valor e validade. A escolha final deve considerar também prazo, escopo e garantia.</p><div className="finance-comparison-list">{quotes.map((quote, index) => { const difference = quote.amount - lowest; return <article key={quote.id} className={quote.status === "Selecionado" ? "selected" : ""}><b>0{index + 1}</b><div><small>{quote.id}</small><strong>{quote.provider}</strong><span>Recebida em {formatExpenseDate(quote.receivedDateIso)} · válida até {formatExpenseDate(quote.validityDateIso)}</span>{quote.attachmentName && <em><Paperclip aria-hidden="true" />{quote.attachmentName}</em>}{quote.selectionReason && <p><Check aria-hidden="true" />{quote.selectionReason}</p>}</div><div><small>Valor</small><strong>{brl.format(quote.amount)}</strong>{difference === 0 ? <em>Menor proposta</em> : <span className="comparison-difference">+ {brl.format(difference)}</span>}</div><WorkModuleFinanceStatus status={quote.status} />{quote.status !== "Selecionado" && quote.status !== "Expirado" && quote.status !== "Rejeitado" ? <button type="button" onClick={() => onSelect(quote)}>Selecionar</button> : <span className="comparison-no-action">{quote.status === "Selecionado" ? "Escolha atual" : "Indisponível"}</span>}</article>; })}</div></div></aside></div>;
}

function shiftWorkDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function createWorkScheduleActivities(works: WorkRecord[]): WorkScheduleActivity[] {
  return works.flatMap((work, workIndex) => {
    const seed = createWorkDetailMock(work).activities;
    return [seed[0], seed[2], seed[3], seed[4]].filter((activity): activity is WorkActivity => Boolean(activity)).map((activity, activityIndex) => {
      const offset = activityIndex === 1 ? workIndex - 3 : activityIndex === 2 ? workIndex - 1 : 0;
      return {
        ...activity,
        id: `${work.id}-${activity.id}`,
        workId: work.id,
        workTitle: work.title,
        property: work.property,
        startDateIso: offset ? shiftWorkDate(activity.startDateIso, offset) : activity.startDateIso,
        endDateIso: offset ? shiftWorkDate(activity.endDateIso, offset) : activity.endDateIso,
      };
    });
  });
}

function WorksSchedulePage({ works, onOpenWork, onUpdateWork, onNotify }: { works: WorkRecord[]; onOpenWork: (work: WorkRecord) => void; onUpdateWork: (work: WorkRecord, message: string) => void; onNotify: (message: string, reference: string) => void }) {
  const [view, setView] = useState<"Agenda" | "Calendário">("Agenda");
  const [workFilter, setWorkFilter] = useState("Todas as obras");
  const [managerFilter, setManagerFilter] = useState("Todos os responsáveis");
  const [statusFilter, setStatusFilter] = useState("Todas as situações");
  const [month, setMonth] = useState("2026-08");
  const [action, setAction] = useState<WorkScheduleAction>(null);
  const [activities, setActivities] = useState<WorkScheduleActivity[]>(() => createWorkScheduleActivities(works));
  const managers = Array.from(new Set(activities.map((activity) => activity.manager))).sort((left, right) => left.localeCompare(right, "pt-BR"));
  const filteredActivities = activities.filter((activity) => (workFilter === "Todas as obras" || activity.workId === workFilter) && (managerFilter === "Todos os responsáveis" || activity.manager === managerFilter) && (statusFilter === "Todas as situações" || activity.status === statusFilter));
  const filtersActive = workFilter !== "Todas as obras" || managerFilter !== "Todos os responsáveis" || statusFilter !== "Todas as situações";
  const overdue = filteredActivities.filter((activity) => activity.status !== "Concluída" && activity.status !== "Bloqueada" && activity.endDateIso < WORKS_DEMO_DATE_ISO);
  const blocked = filteredActivities.filter((activity) => activity.status === "Bloqueada");
  const today = filteredActivities.filter((activity) => activity.status !== "Concluída" && activity.status !== "Bloqueada" && activity.endDateIso >= WORKS_DEMO_DATE_ISO && activity.startDateIso <= WORKS_DEMO_DATE_ISO);
  const upcoming = filteredActivities.filter((activity) => activity.status !== "Concluída" && activity.status !== "Bloqueada" && activity.startDateIso > WORKS_DEMO_DATE_ISO);
  const completed = filteredActivities.filter((activity) => activity.status === "Concluída");
  const nextSevenDays = filteredActivities.filter((activity) => activity.status !== "Concluída" && activity.status !== "Bloqueada" && activity.endDateIso > WORKS_DEMO_DATE_ISO && activity.endDateIso <= shiftWorkDate(WORKS_DEMO_DATE_ISO, 7)).length;
  const scheduleWeek = Array.from({ length: 7 }, (_, index) => {
    const dateIso = shiftWorkDate(WORKS_DEMO_DATE_ISO, index);
    const date = new Date(`${dateIso}T12:00:00Z`);
    return {
      dateIso,
      day: dateIso.slice(8, 10),
      weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(date).replace(".", ""),
      activities: filteredActivities.filter((activity) => activity.endDateIso === dateIso),
    };
  });
  const maxScheduleWeekLoad = Math.max(1, ...scheduleWeek.map((day) => day.activities.length));
  const criticalActivity = [...overdue, ...blocked, ...today, ...upcoming].sort((left, right) => left.endDateIso.localeCompare(right.endDateIso))[0];
  const agendaGroups = [
    { id: "delayed", title: "Atrasadas", description: "Prazo já ultrapassado", tone: "danger", rows: overdue },
    { id: "blocked", title: "Bloqueadas", description: "Dependem de uma decisão", tone: "warning", rows: blocked },
    { id: "today", title: "Em execução hoje", description: "Atividades que atravessam a data atual", tone: "today", rows: today },
    { id: "upcoming", title: "Próximas", description: "Ainda não iniciadas", tone: "next", rows: upcoming },
    { id: "completed", title: "Concluídas", description: "Finalizadas neste planejamento", tone: "completed", rows: completed },
  ];
  const [calendarYear, calendarMonth] = month.split("-").map(Number);
  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1)).getUTCDay();
    const gridStart = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1 - firstDay));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setUTCDate(gridStart.getUTCDate() + index);
      return { dateIso: date.toISOString().slice(0, 10), day: date.getUTCDate(), currentMonth: date.getUTCMonth() === calendarMonth - 1 };
    });
  }, [calendarMonth, calendarYear]);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(calendarYear, calendarMonth - 1, 1)));
  const changeMonth = (direction: number) => {
    const date = new Date(Date.UTC(calendarYear, calendarMonth - 1 + direction, 1));
    setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const clearFilters = () => {
    setWorkFilter("Todas as obras");
    setManagerFilter("Todos os responsáveis");
    setStatusFilter("Todas as situações");
  };
  const openActivityWork = (activity: WorkScheduleActivity) => {
    const work = works.find((record) => record.id === activity.workId);
    if (work) onOpenWork(work);
  };
  const completeActivity = (activity: WorkScheduleActivity) => {
    const nextActivities = activities.map((item) => item.id === activity.id ? { ...item, status: "Concluída" as const, blockedReason: undefined } : item);
    setActivities(nextActivities);
    const work = works.find((record) => record.id === activity.workId);
    if (work) {
      const related = nextActivities.filter((item) => item.workId === work.id);
      const progress = Math.round((related.filter((item) => item.status === "Concluída").length / Math.max(related.length, 1)) * 100);
      onUpdateWork({ ...work, progress, nextActivity: related.find((item) => item.status !== "Concluída")?.title ?? "Entrega concluída", lastUpdateLabel: "Atualizada agora nesta sessão" }, "Atividade concluída pelo cronograma.");
    }
  };
  const handleScheduleSubmit = (submittedAction: NonNullable<WorkScheduleAction>, formData: FormData) => {
    const value = (name: string) => String(formData.get(name) ?? "").trim();
    if (submittedAction.type === "new") {
      const work = works.find((record) => record.id === value("workId"));
      if (!work) return;
      const activity: WorkScheduleActivity = {
        id: nextRecordId("ATV", activities),
        workId: work.id,
        workTitle: work.title,
        property: work.property,
        stage: value("stage") as WorkActivity["stage"],
        title: value("title"),
        manager: value("manager"),
        startDateIso: value("startDateIso"),
        endDateIso: value("endDateIso"),
        status: "Não iniciada",
      };
      setActivities((current) => [...current, activity]);
      onNotify("Atividade adicionada ao cronograma.", activity.id);
    } else {
      const endDateIso = value("endDateIso");
      const reason = value("reason");
      setActivities((current) => current.map((activity) => activity.id === submittedAction.activity.id ? { ...activity, endDateIso, reprogramReason: reason } : activity));
      onNotify("Atividade reprogramada com justificativa.", submittedAction.activity.id);
    }
    setAction(null);
  };

  return <>
    <div className="works-schedule-page">
      <section className="works-dashboard-heading schedule-page-heading" aria-labelledby="schedule-page-title"><div><p className="eyebrow">Módulo 2 · Gestão de Obras</p><h1 id="schedule-page-title">Cronograma</h1><p>Acompanhe atrasos, atividades do dia e próximas entregas em uma única agenda.</p></div><button type="button" className="primary-button button-with-icon works-new-button" onClick={() => setAction({ type: "new" })}><Plus aria-hidden="true" />Nova atividade</button></section>

      <section className="schedule-command-bar" aria-label="Visualização e filtros do cronograma"><div className="schedule-view-toggle" role="group" aria-label="Forma de visualizar"><button type="button" className={view === "Agenda" ? "active" : ""} aria-pressed={view === "Agenda"} onClick={() => setView("Agenda")}><ClipboardList aria-hidden="true" />Agenda</button><button type="button" className={view === "Calendário" ? "active" : ""} aria-pressed={view === "Calendário"} onClick={() => setView("Calendário")}><CalendarClock aria-hidden="true" />Calendário</button></div><div className="schedule-filters"><label><span>Obra</span><select value={workFilter} onChange={(event) => setWorkFilter(event.target.value)}><option>Todas as obras</option>{works.map((work) => <option key={work.id} value={work.id}>{work.id} · {work.title}</option>)}</select></label><label><span>Responsável</span><select value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)}><option>Todos os responsáveis</option>{managers.map((manager) => <option key={manager}>{manager}</option>)}</select></label><label><span>Situação</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todas as situações</option><option>Não iniciada</option><option>Em andamento</option><option>Bloqueada</option><option>Concluída</option></select></label><button type="button" className="secondary-button button-with-icon" disabled={!filtersActive} onClick={clearFilters}><RotateCcw aria-hidden="true" />Limpar</button></div><footer><span><strong>{filteredActivities.length}</strong> de {activities.length} atividades exibidas</span><div className="schedule-legend" aria-label="Legenda"><span className="legend-delayed"><i />Atrasada</span><span className="legend-today"><i />Hoje</span><span className="legend-next"><i />Próxima</span><span className="legend-blocked"><i />Bloqueada</span><span className="legend-completed"><i />Concluída</span></div></footer></section>

      <section className="schedule-overview" aria-label="Pulso do cronograma">
        <article className="schedule-week-pulse">
          <header><div><p className="eyebrow">Pulso da semana</p><h2>Distribuição das entregas</h2><span>Conclusões previstas entre 24 e 30 de agosto.</span></div><CalendarClock aria-hidden="true" /></header>
          <div className="schedule-week-chart">{scheduleWeek.map((day, index) => <span key={day.dateIso} className={index === 0 ? "today" : ""}><small>{day.weekday}</small><strong>{day.day}</strong><i><b style={{ height: `${Math.max(day.activities.length ? 18 : 5, (day.activities.length / maxScheduleWeekLoad) * 100)}%` }} /></i><em>{day.activities.length}</em></span>)}</div>
          {criticalActivity ? <button type="button" className={`schedule-critical-activity ${overdue.some((activity) => activity.id === criticalActivity.id) ? "danger" : blocked.some((activity) => activity.id === criticalActivity.id) ? "blocked" : "next"}`} onClick={() => openActivityWork(criticalActivity)}><span><small>Ponto de atenção prioritário</small><strong>{criticalActivity.title}</strong><em>{criticalActivity.workId} · {criticalActivity.workTitle}</em></span><span><small>Prazo</small><strong>{formatExpenseDate(criticalActivity.endDateIso)}</strong><em>{criticalActivity.manager}</em></span><ArrowRight aria-hidden="true" /></button> : <div className="schedule-critical-empty"><CircleCheck aria-hidden="true" /><span><strong>Agenda sob controle</strong><small>Nenhuma atividade crítica neste filtro.</small></span></div>}
        </article>
        <section className="schedule-metrics" aria-label="Indicadores do cronograma"><article className="schedule-metric-danger"><span><TriangleAlert aria-hidden="true" /></span><div><small>Atrasadas</small><strong>{overdue.length}</strong><p>Precisam de reprogramação</p></div></article><article className="schedule-metric-today"><span><CalendarClock aria-hidden="true" /></span><div><small>Em execução hoje</small><strong>{today.length}</strong><p>Data de referência: 24 ago</p></div></article><article className="schedule-metric-next"><span><ArrowRight aria-hidden="true" /></span><div><small>Próximos 7 dias</small><strong>{nextSevenDays}</strong><p>Entregas até 31 de agosto</p></div></article><article className="schedule-metric-blocked"><span><Pause aria-hidden="true" /></span><div><small>Bloqueadas</small><strong>{blocked.length}</strong><p>Aguardando decisão</p></div></article></section>
      </section>

      {view === "Agenda" && <section className="schedule-agenda" aria-labelledby="schedule-agenda-title"><header><div><p className="eyebrow">Agenda operacional</p><h2 id="schedule-agenda-title">Atividades por prioridade</h2><span>Itens críticos aparecem primeiro; concluídos ficam ao final.</span></div><time dateTime={WORKS_DEMO_DATE_ISO}><CalendarClock aria-hidden="true" />24 de agosto de 2026</time></header><div className="schedule-agenda-groups">{filteredActivities.length > 0 ? agendaGroups.map((group) => group.rows.length > 0 && <section key={group.id} className={`schedule-agenda-group schedule-group-${group.tone}`}><header><span><i />{group.title}</span><small>{group.description}</small><b>{group.rows.length}</b></header><div>{group.rows.sort((left, right) => left.endDateIso.localeCompare(right.endDateIso)).map((activity) => <article key={activity.id}><time dateTime={activity.endDateIso}><strong>{activity.endDateIso.slice(8, 10)}</strong><small>{new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${activity.endDateIso}T12:00:00Z`)).replace(".", "").toUpperCase()}</small></time><div className="schedule-activity-identity"><small>{activity.workId} · {activity.stage}</small><strong>{activity.title}</strong><em>{activity.workTitle}</em>{activity.blockedReason && <p><TriangleAlert aria-hidden="true" />{activity.blockedReason}</p>}{activity.reprogramReason && <p><CalendarClock aria-hidden="true" />Reprogramada: {activity.reprogramReason}</p>}</div><div className="schedule-activity-context"><span><UsersRound aria-hidden="true" />{activity.manager}</span><span><Building2 aria-hidden="true" />{activity.property}</span></div><div className="schedule-activity-period"><small>Período</small><strong>{formatExpenseDate(activity.startDateIso)} — {formatExpenseDate(activity.endDateIso)}</strong></div><WorkDetailStatusBadge status={activity.status} /><div className="schedule-activity-actions">{activity.status !== "Concluída" && <button type="button" onClick={() => completeActivity(activity)}><Check aria-hidden="true" />Concluir</button>}<button type="button" onClick={() => setAction({ type: "reprogram", activity })}><CalendarClock aria-hidden="true" />Reprogramar</button><button type="button" className="schedule-open-work" onClick={() => openActivityWork(activity)} aria-label={`Abrir ${activity.workTitle}`}>Abrir obra<ArrowRight aria-hidden="true" /></button></div></article>)}</div></section>) : <div className="schedule-empty"><CompactEmptyState mark="00" title="Nenhuma atividade encontrada" description="Limpe ou ajuste os filtros para consultar outras atividades." /><button type="button" className="secondary-button button-with-icon" onClick={clearFilters}><RotateCcw aria-hidden="true" />Limpar filtros</button></div>}</div></section>}

      {view === "Calendário" && <section className="schedule-calendar" aria-labelledby="schedule-calendar-title"><header><div><p className="eyebrow">Visão mensal</p><h2 id="schedule-calendar-title">Calendário de entregas</h2><span>As atividades são posicionadas pela data de conclusão.</span></div><div className="schedule-month-control"><button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ArrowRight aria-hidden="true" /></button><strong>{monthLabel}</strong><button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ArrowRight aria-hidden="true" /></button></div></header><div className="schedule-calendar-weekdays"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div><div className="schedule-calendar-grid">{calendarCells.map((cell) => { const dayActivities = filteredActivities.filter((activity) => activity.endDateIso === cell.dateIso); return <article key={cell.dateIso} className={`${cell.currentMonth ? "" : "outside"} ${cell.dateIso === WORKS_DEMO_DATE_ISO ? "today" : ""}`}><header><time dateTime={cell.dateIso}>{cell.day}</time>{dayActivities.length > 0 && <b>{dayActivities.length}</b>}</header><div>{dayActivities.slice(0, 3).map((activity) => { const tone = activity.status === "Concluída" ? "completed" : activity.status === "Bloqueada" ? "blocked" : activity.endDateIso < WORKS_DEMO_DATE_ISO ? "delayed" : activity.startDateIso <= WORKS_DEMO_DATE_ISO ? "today" : "next"; return <button type="button" key={activity.id} className={`calendar-activity-${tone}`} onClick={() => openActivityWork(activity)} title={`${activity.workId} · ${activity.title}`}><i /><span><strong>{activity.workId}</strong>{activity.title}</span></button>; })}{dayActivities.length > 3 && <button type="button" className="calendar-more" onClick={() => setView("Agenda")}>+{dayActivities.length - 3} atividades</button>}</div></article>; })}</div></section>}
    </div>
    {action && <WorksScheduleModal action={action} works={works} onClose={() => setAction(null)} onSubmit={handleScheduleSubmit} />}
  </>;
}

function WorksScheduleModal({ action, works, onClose, onSubmit }: { action: NonNullable<WorkScheduleAction>; works: WorkRecord[]; onClose: () => void; onSubmit: (action: NonNullable<WorkScheduleAction>, data: FormData) => void }) {
  const [selectedWorkId, setSelectedWorkId] = useState(works[0]?.id ?? "");
  const [error, setError] = useState("");
  const selectedWork = works.find((work) => work.id === selectedWorkId) ?? works[0];
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const startDate = String(data.get("startDateIso") ?? "");
    const endDate = String(data.get("endDateIso") ?? "");
    if (action.type === "new" && startDate && endDate && endDate < startDate) {
      setError("A conclusão não pode ser anterior ao início da atividade.");
      return;
    }
    setError("");
    onSubmit(action, data);
  };
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={action.type === "new" ? "Nova atividade" : "Reprogramar atividade"}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar formulário" /><form className="receipt-modal work-detail-modal schedule-activity-modal" onSubmit={handleSubmit}><ModalHeader eyebrow={action.type === "new" ? "Cronograma das obras" : action.activity.id} title={action.type === "new" ? "Nova atividade" : "Reprogramar atividade"} onClose={onClose} /><div className="work-detail-modal-body">{error && <InlineFieldError message={error} />}{action.type === "new" ? <div className="form-grid"><label className="full-field">Obra<select name="workId" value={selectedWorkId} onChange={(event) => setSelectedWorkId(event.target.value)} required>{works.map((work) => <option key={work.id} value={work.id}>{work.id} · {work.title}</option>)}</select></label><label>Etapa<select name="stage"><option>Preparação</option><option>Execução</option><option>Entrega</option></select></label><label>Responsável<select name="manager" defaultValue={selectedWork?.manager}>{WORK_TEAM_OPTIONS.map((member) => <option key={member.name}>{member.name}</option>)}</select></label><label className="full-field">Atividade<input name="title" placeholder="Ex.: Conferir acabamento do setor A" required /></label><label>Início<input name="startDateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} onChange={() => setError("")} required /></label><label>Conclusão<input name="endDateIso" type="date" defaultValue={selectedWork?.endDateIso} onChange={() => setError("")} required /></label></div> : <div className="form-grid"><p className="work-detail-modal-context full-field"><strong>{action.activity.title}</strong>{action.activity.workId} · prazo atual em {formatExpenseDate(action.activity.endDateIso)}</p><label>Nova conclusão<input name="endDateIso" type="date" defaultValue={action.activity.endDateIso} min={action.activity.startDateIso} onChange={() => setError("")} required /></label><label className="full-field">Justificativa<textarea name="reason" rows={4} placeholder="Explique por que a data precisa ser alterada." required /></label></div>}</div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />{action.type === "new" ? "Adicionar atividade" : "Salvar nova data"}</button></footer></form></div>;
}

function WorkDetailStatusBadge({ status }: { status: WorkActivityStatus }) {
  const slug = status.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  return <span className={`work-activity-status work-activity-${slug}`}><i />{status}</span>;
}

function WorkFinancialStatusBadge({ status }: { status: WorkFinancialEntry["status"] }) {
  const slug = status.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  return <span className={`work-financial-status work-financial-${slug}`}>{status}</span>;
}

function formatWorkDetailDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date).replace(".", "");
}

function WorkDetailPage({ work, initialTab, onBack, onEdit, onOpenFinance, onUpdateWork, onNotify }: { work: WorkRecord; initialTab: WorkDetailTab; onBack: () => void; onEdit: () => void; onOpenFinance: () => void; onUpdateWork: (work: WorkRecord, message: string) => void; onNotify: (message: string, reference: string) => void }) {
  const [tab, setTab] = useState<WorkDetailTab>(initialTab);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [action, setAction] = useState<WorkDetailAction>(null);
  const [activities, setActivities] = useState<WorkActivity[]>(() => createWorkDetailMock(work).activities);
  const [team, setTeam] = useState<WorkTeamAllocation[]>(() => createWorkDetailMock(work).team);
  const [financialEntries, setFinancialEntries] = useState<WorkFinancialEntry[]>(() => createWorkDetailMock(work).financialEntries);
  const [journal, setJournal] = useState<WorkJournalEntry[]>(() => createWorkDetailMock(work).journal);
  const [pendingItems, setPendingItems] = useState<WorkPendingItem[]>(() => createWorkDetailMock(work).pendingItems);
  const tabs: Array<{ name: WorkDetailTab; icon: LucideIcon }> = [
    { name: "Resumo", icon: LayoutDashboard },
    { name: "Planejamento", icon: ClipboardList },
    { name: "Equipe", icon: UsersRound },
    { name: "Financeiro", icon: WalletCards },
    { name: "Diário e arquivos", icon: FileSignature },
  ];
  const completedActivities = activities.filter((activity) => activity.status === "Concluída").length;
  const activityProgress = activities.length ? Math.round((completedActivities / activities.length) * 100) : work.progress;
  const blockedActivities = activities.filter((activity) => activity.status === "Bloqueada");
  const selectedBudget = financialEntries.find((entry) => entry.kind === "Orçamento" && entry.status === "Selecionado")?.amount ?? work.budget;
  const totalExpenses = financialEntries.filter((entry) => entry.kind === "Gasto").reduce((sum, entry) => sum + entry.amount, 0);
  const paidExpenses = financialEntries.filter((entry) => entry.kind === "Gasto" && entry.status === "Pago").reduce((sum, entry) => sum + entry.amount, 0);
  const cashAdjustments = financialEntries.filter((entry) => entry.kind === "Aporte" || entry.kind === "Ajuste").reduce((sum, entry) => sum + entry.amount, 0);
  const availableCash = cashAdjustments - paidExpenses;
  const budgetUse = work.budget > 0 ? Math.round((work.spent / work.budget) * 100) : 0;
  const teamCost = team.reduce((sum, allocation) => sum + allocation.quantity * allocation.unitRate, 0);
  const nextActivity = activities.find((activity) => activity.status === "Em andamento") ?? activities.find((activity) => activity.status === "Não iniciada" || activity.status === "Bloqueada");
  const displayPendingItems = [
    ...pendingItems,
    ...blockedActivities.filter((activity) => !pendingItems.some((item) => item.id === `BLOCK-${activity.id}`)).map((activity) => ({ id: `BLOCK-${activity.id}`, title: "Atividade bloqueada", description: `${activity.title}${activity.blockedReason ? ` · ${activity.blockedReason}` : ""}`, tone: "danger" as const })),
  ];

  const appendJournal = (entry: Omit<WorkJournalEntry, "id" | "dateIso">) => {
    setJournal((current) => [{ ...entry, id: nextRecordId("DIA", current), dateIso: `${WORKS_DEMO_DATE_ISO}T12:00:00` }, ...current]);
  };
  const updateWorkStatus = (status: WorkStatus) => {
    if ((status === "Concluída" || status === "Cancelada") && !window.confirm(`${status === "Concluída" ? "Concluir" : "Cancelar"} esta obra?`)) return;
    const progress = status === "Concluída" ? 100 : work.progress;
    const risk = status === "Concluída" ? "Concluída" : work.risk === "Concluída" ? "Dentro do prazo" : work.risk;
    onUpdateWork({ ...work, status, progress, risk, updatedAtIso: `${WORKS_DEMO_DATE_ISO}T12:00:00`, lastUpdateLabel: "Atualizada agora nesta sessão" }, `Situação alterada para ${status}.`);
    appendJournal({ kind: "Atualização", title: `Situação alterada para ${status}`, description: "Alteração manual registrada no detalhe da obra.", author: "Administrativo", progress, files: [] });
    setActionsOpen(false);
  };
  const completeActivity = (activity: WorkActivity) => {
    const nextActivities = activities.map((item) => item.id === activity.id ? { ...item, status: "Concluída" as const, blockedReason: undefined } : item);
    setActivities(nextActivities);
    const nextProgress = Math.round((nextActivities.filter((item) => item.status === "Concluída").length / Math.max(nextActivities.length, 1)) * 100);
    onUpdateWork({ ...work, progress: nextProgress, nextActivity: nextActivities.find((item) => item.status !== "Concluída")?.title ?? "Entrega concluída", lastUpdateLabel: "Atualizada agora nesta sessão" }, "Atividade concluída e progresso recalculado.");
    appendJournal({ kind: "Atualização", title: "Atividade concluída", description: activity.title, author: "Administrativo", progress: nextProgress, files: [] });
  };
  const removeTeamMember = (allocation: WorkTeamAllocation) => {
    if (!window.confirm(`Remover ${allocation.name} da equipe desta obra?`)) return;
    setTeam((current) => current.filter((item) => item.id !== allocation.id));
    onNotify("Pessoa removida da equipe nesta sessão.", allocation.id);
  };
  const markExpensePaid = (entry: WorkFinancialEntry) => {
    setFinancialEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status: "Pago" } : item));
    onUpdateWork({ ...work, spent: work.spent + entry.amount, projectedCashBalance: work.projectedCashBalance - entry.amount, lastUpdateLabel: "Atualizada agora nesta sessão" }, "Pagamento manual registrado.");
    appendJournal({ kind: "Atualização", title: "Pagamento registrado", description: `${entry.description} · ${brl.format(entry.amount)}`, author: "Administrativo", files: [] });
  };
  const selectBudget = (entry: WorkFinancialEntry) => {
    setFinancialEntries((current) => current.map((item) => item.kind === "Orçamento" ? { ...item, status: item.id === entry.id ? "Selecionado" : "Em análise" } : item));
    onUpdateWork({ ...work, budget: entry.amount, projectedCashBalance: entry.amount + (work.reserve ?? 0) - work.spent, lastUpdateLabel: "Atualizada agora nesta sessão" }, "Orçamento selecionado para a obra.");
  };
  const handleActionSubmit = (submittedAction: NonNullable<WorkDetailAction>, formData: FormData) => {
    const value = (name: string) => String(formData.get(name) ?? "").trim();
    const amount = (name: string) => Number(formData.get(name) ?? 0);
    if (submittedAction.type === "update") {
      const progress = Math.min(100, Math.max(0, amount("progress")));
      const kind = value("kind") as WorkJournalEntry["kind"];
      const files = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0).map((file) => file.name);
      const entry = { kind, title: value("title"), description: value("description"), author: "Administrativo", progress, files };
      appendJournal(entry);
      if (kind === "Pendência") setPendingItems((current) => [{ id: nextRecordId("PEN", current), title: entry.title, description: entry.description, tone: "warning" }, ...current]);
      onUpdateWork({ ...work, progress, nextActivity: value("nextActivity") || work.nextActivity, updatedAtIso: `${WORKS_DEMO_DATE_ISO}T12:00:00`, lastUpdateLabel: "Atualizada agora nesta sessão" }, "Atualização registrada no diário.");
    }
    if (submittedAction.type === "activity") {
      const newActivity: WorkActivity = { id: nextRecordId("ATV", activities), stage: value("stage") as WorkActivity["stage"], title: value("title"), manager: value("manager"), startDateIso: value("startDateIso"), endDateIso: value("endDateIso"), status: "Não iniciada" };
      setActivities((current) => [...current, newActivity]);
      onNotify("Atividade adicionada ao planejamento.", newActivity.id);
    }
    if (submittedAction.type === "expense" || submittedAction.type === "budget") {
      const newEntry: WorkFinancialEntry = { id: nextRecordId("FIN", financialEntries), kind: submittedAction.type === "expense" ? "Gasto" : "Orçamento", description: value("description"), party: value("party"), amount: amount("amount"), dateIso: value("dateIso"), status: submittedAction.type === "expense" ? "Previsto" : "Em análise" };
      setFinancialEntries((current) => [newEntry, ...current]);
      onNotify(submittedAction.type === "expense" ? "Gasto previsto adicionado." : "Orçamento adicionado para análise.", newEntry.id);
    }
    if (submittedAction.type === "team") {
      const allocation: WorkTeamAllocation = { id: nextRecordId("EQP", team), name: value("name"), role: value("role"), startDateIso: value("startDateIso"), endDateIso: value("endDateIso"), workMode: value("workMode") as WorkTeamAllocation["workMode"], quantity: amount("quantity"), unitRate: amount("unitRate"), activityIds: [] };
      setTeam((current) => [...current, allocation]);
      onNotify("Pessoa adicionada à equipe da obra.", allocation.id);
    }
    if (submittedAction.type === "cash") {
      const entry: WorkFinancialEntry = { id: nextRecordId("FIN", financialEntries), kind: value("kind") as "Aporte" | "Ajuste", description: value("description"), party: "Caixa administrativo", amount: amount("amount"), dateIso: value("dateIso"), status: "Registrado" };
      setFinancialEntries((current) => [entry, ...current]);
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
        <div className="work-detail-actions"><button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: "update" })}><Plus aria-hidden="true" />Registrar atualização</button><div className="work-detail-actions-menu"><button type="button" className="secondary-button" aria-label="Mais ações da obra" aria-expanded={actionsOpen} onClick={() => setActionsOpen((current) => !current)}><MoreHorizontal aria-hidden="true" /></button>{actionsOpen && <div role="menu"><button type="button" role="menuitem" onClick={() => { setActionsOpen(false); onEdit(); }}><PencilLine aria-hidden="true" />Editar cadastro</button>{work.status === "Pausada" ? <button type="button" role="menuitem" onClick={() => updateWorkStatus("Em andamento")}><Play aria-hidden="true" />Retomar obra</button> : work.status !== "Concluída" && work.status !== "Cancelada" ? <button type="button" role="menuitem" onClick={() => updateWorkStatus("Pausada")}><Pause aria-hidden="true" />Pausar obra</button> : null}{work.status !== "Concluída" && work.status !== "Cancelada" && <button type="button" role="menuitem" onClick={() => updateWorkStatus("Concluída")}><CircleCheck aria-hidden="true" />Concluir obra</button>}{work.status !== "Cancelada" && work.status !== "Concluída" && <button type="button" role="menuitem" className="danger" onClick={() => updateWorkStatus("Cancelada")}><Ban aria-hidden="true" />Cancelar obra</button>}</div>}</div></div>
        <dl className="work-detail-hero-metrics">
          <div><dt>Progresso</dt><dd>{work.progress}%</dd><i><b style={{ width: `${work.progress}%` }} /></i></div>
          <div><dt>Prazo final</dt><dd>{work.endLabel}</dd><small className={`work-risk work-risk-${work.risk === "Em atraso" ? "danger" : work.risk === "Atenção" ? "warning" : "ok"}`}>{work.risk}</small></div>
          <div><dt>Responsável</dt><dd>{work.manager}</dd><small>{team.length} pessoas alocadas</small></div>
          <div><dt>Orçamento previsto</dt><dd>{brl.format(work.budget)}</dd><small>{budgetUse}% utilizado · {brl.format(work.spent)}</small></div>
        </dl>
      </section>

      <nav className="work-detail-tabs" aria-label="Áreas da obra"><div>{tabs.map(({ name, icon: Icon }) => <button type="button" key={name} className={tab === name ? "active" : ""} aria-current={tab === name ? "page" : undefined} onClick={() => setTab(name)}><Icon aria-hidden="true" /><span>{name}</span>{name === "Planejamento" && blockedActivities.length > 0 ? <b>{blockedActivities.length}</b> : name === "Resumo" && displayPendingItems.length > 0 ? <b>{displayPendingItems.length}</b> : null}</button>)}</div></nav>

      {tab === "Resumo" && <div className="work-detail-summary">
        <section className="work-detail-decision-card" aria-labelledby="work-next-decision-title"><header><div><p className="eyebrow">Próxima decisão</p><h2 id="work-next-decision-title">{nextActivity?.title ?? "Planejamento concluído"}</h2></div><CalendarClock aria-hidden="true" /></header><div className="work-detail-decision-progress"><span className="work-detail-progress-ring" style={{ "--work-progress": `${work.progress * 3.6}deg` } as CSSProperties}><strong>{work.progress}%</strong><small>concluído</small></span><div><span>Prazo da atividade</span><strong>{nextActivity ? `${formatExpenseDate(nextActivity.startDateIso)} — ${formatExpenseDate(nextActivity.endDateIso)}` : "Sem próxima atividade"}</strong><small>{nextActivity?.manager ?? work.manager}</small>{nextActivity && <WorkDetailStatusBadge status={nextActivity.status} />}</div></div><footer><button type="button" onClick={() => { setTab("Planejamento"); setAction({ type: "activity" }); }}><Plus aria-hidden="true" />Adicionar atividade</button><button type="button" onClick={() => setAction({ type: "expense" })}><HandCoins aria-hidden="true" />Registrar gasto</button><button type="button" onClick={() => setAction({ type: "budget" })}><ClipboardList aria-hidden="true" />Adicionar orçamento</button></footer></section>
        <section className="work-detail-finance-card" aria-labelledby="work-summary-finance-title"><header><div><p className="eyebrow">Financeiro</p><h2 id="work-summary-finance-title">Posição da obra</h2></div><WalletCards aria-hidden="true" /></header><dl><div><dt>Valor previsto</dt><dd>{brl.format(work.budget)}</dd></div><div><dt>Total gasto</dt><dd>{brl.format(work.spent)}</dd></div><div><dt>Saldo projetado</dt><dd className={work.projectedCashBalance < 0 ? "negative" : ""}>{brl.format(work.projectedCashBalance)}</dd></div><div><dt>Caixa disponível</dt><dd className={availableCash < 0 ? "negative" : ""}>{brl.format(availableCash)}</dd></div></dl><div className="work-detail-finance-usage"><span><small>Orçamento consumido</small><strong className={budgetUse > 100 ? "negative" : ""}>{budgetUse}%</strong></span><i role="progressbar" aria-valuenow={Math.min(100, budgetUse)} aria-valuemin={0} aria-valuemax={100} aria-label={`${budgetUse}% do orçamento da obra foi utilizado`}><b style={{ width: `${Math.min(100, budgetUse)}%` }} /></i></div><button type="button" onClick={() => setTab("Financeiro")}>Ver financeiro completo<ArrowRight aria-hidden="true" /></button></section>
        <section className="work-detail-pending-card" aria-labelledby="work-pending-title"><header><div><p className="eyebrow">Atenção</p><h2 id="work-pending-title">Pendências e decisões</h2></div><b>{displayPendingItems.length}</b></header>{displayPendingItems.length ? <div>{displayPendingItems.slice(0, 4).map((item) => <article key={item.id} className={`work-detail-pending-${item.tone}`}><TriangleAlert aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.description}</small></span>{pendingItems.some((pending) => pending.id === item.id) && <button type="button" onClick={() => setPendingItems((current) => current.filter((pending) => pending.id !== item.id))} aria-label={`Resolver ${item.title}`}><Check aria-hidden="true" /></button>}</article>)}</div> : <CompactEmptyState mark="✓" tone="success" title="Nenhuma pendência aberta" description="A obra não possui bloqueios ou decisões aguardando ação." />}</section>
        <section className="work-detail-team-card" aria-labelledby="work-summary-team-title"><header><div><p className="eyebrow">Responsáveis</p><h2 id="work-summary-team-title">Equipe principal</h2></div><button type="button" onClick={() => setTab("Equipe")}>Ver equipe</button></header><div>{team.slice(0, 4).map((member) => <article key={member.id}><span>{member.name.split(" ").slice(0, 2).map((name) => name[0]).join("")}</span><div><strong>{member.name}</strong><small>{member.role}</small></div><em>{member.activityIds.length} atividades</em></article>)}</div><footer><span>Custo estimado da mão de obra</span><strong>{brl.format(teamCost)}</strong></footer></section>
        <section className="work-detail-timeline-card" aria-labelledby="work-summary-history-title"><header><div><p className="eyebrow">Últimos registros</p><h2 id="work-summary-history-title">Atualizações recentes</h2></div><button type="button" onClick={() => setTab("Diário e arquivos")}>Ver diário</button></header><div>{journal.slice(0, 4).map((entry) => <article key={entry.id}><i className={`journal-${entry.kind.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`} /><div><strong>{entry.title}</strong><p>{entry.description}</p><small>{formatWorkDetailDateTime(entry.dateIso)} · {entry.author}{entry.files.length ? ` · ${entry.files.length} arquivo(s)` : ""}</small></div>{entry.progress !== undefined && <b>{entry.progress}%</b>}</article>)}</div></section>
      </div>}

      {tab === "Planejamento" && <section className="work-detail-tab-panel work-planning-panel" aria-labelledby="work-planning-title"><header><div><p className="eyebrow">Cronograma desta obra</p><h2 id="work-planning-title">Planejamento</h2><span>O progresso calculado pelas atividades está em <strong>{activityProgress}%</strong>.</span></div><button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: "activity" })}><Plus aria-hidden="true" />Nova atividade</button></header><div className="work-planning-stages">{(["Preparação", "Execução", "Entrega"] as WorkActivity["stage"][]).map((stage, stageIndex) => { const stageActivities = activities.filter((activity) => activity.stage === stage); return <section key={stage}><header><span>0{stageIndex + 1}</span><div><strong>{stage}</strong><small>{stageActivities.filter((activity) => activity.status === "Concluída").length} de {stageActivities.length} concluídas</small></div></header><div>{stageActivities.map((activity) => <article key={activity.id} className={activity.status === "Bloqueada" ? "blocked" : ""}><span className="work-planning-check">{activity.status === "Concluída" ? <Check aria-hidden="true" /> : stageIndex + 1}</span><div className="work-planning-identity"><small>{activity.id} · {activity.manager}</small><strong>{activity.title}</strong>{activity.blockedReason && <em><TriangleAlert aria-hidden="true" />{activity.blockedReason}</em>}</div><div className="work-planning-dates"><small>Período</small><strong>{formatExpenseDate(activity.startDateIso)} — {formatExpenseDate(activity.endDateIso)}</strong></div><WorkDetailStatusBadge status={activity.status} /><div className="work-planning-actions">{activity.status !== "Concluída" && <button type="button" onClick={() => completeActivity(activity)} title="Concluir atividade"><Check aria-hidden="true" /><span>Concluir</span></button>}{activity.status !== "Concluída" && activity.status !== "Bloqueada" && <button type="button" onClick={() => setAction({ type: "block", activity })} title="Bloquear atividade"><TriangleAlert aria-hidden="true" /><span>Bloquear</span></button>}<button type="button" onClick={() => setAction({ type: "reprogram", activity })} title="Reprogramar atividade"><CalendarClock aria-hidden="true" /><span>Reprogramar</span></button></div></article>)}</div></section>; })}</div></section>}

      {tab === "Equipe" && <section className="work-detail-tab-panel work-team-panel" aria-labelledby="work-team-title"><header><div><p className="eyebrow">Alocação nesta obra</p><h2 id="work-team-title">Equipe</h2><span>{team.length} pessoas · custo estimado de <strong>{brl.format(teamCost)}</strong></span></div><button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: "team" })}><Plus aria-hidden="true" />Adicionar pessoa</button></header><div className="work-team-list">{team.map((member) => <article key={member.id}><span className="work-team-avatar">{member.name.split(" ").slice(0, 2).map((name) => name[0]).join("")}</span><div className="work-team-identity"><small>{member.id}</small><strong>{member.name}</strong><em>{member.role}</em></div><div><small>Participação</small><strong>{formatExpenseDate(member.startDateIso)} — {formatExpenseDate(member.endDateIso)}</strong></div><div><small>Apontamento</small><strong>{member.quantity} {member.workMode.toLocaleLowerCase("pt-BR")}</strong><em>{brl.format(member.unitRate)} por unidade</em></div><div><small>Custo estimado</small><strong>{brl.format(member.quantity * member.unitRate)}</strong><em>{member.activityIds.length} atividades relacionadas</em></div><button type="button" className="work-team-remove" onClick={() => removeTeamMember(member)} aria-label={`Remover ${member.name}`}><Trash2 aria-hidden="true" /></button></article>)}</div></section>}

      {tab === "Financeiro" && <section className="work-detail-tab-panel work-finance-panel" aria-labelledby="work-finance-title"><header><div><p className="eyebrow">Controle manual</p><h2 id="work-finance-title">Financeiro da obra</h2><span>Orçamentos, gastos e caixa reunidos sem integração bancária.</span></div><div><button type="button" className="secondary-button" onClick={() => setAction({ type: "budget" })}>Novo orçamento</button><button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: "expense" })}><Plus aria-hidden="true" />Registrar gasto</button></div></header><div className="work-finance-metrics"><article><span>Orçamento selecionado</span><strong>{brl.format(selectedBudget)}</strong><small>{financialEntries.filter((entry) => entry.kind === "Orçamento").length} propostas cadastradas</small></article><article><span>Gastos lançados</span><strong>{brl.format(totalExpenses)}</strong><small>{brl.format(paidExpenses)} já pagos</small></article><article><span>Caixa disponível</span><strong className={availableCash < 0 ? "negative" : ""}>{brl.format(availableCash)}</strong><small>Aportes e pagamentos manuais</small></article><article><span>Saldo projetado</span><strong className={work.projectedCashBalance < 0 ? "negative" : ""}>{brl.format(work.projectedCashBalance)}</strong><small>Previsão do cadastro</small></article></div><div className="work-finance-toolbar"><button type="button" onClick={() => setAction({ type: "cash" })}><Plus aria-hidden="true" />Aporte ou ajuste de caixa</button><button type="button" onClick={onOpenFinance}>Abrir página Financeiro<ArrowRight aria-hidden="true" /></button></div><div className="work-finance-list">{financialEntries.map((entry) => <article key={entry.id}><span className={`work-finance-kind work-finance-kind-${entry.kind.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{entry.kind === "Gasto" ? <HandCoins aria-hidden="true" /> : entry.kind === "Orçamento" ? <ClipboardList aria-hidden="true" /> : <WalletCards aria-hidden="true" />}</span><div><small>{entry.id} · {formatExpenseDate(entry.dateIso)}</small><strong>{entry.description}</strong><em>{entry.party}</em></div><b>{brl.format(entry.amount)}</b><WorkFinancialStatusBadge status={entry.status} /><span className="work-finance-row-action">{entry.kind === "Gasto" && entry.status !== "Pago" ? <button type="button" onClick={() => markExpensePaid(entry)}>Marcar pago</button> : entry.kind === "Orçamento" && entry.status !== "Selecionado" ? <button type="button" onClick={() => selectBudget(entry)}>Selecionar</button> : null}</span></article>)}</div><aside className="work-finance-manual-note"><WifiOff aria-hidden="true" /><span><strong>Sem integração bancária</strong>Todos os pagamentos, aportes e ajustes desta demonstração são registrados manualmente e permanecem somente na sessão.</span></aside></section>}

      {tab === "Diário e arquivos" && <section className="work-detail-tab-panel work-journal-panel" aria-labelledby="work-journal-title"><header><div><p className="eyebrow">Histórico da execução</p><h2 id="work-journal-title">Diário e arquivos</h2><span>Registros anteriores são preservados e exibidos em ordem cronológica.</span></div><button type="button" className="primary-button button-with-icon" onClick={() => setAction({ type: "update" })}><Plus aria-hidden="true" />Nova atualização</button></header><div className="work-journal-layout"><div className="work-journal-timeline">{journal.map((entry) => <article key={entry.id}><time dateTime={entry.dateIso}><strong>{formatWorkDetailDateTime(entry.dateIso).split(" ").slice(0, 2).join(" ")}</strong><small>{formatWorkDetailDateTime(entry.dateIso).split(" ").slice(-1)}</small></time><i className={`journal-${entry.kind.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`} /><div><header><span>{entry.kind}</span>{entry.progress !== undefined && <b>{entry.progress}%</b>}</header><h3>{entry.title}</h3><p>{entry.description}</p><small>{entry.author}</small>{entry.files.length > 0 && <ul>{entry.files.map((file) => <li key={file}><Paperclip aria-hidden="true" />{file}</li>)}</ul>}</div></article>)}</div><aside className="work-journal-files"><header><Paperclip aria-hidden="true" /><div><strong>Arquivos da obra</strong><small>{journal.reduce((total, entry) => total + entry.files.length, 0)} referências no diário</small></div></header>{journal.flatMap((entry) => entry.files.map((file) => ({ file, entry }))).map(({ file, entry }) => <article key={`${entry.id}-${file}`}><FileSignature aria-hidden="true" /><span><strong>{file}</strong><small>{entry.title}</small></span></article>)}</aside></div></section>}
    </div>
    {action && <WorkDetailActionModal action={action} work={work} onClose={() => setAction(null)} onSubmit={handleActionSubmit} />}
  </>;
}

function WorkDetailActionModal({ action, work, onClose, onSubmit }: { action: NonNullable<WorkDetailAction>; work: WorkRecord; onClose: () => void; onSubmit: (action: NonNullable<WorkDetailAction>, data: FormData) => void }) {
  const targetActivity = "activity" in action ? action.activity : null;
  const presentation: Record<NonNullable<WorkDetailAction>["type"], { eyebrow: string; title: string; submit: string }> = {
    update: { eyebrow: "Diário da obra", title: "Registrar atualização", submit: "Salvar atualização" },
    activity: { eyebrow: "Planejamento", title: "Adicionar atividade", submit: "Adicionar atividade" },
    expense: { eyebrow: "Financeiro", title: "Registrar gasto", submit: "Adicionar gasto" },
    budget: { eyebrow: "Financeiro", title: "Adicionar orçamento", submit: "Adicionar orçamento" },
    team: { eyebrow: "Equipe", title: "Adicionar pessoa", submit: "Adicionar à equipe" },
    cash: { eyebrow: "Caixa da obra", title: "Registrar aporte ou ajuste", submit: "Registrar movimento" },
    block: { eyebrow: targetActivity?.id ?? work.id, title: "Bloquear atividade", submit: "Registrar bloqueio" },
    reprogram: { eyebrow: targetActivity?.id ?? work.id, title: "Reprogramar atividade", submit: "Salvar nova data" },
  };
  const copy = presentation[action.type];
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={copy.title}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar formulário" /><form className="receipt-modal work-detail-modal" onSubmit={(event) => { event.preventDefault(); onSubmit(action, new FormData(event.currentTarget)); }}><ModalHeader eyebrow={copy.eyebrow} title={copy.title} onClose={onClose} /><div className="work-detail-modal-body">
    {action.type === "update" && <div className="form-grid"><label>Tipo de registro<select name="kind" defaultValue="Atualização"><option>Atualização</option><option>Ocorrência</option><option>Pendência</option><option>Arquivo</option></select></label><label>Progresso atual (%)<input name="progress" type="number" min="0" max="100" defaultValue={work.progress} required /></label><label className="full-field">Título<input name="title" placeholder="Ex.: Setor B concluído" required /></label><label className="full-field">Descrição<textarea name="description" rows={4} placeholder="O que aconteceu e qual é o próximo passo?" required /></label><label className="full-field">Próxima atividade<input name="nextActivity" defaultValue={work.nextActivity} required /></label><label className="full-field">Fotos ou arquivos<input name="files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" /><small>Somente os nomes dos arquivos serão mantidos nesta demonstração.</small></label></div>}
    {action.type === "activity" && <div className="form-grid"><label>Etapa<select name="stage" defaultValue="Execução"><option>Preparação</option><option>Execução</option><option>Entrega</option></select></label><label>Responsável<select name="manager" defaultValue={work.manager}>{WORK_TEAM_OPTIONS.map((member) => <option key={member.name}>{member.name}</option>)}</select></label><label className="full-field">Atividade<input name="title" placeholder="Ex.: Teste e conferência final" required /></label><label>Início<input name="startDateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} required /></label><label>Conclusão<input name="endDateIso" type="date" defaultValue={work.endDateIso} required /></label></div>}
    {(action.type === "expense" || action.type === "budget") && <div className="form-grid"><label className="full-field">Descrição<input name="description" placeholder={action.type === "expense" ? "Ex.: Segunda medição da execução" : "Ex.: Proposta para execução completa"} required /></label><label>{action.type === "expense" ? "Fornecedor" : "Empresa proponente"}<input name="party" required /></label><label>Valor<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Data<input name="dateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} required /></label></div>}
    {action.type === "team" && <div className="form-grid"><label>Pessoa<select name="name" defaultValue="Lucas Rocha">{WORK_TEAM_OPTIONS.map((member) => <option key={member.name}>{member.name}</option>)}</select></label><label>Função<input name="role" placeholder="Ex.: Técnico de manutenção" required /></label><label>Início<input name="startDateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} required /></label><label>Fim<input name="endDateIso" type="date" defaultValue={work.endDateIso} required /></label><label>Forma de apontamento<select name="workMode"><option>Horas</option><option>Diárias</option></select></label><label>Quantidade<input name="quantity" type="number" min="0" step="0.5" required /></label><label>Valor por unidade<input name="unitRate" type="number" min="0" step="0.01" required /></label></div>}
    {action.type === "cash" && <div className="form-grid"><label>Tipo<select name="kind"><option>Aporte</option><option>Ajuste</option></select></label><label>Data<input name="dateIso" type="date" defaultValue={WORKS_DEMO_DATE_ISO} required /></label><label className="full-field">Descrição<input name="description" placeholder="Ex.: Complemento autorizado para materiais" required /></label><label>Valor<input name="amount" type="number" step="0.01" required /></label></div>}
    {action.type === "block" && <div className="form-grid"><p className="work-detail-modal-context full-field"><strong>{action.activity.title}</strong>O motivo ficará visível no planejamento e no diário.</p><label className="full-field">Motivo do bloqueio<textarea name="reason" rows={4} placeholder="Explique o que impede a continuidade." required /></label></div>}
    {action.type === "reprogram" && <div className="form-grid"><p className="work-detail-modal-context full-field"><strong>{action.activity.title}</strong>Prazo atual: {formatExpenseDate(action.activity.endDateIso)}</p><label>Nova conclusão<input name="endDateIso" type="date" defaultValue={action.activity.endDateIso} required /></label><label className="full-field">Justificativa<textarea name="reason" rows={3} placeholder="Por que a data está sendo alterada?" required /></label></div>}
  </div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />{copy.submit}</button></footer></form></div>;
}

function WorkFormPage({ work, works, properties, units, onCancel, onSave }: { work: WorkRecord | null; works: WorkRecord[]; properties: Property[]; units: Unit[]; onCancel: () => void; onSave: (work: WorkRecord) => void }) {
  const [step, setStep] = useState(1);
  const [dirty, setDirty] = useState(false);
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
    if (dirty && !window.confirm("Descartar as alterações desta obra?")) return;
    onCancel();
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep(step)) return;
    if (step < 3) {
      setStep((current) => current + 1);
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
      <button type="button" className="secondary-button work-form-cancel" onClick={handleCancel}>Cancelar</button>
    </section>

    <nav className="work-form-stepper" aria-label="Etapas do cadastro">
      <ol>{steps.map((item) => <li key={item.number} className={`${item.number === step ? "active" : ""} ${item.number < step ? "completed" : ""}`}><button type="button" disabled={item.number > step} aria-current={item.number === step ? "step" : undefined} onClick={() => { if (item.number < step) { setStep(item.number); setErrors({}); } }}><span>{item.number < step ? <Check aria-hidden="true" /> : item.number}</span><strong>{item.title}</strong><small>{item.description}</small></button></li>)}</ol>
    </nav>

    <form className="work-form-shell" onSubmit={handleSubmit} noValidate>
      <div className="work-form-workspace">
        <section className="work-form-card" aria-labelledby={`work-form-step-${step}`}>
        <header><span>0{step}</span><div><h2 id={`work-form-step-${step}`}>{steps[step - 1].title}</h2><p>{step === 1 ? "Comece pelas informações que ajudam a localizar e entender a obra." : step === 2 ? "Defina uma referência principal e o prazo planejado." : "Informe a previsão inicial e confira o resumo antes de salvar."}</p></div></header>
        {firstError && <p className="work-form-alert" role="alert"><TriangleAlert aria-hidden="true" />Revise os campos indicados antes de continuar.</p>}

        {step === 1 && <div className="work-form-grid">
          <label><span>Tipo de intervenção <b>*</b></span><select value={draft.interventionType} onChange={(event) => updateDraft("interventionType", event.target.value as WorkInterventionType)}>{WORK_INTERVENTION_OPTIONS.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="work-form-field-wide"><span>Nome da obra <b>*</b></span><input className={errors.title ? "invalid" : ""} value={draft.title} maxLength={100} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Ex.: Reforma da cobertura" autoFocus aria-invalid={Boolean(errors.title)} />{errors.title && <small className="work-form-error">{errors.title}</small>}</label>
          <label><span>Imóvel <b>*</b></span><select className={errors.property ? "invalid" : ""} value={draft.property} onChange={(event) => updateProperty(event.target.value)} aria-invalid={Boolean(errors.property)}><option value="">Selecione um imóvel</option>{properties.map((property) => <option key={property.id} value={property.name}>{property.name}</option>)}</select>{errors.property && <small className="work-form-error">{errors.property}</small>}{selectedProperty && <small>{selectedProperty.address}</small>}</label>
          <label><span>Unidade <em>opcional</em></span><select className={errors.unit ? "invalid" : ""} value={draft.unit} disabled={!draft.property || availableUnits.length === 0} onChange={(event) => updateDraft("unit", event.target.value)} aria-invalid={Boolean(errors.unit)}><option value="">{availableUnits.length ? "Toda a área do imóvel" : "Nenhuma unidade cadastrada"}</option>{availableUnits.map((unit) => <option key={unit.id}>{unit.name}</option>)}</select>{errors.unit && <small className="work-form-error">{errors.unit}</small>}</label>
          <label className="work-form-field-wide"><span>Descrição curta <em>opcional</em></span><textarea value={draft.description} maxLength={240} rows={3} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Resuma o objetivo e o escopo principal." /><small>{draft.description.length}/240 caracteres</small></label>
          <label><span>Prioridade <b>*</b></span><select value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value as WorkPriority)}>{WORK_PRIORITY_OPTIONS.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        </div>}

        {step === 2 && <div className="work-form-grid">
          <label><span>Responsável principal <b>*</b></span><select className={errors.manager ? "invalid" : ""} value={draft.manager} onChange={(event) => updateManager(event.target.value)} aria-invalid={Boolean(errors.manager)}><option value="">Selecione uma pessoa</option>{WORK_TEAM_OPTIONS.map((member) => <option key={member.name}>{member.name}</option>)}</select>{errors.manager && <small className="work-form-error">{errors.manager}</small>}</label>
          <label><span>Situação inicial <b>*</b></span><select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as WorkStatus)}>{(isEditing ? ["Planejada", "Em andamento", "Pausada", "Concluída", "Cancelada"] : ["Planejada", "Em andamento"]).map((status) => <option key={status}>{status}</option>)}</select></label>
          <label><span>Início previsto <b>*</b></span><input type="date" className={errors.startDateIso || errors.dateRange ? "invalid" : ""} value={draft.startDateIso} onChange={(event) => updateDraft("startDateIso", event.target.value)} aria-invalid={Boolean(errors.startDateIso || errors.dateRange)} />{errors.startDateIso && <small className="work-form-error">{errors.startDateIso}</small>}</label>
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
            <header><div><p className="eyebrow">Visão do cadastro</p><h2>{draft.title.trim() || (isEditing ? "Atualização da obra" : "Nova intervenção")}</h2></div><b>{formProgress}%</b></header>
            <span className="work-form-context-progress" role="progressbar" aria-valuenow={formProgress} aria-valuemin={0} aria-valuemax={100} aria-label={`${formProgress}% do fluxo de cadastro percorrido`}><i style={{ width: `${formProgress}%` }} /></span>
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

      <footer className="work-form-footer"><div><strong>Etapa {step} de 3</strong><span>{step === 3 ? "Revise e confirme o cadastro." : "Você poderá voltar sem perder o preenchimento."}</span></div><div><button type="button" className="secondary-button" disabled={step === 1} onClick={() => { setStep((current) => Math.max(1, current - 1)); setErrors({}); }}>Voltar</button><button type="submit" className="primary-button button-with-icon">{step === 3 ? <><Check aria-hidden="true" />{isEditing ? "Salvar alterações" : "Cadastrar obra"}</> : <>Avançar<ArrowRight aria-hidden="true" /></>}</button></div></footer>
    </form>
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
  const priorityValue = overdueReceivable + overdueExpenses.reduce((sum, expense) => sum + expense.amount, 0) + partialCharges.reduce((sum, charge) => sum + chargeBalance(charge), 0);
  const occupiedUnits = units.filter((unit) => unit.occupied).length;
  const availableUnits = units.length - occupiedUnits;
  const occupancyRate = units.length ? Math.round((occupiedUnits / units.length) * 100) : 0;
  const statusRows = (["Vencida", "Parcial", "Negociada", "Próxima", "Em aberto", "Recebida"] as Status[]).map((status) => ({ status, count: charges.filter((charge) => charge.status === status).length }));
  const statusColors: Record<Status, string> = { Vencida: "#b44853", Parcial: "#c18424", Negociada: "#7657a5", "Próxima": "#4b78cf", "Em aberto": "#8693a5", Recebida: "#2d7b58" };
  let donutStart = 0;
  const donutStops = statusRows.filter((row) => row.count > 0).map((row) => {
    const start = donutStart;
    donutStart += (row.count / Math.max(charges.length, 1)) * 100;
    return `${statusColors[row.status]} ${start}% ${donutStart}%`;
  });
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
        <header><div><span className="dashboard-live-dot" aria-hidden="true" /><span>12 de agosto de 2026</span></div><b>Agosto de 2026</b></header>
        <div className="dashboard-executive-copy"><p>Painel executivo</p><h1 id="dashboard-title">Visão geral</h1><span>Uma leitura integrada da operação patrimonial e da posição financeira.</span></div>
        <div className="dashboard-result"><span>Resultado projetado do período</span><strong className={projectedResult >= 0 ? "positive" : "negative"}>{brl.format(projectedResult)}</strong><small>Recebíveis previstos menos despesas cadastradas</small></div>
        <div className="dashboard-result-breakdown"><span><small>Recebíveis previstos</small><strong>{brl.format(currentPeriodBilled)}</strong></span><i aria-hidden="true">−</i><span><small>Despesas do período</small><strong>{brl.format(currentPeriodExpenses)}</strong></span><i aria-hidden="true">=</i><span><small>Fluxo realizado</small><strong className={realizedResult >= 0 ? "positive" : "negative"}>{brl.format(realizedResult)}</strong></span></div>
      </div>
      <aside className="dashboard-executive-pulse" aria-label="Pulso da operação">
        <header><div><span>Pulso da operação</span><h2>Indicadores essenciais</h2></div><small>Atualizado hoje</small></header>
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
      <header className="dashboard-domain-header"><span className="dashboard-domain-index" aria-hidden="true">01</span><div><p>Operação patrimonial</p><h2 id="dashboard-operation-title">Estrutura, contratos e ocupação</h2><small>Acompanhe o uso das unidades e a estrutura locável.</small></div><b>OPERAÇÃO</b></header>
      <div className="dashboard-domain-content">
        <section className="dashboard-kpis dashboard-kpis-three" aria-label="Indicadores da operação patrimonial">
          <button type="button" className="dashboard-kpi kpi-occupancy" onClick={() => onNavigate("Unidades")}><span>Ocupação das unidades</span><strong>{occupancyRate}%</strong><small>{occupiedUnits} de {units.length} unidades ocupadas</small><i aria-hidden="true"><ArrowRight /></i></button>
          <button type="button" className="dashboard-kpi kpi-available" onClick={() => onNavigate("Unidades")}><span>Unidades disponíveis</span><strong>{availableUnits}</strong><small>Espaços livres para locação</small><i aria-hidden="true"><ArrowRight /></i></button>
          <button type="button" className="dashboard-kpi kpi-contracts" onClick={() => onNavigate("Contratos")}><span>Contratos ativos</span><strong>{contracts.length}</strong><small>Vínculos vigentes na base</small><i aria-hidden="true"><ArrowRight /></i></button>
        </section>
        <section className="dashboard-grid dashboard-grid-operation"><article className="dashboard-panel occupancy-panel">
          <header className="dashboard-panel-header"><div><p className="eyebrow">Desempenho operacional</p><h2>Ocupação por carteira</h2></div><span className="panel-meta">{availableUnits} unidades disponíveis</span></header>
          <div className="occupancy-list">{portfolios.map((row) => <div className="occupancy-row" key={row.portfolio}><div><strong>{row.portfolio}</strong><span>{row.occupied} de {row.total} unidades</span></div><div className="occupancy-track" role="progressbar" aria-valuenow={row.rate} aria-valuemin={0} aria-valuemax={100} aria-label={`Ocupação de ${row.portfolio}`}><i style={{ width: `${row.rate}%` }} /></div><b>{row.rate}%</b></div>)}{portfolios.length === 0 && <CompactEmptyState mark="OP" title="Ocupação ainda sem dados" description="Cadastre carteiras e unidades para formar este panorama operacional." />}</div>
          <button type="button" className="panel-link" onClick={() => onNavigate("Unidades")}>Ver todas as unidades <span aria-hidden="true"><ArrowRight /></span></button>
        </article>{featuredAvailability && featuredProperty ? <article className="dashboard-property-spotlight"><img src={propertyCoverImages[featuredProperty.id] ?? fallbackPropertyCover} alt={`Fachada de ${featuredProperty.name}`} width="720" height="520" /><div className="dashboard-property-spotlight-top"><span>Oportunidade do patrimônio</span><b>{featuredAvailability.units.length} {featuredAvailability.units.length === 1 ? "unidade disponível" : "unidades disponíveis"}</b></div><div className="dashboard-property-spotlight-copy"><span>{featuredProperty.portfolio}</span><h2>{featuredProperty.name}</h2><p>{featuredProperty.address}</p><div>{featuredAvailability.units.map((unit) => <b key={unit.id}>{unit.name} · {decimal.format(unit.area)} m²</b>)}</div><button type="button" onClick={() => onNavigate("Unidades")}>Explorar disponibilidade <span aria-hidden="true">→</span></button></div></article> : <article className="dashboard-availability-empty"><CompactEmptyState mark="✓" tone="success" title="Patrimônio totalmente ocupado" description="Quando uma unidade ficar disponível, ela ganhará destaque visual neste espaço." /></article>}</section>
      </div>
    </section>
    <section className="dashboard-domain dashboard-domain-financial" aria-labelledby="dashboard-financial-title">
      <header className="dashboard-domain-header"><span className="dashboard-domain-index" aria-hidden="true">02</span><div><p>Financeiro</p><h2 id="dashboard-financial-title">Recebíveis e despesas</h2><small>Compare entradas previstas, recebimentos e despesas.</small></div><b>FINANCEIRO</b></header>
      <div className="dashboard-domain-content">
        <section className="dashboard-kpis dashboard-kpis-three" aria-label="Indicadores financeiros">
          <button type="button" className="dashboard-kpi kpi-receivable" onClick={() => onNavigate("Cobranças")}><span>Saldo a receber</span><strong>{brl.format(receivableBalance)}</strong><small>{openCharges.length} cobranças em aberto</small><i aria-hidden="true"><ArrowRight /></i></button>
          <button type="button" className="dashboard-kpi kpi-overdue" onClick={() => onNavigate("Cobranças", "Vencida")}><span>Recebíveis vencidos</span><strong>{brl.format(overdueReceivable)}</strong><small>{overdueCharges.length} {overdueCharges.length === 1 ? "cobrança exige" : "cobranças exigem"} atenção</small><i aria-hidden="true"><ArrowRight /></i></button>
          <button type="button" className="dashboard-kpi kpi-payable" onClick={() => onNavigate("Despesas")}><span>Despesas</span><strong>{brl.format(payableBalance)}</strong><small>{openExpenses.length} despesas em aberto</small><i aria-hidden="true"><ArrowRight /></i></button>
        </section>
        <section className="dashboard-grid dashboard-grid-main">
          <article className="dashboard-panel dashboard-cashflow">
            <header className="dashboard-panel-header"><div><p className="eyebrow">Recebíveis por competência</p><h2>Previsto x recebido</h2></div><div className="chart-legend"><span><i className="legend-billed" />Previsto</span><span><i className="legend-received" />Recebido</span></div></header>
            <div className="competence-chart" role="img" aria-label="Comparação entre valores previstos e recebidos por competência"><div className="chart-scale" aria-hidden="true"><span>{brl.format(monthlyMax)}</span><span>{brl.format(monthlyMax / 2)}</span><span>R$ 0</span></div><div className="chart-plot">{monthlyRows.map((row) => <div className="chart-group" key={row.competence} aria-label={`${row.competence}: previsto ${brl.format(row.billed)}, recebido ${brl.format(row.received)}`}><div className="chart-bars"><i className="chart-bar chart-bar-billed" style={{ "--bar-height": `${(row.billed / monthlyMax) * 100}%` } as CSSProperties} /><i className="chart-bar chart-bar-received" style={{ "--bar-height": `${(row.received / monthlyMax) * 100}%` } as CSSProperties} /></div><strong>{row.competence}</strong></div>)}</div></div>
            <footer className="dashboard-panel-footer"><span>Total previsto <strong>{brl.format(charges.reduce((sum, charge) => sum + chargeTotal(charge), 0))}</strong></span><span>Total recebido <strong>{brl.format(charges.reduce((sum, charge) => sum + receivedTotal(charge), 0))}</strong></span></footer>
          </article>
          <article className="dashboard-panel dashboard-status-panel"><header className="dashboard-panel-header"><div><p className="eyebrow">Carteira de cobranças</p><h2>Situação atual</h2></div></header><div className="status-overview"><div className="status-donut" style={{ background: donutStops.length ? `conic-gradient(${donutStops.join(",")})` : "#e5e9ef" }} role="img" aria-label={`Distribuição de ${charges.length} cobranças por situação`}><span><strong>{openCharges.length}</strong><small>em aberto</small></span></div><div className="status-breakdown">{statusRows.filter((row) => row.count > 0).map((row) => <button type="button" key={row.status} onClick={() => onNavigate("Cobranças", row.status)}><i style={{ background: statusColors[row.status] }} /><span>{row.status}</span><strong>{row.count}</strong></button>)}{charges.length === 0 && <CompactEmptyState mark="CO" tone="charge" title="Sem cobranças no período" description="A distribuição por situação será formada após a primeira competência." />}</div></div></article>
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

  return <>
    <PageHeading eyebrow="Gestão de recebíveis" title="Cobranças" description="Priorize valores em risco, acompanhe acordos e registre recebimentos por competência." action="Nova cobrança" onAction={onNew} />
    <section className="charge-command-overview" aria-label="Indicadores de cobranças">
      <div className="charge-command-balance"><span>Saldo em acompanhamento</span><strong>{brl.format(pending)}</strong><small>{pendingCharges.length} {pendingCharges.length === 1 ? "cobrança ativa" : "cobranças ativas"}</small><div><span><b>{collectionRate}% recebido</b><small>{brl.format(totalReceived)} de {brl.format(totalBilled)}</small></span><i aria-hidden="true"><b style={{ width: `${collectionRate}%` }} /></i></div></div>
      <button type="button" className="charge-command-card charge-command-overdue" aria-pressed={statusFilter === "Vencida"} onClick={() => toggleStatus("Vencida")} title="Filtrar cobranças vencidas"><span>Vencidas</span><strong>{countByStatus("Vencida")}</strong><small>{brl.format(overdueBalance)} em risco</small><i aria-hidden="true"><TriangleAlert /></i></button>
      <button type="button" className="charge-command-card charge-command-upcoming" aria-pressed={statusFilter === "Próxima"} onClick={() => toggleStatus("Próxima")} title="Filtrar cobranças próximas"><span>Próximas</span><strong>{countByStatus("Próxima")}</strong><small>{brl.format(upcomingBalance)} a vencer</small><i aria-hidden="true"><CalendarClock /></i></button>
      <button type="button" className="charge-command-card charge-command-negotiated" aria-pressed={statusFilter === "Negociada"} onClick={() => toggleStatus("Negociada")} title="Filtrar cobranças negociadas"><span>Em negociação</span><strong>{countByStatus("Negociada")}</strong><small>{brl.format(negotiatedBalance)} acordados</small><i aria-hidden="true"><Handshake /></i></button>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por contrato, unidade, locatário ou item" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><FilterSelect label="Filtrar por situação" value={statusFilter} onChange={setStatusFilter} active={statusFilter !== "Todas"}><option>Todas</option><option>Vencida</option><option>Em aberto</option><option>Próxima</option><option>Parcial</option><option>Negociada</option><option>Recebida</option></FilterSelect><button type="button" className="secondary-button report-export-button button-with-icon" onClick={onReport}><span className="report-export-icon" aria-hidden="true"><ArrowDownToLine /></span>Exportar relatório</button><button type="button" className="primary-button charge-mobile-new button-with-icon" onClick={onNew}><Plus aria-hidden="true" />Nova cobrança</button></>} footer={<><span>{rows.length} de {total} cobranças</span><span>Inclusão, negociação e baixa manuais</span></>}>
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
          <span className="charge-ledger-arrow" aria-hidden="true"><ArrowRight /></span>
        </button>;
      })}</div> : <EmptyState filtered={hasChargeFilters} entity="cobrança" mark="CO" tone="charge" eyebrow="Primeira competência" title="Transforme contratos em recebíveis" description="Crie a primeira cobrança para acompanhar vencimentos, baixas e negociações em um único fluxo." action="Nova cobrança" onAction={onNew} onClear={clearChargeFilters} />}
    </TableSection>
  </>;
}

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <span className={`status status-${status.toLowerCase()}`}><i />{status}</span>;
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
  const totalPayable = rows.filter((expense) => expense.status !== "Pago").reduce((sum, expense) => sum + expense.amount, 0);
  const totalOverdue = rows.filter((expense) => expense.status === "Vencido").reduce((sum, expense) => sum + expense.amount, 0);
  const totalPaid = rows.filter((expense) => expense.status === "Pago").reduce((sum, expense) => sum + expense.amount, 0);
  const openAccounts = rows.filter((expense) => expense.status !== "Pago").length;
  const overdueAccounts = rows.filter((expense) => expense.status === "Vencido").length;
  const paidAccounts = rows.filter((expense) => expense.status === "Pago").length;
  const nextDue = rows.filter(isUpcomingExpense).length;
  const totalCommitted = totalPayable + totalPaid;
  const paymentRate = totalCommitted ? Math.round((totalPaid / totalCommitted) * 100) : 0;
  const hasExpenseFilters = Boolean(search.trim() || statusFilter !== "Todas" || categoryFilter !== "Todas as categorias");
  const toggleExpenseStatus = (status: ExpenseStatus) => setStatusFilter(statusFilter === status ? "Todas" : status);
  const clearExpenseFilters = () => {
    setSearch("");
    setStatusFilter("Todas");
    setCategoryFilter("Todas as categorias");
  };
  const sortedRows = [...rows].sort((first, second) => {
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
      <button type="button" className="expense-command-card expense-command-upcoming" aria-pressed={statusFilter === "Pendente"} onClick={() => toggleExpenseStatus("Pendente")}><span>Próximos 7 dias</span><strong>{nextDue}</strong><small>vencimentos a priorizar</small><i aria-hidden="true"><CalendarClock /></i></button>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por fornecedor, descrição ou despesa" /><FilterSelect label="Filtrar despesas por status" value={statusFilter} onChange={setStatusFilter} active={statusFilter !== "Todas"}><option>Todas</option><option>Pendente</option><option>Pago</option><option>Vencido</option></FilterSelect><FilterSelect label="Filtrar despesas por categoria" value={categoryFilter} onChange={setCategoryFilter} active={categoryFilter !== "Todas as categorias"}><option>Todas as categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</FilterSelect><FilterSelect label="Ordenar despesas" value={`${sortKey}:${sortDirection}`} onChange={selectSort} active={`${sortKey}:${sortDirection}` !== "urgent:asc"} variant="sort" wide><option value="urgent:asc">Mais urgentes</option><option value="due:asc">Vencimento: mais próximo</option><option value="due:desc">Vencimento: mais distante</option><option value="amount:desc">Valor: maior primeiro</option><option value="amount:asc">Valor: menor primeiro</option><option value="supplier:asc">Fornecedor: A–Z</option><option value="supplier:desc">Fornecedor: Z–A</option><option value="status:asc">Status: críticos primeiro</option><option value="status:desc">Status: pagos primeiro</option></FilterSelect><button type="button" className="secondary-button expense-clear-filters button-with-icon" onClick={clearExpenseFilters} disabled={!hasExpenseFilters}><RotateCcw aria-hidden="true" />Limpar filtros</button><button type="button" className="primary-button expense-mobile-new button-with-icon" onClick={onNew}><Plus aria-hidden="true" />Nova despesa</button></>} footer={<><span>{rows.length} de {total} despesas</span><span>{hasExpenseFilters ? "Resumo do resultado filtrado" : "Visão geral da base"}</span></>}>
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

function PortfoliosPage({ portfolios, properties, units, search, setSearch, onNew, onEdit }: { portfolios: Portfolio[]; properties: Property[]; units: Unit[]; search: string; setSearch: (value: string) => void; onNew: () => void; onEdit: (portfolio: Portfolio) => void }) {
  const rows = portfolios.filter((portfolio) => `${portfolio.name}${portfolio.holder}${portfolio.document}`.toLowerCase().includes(search.toLowerCase()));
  const occupiedUnits = units.filter((unit) => unit.occupied).length;
  const occupancy = units.length ? Math.round((occupiedUnits / units.length) * 100) : 0;

  return <>
    <PageHeading eyebrow="Estrutura patrimonial" title="Carteiras" description="Visualize cada portfólio, seus imóveis e a ocupação da estrutura locável." action="Nova carteira" onAction={onNew} />

    <section className="portfolio-overview" aria-label="Visão consolidada das carteiras">
      <div className="portfolio-overview-intro"><span>Visão consolidada</span><strong>{properties.length} imóveis <b>em gestão</b></strong><small>Patrimônio distribuído em {portfolios.length} {portfolios.length === 1 ? "carteira ativa" : "carteiras ativas"}.</small></div>
      <div className="portfolio-overview-metric"><span>Carteiras</span><strong>{portfolios.length}</strong><small>estruturas patrimoniais</small></div>
      <div className="portfolio-overview-metric"><span>Unidades</span><strong>{units.length}</strong><small>{units.length - occupiedUnits} disponíveis</small></div>
      <div className="portfolio-overview-occupancy"><span>Ocupação geral</span><strong>{occupancy}%</strong><small>{occupiedUnits} de {units.length} unidades</small><i aria-hidden="true"><b style={{ width: `${occupancy}%` }} /></i></div>
    </section>

    <section className="portfolio-controls" aria-label="Busca de carteiras">
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por carteira, titular ou CNPJ" />
      <span>{rows.length} {rows.length === 1 ? "carteira encontrada" : "carteiras encontradas"}</span>
      <button type="button" className="primary-button portfolio-mobile-new button-with-icon" onClick={onNew}><Plus aria-hidden="true" />Nova carteira</button>
    </section>

    {rows.length > 0 ? <section className="portfolio-card-grid" aria-label="Portfólios cadastrados">{rows.map((portfolio) => {
      const portfolioProperties = properties.filter((property) => property.portfolio === portfolio.name);
      const portfolioUnits = units.filter((unit) => unit.portfolio === portfolio.name);
      const portfolioOccupied = portfolioUnits.filter((unit) => unit.occupied).length;
      const portfolioOccupancy = portfolioUnits.length ? Math.round((portfolioOccupied / portfolioUnits.length) * 100) : 0;
      const monogram = portfolio.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
      const tone = portfolios.indexOf(portfolio) % 2 === 0 ? "atlas" : "horizon";

      return <article className={`portfolio-card portfolio-card-${tone}`} key={portfolio.id}>
        {portfolioProperties.length > 0 ? <div className={`portfolio-gallery portfolio-gallery-${Math.min(portfolioProperties.length, 3)}`}>
          {portfolioProperties.slice(0, 3).map((property) => <span key={property.id}><img src={propertyCoverImages[property.id] ?? fallbackPropertyCover} alt={`${property.name}, imóvel de ${portfolio.name}`} width="640" height="400" loading="lazy" /></span>)}
          <span className="portfolio-card-id">{portfolio.id}</span>
          <span className="portfolio-card-monogram" aria-hidden="true">{monogram}</span>
        </div> : <div className="portfolio-empty-cover"><span>{monogram}</span><strong>Carteira pronta para receber imóveis</strong><small>Vincule o primeiro empreendimento ao portfólio.</small></div>}

        <div className="portfolio-card-body">
          <header><div><span>Titular da carteira</span><h2>{portfolio.name}</h2><p>{portfolio.holder}</p></div><button type="button" className="secondary-button portfolio-edit button-with-icon" onClick={() => onEdit(portfolio)}><PencilLine aria-hidden="true" />Editar carteira</button></header>
          <div className="portfolio-document"><span>Documento do titular</span><strong>{portfolio.document}</strong></div>
          <div className="portfolio-card-metrics">
            <span>Imóveis<strong>{portfolioProperties.length}</strong></span>
            <span>Unidades<strong>{portfolioUnits.length}</strong></span>
            <span>Ocupação<strong>{portfolioOccupancy}%</strong></span>
          </div>
          <div className="portfolio-occupancy-row"><span><strong>{portfolioOccupied} ocupadas</strong><small>{portfolioUnits.length - portfolioOccupied} disponíveis</small></span><i aria-label={`Ocupação de ${portfolio.name}: ${portfolioOccupancy}%`}><b style={{ width: `${portfolioOccupancy}%` }} /></i></div>
          <div className="portfolio-property-list"><span>Empreendimentos</span><div>{portfolioProperties.slice(0, 3).map((property) => <small key={property.id}>{property.name}</small>)}{portfolioProperties.length > 3 && <small>+{portfolioProperties.length - 3}</small>}{portfolioProperties.length === 0 && <small>Nenhum imóvel vinculado</small>}</div></div>
        </div>
      </article>;
    })}</section> : <div className="portfolio-empty-result"><EmptyState filtered={Boolean(search.trim())} entity="carteira" mark="CA" tone="portfolio" eyebrow="Estrutura patrimonial" title="Comece organizando o patrimônio" description="Crie uma carteira para reunir titularidade, imóveis e indicadores de ocupação em uma visão consolidada." action="Nova carteira" onAction={onNew} onClear={() => setSearch("")} /></div>}

    {rows.length > 0 && <details className="portfolio-table-view">
      <summary><span><strong>Visão cadastral</strong><small>Consulte titular, documento e totais em formato de tabela.</small></span><b aria-hidden="true">+</b></summary>
      <div className="portfolio-table-scroll"><table className="compact-table"><thead><tr><th>Carteira</th><th>Titular</th><th>Documento</th><th>Imóveis</th><th>Unidades</th><th /></tr></thead><tbody>{rows.map((portfolio) => <tr key={portfolio.id}><td><strong>{portfolio.name}</strong><small>{portfolio.id}</small></td><td>{portfolio.holder}</td><td>{portfolio.document}</td><td>{properties.filter((property) => property.portfolio === portfolio.name).length}</td><td>{units.filter((unit) => unit.portfolio === portfolio.name).length}</td><td><button type="button" className="row-action" onClick={() => onEdit(portfolio)}>Editar</button></td></tr>)}</tbody></table></div>
    </details>}
  </>;
}

function PropertiesPage({ properties, units, search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen }: { properties: Property[]; units: Unit[]; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (property: Property) => void }) {
  const rows = properties.filter((property) => `${property.name}${property.address}${property.id}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || property.portfolio === portfolioFilter));
  const visibleNames = new Set(rows.map((property) => property.name));
  const visibleUnits = units.filter((unit) => visibleNames.has(unit.property));
  const occupiedUnits = visibleUnits.filter((unit) => unit.occupied).length;
  const availableUnits = visibleUnits.length - occupiedUnits;
  const occupancy = visibleUnits.length ? Math.round((occupiedUnits / visibleUnits.length) * 100) : 0;
  const visiblePortfolios = new Set(rows.map((property) => property.portfolio)).size;

  return <><PageHeading eyebrow="Estrutura patrimonial" title="Imóveis" description="Reconheça cada empreendimento e acompanhe sua ocupação em uma única visão." action="Novo imóvel" onAction={onNew} />
    <section className="property-insight-strip" aria-label="Resumo dos imóveis exibidos">
      <div className="property-insight-main"><span>Patrimônio em foco</span><strong>{rows.length} {rows.length === 1 ? "empreendimento" : "empreendimentos"}</strong><small>Distribuídos em {visiblePortfolios} {visiblePortfolios === 1 ? "carteira" : "carteiras"}</small></div>
      <div><span>Unidades</span><strong>{visibleUnits.length}</strong><small>estrutura locável</small></div>
      <div className="property-insight-available"><span>Disponíveis</span><strong>{availableUnits}</strong><small>prontas para locação</small></div>
      <div className="property-insight-occupancy"><span>Ocupação</span><strong>{occupancy}%</strong><small>{occupiedUnits} unidades ocupadas</small><i aria-hidden="true"><b style={{ width: `${occupancy}%` }} /></i></div>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por imóvel ou endereço" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><button type="button" className="primary-button property-mobile-new button-with-icon" onClick={onNew}><Plus aria-hidden="true" />Novo imóvel</button></>} footer={<><span>{rows.length} imóveis</span><span>{availableUnits} unidades disponíveis</span></>}>
      {rows.length > 0 ? <div className="property-card-grid" aria-label="Imóveis cadastrados">{rows.map((property) => {
        const propertyUnits = units.filter((unit) => unit.property === property.name);
        const propertyOccupied = propertyUnits.filter((unit) => unit.occupied).length;
        const propertyAvailable = propertyUnits.length - propertyOccupied;
        const propertyOccupancy = propertyUnits.length ? Math.round((propertyOccupied / propertyUnits.length) * 100) : 0;

        return <button type="button" className="property-card" key={property.id} onClick={() => onOpen(property)} aria-label={`Abrir detalhes de ${property.name}. Ocupação de ${propertyOccupancy}%`}>
          <span className="property-card-media">
            <img src={propertyCoverImages[property.id] ?? fallbackPropertyCover} alt={`Fachada ilustrativa de ${property.name}`} width="640" height="400" loading="lazy" />
            <span className="property-card-id">{property.id}</span>
            <span className={`property-card-availability ${propertyAvailable === 0 ? "property-card-full" : ""}`}>{propertyAvailable === 0 ? "Ocupação total" : `${propertyAvailable} ${propertyAvailable === 1 ? "disponível" : "disponíveis"}`}</span>
          </span>
          <span className="property-card-body">
            <strong>{property.name}</strong>
            <span className="property-card-address"><i aria-hidden="true" />{property.address}</span>
            <span className="property-card-meta">
              <b>{property.portfolio}</b>
              <span>{propertyUnits.length} {propertyUnits.length === 1 ? "unidade" : "unidades"}</span>
            </span>
            <span className="property-card-occupancy">
              <span><strong>{propertyOccupancy}% ocupado</strong><small>{propertyOccupied} ocupadas · {propertyAvailable} livres</small></span>
              <i aria-hidden="true"><b style={{ width: `${propertyOccupancy}%` }} /></i>
            </span>
          </span>
        </button>;
      })}</div> : <EmptyState filtered={Boolean(search.trim() || portfolioFilter !== "Todas as carteiras")} entity="imóvel" mark="IM" tone="property" eyebrow="Ativo imobiliário" title="Dê forma visual ao patrimônio" description="Cadastre o primeiro empreendimento para organizar localização, imagens, documentos e unidades vinculadas." action="Novo imóvel" onAction={onNew} onClear={() => { setSearch(""); setPortfolioFilter("Todas as carteiras"); }} />}
    </TableSection>
  </>;
}

function UnitsPage({ units, properties, search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen, onEdit }: { units: Unit[]; properties: Property[]; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (unit: Unit) => void; onEdit: (unit: Unit) => void }) {
  const rows = units.filter((unit) => `${unit.name}${unit.property}${unit.id}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || unit.portfolio === portfolioFilter));
  const occupiedUnits = rows.filter((unit) => unit.occupied).length;
  const availableUnits = rows.length - occupiedUnits;
  const occupancy = rows.length ? Math.round((occupiedUnits / rows.length) * 100) : 0;
  const totalArea = rows.reduce((total, unit) => total + unit.area, 0);
  const visibleProperties = new Set(rows.map((unit) => unit.property)).size;

  return <><PageHeading eyebrow="Estrutura locável" title="Unidades" description="Visualize disponibilidade, metragem e localização de cada espaço do patrimônio." action="Nova unidade" onAction={onNew} />
    <section className="unit-overview" aria-label="Resumo das unidades exibidas">
      <div className="unit-overview-intro"><span>Mapa de disponibilidade</span><strong>{rows.length} {rows.length === 1 ? "unidade" : "unidades"}</strong><small>Em {visibleProperties} {visibleProperties === 1 ? "empreendimento" : "empreendimentos"}</small></div>
      <div><span>Área locável</span><strong>{decimal.format(totalArea)} m²</strong><small>somada no filtro atual</small></div>
      <div className="unit-overview-available"><span>Disponíveis agora</span><strong>{availableUnits}</strong><small>prontas para novo contrato</small></div>
      <div className="unit-overview-occupancy"><span>Ocupação</span><strong>{occupancy}%</strong><small>{occupiedUnits} ocupadas · {availableUnits} livres</small><i aria-hidden="true"><b style={{ width: `${occupancy}%` }} /></i></div>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por unidade ou imóvel" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><button type="button" className="primary-button unit-mobile-new button-with-icon" onClick={onNew}><Plus aria-hidden="true" />Nova unidade</button></>} footer={<><span>{rows.length} unidades</span><span>{availableUnits} disponíveis no filtro</span></>}>
      {rows.length > 0 ? <div className="unit-card-grid" aria-label="Unidades cadastradas">{rows.map((unit) => {
        const property = properties.find((record) => record.name === unit.property);
        const propertyImage = property ? propertyCoverImages[property.id] : undefined;

        return <article className={`unit-card ${unit.occupied ? "unit-card-occupied" : "unit-card-available"}`} key={unit.id}>
          <button type="button" className="unit-card-open" onClick={() => onOpen(unit)} aria-label={`Abrir detalhes de ${unit.name}, ${unit.occupied ? "ocupada" : "disponível"}`}>
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
                <span><small>Carteira</small><b>{unit.portfolio.replace("Carteira ", "")}</b></span>
              </span>
            </span>
          </button>
          <footer><span>{unit.occupied ? "Espaço em uso" : "Pronta para locação"}</span><button type="button" onClick={() => onEdit(unit)}>Editar</button></footer>
        </article>;
      })}</div> : <EmptyState filtered={Boolean(search.trim() || portfolioFilter !== "Todas as carteiras")} entity="unidade" mark="UN" tone="unit" eyebrow="Mapa de disponibilidade" title="Mapeie os espaços locáveis" description="Adicione unidades para visualizar metragem, ocupação e disponibilidade dentro de cada empreendimento." action="Nova unidade" onAction={onNew} onClear={() => { setSearch(""); setPortfolioFilter("Todas as carteiras"); }} />}
    </TableSection>
  </>;
}

function TenantsPage({ tenants, contracts, charges, search, setSearch, onNew, onOpen, onEdit }: { tenants: Tenant[]; contracts: Contract[]; charges: Charge[]; search: string; setSearch: (value: string) => void; onNew: () => void; onOpen: (tenant: Tenant) => void; onEdit: (tenant: Tenant) => void }) {
  const [relationshipFilter, setRelationshipFilter] = useState("Todos");
  const activeTenantNames = new Set(contracts.map((contract) => contract.tenant));
  const activeTenants = tenants.filter((tenant) => activeTenantNames.has(tenant.name));
  const unlinkedTenants = tenants.filter((tenant) => !activeTenantNames.has(tenant.name));
  const monthlyRevenue = contracts.reduce((total, contract) => total + contract.rent, 0);
  const rows = tenants.filter((tenant) => {
    const matchesSearch = `${tenant.name}${tenant.document}${tenant.id}`.toLowerCase().includes(search.toLowerCase());
    const hasContract = activeTenantNames.has(tenant.name);
    const matchesRelationship = relationshipFilter === "Todos" || (relationshipFilter === "Com contrato" ? hasContract : !hasContract);
    return matchesSearch && matchesRelationship;
  });
  const toggleRelationship = (filter: "Com contrato" | "Sem contrato") => setRelationshipFilter(relationshipFilter === filter ? "Todos" : filter);

  return <><PageHeading eyebrow="Relacionamentos de locação" title="Locatários" description="Acompanhe vínculos, ocupação e situação financeira de cada relacionamento." action="Novo locatário" onAction={onNew} />
    <section className="tenant-overview" aria-label="Resumo dos locatários">
      <div className="tenant-overview-intro"><span>Base de relacionamentos</span><strong>{tenants.length} {tenants.length === 1 ? "locatário cadastrado" : "locatários cadastrados"}</strong><small>Pessoas e empresas conectadas à operação</small></div>
      <div className="tenant-overview-revenue"><span>Receita mensal vinculada</span><strong>{brl.format(monthlyRevenue)}</strong><small>aluguel base dos contratos ativos</small></div>
      <button type="button" className="tenant-overview-active" aria-pressed={relationshipFilter === "Com contrato"} onClick={() => toggleRelationship("Com contrato")}><span>Com contrato</span><strong>{activeTenants.length}</strong><small>{contracts.reduce((total, contract) => total + contract.units.length, 0)} unidades ocupadas</small><i aria-hidden="true"><CircleCheck /></i></button>
      <button type="button" className="tenant-overview-unlinked" aria-pressed={relationshipFilter === "Sem contrato"} onClick={() => toggleRelationship("Sem contrato")}><span>Sem vínculo ativo</span><strong>{unlinkedTenants.length}</strong><small>disponíveis para nova locação</small><i aria-hidden="true"><Plus /></i></button>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por nome, CPF ou CNPJ" /><FilterSelect label="Filtrar por vínculo" value={relationshipFilter} onChange={setRelationshipFilter} active={relationshipFilter !== "Todos"}><option>Todos</option><option>Com contrato</option><option>Sem contrato</option></FilterSelect><button type="button" className="primary-button tenant-mobile-new button-with-icon" onClick={onNew}><Plus aria-hidden="true" />Novo locatário</button></>} footer={<><span>{rows.length} de {tenants.length} locatários</span><span>{activeTenants.length} com vínculo ativo</span></>}>
      {rows.length > 0 ? <div className="tenant-card-grid" aria-label="Locatários cadastrados">{rows.map((tenant) => {
        const tenantContracts = contracts.filter((contract) => contract.tenant === tenant.name);
        const tenantCharges = charges.filter((charge) => charge.tenant === tenant.name);
        const attentionCharges = tenantCharges.filter((charge) => charge.status === "Vencida" || charge.status === "Parcial");
        const openBalance = tenantCharges.filter((charge) => charge.status !== "Recebida").reduce((total, charge) => total + chargeBalance(charge), 0);
        const tenantRevenue = tenantContracts.reduce((total, contract) => total + contract.rent, 0);
        const mainContract = tenantContracts[0];
        const relationshipStatus = !mainContract ? "Sem vínculo" : attentionCharges.length ? "Atenção" : "Ativo";
        const relationshipClass = !mainContract ? "unlinked" : attentionCharges.length ? "attention" : "active";

        return <article className={`tenant-card tenant-card-${relationshipClass}`} key={tenant.id}>
          <button type="button" className="tenant-card-open" onClick={() => onOpen(tenant)} aria-label={`Abrir detalhes de ${tenant.name}`}>
            <span className="tenant-card-head"><span className="tenant-card-avatar" aria-hidden="true">{tenantInitials(tenant.name)}</span><span className="tenant-card-identity"><span><b>{tenant.type === "PJ" ? "Pessoa jurídica" : "Pessoa física"}</b><small>{tenant.id}</small></span><strong>{tenant.name}</strong><small>{tenant.document}</small></span><span className={`tenant-relationship-badge tenant-relationship-${relationshipClass}`}><i />{relationshipStatus}</span></span>
            {mainContract ? <>
              <span className="tenant-card-contract"><span><small>Contrato vigente</small><strong>{mainContract.id}</strong></span><span><small>Empreendimento</small><strong>{mainContract.property}</strong></span><span><small>{mainContract.units.length === 1 ? "Unidade" : "Unidades"}</small><strong>{mainContract.units.join(" · ")}</strong></span></span>
              <span className="tenant-card-financial"><span><small>Aluguel base mensal</small><strong>{brl.format(tenantRevenue)}</strong></span><span><small>Saldo em aberto</small><strong className={attentionCharges.length ? "tenant-value-attention" : ""}>{brl.format(openBalance)}</strong></span><span><small>Cobranças</small><strong>{tenantCharges.length}</strong></span></span>
            </> : <span className="tenant-card-empty-link"><i aria-hidden="true"><Plus /></i><span><strong>Sem contrato ativo</strong><small>Cadastro pronto para um novo vínculo de locação.</small></span></span>}
            <span className="tenant-card-arrow" aria-hidden="true">Ver relacionamento <b>→</b></span>
          </button>
          <footer><span>{mainContract ? `${tenantContracts.length} ${tenantContracts.length === 1 ? "contrato ativo" : "contratos ativos"}` : "Relacionamento em prospecção"}</span><button type="button" onClick={() => onEdit(tenant)}>Editar cadastro</button></footer>
        </article>;
      })}</div> : <EmptyState filtered={Boolean(search.trim() || relationshipFilter !== "Todos")} entity="locatário" mark="LO" tone="tenant" eyebrow="Base de relacionamentos" title="Cadastre o primeiro locatário" description="Construa uma base pronta para conectar pessoas e empresas aos contratos e à operação financeira." action="Novo locatário" onAction={onNew} onClear={() => { setSearch(""); setRelationshipFilter("Todos"); }} />}
    </TableSection>
  </>;
}

function ContractsPage({ contracts: contractOptions, charges, search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen }: { contracts: Contract[]; charges: Charge[]; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (contract: Contract) => void }) {
  const rows = contractOptions.filter((contract) => `${contract.id}${contract.property}${contract.tenant}${contract.units.join("")}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || contract.portfolio === portfolioFilter));
  const monthlyRevenue = rows.reduce((total, contract) => total + contract.rent, 0);
  const linkedUnits = rows.reduce((total, contract) => total + contract.units.length, 0);
  const visibleContractIds = new Set(rows.map((contract) => contract.id));
  const generatedCharges = charges.filter((charge) => visibleContractIds.has(charge.contract)).length;

  return <><PageHeading eyebrow="Locações" title="Contratos" description="Acompanhe acordos ativos, vigências e valores contratados com clareza executiva." action="Novo contrato" onAction={onNew} />
    <section className="contract-overview" aria-label="Resumo dos contratos exibidos">
      <div className="contract-overview-intro"><span>Carteira contratual</span><strong>{rows.length} {rows.length === 1 ? "contrato ativo" : "contratos ativos"}</strong><small>Acordos vigentes no filtro atual</small></div>
      <div><span>Receita mensal base</span><strong>{brl.format(monthlyRevenue)}</strong><small>sem adicionais contratuais</small></div>
      <div><span>Unidades vinculadas</span><strong>{linkedUnits}</strong><small>espaços sob contrato</small></div>
      <div className="contract-overview-billing"><span>Cobranças geradas</span><strong>{generatedCharges}</strong><small>competências incluídas manualmente</small></div>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por contrato, unidade ou locatário" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><button type="button" className="primary-button contract-mobile-new button-with-icon" onClick={onNew}><Plus aria-hidden="true" />Novo contrato</button></>} footer={<><span>{rows.length} contratos ativos</span><span>{brl.format(monthlyRevenue)} de receita mensal base</span></>}>
      {rows.length > 0 ? <div className="contract-card-grid" aria-label="Contratos ativos">{rows.map((contract) => {
        const [startDate, endDate] = contract.period.split(" — ");
        const contractCharges = charges.filter((charge) => charge.contract === contract.id).length;

        return <button type="button" className="contract-card" key={contract.id} onClick={() => onOpen(contract)} aria-label={`Abrir ${contract.id}, contrato de ${contract.tenant}`}>
          <span className="contract-card-accent" aria-hidden="true" />
          <span className="contract-card-head"><span><b>{contract.id}</b><small>{contract.portfolio}</small></span><span className="contract-active-badge">Ativo</span></span>
          <span className="contract-card-tenant"><small>Locatário</small><strong>{contract.tenant}</strong><span>{contract.property}</span></span>
          <span className="contract-card-units"><small>{contract.units.length} {contract.units.length === 1 ? "unidade vinculada" : "unidades vinculadas"}</small><span>{contract.units.map((unit) => <b key={unit}>{unit}</b>)}</span></span>
          <span className="contract-card-value"><span><small>Aluguel base</small><strong>{brl.format(contract.rent)}</strong></span><span><small>Vencimento</small><strong>Dia {contract.due}</strong></span></span>
          <span className="contract-card-period"><span><i aria-hidden="true" /><b>{startDate}</b></span><i aria-hidden="true" /><span><i aria-hidden="true" /><b>{endDate}</b></span></span>
          <span className="contract-card-footer"><span>Reajuste em {contract.adjustment}</span><b>{contractCharges} {contractCharges === 1 ? "cobrança" : "cobranças"} <i aria-hidden="true"><ArrowRight /></i></b></span>
        </button>;
      })}</div> : <EmptyState filtered={Boolean(search.trim() || portfolioFilter !== "Todas as carteiras")} entity="contrato" mark="CT" tone="contract" eyebrow="Instrumento de locação" title="Conecte patrimônio e locatário" description="Crie o primeiro contrato para definir unidades, vigência, valores e a composição das futuras cobranças." action="Novo contrato" onAction={onNew} onClear={() => { setSearch(""); setPortfolioFilter("Todas as carteiras"); }} />}
    </TableSection>
    <InfoNote text="Os itens e valores ficam previstos no contrato, enquanto cada competência continua sendo incluída manualmente em Cobranças." />
  </>;
}

function InfoNote({ text }: { text: string }) { return <aside className="info-note"><span>i</span><p>{text}</p></aside>; }

function RegistryDetailDrawer({ detail, properties, units, contracts, charges, documents, categorizedDocuments, onCategorizedDocumentsChange, onClose, onEdit }: { detail: RegistryDetail; properties: Property[]; units: Unit[]; contracts: Contract[]; charges: Charge[]; documents: LocalDocument[]; categorizedDocuments?: CategorizedDocuments; onCategorizedDocumentsChange: (documents: CategorizedDocuments) => void; onClose: () => void; onEdit: () => void }) {
  let eyebrow = "Detalhes do cadastro";
  const title = detail.record.name;
  let fields: Array<{ label: string; value: ReactNode }>;
  const propertyUnits = detail.kind === "property" ? units.filter((unit) => unit.property === detail.record.name) : [];
  const propertyOccupied = propertyUnits.filter((unit) => unit.occupied).length;
  const propertyAvailable = propertyUnits.length - propertyOccupied;
  const propertyOccupancy = propertyUnits.length ? Math.round((propertyOccupied / propertyUnits.length) * 100) : 0;
  const unitProperty = detail.kind === "unit" ? properties.find((property) => property.name === detail.record.property) : undefined;
  const unitContract = detail.kind === "unit" ? contracts.find((contract) => contract.property === detail.record.property && contract.units.includes(detail.record.name)) : undefined;
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
      { label: "Identificador", value: detail.record.id },
      { label: "Carteira", value: detail.record.portfolio },
      { label: "Tipo de imóvel", value: detail.record.propertyType || "Não informado" },
      { label: "Endereço principal", value: detail.record.address },
      { label: "Inscrição municipal", value: detail.record.municipalRegistration || "Não informada" },
      { label: "Matrícula", value: detail.record.registryNumber || "Não informada" },
      { label: "Cartório", value: detail.record.registryOffice || "Não informado" },
      { label: "Gestor responsável", value: detail.record.manager || "Não definido" },
      { label: "Unidades", value: detail.record.units },
    ];
  } else if (detail.kind === "unit") {
    eyebrow = "Detalhes da unidade";
    fields = [
      { label: "Identificador", value: detail.record.id },
      { label: "Imóvel", value: detail.record.property },
      { label: "Carteira", value: detail.record.portfolio },
      { label: "Tipo", value: detail.record.unitType || "Não informado" },
      { label: "Código", value: detail.record.code || detail.record.name },
      { label: "Bloco / pavimento", value: [detail.record.block, detail.record.floor].filter(Boolean).join(" · ") || "Não informado" },
      { label: "Área total", value: detail.record.totalArea ? `${decimal.format(detail.record.totalArea)} m²` : "Não informada" },
      { label: "Inscrição municipal", value: detail.record.municipalRegistration || "Não informada" },
      { label: "Endereço do imóvel", value: unitProperty?.address ?? "Endereço não informado" },
    ];
  } else {
    eyebrow = "Detalhes do locatário";
    fields = [
      { label: "Identificador", value: detail.record.id },
      { label: "Tipo", value: detail.record.type === "PJ" ? "Pessoa jurídica" : "Pessoa física" },
      { label: detail.record.type === "PJ" ? "CNPJ" : "CPF", value: detail.record.document },
      { label: "Nome fantasia", value: detail.record.tradeName || "Não informado" },
      { label: "Contato", value: detail.record.contactName || "Não informado" },
      { label: "Telefone / WhatsApp", value: detail.record.phone || "Não informado" },
      { label: "E-mail", value: detail.record.email || "Não informado" },
      { label: "Canal preferencial", value: detail.record.preferredChannel || "Não definido" },
      { label: "Endereço de cobrança", value: detail.record.billingAddress || "Não informado" },
      { label: "Contratos ativos", value: tenantContracts.length },
    ];
  }

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${eyebrow}: ${title}`}><button className="drawer-backdrop" onClick={onClose} /><aside className={`drawer wide-drawer registry-detail-drawer ${detail.kind === "property" ? "property-detail-drawer" : detail.kind === "unit" ? "unit-detail-drawer" : "tenant-detail-drawer"}`}>{detail.kind === "property" ? <header className="property-detail-hero">
    <img src={propertyCoverImages[detail.record.id] ?? fallbackPropertyCover} alt={`Fachada ilustrativa de ${detail.record.name}`} width="800" height="520" />
    <div className="property-detail-hero-top"><p className="eyebrow eyebrow-light">Detalhes do imóvel</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
    <div className="property-detail-hero-copy"><span>{detail.record.id}</span><h2>{detail.record.name}</h2><p>{detail.record.address}</p></div>
  </header> : detail.kind === "unit" ? <header className="unit-detail-hero">
    <img src={(unitProperty && propertyCoverImages[unitProperty.id]) ?? fallbackPropertyCover} alt="" width="800" height="480" />
    <div className="property-detail-hero-top"><p className="eyebrow eyebrow-light">Detalhes da unidade</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
    <div className="property-detail-hero-copy unit-detail-hero-copy"><div><span>{detail.record.id}</span><span className={`unit-detail-hero-status ${detail.record.occupied ? "occupied" : "available"}`}>{detail.record.occupied ? "Ocupada" : "Disponível"}</span></div><h2>{detail.record.name}</h2><p>{detail.record.property}</p></div>
  </header> : <header className={`tenant-detail-hero ${tenantContracts.length ? tenantAttentionCharges.length ? "tenant-detail-hero-attention" : "tenant-detail-hero-active" : "tenant-detail-hero-unlinked"}`}>
    <div className="tenant-detail-hero-top"><p className="eyebrow eyebrow-light">Relacionamento de locação</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
    <div className="tenant-detail-hero-copy"><span className="tenant-detail-avatar" aria-hidden="true">{tenantInitials(detail.record.name)}</span><div><span>{detail.record.id} · {detail.record.type === "PJ" ? "Pessoa jurídica" : "Pessoa física"}</span><h2>{detail.record.name}</h2><p>{tenantContracts.length ? `${tenantContracts.length} ${tenantContracts.length === 1 ? "contrato ativo" : "contratos ativos"} · ${tenantLinkedUnits} ${tenantLinkedUnits === 1 ? "unidade vinculada" : "unidades vinculadas"}` : "Cadastro disponível para novo vínculo"}</p></div></div>
    <i className="tenant-detail-status" aria-hidden="true">{tenantContracts.length ? tenantAttentionCharges.length ? "!" : "✓" : "+"}</i>
  </header>}<div className="drawer-body">
    {detail.kind === "property" && <section className="property-detail-summary" aria-label={`Ocupação de ${detail.record.name}`}>
      <div><span>Carteira</span><strong>{detail.record.portfolio}</strong></div>
      <div><span>Unidades</span><strong>{propertyUnits.length}</strong></div>
      <div><span>Ocupadas</span><strong>{propertyOccupied}</strong></div>
      <div className="property-detail-availability"><span>Disponíveis</span><strong>{propertyAvailable}</strong></div>
      <div className="property-detail-progress"><span><strong>{propertyOccupancy}% de ocupação</strong><small>{propertyAvailable ? `${propertyAvailable} ${propertyAvailable === 1 ? "unidade disponível" : "unidades disponíveis"}` : "Empreendimento totalmente ocupado"}</small></span><i aria-hidden="true"><b style={{ width: `${propertyOccupancy}%` }} /></i></div>
    </section>}
    {detail.kind === "unit" && <>
      <section className="unit-detail-summary" aria-label={`Resumo de ${detail.record.name}`}>
        <div className={detail.record.occupied ? "unit-detail-occupied" : "unit-detail-available"}><span>Situação atual</span><strong>{detail.record.occupied ? "Ocupada" : "Disponível"}</strong><small>{detail.record.occupied ? "espaço em utilização" : "pronta para locação"}</small></div>
        <div><span>Área privativa</span><strong>{decimal.format(detail.record.area)} <small>m²</small></strong><small>metragem cadastrada</small></div>
        <div><span>Empreendimento</span><strong>{detail.record.property}</strong><small>{unitProperty?.address ?? "Endereço não informado"}</small></div>
        <div><span>Carteira</span><strong>{detail.record.portfolio.replace("Carteira ", "")}</strong><small>vínculo patrimonial</small></div>
      </section>
      {unitContract ? <section className="unit-current-lease" aria-label={`Locação vigente ${unitContract.id}`}>
        <header><span>Locação vigente</span><b>{unitContract.id}</b></header>
        <div><span>Locatário<strong>{unitContract.tenant}</strong></span><span>Aluguel base<strong>{brl.format(unitContract.rent)}</strong></span></div>
        <footer><span>{unitContract.period}</span><span>Vencimento no dia {unitContract.due}</span></footer>
      </section> : !detail.record.occupied && <aside className="unit-availability-note"><span aria-hidden="true"><Plus /></span><div><strong>Disponível para nova locação</strong><p>Esta unidade pode ser selecionada ao cadastrar um novo contrato.</p></div></aside>}
      <div className="unit-detail-section-title"><span>Dados cadastrais</span><small>Informações estruturais da unidade</small></div>
    </>}
    {detail.kind === "tenant" && <>
      <section className="tenant-detail-summary" aria-label={`Resumo do relacionamento com ${detail.record.name}`}>
        <div className="tenant-detail-revenue"><span>Receita mensal vinculada</span><strong>{brl.format(tenantMonthlyRevenue)}</strong><small>aluguel base contratado</small></div>
        <div><span>Contratos ativos</span><strong>{tenantContracts.length}</strong><small>{tenantContracts.length ? "vínculos em andamento" : "sem vínculo vigente"}</small></div>
        <div><span>Unidades vinculadas</span><strong>{tenantLinkedUnits}</strong><small>espaços ocupados</small></div>
        <div className={tenantAttentionCharges.length ? "tenant-detail-attention" : ""}><span>Saldo em aberto</span><strong>{brl.format(tenantOpenBalance)}</strong><small>{tenantAttentionCharges.length ? `${tenantAttentionCharges.length} cobrança exige atenção` : `${tenantOpenCharges.length} cobranças abertas`}</small></div>
      </section>
      {tenantContracts.length ? <section className="tenant-contract-panel" aria-labelledby="tenant-contracts-title"><header><div><span>Relacionamentos ativos</span><h3 id="tenant-contracts-title">Contratos e ocupação</h3></div><b>{tenantContracts.length}</b></header><div>{tenantContracts.map((contract) => <article key={contract.id}><span className="tenant-contract-id"><small>Contrato</small><strong>{contract.id}</strong></span><span><small>Empreendimento</small><strong>{contract.property}</strong></span><span><small>Aluguel base</small><strong>{brl.format(contract.rent)}</strong></span><footer><span>{contract.units.join(" · ")}</span><span>Vence dia {contract.due}</span></footer></article>)}</div></section> : <aside className="tenant-unlinked-note"><span aria-hidden="true"><Plus /></span><div><strong>Pronto para um novo contrato</strong><p>Este locatário está cadastrado, mas ainda não possui uma unidade vinculada.</p></div></aside>}
      <section className="tenant-financial-panel" aria-labelledby="tenant-financial-title"><header><div><span>Saúde financeira</span><h3 id="tenant-financial-title">Cobranças do relacionamento</h3></div><b className={tenantAttentionCharges.length ? "has-attention" : ""}>{tenantAttentionCharges.length ? "Requer atenção" : tenantCharges.length ? "Em dia" : "Sem histórico"}</b></header>{tenantCharges.length ? <div>{tenantCharges.slice(0, 4).map((charge) => <span key={charge.id}><StatusBadge status={charge.status} /><strong>{charge.id}</strong><small>{charge.competence}</small><b>{brl.format(chargeBalance(charge))}</b></span>)}</div> : <CompactEmptyState mark="CO" tone="tenant" title="Relacionamento sem histórico financeiro" description="As cobranças vinculadas a este locatário aparecerão aqui por competência." />}</section>
      <div className="tenant-detail-section-title"><span>Dados cadastrais</span><small>Identificação do relacionamento</small></div>
    </>}
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

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Detalhes da cobrança ${charge.id}`}><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer wide-drawer charge-detail-drawer">
    <header className={`charge-detail-hero charge-detail-hero-${statusName}`}>
      <div className="charge-detail-hero-top"><p className="eyebrow eyebrow-light">Cobrança composta</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
      <div className="charge-detail-hero-copy"><div><StatusBadge status={charge.status} /><span>{charge.competence}</span></div><h2>{charge.id}</h2><p>{charge.tenant} · {charge.property}</p></div>
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
    <section className="charge-detail-context" aria-labelledby="charge-context-title"><header><div><span>Origem da cobrança</span><h3 id="charge-context-title">Vínculos e competência</h3></div><b>{charge.competence}</b></header><div><span>Contrato<strong>{charge.contract}</strong></span><span>Carteira<strong>{charge.portfolio}</strong></span><span>Locatário<strong>{charge.tenant}</strong></span><span>Imóvel<strong>{charge.property}</strong></span><span>Tipo<strong>{charge.inclusionType || "Normal"}</strong></span><span>Pagamento<strong>{charge.paymentMethod || "Não definido"}</strong></span></div><footer>{charge.units.map((unit) => <span key={unit}>{unit}</span>)}</footer></section>
    <section className="charge-items-block"><div className="section-title"><h3>Composição da cobrança</h3><span>{charge.items.length} itens</span></div><div className="charge-items">{charge.items.map((item) => <article className="charge-item" key={`${item.name}-${item.dueDate}`}><div className="charge-item-head"><strong>{item.name}</strong><span>Vence {item.dueDate}</span></div>{(item.reference || item.supportDocumentName) && <p className="charge-item-reference-line">{[item.reference, item.supportDocumentName].filter(Boolean).join(" · ")}</p>}<div className="charge-item-values"><span>Previsto <b>{brl.format(item.amount)}</b></span><span>Recebido <b>{brl.format(item.received)}</b></span><span>Saldo <b>{brl.format(item.amount - item.received)}</b></span></div></article>)}</div></section>
    <section className="history-block"><div className="section-title"><h3>Histórico de recebimentos</h3><span>{receipts.length ? `${receipts.length} ${receipts.length === 1 ? "registro" : "registros"}` : receivedTotal(charge) ? "Registro demonstrativo" : "Sem registros"}</span></div>{receipts.length ? receipts.map((receipt) => <div className="history-entry" key={receipt.id}><i /><div><strong>{brl.format(receipt.amount)}</strong><span>{formatExpenseDate(receipt.receiptDate)} · {receipt.paymentMethod} · {receipt.financialAccount}</span>{receipt.reference && <small>Referência {receipt.reference}</small>}</div></div>) : receivedTotal(charge) ? <div className="history-entry"><i /><div><strong>{brl.format(receivedTotal(charge))}</strong><span>10 ago 2026 · Baixa manual distribuída por item</span></div></div> : <CompactEmptyState mark="↓" tone="charge" title="Aguardando a primeira baixa" description="Recebimentos parciais ou integrais serão organizados aqui em ordem cronológica." />}</section>
  </div><footer className="drawer-footer charge-drawer-footer charge-detail-footer"><button type="button" className="secondary-button drawer-footer-close" onClick={onClose}>Fechar</button>{charge.status !== "Recebida" && <><button type="button" className="secondary-button negotiation-action-button button-with-icon" onClick={onNegotiate}><Handshake aria-hidden="true" />{negotiation ? "Editar negociação" : "Negociar cobrança"}</button><button type="button" className="primary-button button-with-icon" onClick={onReceipt}><HandCoins aria-hidden="true" />Registrar recebimento</button></>}</footer></aside></div>;
}

function ContractDrawer({ contract, charges, onClose, onCharge }: { contract: Contract; charges: Charge[]; onClose: () => void; onCharge: () => void }) {
  const [startDate, endDate] = contract.period.split(" — ");
  const contractCharges = charges.filter((charge) => charge.contract === contract.id);

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Detalhes do contrato ${contract.id}`}><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer wide-drawer contract-detail-drawer">
    <header className="contract-detail-hero">
      <div className="contract-detail-hero-top"><p className="eyebrow eyebrow-light">Instrumento de locação</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
      <div className="contract-detail-hero-copy"><div><span>{contract.id}</span><b>Contrato ativo</b></div><h2>{contract.tenant}</h2><p>{contract.property} · {contract.portfolio}</p></div>
      <i className="contract-detail-seal" aria-hidden="true"><Check /></i>
    </header>
    <div className="drawer-body">
      <section className="contract-detail-summary" aria-label={`Resumo financeiro de ${contract.id}`}>
        <div className="contract-detail-rent"><span>Aluguel base</span><strong>{brl.format(contract.rent)}</strong><small>valor mensal contratado</small></div>
        <div><span>Vencimento</span><strong>Dia {contract.due}</strong><small>de cada competência</small></div>
        <div><span>Reajuste</span><strong>{contract.adjustment}</strong><small>mês de referência</small></div>
        <div><span>Cobranças</span><strong>{contractCharges.length}</strong><small>competências geradas</small></div>
      </section>
      <section className="contract-period-panel" aria-labelledby="contract-period-title">
        <header><div><span>Vigência contratual</span><h3 id="contract-period-title">Período do acordo</h3></div><b>Em andamento</b></header>
        <div className="contract-period-line"><span><i aria-hidden="true" /><small>Início</small><strong>{startDate}</strong></span><i aria-hidden="true" /><span><i aria-hidden="true" /><small>Término</small><strong>{endDate}</strong></span></div>
      </section>
      <section className="contract-relationships" aria-labelledby="contract-relationships-title">
        <header><div><span>Vínculos do contrato</span><h3 id="contract-relationships-title">Estrutura locada</h3></div><small>{contract.units.length} {contract.units.length === 1 ? "unidade" : "unidades"}</small></header>
        <div className="contract-relationship-main"><span>Imóvel<strong>{contract.property}</strong></span><span>Locatário<strong>{contract.tenant}</strong></span></div>
        <div className="contract-relationship-units">{contract.units.map((unit) => <span key={unit}>{unit}</span>)}</div>
      </section>
      <section className="contract-composition" aria-labelledby="contract-composition-title"><div className="section-title"><h3 id="contract-composition-title">Composição prevista</h3><span>{contract.charges.length} itens</span></div><div>{contract.charges.map((item, index) => <span key={item}><i>{String(index + 1).padStart(2, "0")}</i><strong>{item}</strong></span>)}</div></section>
      <dl className="detail-list registry-detail-list"><div><dt>Finalidade</dt><dd>{contract.purpose || "Não informada"}</dd></div><div><dt>Índice de reajuste</dt><dd>{contract.adjustmentIndex || "Não informado"}{contract.adjustmentPeriod ? ` · ${contract.adjustmentPeriod} meses` : ""}</dd></div><div><dt>Encargos por atraso</dt><dd>{contract.lateFee ?? 0}% de multa · {contract.monthlyInterest ?? 0}% a.m.</dd></div><div><dt>Pagamento</dt><dd>{contract.paymentMethod || "Não definido"} · {contract.paymentReference || "Mês corrente"}</dd></div><div><dt>Garantia</dt><dd>{contract.guaranteeType || "Não informada"}{contract.guaranteeDetails ? ` · ${contract.guaranteeDetails}` : ""}</dd></div><div><dt>Documento</dt><dd>{contract.documentName || "Não anexado"}</dd></div></dl>
      <aside className="contract-edit-policy" aria-label="Política de alteração do contrato"><span aria-hidden="true"><TriangleAlert /></span><div><strong>Contrato ativo não pode ser editado diretamente</strong><p>Para corrigir condições, encerre a vigência atual e cadastre o substituto. Cobranças e histórico permanecem vinculados ao acordo original.</p></div></aside>
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

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Detalhes da despesa ${expense.id}`}><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer wide-drawer expense-detail-drawer">
    <header className={`expense-detail-hero expense-detail-hero-${statusName}`}>
      <div className="expense-detail-hero-top"><p className="eyebrow eyebrow-light">Compromisso financeiro</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes"><X aria-hidden="true" /></button></div>
      <div className="expense-detail-hero-copy"><div><span>{expense.id}</span><ExpenseStatusBadge status={expense.status} /></div><h2>{expense.supplier}</h2><p>{expense.description}</p></div>
      <i className="expense-detail-orbit" aria-hidden="true"><ArrowDownToLine /></i>
    </header>
    <div className="drawer-body">
      <section className="expense-detail-summary" aria-label={`Resumo financeiro de ${expense.id}`}>
        <div className="expense-detail-amount"><span>Valor da despesa</span><strong>{brl.format(expense.amount)}</strong><small>{expense.status === "Pago" ? "compromisso quitado" : "valor a desembolsar"}</small></div>
        <div><span>Categoria</span><strong>{expense.category}</strong><small>classificação financeira</small></div>
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

  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Exportar relatório contábil"><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar exportação" /><form className="receipt-modal report-modal" onSubmit={handleExport}><ModalHeader eyebrow="Relatório contábil" title="Exportar relação de aluguéis" onClose={onClose} /><div className="report-modal-body"><p className="report-intro">Gere uma planilha no mesmo formato do modelo contábil, por carteira ou com todas as carteiras reunidas.</p><InlineFieldError message={exportError || preview.error || noRowsMessage} /><div className="form-grid report-form-grid"><label className="full-field">Escopo do relatório<select value={portfolioScope} onChange={(event) => { setPortfolioScope(event.target.value); setGeneratedDownload(null); setExportError(""); }}><option value={ALL_REPORT_PORTFOLIOS}>Todas as carteiras · relatório geral</option>{portfolioOptions.map((portfolio) => <option value={portfolio.name} key={portfolio.id}>{portfolio.name} · {portfolio.holder}</option>)}</select></label><label>Competência<input type="month" value={competenceInput} onChange={(event) => { setCompetenceInput(event.target.value); setGeneratedDownload(null); setExportError(""); }} required /></label><label>Nome do arquivo<input value={filename} onChange={(event) => { setFilenameOverride(event.target.value); setGeneratedDownload(null); setExportError(""); }} spellCheck={false} required /></label></div>{preview.model && <section className="report-preview" aria-live="polite"><div className="section-title"><h3>Prévia da exportação</h3><span>{preview.model.isGeneral ? "Relatório geral" : "Carteira específica"}</span></div><div className="report-preview-values"><span>Competência<strong>{preview.model.month.toLocaleLowerCase("pt-BR")} de {preview.model.year}</strong></span><span>Locações<strong>{preview.model.rows.length}</strong></span><span>Total de aluguéis<strong>{brl.format(preview.model.total)}</strong></span></div><p><span aria-hidden="true">i</span> Somente o item <strong>Aluguel</strong> entra no relatório. O arquivo é criado e baixado localmente, sem envio de dados.</p></section>}{generatedDownload && <aside className="report-download-ready" role="status"><span aria-hidden="true">✓</span><div><strong>Arquivo gerado com sucesso</strong><p>{generatedDownload.filename}</p></div><a className="secondary-button" href={generatedDownload.objectUrl} download={generatedDownload.filename}>Baixar novamente</a></aside>}</div><footer><button type="button" className="secondary-button" onClick={onClose} disabled={exporting}>{generatedDownload ? "Fechar" : "Cancelar"}</button><button className="primary-button" disabled={exporting || !preview.model || preview.model.rows.length === 0} aria-busy={exporting}>{exporting ? "Gerando planilha…" : generatedDownload ? "Gerar novamente" : "Gerar e baixar .xlsx"}</button></footer></form></div>;
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

  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Negociar cobrança ${charge.id}`}><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar negociação" /><form className="receipt-modal negotiation-modal" noValidate onSubmit={handleSubmit}><ModalHeader eyebrow={negotiation ? "Revisão do acordo" : "Cobrança em aberto"} title={negotiation ? `Editar negociação ${charge.id}` : `Negociar ${charge.id}`} onClose={onClose} /><div className="negotiation-modal-body">
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
    <section className="negotiation-section" aria-labelledby="negotiation-record-title"><div className="negotiation-section-heading"><span aria-hidden="true">03</span><div><h3 id="negotiation-record-title">Contato e formalização</h3><p>Registre com quem o acordo foi tratado e a evidência correspondente.</p></div></div><div className="negotiation-fields-grid"><label>Contato responsável<input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Nome da pessoa que aprovou" /></label><label>Canal do acordo<select value={contactChannel} onChange={(event) => setContactChannel(event.target.value)}><option>WhatsApp</option><option>E-mail</option><option>Telefone</option><option>Presencial</option><option>Portal</option></select></label><label className="full-field">Documento do acordo<input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(event) => setAgreementDocumentName(event.target.files?.[0]?.name ?? "")} /><small>{agreementDocumentName || "Opcional: termo, e-mail ou evidência do aceite."}</small></label></div></section>
    <label className="standalone-label negotiation-notes">Observações<textarea rows={3} maxLength={500} placeholder="Registre condições adicionais ou o histórico do contato." value={notes} onChange={(event) => { setNotes(event.target.value); clearError(); }} /><small>{notes.length}/500 caracteres</small></label>
  </div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={Boolean(termsError)}>{negotiation ? "Salvar alterações" : "Confirmar negociação"}</button></footer></form></div>;
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
  const [reviewing, setReviewing] = useState(false);
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
    setReviewing(false);
  };
  const changeAdjustment = (kind: "discount" | "interest", value: string) => {
    const nextDiscount = kind === "discount" ? Number(value || 0) : discountValue;
    const nextInterest = kind === "interest" ? Number(value || 0) : interestValue;
    if (kind === "discount") setDiscount(value); else setInterest(value);
    const amount = Number(receivedAmount || 0) + nextDiscount - nextInterest;
    setAllocations(receivedAmount === "" || !Number.isFinite(amount) ? pendingItems.map(() => 0) : distributeAmount(amount));
    setReviewing(false);
  };
  const handleReceiptSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canConfirm) return;
    if (!reviewing) {
      setReviewing(true);
      return;
    }
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
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Registrar recebimento"><button className="drawer-backdrop" onClick={onClose} /><form className="receipt-modal allocation-modal" onSubmit={handleReceiptSubmit}><ModalHeader eyebrow="Baixa manual" title="Distribuir recebimento" onClose={onClose} /><div className="receipt-summary"><div><span>Valor da cobrança</span><strong>{brl.format(chargeTotal(charge))}</strong></div><div><span>Já recebido</span><strong>{brl.format(receivedTotal(charge))}</strong></div><div><span>Saldo atual</span><strong>{brl.format(currentBalance)}</strong></div></div><InlineFieldError message={receiptError} />
    <section className="receipt-form-section"><div className="section-title"><h3>Dados do recebimento</h3><span>Informações para conciliação e auditoria</span></div><div className="form-grid"><label>Data do recebimento<input type="date" value={receiptDate} onChange={(event) => { setReceiptDate(event.target.value); setReviewing(false); }} disabled={reviewing} required /></label><label>Data do crédito<input type="date" value={creditDate} onChange={(event) => { setCreditDate(event.target.value); setReviewing(false); }} disabled={reviewing} required /></label><label>Valor recebido<input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0,00" value={receivedAmount} onChange={(event) => changeReceivedAmount(event.target.value)} disabled={reviewing} required /></label><label>Forma de pagamento<select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setReviewing(false); }} disabled={reviewing} required>{PAYMENT_METHOD_OPTIONS.map((method) => <option key={method}>{method}</option>)}</select></label><label>Conta financeira<select value={financialAccount} onChange={(event) => { setFinancialAccount(event.target.value); setReviewing(false); }} disabled={reviewing} required>{FINANCIAL_ACCOUNT_OPTIONS.map((account) => <option key={account}>{account}</option>)}</select></label><label>Identificador / referência<input value={reference} placeholder="NSU, E2E do Pix ou código bancário" onChange={(event) => { setReference(event.target.value); setReviewing(false); }} disabled={reviewing} /></label></div></section>
    <section className="receipt-form-section"><div className="section-title"><h3>Ajustes</h3><span>O valor liquidado será distribuído nos itens</span></div><div className="form-grid"><label>Desconto concedido<input type="number" min="0" step="0.01" value={discount} placeholder="0,00" onChange={(event) => changeAdjustment("discount", event.target.value)} disabled={reviewing} /></label><label>Juros / acréscimo<input type="number" min="0" step="0.01" value={interest} placeholder="0,00" onChange={(event) => changeAdjustment("interest", event.target.value)} disabled={reviewing} /></label></div><div className="receipt-adjustment-total"><span>Valor liquidado na cobrança</span><strong>{brl.format(Number.isFinite(principalToSettle) ? Math.max(0, principalToSettle) : 0)}</strong></div></section>
    <section className="allocation-block"><div className="section-title"><h3>Prévia da distribuição</h3><span>{receivedAmount ? "Revise os valores por item" : "Informe o valor recebido"}</span></div>{pendingItems.map(({ item }, index) => <label className="allocation-row" key={`${item.name}-${index}`}><span><strong>{item.name}</strong><small>Saldo {brl.format(item.amount - item.received)}</small></span><input aria-label={`Valor para ${item.name}`} type="number" min="0" step="0.01" max={item.amount - item.received} placeholder="0,00" value={allocations[index] || ""} disabled={!receivedAmount || reviewing} onChange={(event) => { setAllocations((values) => values.map((value, position) => position === index ? Number(event.target.value) : value)); setReviewing(false); }} /></label>)}<div className="allocation-total"><span>Total distribuído</span><strong>{brl.format(allocationTotal)}</strong></div></section><div className="post-balance"><span>Saldo após esta baixa</span><strong>{brl.format(Math.max(0, currentBalance - allocationTotal))}</strong></div>
    {reviewing && <aside className="receipt-review" role="status"><span aria-hidden="true">✓</span><div><strong>Revise antes de confirmar</strong><p>{brl.format(receivedValue)} recebido via {paymentMethod}, liquidando {brl.format(allocationTotal)} em {allocations.filter((value) => value > 0).length} {allocations.filter((value) => value > 0).length === 1 ? "item" : "itens"}. O saldo ficará em {brl.format(Math.max(0, currentBalance - allocationTotal))}.</p></div></aside>}
    <section className="receipt-form-section"><div className="section-title"><h3>Comprovação e observações</h3><span>Campos complementares</span></div><div className="form-grid"><label>Pagador diferente do locatário<input value={thirdPartyPayer} placeholder="Nome ou documento, se aplicável" onChange={(event) => { setThirdPartyPayer(event.target.value); setReviewing(false); }} disabled={reviewing} /></label><label>Comprovante<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => { setProofName(event.target.files?.[0]?.name ?? ""); setReviewing(false); }} disabled={reviewing} /><small>{proofName || "Opcional"}</small></label><label className="full-field">Observação<textarea placeholder="Ex.: pagamento parcial, complemento..." rows={3} value={note} onChange={(event) => { setNote(event.target.value); setReviewing(false); }} disabled={reviewing} /></label></div></section>
    <footer><button type="button" className="secondary-button" onClick={reviewing ? () => setReviewing(false) : onClose}>{reviewing ? "Voltar e editar" : "Cancelar"}</button><button className="primary-button" disabled={!canConfirm}>{reviewing ? "Confirmar recebimento" : "Revisar distribuição"}</button></footer></form></div>;
}

function ModalHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) { return <header><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header>; }
function ModalFooter({ onClose, action, pending = false, disabled = false, disabledReason }: { onClose: () => void; action: string; pending?: boolean; disabled?: boolean; disabledReason?: string }) { return <footer className="entity-form-footer"><div><span aria-hidden="true"><Check /></span><p><strong>Cadastro protegido</strong><small>Os campos obrigatórios são validados antes de salvar.</small></p></div><button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button><button className="primary-button button-with-icon" disabled={pending || disabled} aria-busy={pending} title={disabled ? disabledReason : undefined}>{pending ? <><span className="spinner button-spinner" aria-hidden="true" />Salvando…</> : <><CircleCheck aria-hidden="true" />{action}</>}</button></footer>; }

function EntityFormSection({ index, title, description, children, className = "" }: { index: string; title: string; description: string; children: ReactNode; className?: string }) {
  return <section className={`entity-form-section full-field ${className}`}><header><span>{index}</span><div><h3>{title}</h3><p>{description}</p></div></header><div className="entity-form-section-fields">{children}</div></section>;
}

function EntityForm({ kind, portfolio, property, unit, tenant, documents: initialDocuments = [], categorizedDocuments: initialCategorizedDocuments = createEmptyCategorizedDocuments(), chargeSourceContract, portfolioOptions, propertyOptions, unitOptions, tenantOptions, contractOptions, chargeOptions, onClose, onSave }: { kind: Exclude<FormKind, null>; portfolio?: Portfolio | null; property?: Property | null; unit?: Unit | null; tenant?: Tenant | null; documents?: LocalDocument[]; categorizedDocuments?: CategorizedDocuments; chargeSourceContract?: Contract | null; portfolioOptions: Portfolio[]; propertyOptions: Property[]; unitOptions: Unit[]; tenantOptions: Tenant[]; contractOptions: Contract[]; chargeOptions: Charge[]; onClose: () => void; onSave: (data: FormData, documents?: FormDocuments) => void }) {
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
  const contractProperties = propertyOptions.filter((record) => record.portfolio === contractPortfolio);
  const contractUnits = unitOptions.filter((record) => record.property === contractProperty && !record.occupied);
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
  const confirmChargeItemsReplacement = (source: "contrato" | "competência") => !chargeItemsDirty || window.confirm(`Os itens desta cobrança foram alterados. Deseja substituí-los ao mudar ${source === "contrato" ? "o contrato" : "a competência"}?`);
  const changeChargeContract = (nextContractId: string) => {
    if (nextContractId === chargeContractId || !confirmChargeItemsReplacement("contrato")) return;
    const nextContract = contractOptions.find((contract) => contract.id === nextContractId);
    if (!nextContract) return;
    setChargeContractId(nextContractId);
    setChargeItems(buildChargeItemsFromContract(nextContract, chargeCompetence));
    setChargeItemsDirty(false);
  };
  const changeChargeCompetence = (nextCompetence: string) => {
    if (nextCompetence === chargeCompetence || !confirmChargeItemsReplacement("competência")) return;
    const selectedContract = contractOptions.find((contract) => contract.id === chargeContractId);
    setChargeCompetence(nextCompetence);
    if (selectedContract) setChargeItems(buildChargeItemsFromContract(selectedContract, nextCompetence));
    setChargeItemsDirty(false);
  };
  const getTenantDocumentError = (value: string, type: Tenant["type"]) => {
    if (tenant && documentDigits(value) === documentDigits(tenant.document)) return "";
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
      data.set("contractRulesJson", JSON.stringify(contractRules));
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
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={config[1]}><button className="drawer-backdrop" onClick={closeForm} aria-label="Fechar formulário" /><form className={`receipt-modal entity-modal entity-${kind}-modal`} noValidate onSubmit={handleSubmit} onInputCapture={clearFieldError}><header className="entity-form-hero"><span className="entity-form-mark" aria-hidden="true">{presentation.mark}</span><div><p>{presentation.label}</p><h2>{config[1]}</h2><span>{presentation.description}</span></div><b>{portfolio || property || unit || tenant ? "Modo de edição" : "Novo cadastro"}</b><button type="button" className="close-button" onClick={closeForm} aria-label="Fechar formulário"><X aria-hidden="true" /></button></header><div className="entity-modal-body"><InlineFieldError message={formError || chargeBusinessError} /><div className="form-grid entity-grid">
    {kind === "portfolio" && <>
      <EntityFormSection index="01" title="Identificação da carteira" description="Defina como esta estrutura será reconhecida no sistema."><label className="full-field">Nome da carteira<input name="portfolioName" placeholder="Ex.: Carteira Atlas" defaultValue={portfolio?.name ?? ""} required /></label></EntityFormSection>
      <EntityFormSection index="02" title="Titularidade" description="Associe a pessoa ou empresa responsável pela carteira."><label>Tipo de titular<select value={portfolioOwnerType} onChange={(event) => { const type = event.target.value as Tenant["type"]; setPortfolioOwnerType(type); setPortfolioDocument(maskTenantDocument(portfolioDocument, type)); }}><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></label><label>Titular<input name="portfolioHolder" list="portfolio-holder-options" placeholder="Razão social ou nome" defaultValue={portfolio?.holder ?? ""} required /><datalist id="portfolio-holder-options">{Array.from(new Set(portfolioOptions.map((record) => record.holder))).map((holder) => <option value={holder} key={holder} />)}</datalist></label><label className="full-field">{portfolioOwnerType === "PJ" ? "CNPJ" : "CPF"} do titular<input name="portfolioDocument" inputMode="numeric" value={portfolioDocument} onChange={(event) => setPortfolioDocument(maskTenantDocument(event.target.value, portfolioOwnerType))} placeholder={portfolioOwnerType === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} required /></label></EntityFormSection>
      <EntityFormSection index="03" title="Administração" description="Registre responsabilidade e contexto sem burocratizar o cadastro."><label>Gestor responsável<select name="portfolioManager" defaultValue={portfolio?.manager ?? ""}><option value="">Não definido</option>{MANAGER_OPTIONS.map((manager) => <option key={manager}>{manager}</option>)}</select></label><label className="full-field">Descrição<textarea name="portfolioDescription" rows={2} placeholder="Objetivo e escopo desta carteira" defaultValue={portfolio?.description ?? ""} /></label><label className="full-field">Observações internas<textarea name="portfolioNotes" rows={3} defaultValue={portfolio?.notes ?? ""} /></label></EntityFormSection>
    </>}
    {kind === "property" && <>
      <EntityFormSection index="01" title="Identificação do imóvel" description="Vincule o empreendimento à carteira e classifique o ativo."><label>Carteira<select name="propertyPortfolio" defaultValue={property?.portfolio ?? portfolioOptions[0]?.name} required>{portfolioOptions.map((option) => <option key={option.id}>{option.name}</option>)}</select></label><label>Tipo de empreendimento<select name="propertyType" defaultValue={property?.propertyType ?? "Edifício comercial"} required>{PROPERTY_TYPE_OPTIONS.map((type) => <option key={type}>{type}</option>)}</select></label><label className="full-field">Nome do imóvel<input name="propertyName" placeholder="Ex.: Centro Empresarial Nexo" defaultValue={property?.name ?? ""} required /></label></EntityFormSection>
      <EntityFormSection index="02" title="Localização" description="Use dados estruturados para pesquisas, documentos e relatórios."><label>CEP<input name="propertyCep" inputMode="numeric" placeholder="00000-000" defaultValue={property?.cep ?? ""} required /></label><label>Logradouro<input name="propertyStreet" placeholder="Rua, avenida ou rodovia" defaultValue={property?.street ?? property?.address ?? ""} required /></label><label>Número<input name="propertyNumber" placeholder="Número ou S/N" defaultValue={property?.number ?? ""} required /></label><label>Complemento<input name="propertyComplement" placeholder="Torre, bloco ou referência" defaultValue={property?.complement ?? ""} /></label><label>Bairro<input name="propertyDistrict" defaultValue={property?.district ?? ""} required /></label><label>Cidade<input name="propertyCity" defaultValue={property?.city ?? ""} required /></label><label>UF<input name="propertyState" maxLength={2} placeholder="MG" defaultValue={property?.state ?? ""} required /></label></EntityFormSection>
      <EntityFormSection index="03" title="Dados registrais e administração" description="Mantenha referências úteis para tributos e documentação."><label>Inscrição imobiliária / IPTU<input name="propertyMunicipalRegistration" defaultValue={property?.municipalRegistration ?? ""} /></label><label>Matrícula<input name="propertyRegistryNumber" defaultValue={property?.registryNumber ?? ""} /></label><label>Cartório de registro<input name="propertyRegistryOffice" defaultValue={property?.registryOffice ?? ""} /></label><label>Gestor responsável<select name="propertyManager" defaultValue={property?.manager ?? ""}><option value="">Não definido</option>{MANAGER_OPTIONS.map((manager) => <option key={manager}>{manager}</option>)}</select></label><label className="full-field">Observações<textarea name="propertyNotes" rows={3} defaultValue={property?.notes ?? ""} /></label></EntityFormSection>
    </>}
    {kind === "unit" && <>
      <EntityFormSection index="01" title="Vínculo e identificação" description="A unidade nasce disponível; a ocupação será definida por contrato ativo."><label>Imóvel<select name="unitProperty" defaultValue={unit?.property ?? propertyOptions[0]?.name} required>{propertyOptions.map((option) => <option key={option.id}>{option.name}</option>)}</select></label><label>Tipo de unidade<select name="unitType" defaultValue={unit?.unitType ?? "Sala comercial"} required>{UNIT_TYPE_OPTIONS.map((type) => <option key={type}>{type}</option>)}</select></label><label>Código / número<input name="unitCode" placeholder="Ex.: 101, A, Loja 04" defaultValue={unit?.code ?? unit?.name.replace(/^(Sala|Loja|Galpão|Box|Apartamento)\s+/i, "") ?? ""} required /></label><label>Bloco / torre / setor<input name="unitBlock" defaultValue={unit?.block ?? ""} /></label><label>Pavimento<input name="unitFloor" defaultValue={unit?.floor ?? ""} /></label></EntityFormSection>
      <EntityFormSection index="02" title="Características cadastrais" description="Registre apenas as medidas e referências que serão usadas na operação."><label>Área privativa<span className="input-with-suffix"><input name="unitArea" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={unit?.area ?? ""} required /><span className="input-suffix">m²</span></span></label><label>Área total<span className="input-with-suffix"><input name="unitTotalArea" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={unit?.totalArea ?? ""} /><span className="input-suffix">m²</span></span></label><label>Inscrição imobiliária própria<input name="unitMunicipalRegistration" defaultValue={unit?.municipalRegistration ?? ""} /></label><label className="full-field">Observações<textarea name="unitNotes" rows={3} defaultValue={unit?.notes ?? ""} /></label>{unit?.occupied && <p className="form-help full-field">Esta unidade está ocupada por contrato ativo. O vínculo não pode ser alterado por este cadastro.</p>}</EntityFormSection>
    </>}
    {kind === "tenant" && <>
      <EntityFormSection index="01" title="Identificação do locatário" description="Registre a pessoa ou empresa sem coletar dados pessoais excessivos."><label>Tipo de pessoa<select name="tenantType" value={tenantType} onChange={(event) => { const nextType = event.target.value as Tenant["type"]; setTenantType(nextType); setTenantDocument(maskTenantDocument(tenantDocument, nextType)); setTenantDocumentError(""); }} required><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></label><label>{tenantType === "PJ" ? "Razão social" : "Nome completo"}<input name="tenantName" defaultValue={tenant?.name ?? ""} required /></label>{tenantType === "PJ" && <label>Nome fantasia<input name="tenantTradeName" defaultValue={tenant?.tradeName ?? ""} /></label>}<label>{tenantType === "PJ" ? "CNPJ" : "CPF"}<input name="tenantDocument" inputMode="numeric" maxLength={tenantType === "PJ" ? 18 : 14} value={tenantDocument} onChange={(event) => { const masked = maskTenantDocument(event.target.value, tenantType); setTenantDocument(masked); setTenantDocumentError(""); }} onBlur={() => tenantDocument && setTenantDocumentError(getTenantDocumentError(tenantDocument, tenantType))} aria-invalid={tenantDocumentError ? "true" : undefined} required /><small className={tenantDocumentError ? "field-error" : "field-help"}>{tenantDocumentError || "O documento será validado e verificado contra duplicidades."}</small></label></EntityFormSection>
      <EntityFormSection index="02" title="Contato" description="É necessário informar ao menos um canal para comunicação e cobrança.">{tenantType === "PJ" && <label>Pessoa de contato<input name="tenantContactName" defaultValue={tenant?.contactName ?? ""} /></label>}<label>Telefone / WhatsApp<input name="tenantPhone" type="tel" placeholder="(31) 99999-9999" defaultValue={tenant?.phone ?? ""} /></label><label>E-mail<input name="tenantEmail" type="email" placeholder="financeiro@empresa.com.br" defaultValue={tenant?.email ?? ""} /></label><label>Canal preferencial<select name="tenantPreferredChannel" defaultValue={tenant?.preferredChannel ?? "E-mail"}><option>E-mail</option><option>WhatsApp</option><option>Telefone</option><option>Correspondência</option></select></label></EntityFormSection>
      <EntityFormSection index="03" title="Endereço de cobrança" description="Preencha quando houver faturamento, correspondência ou comunicação formal."><label>CEP<input name="tenantBillingCep" inputMode="numeric" placeholder="00000-000" /></label><label>Logradouro<input name="tenantBillingStreet" /></label><label>Número<input name="tenantBillingNumber" /></label><label>Complemento<input name="tenantBillingComplement" /></label><label>Bairro<input name="tenantBillingDistrict" /></label><label>Cidade<input name="tenantBillingCity" /></label><label>UF<input name="tenantBillingState" maxLength={2} /></label>{tenantType === "PJ" && <label>Inscrição municipal<input name="tenantMunicipalRegistration" defaultValue={tenant?.municipalRegistration ?? ""} /></label>}<label className="full-field">Observações internas<textarea name="tenantNotes" rows={3} defaultValue={tenant?.notes ?? ""} /></label></EntityFormSection>
    </>}
    {supportsDocumentTopics && <CategorizedDocumentManager documents={categorizedDocuments} onChange={setCategorizedDocuments} onRemove={handleDocumentRemoval} />}
    {(kind === "tenant" || kind === "unit") && <DocumentManager title={kind === "unit" ? "Documentos da unidade" : "Documentos do locatário"} description={kind === "unit" ? "Fotos, plantas, vistorias e manutenções específicas desta unidade." : "Anexe somente documentos necessários ao relacionamento e ao contrato."} documents={documents} onChange={setDocuments} onRemove={handleDocumentRemoval} />}
    {kind === "expense" && <>
      <EntityFormSection index="01" title="Origem e classificação" description="Vincule a obrigação a um fornecedor e a uma classificação consistente."><label>Fornecedor / beneficiário<input name="expenseSupplier" list="expense-supplier-options" placeholder="Busque ou informe o fornecedor" required /><datalist id="expense-supplier-options">{Array.from(new Set(expenses.map((expense) => expense.supplier))).map((supplier) => <option value={supplier} key={supplier} />)}</datalist></label><label>Categoria<select name="expenseCategory" required>{EXPENSE_CATEGORY_OPTIONS.map((category) => <option key={category}>{category}</option>)}</select></label><label className="full-field">Descrição<input name="expenseDescription" placeholder="Origem ou finalidade da despesa" required /></label><label>Alocação<select name="expenseAllocationType" value={expenseAllocationType} onChange={(event) => setExpenseAllocationType(event.target.value)}><option>Geral da operação</option><option>Carteira</option><option>Imóvel</option><option>Unidade</option><option>Contrato</option></select></label>{expenseAllocationOptions.length > 0 && <label>Registro vinculado<select name="expenseAllocationId" required><option value="" disabled>Selecione</option>{expenseAllocationOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}</EntityFormSection>
      <EntityFormSection index="02" title="Condições financeiras" description="Competência e vencimento são controles diferentes."><label>Valor<input name="expenseAmount" type="number" inputMode="decimal" min="0.01" step="0.01" required /></label><label>Competência<input name="expenseCompetence" type="month" defaultValue="2026-08" required /></label><label>Data de vencimento<input name="expenseDueDate" type="date" required /></label><label>Previsão de pagamento<input name="expensePlannedDate" type="date" /></label><label>Tipo de lançamento<select name="expenseEntryType" value={expenseEntryType} onChange={(event) => setExpenseEntryType(event.target.value)}><option>Única</option><option>Parcelada</option><option>Recorrente</option></select></label>{expenseEntryType !== "Única" && <label>{expenseEntryType === "Parcelada" ? "Quantidade de parcelas" : "Periodicidade"}<input name="expenseRecurrence" type={expenseEntryType === "Parcelada" ? "number" : "text"} min={expenseEntryType === "Parcelada" ? 2 : undefined} placeholder={expenseEntryType === "Parcelada" ? "Ex.: 6" : "Ex.: Mensal"} required /></label>}</EntityFormSection>
      <EntityFormSection index="03" title="Documento e pagamento" description="Guarde referências para auditoria e revele a baixa somente quando necessário."><label>Tipo de documento<select name="expenseDocumentType"><option value="">Não informado</option>{DOCUMENT_TYPE_OPTIONS.map((type) => <option key={type}>{type}</option>)}</select></label><label>Número do documento<input name="expenseDocumentNumber" /></label><label>Data de emissão<input name="expenseIssueDate" type="date" /></label><label>Anexo<input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={(event) => setExpenseAttachmentName(event.target.files?.[0]?.name ?? "")} /><small>{expenseAttachmentName || "Nota, guia, boleto ou contrato relacionado."}</small></label><label className="full-field check-inline"><input name="expenseAlreadyPaid" type="checkbox" checked={expenseAlreadyPaid} onChange={(event) => setExpenseAlreadyPaid(event.target.checked)} />Esta despesa já foi paga</label>{expenseAlreadyPaid && <><label>Data do pagamento<input name="expensePaidDate" type="date" defaultValue={DEMO_DATE_ISO} required /></label><label>Forma de pagamento<select name="expensePaymentMethod" required>{PAYMENT_METHOD_OPTIONS.map((method) => <option key={method}>{method}</option>)}</select></label><label>Conta financeira<select name="expenseFinancialAccount" required>{FINANCIAL_ACCOUNT_OPTIONS.map((account) => <option key={account}>{account}</option>)}</select></label></>}<label className="full-field">Observações<textarea name="expenseNotes" rows={3} /></label><p className="form-help full-field">O status será calculado pela data de vencimento e pelas baixas registradas.</p></EntityFormSection>
    </>}
    {kind === "contract" && <>
      <section className="contract-form-section full-field" aria-labelledby="contract-links-title">
        <header className="contract-section-heading"><span>01</span><div><h3 id="contract-links-title">Vínculos</h3><p>Escolha a estrutura e o locatário deste contrato.</p></div></header>
        <div className="contract-section-grid">
          <label>Carteira<select name="contractPortfolio" value={contractPortfolio} onChange={(event) => { setContractPortfolio(event.target.value); setContractProperty(""); setSelectedUnits([]); setFormError(""); }} required>{portfolioOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
          <label>Imóvel<select name="contractProperty" value={contractProperty} onChange={(event) => { setContractProperty(event.target.value); setSelectedUnits([]); setFormError(""); }} required><option value="" disabled>Selecione o imóvel</option>{contractProperties.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
          <fieldset className="full-field check-field" aria-describedby="contract-units-help"><legend>Unidades vinculadas</legend>{contractUnits.map((option) => <label key={option.id}><input type="checkbox" name="contractUnits" value={option.id} checked={selectedUnits.includes(option.id)} onChange={() => toggleUnit(option.id)} />{option.name}</label>)}<p className="selection-hint" id="contract-units-help">{!contractProperty ? "Selecione um imóvel para ver suas unidades disponíveis." : contractUnits.length === 0 ? "Nenhuma unidade disponível ou elegível para este imóvel." : `${contractUnits.length} unidade${contractUnits.length === 1 ? " disponível" : "s disponíveis"} para o imóvel selecionado.`}</p></fieldset>
          <label>Locatário<select name="contractTenant" defaultValue="" required><option value="" disabled>Selecione o locatário</option>{tenantOptions.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.document}</option>)}</select></label>
          <label>Finalidade<select name="contractPurpose" defaultValue="Comercial"><option>Comercial</option><option>Residencial</option><option>Industrial</option><option>Mista</option><option>Outra</option></select></label>
        </div>
      </section>
      <section className="contract-form-section full-field" aria-labelledby="contract-terms-title">
        <header className="contract-section-heading"><span>02</span><div><h3 id="contract-terms-title">Vigência</h3><p>Defina as datas que controlam ocupação, validade e primeira cobrança.</p></div></header>
        <div className="contract-section-grid">
          <label>Início da vigência<input name="contractStart" type="date" value={contractStart} onChange={(event) => setContractStart(event.target.value)} required /></label>
          <label>Fim da vigência<input name="contractEnd" type="date" min={contractStart || undefined} required /></label>
          <label>Data de ocupação<input name="contractOccupancyDate" type="date" /></label>
          <label>Data de assinatura<input name="contractSignatureDate" type="date" /></label>
          <label className="full-field">Primeira cobrança<select name="contractFirstChargeRule" defaultValue="Proporcional desde a ocupação"><option>Proporcional desde a ocupação</option><option>Mês integral da vigência</option><option>Competência seguinte</option><option>Definida manualmente</option></select></label>
        </div>
      </section>
      <EntityFormSection index="03" title="Condições financeiras" description="Centralize as regras usadas na geração e comunicação das cobranças.">
        <label>Aluguel base<input name="contractRent" type="number" inputMode="decimal" min="0.01" step="0.01" required /></label>
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
        <div className="repeatable-block"><div className="section-title"><h3>Itens previstos</h3><button type="button" className="text-button" onClick={addContractRule}>+ Adicionar item</button></div>{contractRules.map((item, index) => <div className="contract-rule-row" key={`${item.name}-${index}`}>
          <label>Categoria<input value={item.name} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, name: event.target.value } : value))} required /></label>
          <label>Responsável<select value={item.responsibility} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, responsibility: event.target.value } : value))}><option>Locatário</option><option>Locador</option><option>Compartilhado</option></select></label>
          <label>Cálculo<select value={item.calculation} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, calculation: event.target.value } : value))}><option>Valor fixo</option><option>Valor variável</option><option>Percentual</option><option>Conforme documento</option></select></label>
          <label>Valor / percentual<input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, amount: Number(event.target.value) } : value))} disabled={item.name === "Aluguel" || item.calculation === "Valor variável" || item.calculation === "Conforme documento"} /></label>
          <label>Vencimento<select value={item.dueRule} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, dueRule: event.target.value } : value))}><option>Mesmo dia do aluguel</option><option>Conforme documento</option><option>Último dia útil</option><option>Definido na cobrança</option></select></label>
          <label>Recorrência<select value={item.recurrence} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, recurrence: event.target.value } : value))}><option>Mensal</option><option>Anual</option><option>Única</option><option>Eventual</option></select></label>
          <label className="check-inline"><input type="checkbox" checked={item.proofRequired} onChange={(event) => setContractRules((items) => items.map((value, position) => position === index ? { ...value, proofRequired: event.target.checked } : value))} />Exigir comprovante</label>
          <button type="button" className="remove-button" onClick={() => setContractRules((items) => items.filter((_, position) => position !== index))} disabled={contractRules.length === 1}>Remover</button>
        </div>)}</div>
        <p className="form-help">Salvar o contrato define as regras, mas não cria cobranças automaticamente.</p>
      </section>
      <EntityFormSection index="06" title="Garantia" description="Solicite detalhes apenas quando houver uma modalidade de garantia.">
        <label>Modalidade<select name="contractGuaranteeType" value={contractGuaranteeType} onChange={(event) => setContractGuaranteeType(event.target.value)}><option>Sem garantia</option><option>Caução</option><option>Fiador</option><option>Seguro-fiança</option><option>Título de capitalização</option><option>Outra</option></select></label>
        {contractGuaranteeType !== "Sem garantia" && <label className="full-field">Detalhes da garantia<textarea name="contractGuaranteeDetails" rows={3} placeholder="Valor, garantidor, validade ou referência da apólice" required /></label>}
      </EntityFormSection>
      <EntityFormSection index="07" title="Documento e observações" description="Mantenha a referência do instrumento assinado junto ao cadastro.">
        <label className="full-field">Contrato assinado<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => setContractDocumentName(event.target.files?.[0]?.name ?? "")} /><small>{contractDocumentName || "PDF ou imagem do instrumento contratual."}</small></label>
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
          <label className="charge-item-proof">Documento de suporte<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => { const supportDocumentName = event.target.files?.[0]?.name ?? ""; setChargeItems((items) => items.map((value, position) => position === index ? { ...value, supportDocumentName } : value)); setChargeItemsDirty(true); }} /><small>{item.supportDocumentName || "Opcional para itens variáveis."}</small></label>
          <button type="button" className="remove-button" onClick={() => { setChargeItems((items) => items.filter((_, position) => position !== index)); setChargeItemsDirty(true); }}>Remover</button>
        </div>)}
        <div className="builder-total"><span>Total previsto</span><strong>{brl.format(chargeItems.reduce((sum, item) => sum + item.amount, 0))}</strong></div>
      </div><p className="form-help">Os vencimentos podem ficar fora do mês de competência quando a regra contratual exigir, como no pagamento em mês vencido.</p></section>
    </>}
  </div></div><ModalFooter onClose={closeForm} action={config[2]} pending={saving} disabled={kind === "charge" && Boolean(chargeBusinessError)} disabledReason={chargeBusinessError} /></form></div>;
}
