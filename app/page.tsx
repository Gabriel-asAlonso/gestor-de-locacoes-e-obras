"use client";

import type { CSSProperties, ReactNode } from "react";
import { createContext, FormEvent, useContext, useEffect, useMemo, useRef, useState } from "react";
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

type Status = "Vencida" | "Em aberto" | "Próxima" | "Parcial" | "Negociada" | "Recebida";
type ExpenseStatus = "Pendente" | "Pago" | "Vencido";
type Page = "Visão geral" | "Carteiras" | "Imóveis" | "Unidades" | "Locatários" | "Contratos" | "Cobranças" | "Despesas";
type FormKind = "portfolio" | "property" | "unit" | "tenant" | "contract" | "charge" | "expense" | null;
type ContentState = "ready" | "loading" | "error";
type ToastMessage = { message: string; reference: string } | null;
type FormDocuments = LocalDocument[] | CategorizedDocuments;
type Portfolio = { id: string; name: string; holder: string; document: string; properties: number; units: number };
type Property = { id: string; portfolio: string; name: string; address: string; units: number };
type Unit = { id: string; property: string; portfolio: string; name: string; area: number; occupied: boolean };
type Tenant = { id: string; type: "PJ" | "PF"; name: string; document: string; contracts: number };
type RegistryDetail = { kind: "property"; record: Property } | { kind: "unit"; record: Unit } | { kind: "tenant"; record: Tenant };
const FilterStateContext = createContext(false);
type ChargeItem = { name: string; dueDate: string; amount: number; received: number };
type ChargeDraftItem = { name: string; due: string; amount: number };
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

function contractDueDate(competence: string, dueDay: number) {
  const [year, month] = competence.split("-").map(Number);
  if (!year || !month) return "";
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(dueDay, lastDay)).padStart(2, "0")}`;
}

function buildChargeItemsFromContract(contract: Contract, competence: string): ChargeDraftItem[] {
  return contract.charges.map((name) => {
    const previousCharge = charges.find((charge) => charge.contract === contract.id && charge.items.some((item) => item.name === name));
    const previousAmount = previousCharge?.items.find((item) => item.name === name)?.amount;
    return {
      name,
      due: contractDueDate(competence, contract.due),
      amount: name === "Aluguel" ? contract.rent : previousAmount ?? 0,
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

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const expenseMonths = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const formatExpenseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${expenseMonths[month - 1]} ${year}`;
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
  const [chargeRecords, setChargeRecords] = useState<Charge[]>(charges);
  const [negotiationsByCharge, setNegotiationsByCharge] = useState<Record<string, ChargeNegotiation>>({});
  const [documentsByOwner, setDocumentsByOwner] = useState<Record<string, LocalDocument[]>>({});
  const documentsByOwnerRef = useRef(documentsByOwner);
  const [categorizedDocumentsByOwner, setCategorizedDocumentsByOwner] = useState<Record<string, CategorizedDocuments>>({});
  const categorizedDocumentsByOwnerRef = useRef(categorizedDocumentsByOwner);
  const [expenseRecords, setExpenseRecords] = useState<Expense[]>(expenses);
  const [toast, setToast] = useState<ToastMessage>(null);
  const [contentState, setContentState] = useState<ContentState>("ready");
  const [online, setOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => { documentsByOwnerRef.current = documentsByOwner; }, [documentsByOwner]);
  useEffect(() => { categorizedDocumentsByOwnerRef.current = categorizedDocumentsByOwner; }, [categorizedDocumentsByOwner]);
  useEffect(() => () => revokeDocumentUrls(Object.values(documentsByOwnerRef.current).flat()), []);
  useEffect(() => () => revokeDocumentUrls(Object.values(categorizedDocumentsByOwnerRef.current).flatMap(flattenCategorizedDocuments)), []);

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
    setToast({ message, reference });
    window.setTimeout(() => setToast(null), 4200);
  };
  const changePage = (next: Page) => {
    if (next !== page) setContentState("loading");
    setPage(next);
    setSearch("");
    setPortfolioFilter("Todas as carteiras");
    setStatusFilter("Todas");
    setCategoryFilter("Todas as categorias");
    setMenuOpen(false);
    setSidebarCollapsed(true);
    if (next !== page) window.setTimeout(() => setContentState(navigator.onLine ? "ready" : "error"), 450);
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
  const saveReceipt = (event: FormEvent) => {
    event.preventDefault();
    setReceiptOpen(false);
    setSelectedCharge(null);
    notify("Recebimento registrado e distribuído entre os itens.", selectedCharge?.id ?? "COB-DEMO");
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
    const references: Record<Exclude<FormKind, null>, string> = {
      portfolio: "CAR-DEMO-003", property: "IMO-DEMO-005", unit: "UNI-DEMO-008",
      tenant: "LOC-DEMO-022", contract: "CTR-DEMO-022", charge: "COB-DEMO-0089", expense: "PAG-DEMO",
    };
    let savedReference = form ? references[form] : "REG-DEMO";
    let message = "Cadastro salvo neste ambiente demonstrativo.";
    if (form === "portfolio") {
      const values = {
        name: String(data.get("portfolioName") ?? ""),
        holder: String(data.get("portfolioHolder") ?? ""),
        document: String(data.get("portfolioDocument") ?? ""),
      };
      if (editingPortfolio) {
        savedReference = editingPortfolio.id;
        setPortfolioRecords((records) => records.map((record) => record.id === editingPortfolio.id ? { ...record, ...values } : record));
        message = "Carteira atualizada neste ambiente demonstrativo.";
      } else {
        setPortfolioRecords((records) => [...records, { id: savedReference, ...values, properties: 0, units: 0 }]);
        message = "Carteira criada neste ambiente demonstrativo.";
      }
    } else if (form === "property") {
      const values = {
        portfolio: String(data.get("propertyPortfolio") ?? ""),
        name: String(data.get("propertyName") ?? ""),
        address: String(data.get("propertyAddress") ?? ""),
      };
      if (editingProperty) {
        savedReference = editingProperty.id;
        setPropertyRecords((records) => records.map((record) => record.id === editingProperty.id ? { ...record, ...values } : record));
        message = "Imóvel atualizado neste ambiente demonstrativo.";
      } else {
        setPropertyRecords((records) => [...records, { id: savedReference, ...values, units: 0 }]);
        message = "Imóvel criado neste ambiente demonstrativo.";
      }
    } else if (form === "unit") {
      const unitProperty = String(data.get("unitProperty") ?? "");
      const selectedProperty = propertyRecords.find((record) => record.name === unitProperty);
      const values = {
        property: unitProperty,
        portfolio: selectedProperty?.portfolio ?? editingUnit?.portfolio ?? portfolios[0].name,
        name: String(data.get("unitName") ?? ""),
        area: Number(data.get("unitArea")),
        occupied: editingUnit?.occupied || data.get("unitStatus") === "Ocupada",
      };
      if (editingUnit) {
        savedReference = editingUnit.id;
        setUnitRecords((records) => records.map((record) => record.id === editingUnit.id ? { ...record, ...values } : record));
        message = "Unidade atualizada neste ambiente demonstrativo.";
      } else {
        setUnitRecords((records) => [...records, { id: savedReference, ...values }]);
        message = "Unidade criada neste ambiente demonstrativo.";
      }
    } else if (form === "tenant") {
      const values = {
        type: String(data.get("tenantType") ?? "PJ") as Tenant["type"],
        name: String(data.get("tenantName") ?? ""),
        document: String(data.get("tenantDocument") ?? ""),
      };
      if (editingTenant) {
        savedReference = editingTenant.id;
        setTenantRecords((records) => records.map((record) => record.id === editingTenant.id ? { ...record, ...values } : record));
        message = "Locatário atualizado neste ambiente demonstrativo.";
      } else {
        setTenantRecords((records) => [...records, { id: savedReference, ...values, contracts: 0 }]);
        message = "Locatário criado neste ambiente demonstrativo.";
      }
    } else if (form === "expense") {
      const nextNumber = expenseRecords.reduce((largest, record) => Math.max(largest, Number(record.id.match(/\d+/)?.[0] ?? 0)), 0) + 1;
      savedReference = `PAG-${String(nextNumber).padStart(4, "0")}`;
      const dueIso = String(data.get("expenseDueDate") ?? "");
      const status = String(data.get("expenseStatus") ?? "Pendente") as ExpenseStatus;
      const paidIso = String(data.get("expensePaidDate") ?? "");
      setExpenseRecords((records) => [...records, {
        id: savedReference,
        supplier: String(data.get("expenseSupplier") ?? ""),
        description: String(data.get("expenseDescription") ?? ""),
        category: String(data.get("expenseCategory") ?? ""),
        amount: Number(data.get("expenseAmount")),
        dueDate: formatExpenseDate(dueIso),
        dueIso,
        paidDate: status === "Pago" && paidIso ? formatExpenseDate(paidIso) : null,
        status,
      }]);
      message = "Despesa cadastrada neste ambiente demonstrativo.";
    }
    if (documents && Array.isArray(documents) && form === "tenant") {
      setDocumentsByOwner((current) => {
        const retainedIds = new Set(documents.map((document) => document.id));
        revokeDocumentUrls((current[savedReference] ?? []).filter((document) => !retainedIds.has(document.id)));
        return { ...current, [savedReference]: documents };
      });
    } else if (documents && !Array.isArray(documents) && (form === "property" || form === "unit")) {
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
    <Sidebar page={page} attentionCount={chargeAttentionCount} onNavigate={changePage} onLogout={() => setAuthenticated(false)} open={menuOpen} onClose={() => setMenuOpen(false)} collapsed={sidebarCollapsed} onExpand={() => setSidebarCollapsed(false)} />
    <section className="workspace" onClick={() => !sidebarCollapsed && setSidebarCollapsed(true)}>
      <header className="topbar">
        <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir navegação">☰</button>
        <div><span className="breadcrumb">Módulo 1 /</span> {page}</div>
        <div className="topbar-context"><span className="context-dot" /> Dados fictícios</div>
      </header>
      <div className="content">
        {!online && <ConnectionBanner onRetry={retryContent} />}
        {contentState === "loading" && <AuthenticatedPageSkeleton />}
        {contentState === "error" && <SystemError onRetry={retryContent} />}
        {contentState === "ready" && <FilterStateContext.Provider value={Boolean(search || portfolioFilter !== "Todas as carteiras" || statusFilter !== "Todas" || categoryFilter !== "Todas as categorias")}><>
          {page === "Visão geral" && <DashboardPage charges={chargeRecords} negotiations={negotiationsByCharge} expenses={expenseRecords} properties={propertyRecords} units={unitRecords} contracts={contracts} onNavigate={(next, status) => { changePage(next); if (status) setStatusFilter(status); }} />}
          {page === "Cobranças" && <ChargesPage charges={filteredCharges} summaryCharges={chargesInScope} negotiations={negotiationsByCharge} total={chargeRecords.length} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onOpen={setSelectedCharge} onNew={() => { setChargeSourceContract(null); setForm("charge"); }} onReport={() => setReportOpen(true)} />}
          {page === "Carteiras" && <PortfoliosPage portfolios={portfolioRecords} properties={propertyRecords} units={unitRecords} search={search} setSearch={setSearch} onNew={() => { setEditingPortfolio(null); setForm("portfolio"); }} onEdit={(portfolio) => { setEditingPortfolio(portfolio); setForm("portfolio"); }} />}
          {page === "Imóveis" && <PropertiesPage properties={propertyRecords} units={unitRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => { setEditingProperty(null); setForm("property"); }} onOpen={(property) => setRegistryDetail({ kind: "property", record: property })} />}
          {page === "Unidades" && <UnitsPage units={unitRecords} properties={propertyRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => { setEditingUnit(null); setForm("unit"); }} onOpen={(unit) => setRegistryDetail({ kind: "unit", record: unit })} onEdit={(unit) => { setEditingUnit(unit); setForm("unit"); }} />}
          {page === "Locatários" && <TenantsPage tenants={tenantRecords} contracts={contracts} charges={chargeRecords} search={search} setSearch={setSearch} onNew={() => { setEditingTenant(null); setForm("tenant"); }} onOpen={(tenant) => setRegistryDetail({ kind: "tenant", record: tenant })} onEdit={(tenant) => { setEditingTenant(tenant); setForm("tenant"); }} />}
          {page === "Contratos" && <ContractsPage charges={chargeRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => setForm("contract")} onOpen={setSelectedContract} />}
          {page === "Despesas" && <ExpensesPage rows={filteredExpenses} total={expenseRecords.length} categories={Array.from(new Set(expenseRecords.map((expense) => expense.category)))} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onOpen={setSelectedExpense} onNew={() => setForm("expense")} />}
        </></FilterStateContext.Provider>}
      </div>
    </section>
    {selectedCharge && <ChargeDrawer charge={selectedCharge} negotiation={negotiationsByCharge[selectedCharge.id]} onClose={() => { setSelectedCharge(null); setNegotiationOpen(false); }} onReceipt={() => setReceiptOpen(true)} onNegotiate={() => setNegotiationOpen(true)} />}
    {selectedContract && <ContractDrawer contract={selectedContract} charges={chargeRecords} onClose={() => setSelectedContract(null)} onCharge={() => { setChargeSourceContract(selectedContract); setSelectedContract(null); setForm("charge"); }} />}
    {registryDetail && <RegistryDetailDrawer detail={registryDetail} properties={propertyRecords} units={unitRecords} contracts={contracts} charges={chargeRecords} documents={registryDetail.kind === "tenant" ? documentsByOwner[registryDetail.record.id] ?? [] : []} categorizedDocuments={registryDetail.kind === "property" || registryDetail.kind === "unit" ? categorizedDocumentsByOwner[registryDetail.record.id] ?? createEmptyCategorizedDocuments() : undefined} onCategorizedDocumentsChange={(nextDocuments) => updateRegistryDocuments(registryDetail.record.id, nextDocuments)} onClose={() => setRegistryDetail(null)} onEdit={editRegistryDetail} />}
    {selectedExpense && <ExpenseDrawer expense={selectedExpense} onClose={() => setSelectedExpense(null)} onStatusChange={(status, paidIso) => {
      const paidDate = status === "Pago" && paidIso ? formatExpenseDate(paidIso) : null;
      setExpenseRecords((records) => records.map((record) => record.id === selectedExpense.id ? { ...record, status, paidDate } : record));
      setSelectedExpense((record) => record ? { ...record, status, paidDate } : null);
      notify("Status da despesa atualizado.", selectedExpense.id);
    }} />}
    {receiptOpen && selectedCharge && <ReceiptModal charge={selectedCharge} onClose={() => setReceiptOpen(false)} onSave={saveReceipt} />}
    {negotiationOpen && selectedCharge && <NegotiationModal charge={selectedCharge} negotiation={negotiationsByCharge[selectedCharge.id]} onClose={() => setNegotiationOpen(false)} onSave={saveNegotiation} />}
    {reportOpen && <ReportExportModal initialPortfolio={portfolioFilter} portfolioOptions={portfolioRecords} propertyOptions={propertyRecords} tenantOptions={tenantRecords} chargeOptions={chargeRecords} onClose={() => setReportOpen(false)} onExported={(filename) => notify("Relatório contábil gerado e pronto para download.", filename)} />}
    {form && <EntityForm kind={form} portfolio={form === "portfolio" ? editingPortfolio : null} property={form === "property" ? editingProperty : null} unit={form === "unit" ? editingUnit : null} tenant={form === "tenant" ? editingTenant : null} documents={form === "tenant" && editingTenant ? documentsByOwner[editingTenant.id] ?? [] : []} categorizedDocuments={form === "property" && editingProperty ? categorizedDocumentsByOwner[editingProperty.id] ?? createEmptyCategorizedDocuments() : form === "unit" && editingUnit ? categorizedDocumentsByOwner[editingUnit.id] ?? createEmptyCategorizedDocuments() : undefined} chargeSourceContract={form === "charge" ? chargeSourceContract : null} portfolioOptions={portfolioRecords} propertyOptions={propertyRecords} unitOptions={unitRecords} tenantOptions={tenantRecords} onClose={() => { setForm(null); setEditingPortfolio(null); setEditingProperty(null); setEditingUnit(null); setEditingTenant(null); setChargeSourceContract(null); }} onSave={saveForm} />}
    {toast && <SuccessToast message={toast} />}
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
          <button className="primary-button login-button" disabled={loading} aria-busy={loading}>{loading ? <><span className="spinner" /> Preparando ambiente</> : <><span>Acessar demonstração</span><span className="login-button-arrow" aria-hidden="true">→</span></>}</button>
          <div className="login-trust-note"><span aria-hidden="true">✓</span><p><strong>Dados exclusivamente demonstrativos</strong><small>Nenhuma informação real do cliente é exibida nesta versão.</small></p></div>
        </form>
        <p className="login-panel-version">Locações &amp; Recebíveis · Módulo 1</p>
      </div>
    </section>
  </main>;
}

function SidebarGlyph({ name }: { name: string }) {
  const glyphs: Record<string, string> = {
    "Operação": "clipboard", "Estrutura": "structure", "Locação": "key", "Financeiro": "finance",
    "Visão geral": "schedule", "Carteiras": "briefcase", "Imóveis": "building", "Unidades": "door",
    "Locatários": "users", "Contratos": "document", "Cobranças": "income", "Despesas": "payable",
  };
  return <span className={`sidebar-glyph glyph-${glyphs[name] ?? "document"}`} aria-hidden="true"><span /></span>;
}

function Sidebar({ page, attentionCount, onNavigate, onLogout, open, onClose, collapsed, onExpand }: { page: Page; attentionCount: number; onNavigate: (page: Page) => void; onLogout: () => void; open: boolean; onClose: () => void; collapsed: boolean; onExpand: () => void }) {
  const [openTheme, setOpenTheme] = useState<string | null>("Operação");
  const groups: Array<{ name: string; description: string; pages: Array<{ name: Page; count?: number }> }> = [
    { name: "Operação", description: "Acompanhamento diário", pages: [{ name: "Visão geral" }] },
    { name: "Estrutura", description: "Cadastros e patrimônio", pages: [{ name: "Carteiras" }, { name: "Imóveis" }, { name: "Unidades" }, { name: "Locatários" }] },
    { name: "Locação", description: "Contratos e recebíveis", pages: [{ name: "Contratos" }, { name: "Cobranças", count: attentionCount }] },
    { name: "Financeiro", description: "Obrigações financeiras", pages: [{ name: "Despesas" }] },
  ];
  const compact = collapsed && !open;
  const item = (name: Page, count?: number) => <button type="button" onClick={() => onNavigate(name)} className={`nav-item ${page === name ? "active" : ""}`} aria-current={page === name ? "page" : undefined} title={compact ? name : undefined}><SidebarGlyph name={name} /><span className="nav-item-label">{name}</span>{count !== undefined && <b>{count}</b>}</button>;
  return <>
    {open && <button className="mobile-backdrop" onClick={onClose} aria-label="Fechar navegação" />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""} ${compact ? "sidebar-collapsed" : ""}`} aria-label="Navegação do Módulo 1" onClick={() => { if (compact) onExpand(); }}>
      <div className="sidebar-main">
        <div className="sidebar-brand">
          <div className="brand-mark sidebar-logo"><span>L</span><i /><span>R</span></div>
          <div className="sidebar-brand-copy"><strong>Locações & Recebíveis</strong><span>Gestão operacional · Módulo 1</span></div>
          <button type="button" className="sidebar-mobile-close" onClick={onClose} aria-label="Fechar navegação">×</button>
        </div>
        <nav aria-label="Navegação principal">
          <div className="theme-list">{groups.map((group, index) => {
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
          })}</div>
        </nav>
      </div>
      <footer className="sidebar-footer">
        <div className="sidebar-environment"><span className="environment-dot" /><div><strong>Base demonstrativa</strong><small>Dados fictícios</small></div></div>
        <div className="sidebar-account">
          <div className="avatar-shell"><div className="avatar">AD</div><span /></div>
          <div className="account-copy"><strong>Administrativo</strong><span>Acesso principal</span></div>
          <button type="button" className="logout-button" onClick={onLogout} aria-label="Sair do sistema" title="Sair"><span className="logout-icon" aria-hidden="true" /><em>Sair</em></button>
        </div>
      </footer>
    </aside>
  </>;
}

function PageHeading({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action && onAction && <button className="primary-button" onClick={onAction}>{action}</button>}</section>;
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="search-field"><span aria-hidden="true" /><input aria-label="Buscar" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function FilterSelect({ label, value, onChange, children, active = false, variant = "filter", wide = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; active?: boolean; variant?: "filter" | "sort"; wide?: boolean }) {
  return <label className={`filter-select ${active ? "is-active" : ""} ${wide ? "filter-select-wide" : ""}`}>
    <span className="sr-only">{label}</span>
    <span className={`filter-select-icon filter-select-icon-${variant}`} aria-hidden="true" />
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    <span className="filter-select-chevron" aria-hidden="true" />
  </label>;
}

function PortfolioFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <FilterSelect label="Filtrar por carteira" value={value} onChange={onChange} active={value !== "Todas as carteiras"}><option>Todas as carteiras</option>{portfolios.map((portfolio) => <option key={portfolio.id}>{portfolio.name}</option>)}</FilterSelect>;
}

function ConnectionBanner({ onRetry }: { onRetry: () => void }) {
  return <aside className="connection-banner" role="alert"><span aria-hidden="true">!</span><div><strong>Sem conexão</strong><p>Os dados exibidos podem estar desatualizados. Reconecte para continuar salvando.</p></div><button type="button" className="secondary-button" onClick={onRetry}>Tentar novamente</button></aside>;
}

function SystemError({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return <section className={`system-error ${compact ? "system-error-compact" : ""}`} role="alert"><span aria-hidden="true">!</span><div><h3>Não foi possível carregar os dados</h3><p>Confira sua conexão e tente novamente. Nenhuma alteração foi perdida.</p></div><button type="button" className="primary-button" onClick={onRetry}>Tentar novamente</button></section>;
}

function AuthenticatedPageSkeleton() {
  return <div className="page-skeleton" role="status" aria-live="polite"><span className="sr-only">Carregando conteúdo</span><div className="skeleton-heading"><i /><i /></div><div className="skeleton-cards">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div><div className="skeleton-table"><i />{Array.from({ length: 5 }, (_, index) => <span key={index}><b /><b /><b /><b /></span>)}</div></div>;
}

function SuccessToast({ message }: { message: Exclude<ToastMessage, null> }) {
  return <div className="toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span><div><strong>{message.message}</strong><small>Referência: {message.reference}</small></div></div>;
}

function InlineFieldError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="inline-field-error" id="entity-form-error" role="alert"><span aria-hidden="true">!</span>{message}</p>;
}

function TableSection({ toolbar, children, footer }: { toolbar: ReactNode; children: ReactNode; footer: ReactNode }) {
  return <section className="table-section"><div className="table-toolbar">{toolbar}</div><div className="table-wrap">{children}</div><div className="table-footer">{footer}</div></section>;
}

function EmptyState({ filtered, entity = "registro" }: { filtered?: boolean; entity?: string }) {
  const hasActiveFilter = useContext(FilterStateContext);
  const isFiltered = filtered ?? hasActiveFilter;
  return <div className="empty-state"><span aria-hidden="true">0</span><h3>{isFiltered ? "Nenhum resultado para estes filtros" : `Nenhum ${entity} cadastrado`}</h3><p>{isFiltered ? "Ajuste ou limpe a busca e os filtros aplicados." : `Quando houver algum ${entity}, ele aparecerá aqui.`}</p></div>;
}
function UnitPills({ values }: { values: string[] }) { return <div className="tag-list">{values.map((value) => <span key={value}>{value}</span>)}</div>; }
function tenantInitials(name: string) {
  const ignoredWords = new Set(["ltda.", "ltda", "s/a", "sa", "de", "da", "do", "dos", "das"]);
  const words = name.split(/\s+/).filter((word) => word && !ignoredWords.has(word.toLowerCase()));
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
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
          <button type="button" onClick={() => onNavigate("Cobranças")}><i className="dashboard-pulse-ring dashboard-pulse-collection" style={{ background: `conic-gradient(#4faf81 ${collectionRate}%,#e4e9e7 ${collectionRate}% 100%)` }} aria-hidden="true"><span>{collectionRate}%</span></i><span><strong>Recebimento</strong><small>{brl.format(currentPeriodReceived)} realizados</small></span><b aria-hidden="true">→</b></button>
          <button type="button" onClick={() => onNavigate("Unidades")}><i className="dashboard-pulse-ring dashboard-pulse-occupancy" style={{ background: `conic-gradient(#638bd4 ${occupancyRate}%,#e4e8ee ${occupancyRate}% 100%)` }} aria-hidden="true"><span>{occupancyRate}%</span></i><span><strong>Ocupação</strong><small>{occupiedUnits} de {units.length} unidades</small></span><b aria-hidden="true">→</b></button>
        </div>
        <footer><button type="button" onClick={() => onNavigate("Cobranças")}>Cobranças <span>→</span></button><button type="button" onClick={() => onNavigate("Despesas")}>Despesas <span>→</span></button><button type="button" onClick={() => onNavigate("Contratos")}>Contratos <span>→</span></button></footer>
      </aside>
    </section>
    <article className="dashboard-panel attention-panel financial-attention dashboard-priorities-first dashboard-priority-center">
      <header className="dashboard-panel-header"><div><p className="eyebrow">Central de prioridades</p><h2>Valores que exigem atenção</h2><span>{priorityValue ? `${brl.format(priorityValue)} concentrados em pendências financeiras` : "Nenhuma pendência crítica no momento"}</span></div><span className="attention-count">{overdueCharges.length + overdueExpenses.length + partialCharges.length}</span></header>
      <div className="attention-list">{overdueCharges.map((charge) => <button type="button" key={charge.id} onClick={() => onNavigate("Cobranças", "Vencida")}><i className="attention-danger" /><span><strong>{charge.tenant}</strong><small>{charge.id} · cobrança vencida</small></span><b>{brl.format(chargeBalance(charge))}</b></button>)}{overdueExpenses.map((expense) => <button type="button" key={expense.id} onClick={() => onNavigate("Despesas", "Vencido")}><i className="attention-danger" /><span><strong>{expense.supplier}</strong><small>{expense.id} · despesa vencida</small></span><b>{brl.format(expense.amount)}</b></button>)}{partialCharges.map((charge) => <button type="button" key={charge.id} onClick={() => onNavigate("Cobranças", "Parcial")}><i className="attention-warning" /><span><strong>{charge.tenant}</strong><small>{charge.id} · baixa parcial</small></span><b>{brl.format(chargeBalance(charge))}</b></button>)}</div>
    </article>
    <section className="dashboard-domain dashboard-domain-operation" aria-labelledby="dashboard-operation-title">
      <header className="dashboard-domain-header"><span className="dashboard-domain-index" aria-hidden="true">01</span><div><p>Operação patrimonial</p><h2 id="dashboard-operation-title">Estrutura, contratos e ocupação</h2><small>Acompanhe o uso das unidades e a estrutura locável.</small></div><b>OPERAÇÃO</b></header>
      <div className="dashboard-domain-content">
        <section className="dashboard-kpis dashboard-kpis-three" aria-label="Indicadores da operação patrimonial">
          <button type="button" className="dashboard-kpi kpi-occupancy" onClick={() => onNavigate("Unidades")}><span>Ocupação das unidades</span><strong>{occupancyRate}%</strong><small>{occupiedUnits} de {units.length} unidades ocupadas</small><i aria-hidden="true">→</i></button>
          <button type="button" className="dashboard-kpi kpi-available" onClick={() => onNavigate("Unidades")}><span>Unidades disponíveis</span><strong>{availableUnits}</strong><small>Espaços livres para locação</small><i aria-hidden="true">→</i></button>
          <button type="button" className="dashboard-kpi kpi-contracts" onClick={() => onNavigate("Contratos")}><span>Contratos ativos</span><strong>{contracts.length}</strong><small>Vínculos vigentes na base</small><i aria-hidden="true">→</i></button>
        </section>
        <section className="dashboard-grid dashboard-grid-operation"><article className="dashboard-panel occupancy-panel">
          <header className="dashboard-panel-header"><div><p className="eyebrow">Desempenho operacional</p><h2>Ocupação por carteira</h2></div><span className="panel-meta">{availableUnits} unidades disponíveis</span></header>
          <div className="occupancy-list">{portfolios.map((row) => <div className="occupancy-row" key={row.portfolio}><div><strong>{row.portfolio}</strong><span>{row.occupied} de {row.total} unidades</span></div><div className="occupancy-track" role="progressbar" aria-valuenow={row.rate} aria-valuemin={0} aria-valuemax={100} aria-label={`Ocupação de ${row.portfolio}`}><i style={{ width: `${row.rate}%` }} /></div><b>{row.rate}%</b></div>)}</div>
          <button type="button" className="panel-link" onClick={() => onNavigate("Unidades")}>Ver todas as unidades <span aria-hidden="true">→</span></button>
        </article>{featuredAvailability && featuredProperty && <article className="dashboard-property-spotlight"><img src={propertyCoverImages[featuredProperty.id] ?? fallbackPropertyCover} alt={`Fachada de ${featuredProperty.name}`} width="720" height="520" /><div className="dashboard-property-spotlight-top"><span>Oportunidade do patrimônio</span><b>{featuredAvailability.units.length} {featuredAvailability.units.length === 1 ? "unidade disponível" : "unidades disponíveis"}</b></div><div className="dashboard-property-spotlight-copy"><span>{featuredProperty.portfolio}</span><h2>{featuredProperty.name}</h2><p>{featuredProperty.address}</p><div>{featuredAvailability.units.map((unit) => <b key={unit.id}>{unit.name} · {decimal.format(unit.area)} m²</b>)}</div><button type="button" onClick={() => onNavigate("Unidades")}>Explorar disponibilidade <span aria-hidden="true">→</span></button></div></article>}</section>
      </div>
    </section>
    <section className="dashboard-domain dashboard-domain-financial" aria-labelledby="dashboard-financial-title">
      <header className="dashboard-domain-header"><span className="dashboard-domain-index" aria-hidden="true">02</span><div><p>Financeiro</p><h2 id="dashboard-financial-title">Recebíveis e despesas</h2><small>Compare entradas previstas, recebimentos e despesas.</small></div><b>FINANCEIRO</b></header>
      <div className="dashboard-domain-content">
        <section className="dashboard-kpis dashboard-kpis-three" aria-label="Indicadores financeiros">
          <button type="button" className="dashboard-kpi kpi-receivable" onClick={() => onNavigate("Cobranças")}><span>Saldo a receber</span><strong>{brl.format(receivableBalance)}</strong><small>{openCharges.length} cobranças em aberto</small><i aria-hidden="true">→</i></button>
          <button type="button" className="dashboard-kpi kpi-overdue" onClick={() => onNavigate("Cobranças", "Vencida")}><span>Recebíveis vencidos</span><strong>{brl.format(overdueReceivable)}</strong><small>{overdueCharges.length} {overdueCharges.length === 1 ? "cobrança exige" : "cobranças exigem"} atenção</small><i aria-hidden="true">→</i></button>
          <button type="button" className="dashboard-kpi kpi-payable" onClick={() => onNavigate("Despesas")}><span>Despesas</span><strong>{brl.format(payableBalance)}</strong><small>{openExpenses.length} despesas em aberto</small><i aria-hidden="true">→</i></button>
        </section>
        <section className="dashboard-grid dashboard-grid-main">
          <article className="dashboard-panel dashboard-cashflow">
            <header className="dashboard-panel-header"><div><p className="eyebrow">Recebíveis por competência</p><h2>Previsto x recebido</h2></div><div className="chart-legend"><span><i className="legend-billed" />Previsto</span><span><i className="legend-received" />Recebido</span></div></header>
            <div className="competence-chart" role="img" aria-label="Comparação entre valores previstos e recebidos por competência"><div className="chart-scale" aria-hidden="true"><span>{brl.format(monthlyMax)}</span><span>{brl.format(monthlyMax / 2)}</span><span>R$ 0</span></div><div className="chart-plot">{monthlyRows.map((row) => <div className="chart-group" key={row.competence} aria-label={`${row.competence}: previsto ${brl.format(row.billed)}, recebido ${brl.format(row.received)}`}><div className="chart-bars"><i className="chart-bar chart-bar-billed" style={{ "--bar-height": `${(row.billed / monthlyMax) * 100}%` } as CSSProperties} /><i className="chart-bar chart-bar-received" style={{ "--bar-height": `${(row.received / monthlyMax) * 100}%` } as CSSProperties} /></div><strong>{row.competence}</strong></div>)}</div></div>
            <footer className="dashboard-panel-footer"><span>Total previsto <strong>{brl.format(charges.reduce((sum, charge) => sum + chargeTotal(charge), 0))}</strong></span><span>Total recebido <strong>{brl.format(charges.reduce((sum, charge) => sum + receivedTotal(charge), 0))}</strong></span></footer>
          </article>
          <article className="dashboard-panel dashboard-status-panel"><header className="dashboard-panel-header"><div><p className="eyebrow">Carteira de cobranças</p><h2>Situação atual</h2></div></header><div className="status-overview"><div className="status-donut" style={{ background: donutStops.length ? `conic-gradient(${donutStops.join(",")})` : "#e5e9ef" }} role="img" aria-label={`Distribuição de ${charges.length} cobranças por situação`}><span><strong>{openCharges.length}</strong><small>em aberto</small></span></div><div className="status-breakdown">{statusRows.filter((row) => row.count > 0).map((row) => <button type="button" key={row.status} onClick={() => onNavigate("Cobranças", row.status)}><i style={{ background: statusColors[row.status] }} /><span>{row.status}</span><strong>{row.count}</strong></button>)}</div></div></article>
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

  return <>
    <PageHeading eyebrow="Gestão de recebíveis" title="Cobranças" description="Priorize valores em risco, acompanhe acordos e registre recebimentos por competência." action="Nova cobrança" onAction={onNew} />
    <section className="charge-command-overview" aria-label="Indicadores de cobranças">
      <div className="charge-command-balance"><span>Saldo em acompanhamento</span><strong>{brl.format(pending)}</strong><small>{pendingCharges.length} {pendingCharges.length === 1 ? "cobrança ativa" : "cobranças ativas"}</small><div><span><b>{collectionRate}% recebido</b><small>{brl.format(totalReceived)} de {brl.format(totalBilled)}</small></span><i aria-hidden="true"><b style={{ width: `${collectionRate}%` }} /></i></div></div>
      <button type="button" className="charge-command-card charge-command-overdue" aria-pressed={statusFilter === "Vencida"} onClick={() => toggleStatus("Vencida")} title="Filtrar cobranças vencidas"><span>Vencidas</span><strong>{countByStatus("Vencida")}</strong><small>{brl.format(overdueBalance)} em risco</small><i aria-hidden="true">!</i></button>
      <button type="button" className="charge-command-card charge-command-upcoming" aria-pressed={statusFilter === "Próxima"} onClick={() => toggleStatus("Próxima")} title="Filtrar cobranças próximas"><span>Próximas</span><strong>{countByStatus("Próxima")}</strong><small>{brl.format(upcomingBalance)} a vencer</small><i aria-hidden="true">→</i></button>
      <button type="button" className="charge-command-card charge-command-negotiated" aria-pressed={statusFilter === "Negociada"} onClick={() => toggleStatus("Negociada")} title="Filtrar cobranças negociadas"><span>Em negociação</span><strong>{countByStatus("Negociada")}</strong><small>{brl.format(negotiatedBalance)} acordados</small><i aria-hidden="true">◆</i></button>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por contrato, unidade, locatário ou item" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><FilterSelect label="Filtrar por situação" value={statusFilter} onChange={setStatusFilter} active={statusFilter !== "Todas"}><option>Todas</option><option>Vencida</option><option>Em aberto</option><option>Próxima</option><option>Parcial</option><option>Negociada</option><option>Recebida</option></FilterSelect><button type="button" className="secondary-button report-export-button" onClick={onReport}><span className="report-export-icon" aria-hidden="true">↓</span>Exportar relatório</button><button type="button" className="primary-button charge-mobile-new" onClick={onNew}>Nova cobrança</button></>} footer={<><span>{rows.length} de {total} cobranças</span><span>Inclusão, negociação e baixa manuais</span></>}>
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
          <span className="charge-ledger-arrow" aria-hidden="true">→</span>
        </button>;
      })}</div> : <EmptyState entity="cobrança" />}
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
      <button type="button" className="expense-command-card expense-command-overdue" aria-pressed={statusFilter === "Vencido"} onClick={() => toggleExpenseStatus("Vencido")}><span>Em atraso</span><strong>{brl.format(totalOverdue)}</strong><small>{overdueAccounts} {overdueAccounts === 1 ? "despesa vencida" : "despesas vencidas"}</small><i aria-hidden="true">!</i></button>
      <button type="button" className="expense-command-card expense-command-paid" aria-pressed={statusFilter === "Pago"} onClick={() => toggleExpenseStatus("Pago")}><span>Total pago</span><strong>{brl.format(totalPaid)}</strong><small>{paidAccounts} {paidAccounts === 1 ? "despesa quitada" : "despesas quitadas"}</small><i aria-hidden="true">✓</i></button>
      <button type="button" className="expense-command-card expense-command-upcoming" aria-pressed={statusFilter === "Pendente"} onClick={() => toggleExpenseStatus("Pendente")}><span>Próximos 7 dias</span><strong>{nextDue}</strong><small>vencimentos a priorizar</small><i aria-hidden="true">→</i></button>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por fornecedor, descrição ou despesa" /><FilterSelect label="Filtrar despesas por status" value={statusFilter} onChange={setStatusFilter} active={statusFilter !== "Todas"}><option>Todas</option><option>Pendente</option><option>Pago</option><option>Vencido</option></FilterSelect><FilterSelect label="Filtrar despesas por categoria" value={categoryFilter} onChange={setCategoryFilter} active={categoryFilter !== "Todas as categorias"}><option>Todas as categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</FilterSelect><FilterSelect label="Ordenar despesas" value={`${sortKey}:${sortDirection}`} onChange={selectSort} active={`${sortKey}:${sortDirection}` !== "urgent:asc"} variant="sort" wide><option value="urgent:asc">Mais urgentes</option><option value="due:asc">Vencimento: mais próximo</option><option value="due:desc">Vencimento: mais distante</option><option value="amount:desc">Valor: maior primeiro</option><option value="amount:asc">Valor: menor primeiro</option><option value="supplier:asc">Fornecedor: A–Z</option><option value="supplier:desc">Fornecedor: Z–A</option><option value="status:asc">Status: críticos primeiro</option><option value="status:desc">Status: pagos primeiro</option></FilterSelect><button type="button" className="secondary-button expense-clear-filters" onClick={clearExpenseFilters} disabled={!hasExpenseFilters}>Limpar filtros</button><button type="button" className="primary-button expense-mobile-new" onClick={onNew}>Nova despesa</button></>} footer={<><span>{rows.length} de {total} despesas</span><span>{hasExpenseFilters ? "Resumo do resultado filtrado" : "Visão geral da base"}</span></>}>
      {sortedRows.length > 0 ? <div className="expense-ledger" aria-label="Despesas cadastradas">{sortedRows.map((expense) => {
        const timing = expenseTiming(expense);
        const stateClass = expense.status === "Vencido" ? "expense-ledger-overdue" : timing ? "expense-ledger-soon" : expense.status === "Pago" ? "expense-ledger-paid" : "expense-ledger-pending";
        return <button type="button" className={`expense-ledger-row ${stateClass}`} key={expense.id} onClick={() => onOpen(expense)} aria-label={`Abrir despesa ${expense.id}, ${expense.status}`}>
          <span className="expense-ledger-marker" aria-hidden="true" />
          <span className="expense-ledger-identity"><span><strong>{expense.id}</strong><small>{expense.category}</small></span><ExpenseStatusBadge status={expense.status} /></span>
          <span className="expense-ledger-context"><small>Fornecedor / beneficiário</small><strong>{expense.supplier}</strong><span>{expense.description}</span></span>
          <span className="expense-ledger-due"><small>Vencimento</small><strong>{expense.dueDate}</strong><span className={expense.status === "Vencido" ? "timing-overdue" : "timing-soon"}>{timing || (expense.status === "Pago" ? `Pago em ${expense.paidDate}` : "Dentro do prazo")}</span></span>
          <span className="expense-ledger-value"><small>Valor da despesa</small><strong>{brl.format(expense.amount)}</strong><span>{expense.status === "Pago" ? "Compromisso quitado" : "Pagamento pendente"}</span></span>
          <span className="expense-ledger-arrow" aria-hidden="true">→</span>
        </button>;
      })}</div> : <EmptyState entity="despesa" />}
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
      <button type="button" className="primary-button portfolio-mobile-new" onClick={onNew}>Nova carteira</button>
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
          <header><div><span>Titular da carteira</span><h2>{portfolio.name}</h2><p>{portfolio.holder}</p></div><button type="button" className="secondary-button portfolio-edit" onClick={() => onEdit(portfolio)}>Editar carteira</button></header>
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
    })}</section> : <div className="portfolio-empty-result"><EmptyState /></div>}

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
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por imóvel ou endereço" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><button type="button" className="primary-button property-mobile-new" onClick={onNew}>Novo imóvel</button></>} footer={<><span>{rows.length} imóveis</span><span>{availableUnits} unidades disponíveis</span></>}>
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
      })}</div> : <EmptyState entity="imóvel" />}
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
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por unidade ou imóvel" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><button type="button" className="primary-button unit-mobile-new" onClick={onNew}>Nova unidade</button></>} footer={<><span>{rows.length} unidades</span><span>{availableUnits} disponíveis no filtro</span></>}>
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
      })}</div> : <EmptyState entity="unidade" />}
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
      <button type="button" className="tenant-overview-active" aria-pressed={relationshipFilter === "Com contrato"} onClick={() => toggleRelationship("Com contrato")}><span>Com contrato</span><strong>{activeTenants.length}</strong><small>{contracts.reduce((total, contract) => total + contract.units.length, 0)} unidades ocupadas</small><i aria-hidden="true">✓</i></button>
      <button type="button" className="tenant-overview-unlinked" aria-pressed={relationshipFilter === "Sem contrato"} onClick={() => toggleRelationship("Sem contrato")}><span>Sem vínculo ativo</span><strong>{unlinkedTenants.length}</strong><small>disponíveis para nova locação</small><i aria-hidden="true">+</i></button>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por nome, CPF ou CNPJ" /><FilterSelect label="Filtrar por vínculo" value={relationshipFilter} onChange={setRelationshipFilter} active={relationshipFilter !== "Todos"}><option>Todos</option><option>Com contrato</option><option>Sem contrato</option></FilterSelect><button type="button" className="primary-button tenant-mobile-new" onClick={onNew}>Novo locatário</button></>} footer={<><span>{rows.length} de {tenants.length} locatários</span><span>{activeTenants.length} com vínculo ativo</span></>}>
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
            </> : <span className="tenant-card-empty-link"><i aria-hidden="true">+</i><span><strong>Sem contrato ativo</strong><small>Cadastro pronto para um novo vínculo de locação.</small></span></span>}
            <span className="tenant-card-arrow" aria-hidden="true">Ver relacionamento <b>→</b></span>
          </button>
          <footer><span>{mainContract ? `${tenantContracts.length} ${tenantContracts.length === 1 ? "contrato ativo" : "contratos ativos"}` : "Relacionamento em prospecção"}</span><button type="button" onClick={() => onEdit(tenant)}>Editar cadastro</button></footer>
        </article>;
      })}</div> : <EmptyState filtered={Boolean(search || relationshipFilter !== "Todos")} entity="locatário" />}
    </TableSection>
  </>;
}

function ContractsPage({ charges, search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen }: { charges: Charge[]; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (contract: Contract) => void }) {
  const rows = contracts.filter((contract) => `${contract.id}${contract.property}${contract.tenant}${contract.units.join("")}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || contract.portfolio === portfolioFilter));
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
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por contrato, unidade ou locatário" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><button type="button" className="primary-button contract-mobile-new" onClick={onNew}>Novo contrato</button></>} footer={<><span>{rows.length} contratos ativos</span><span>{brl.format(monthlyRevenue)} de receita mensal base</span></>}>
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
          <span className="contract-card-footer"><span>Reajuste em {contract.adjustment}</span><b>{contractCharges} {contractCharges === 1 ? "cobrança" : "cobranças"} <i aria-hidden="true">→</i></b></span>
        </button>;
      })}</div> : <EmptyState entity="contrato" />}
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
      { label: "Endereço principal", value: detail.record.address },
      { label: "Unidades", value: detail.record.units },
    ];
  } else if (detail.kind === "unit") {
    eyebrow = "Detalhes da unidade";
    fields = [
      { label: "Identificador", value: detail.record.id },
      { label: "Imóvel", value: detail.record.property },
      { label: "Carteira", value: detail.record.portfolio },
      { label: "Endereço do imóvel", value: unitProperty?.address ?? "Endereço não informado" },
    ];
  } else {
    eyebrow = "Detalhes do locatário";
    fields = [
      { label: "Identificador", value: detail.record.id },
      { label: "Tipo", value: detail.record.type === "PJ" ? "Pessoa jurídica" : "Pessoa física" },
      { label: detail.record.type === "PJ" ? "CNPJ" : "CPF", value: detail.record.document },
      { label: "Contratos ativos", value: tenantContracts.length },
    ];
  }

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${eyebrow}: ${title}`}><button className="drawer-backdrop" onClick={onClose} /><aside className={`drawer wide-drawer registry-detail-drawer ${detail.kind === "property" ? "property-detail-drawer" : detail.kind === "unit" ? "unit-detail-drawer" : "tenant-detail-drawer"}`}>{detail.kind === "property" ? <header className="property-detail-hero">
    <img src={propertyCoverImages[detail.record.id] ?? fallbackPropertyCover} alt={`Fachada ilustrativa de ${detail.record.name}`} width="800" height="520" />
    <div className="property-detail-hero-top"><p className="eyebrow eyebrow-light">Detalhes do imóvel</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes">×</button></div>
    <div className="property-detail-hero-copy"><span>{detail.record.id}</span><h2>{detail.record.name}</h2><p>{detail.record.address}</p></div>
  </header> : detail.kind === "unit" ? <header className="unit-detail-hero">
    <img src={(unitProperty && propertyCoverImages[unitProperty.id]) ?? fallbackPropertyCover} alt="" width="800" height="480" />
    <div className="property-detail-hero-top"><p className="eyebrow eyebrow-light">Detalhes da unidade</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes">×</button></div>
    <div className="property-detail-hero-copy unit-detail-hero-copy"><div><span>{detail.record.id}</span><span className={`unit-detail-hero-status ${detail.record.occupied ? "occupied" : "available"}`}>{detail.record.occupied ? "Ocupada" : "Disponível"}</span></div><h2>{detail.record.name}</h2><p>{detail.record.property}</p></div>
  </header> : <header className={`tenant-detail-hero ${tenantContracts.length ? tenantAttentionCharges.length ? "tenant-detail-hero-attention" : "tenant-detail-hero-active" : "tenant-detail-hero-unlinked"}`}>
    <div className="tenant-detail-hero-top"><p className="eyebrow eyebrow-light">Relacionamento de locação</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes">×</button></div>
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
      </section> : !detail.record.occupied && <aside className="unit-availability-note"><span aria-hidden="true">+</span><div><strong>Disponível para nova locação</strong><p>Esta unidade pode ser selecionada ao cadastrar um novo contrato.</p></div></aside>}
      <div className="unit-detail-section-title"><span>Dados cadastrais</span><small>Informações estruturais da unidade</small></div>
    </>}
    {detail.kind === "tenant" && <>
      <section className="tenant-detail-summary" aria-label={`Resumo do relacionamento com ${detail.record.name}`}>
        <div className="tenant-detail-revenue"><span>Receita mensal vinculada</span><strong>{brl.format(tenantMonthlyRevenue)}</strong><small>aluguel base contratado</small></div>
        <div><span>Contratos ativos</span><strong>{tenantContracts.length}</strong><small>{tenantContracts.length ? "vínculos em andamento" : "sem vínculo vigente"}</small></div>
        <div><span>Unidades vinculadas</span><strong>{tenantLinkedUnits}</strong><small>espaços ocupados</small></div>
        <div className={tenantAttentionCharges.length ? "tenant-detail-attention" : ""}><span>Saldo em aberto</span><strong>{brl.format(tenantOpenBalance)}</strong><small>{tenantAttentionCharges.length ? `${tenantAttentionCharges.length} cobrança exige atenção` : `${tenantOpenCharges.length} cobranças abertas`}</small></div>
      </section>
      {tenantContracts.length ? <section className="tenant-contract-panel" aria-labelledby="tenant-contracts-title"><header><div><span>Relacionamentos ativos</span><h3 id="tenant-contracts-title">Contratos e ocupação</h3></div><b>{tenantContracts.length}</b></header><div>{tenantContracts.map((contract) => <article key={contract.id}><span className="tenant-contract-id"><small>Contrato</small><strong>{contract.id}</strong></span><span><small>Empreendimento</small><strong>{contract.property}</strong></span><span><small>Aluguel base</small><strong>{brl.format(contract.rent)}</strong></span><footer><span>{contract.units.join(" · ")}</span><span>Vence dia {contract.due}</span></footer></article>)}</div></section> : <aside className="tenant-unlinked-note"><span aria-hidden="true">+</span><div><strong>Pronto para um novo contrato</strong><p>Este locatário está cadastrado, mas ainda não possui uma unidade vinculada.</p></div></aside>}
      <section className="tenant-financial-panel" aria-labelledby="tenant-financial-title"><header><div><span>Saúde financeira</span><h3 id="tenant-financial-title">Cobranças do relacionamento</h3></div><b className={tenantAttentionCharges.length ? "has-attention" : ""}>{tenantAttentionCharges.length ? "Requer atenção" : tenantCharges.length ? "Em dia" : "Sem histórico"}</b></header>{tenantCharges.length ? <div>{tenantCharges.slice(0, 4).map((charge) => <span key={charge.id}><StatusBadge status={charge.status} /><strong>{charge.id}</strong><small>{charge.competence}</small><b>{brl.format(chargeBalance(charge))}</b></span>)}</div> : <p>Nenhuma cobrança foi gerada para este locatário.</p>}</section>
      <div className="tenant-detail-section-title"><span>Dados cadastrais</span><small>Identificação do relacionamento</small></div>
    </>}
    <dl className="detail-list registry-detail-list">{fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
    {categorizedDocuments ? <CategorizedDocumentManager documents={categorizedDocuments} onChange={onCategorizedDocumentsChange} /> : <section className="registry-documents" aria-labelledby="registry-documents-title"><div className="section-title"><h3 id="registry-documents-title">Documentos e imagens</h3><span>{documents.length ? `${documents.length} ${documents.length === 1 ? "anexo" : "anexos"}` : "Sem anexos"}</span></div><DocumentCollection documents={documents} emptyDescription="Nenhuma imagem ou arquivo foi anexado a este registro nesta sessão." /></section>}
  </div><footer className={`drawer-footer ${detail.kind === "tenant" ? "tenant-detail-footer" : ""}`}><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button" onClick={onEdit}>Editar cadastro</button></footer></aside></div>;
}

function ChargeDrawer({ charge, negotiation, onClose, onReceipt, onNegotiate }: { charge: Charge; negotiation?: ChargeNegotiation; onClose: () => void; onReceipt: () => void; onNegotiate: () => void }) {
  const lastInstallment = negotiation?.schedule.at(-1);
  const totalValue = chargeTotal(charge);
  const receivedValue = receivedTotal(charge);
  const balanceValue = operationalChargeBalance(charge, negotiation);
  const receivedRate = totalValue ? Math.min(100, Math.round((receivedValue / totalValue) * 100)) : 0;
  const statusName = charge.status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(" ", "-");

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Detalhes da cobrança ${charge.id}`}><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer wide-drawer charge-detail-drawer">
    <header className={`charge-detail-hero charge-detail-hero-${statusName}`}>
      <div className="charge-detail-hero-top"><p className="eyebrow eyebrow-light">Cobrança composta</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes">×</button></div>
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
    {negotiation && <section className="negotiation-card" aria-labelledby="negotiation-card-title"><div className="section-title"><h3 id="negotiation-card-title">Acordo de negociação</h3><span>{negotiation.id}</span></div><div className="negotiation-card-values"><span>Total acordado<strong>{brl.format(negotiation.negotiatedTotal)}</strong></span><span>Entrada prevista<strong>{brl.format(negotiation.downPayment)}</strong></span><span>Parcelamento<strong>{negotiation.installmentCount}× de {brl.format(negotiation.schedule[0]?.amount ?? 0)}</strong></span></div><dl className="negotiation-card-meta"><div><dt>Motivo</dt><dd>{negotiation.reason}</dd></div><div><dt>Forma de pagamento</dt><dd>{negotiation.paymentMethod}</dd></div><div><dt>Período</dt><dd>{formatExpenseDate(negotiation.firstDueDate)}{lastInstallment && negotiation.installmentCount > 1 ? ` — ${formatExpenseDate(lastInstallment.dueDate)}` : ""}</dd></div></dl>{negotiation.notes && <p>{negotiation.notes}</p>}</section>}
    <section className="charge-detail-context" aria-labelledby="charge-context-title"><header><div><span>Origem da cobrança</span><h3 id="charge-context-title">Vínculos e competência</h3></div><b>{charge.competence}</b></header><div><span>Contrato<strong>{charge.contract}</strong></span><span>Carteira<strong>{charge.portfolio}</strong></span><span>Locatário<strong>{charge.tenant}</strong></span><span>Imóvel<strong>{charge.property}</strong></span></div><footer>{charge.units.map((unit) => <span key={unit}>{unit}</span>)}</footer></section>
    <section className="charge-items-block"><div className="section-title"><h3>Composição da cobrança</h3><span>{charge.items.length} itens</span></div><div className="charge-items">{charge.items.map((item) => <article className="charge-item" key={`${item.name}-${item.dueDate}`}><div className="charge-item-head"><strong>{item.name}</strong><span>Vence {item.dueDate}</span></div><div className="charge-item-values"><span>Previsto <b>{brl.format(item.amount)}</b></span><span>Recebido <b>{brl.format(item.received)}</b></span><span>Saldo <b>{brl.format(item.amount - item.received)}</b></span></div></article>)}</div></section>
    <section className="history-block"><div className="section-title"><h3>Histórico de recebimentos</h3><span>{receivedTotal(charge) ? "1 registro" : "Sem registros"}</span></div>{receivedTotal(charge) ? <div className="history-entry"><i /><div><strong>{brl.format(receivedTotal(charge))}</strong><span>10 ago 2026 · Baixa manual distribuída por item</span></div></div> : <div className="history-empty">Nenhuma baixa registrada nesta cobrança.</div>}</section>
  </div><footer className="drawer-footer charge-drawer-footer charge-detail-footer"><button type="button" className="secondary-button drawer-footer-close" onClick={onClose}>Fechar</button>{charge.status !== "Recebida" && <><button type="button" className="secondary-button negotiation-action-button" onClick={onNegotiate}>{negotiation ? "Editar negociação" : "Negociar cobrança"}</button><button type="button" className="primary-button" onClick={onReceipt}>Registrar recebimento</button></>}</footer></aside></div>;
}

function ContractDrawer({ contract, charges, onClose, onCharge }: { contract: Contract; charges: Charge[]; onClose: () => void; onCharge: () => void }) {
  const [startDate, endDate] = contract.period.split(" — ");
  const contractCharges = charges.filter((charge) => charge.contract === contract.id);

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`Detalhes do contrato ${contract.id}`}><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer wide-drawer contract-detail-drawer">
    <header className="contract-detail-hero">
      <div className="contract-detail-hero-top"><p className="eyebrow eyebrow-light">Instrumento de locação</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes">×</button></div>
      <div className="contract-detail-hero-copy"><div><span>{contract.id}</span><b>Contrato ativo</b></div><h2>{contract.tenant}</h2><p>{contract.property} · {contract.portfolio}</p></div>
      <i className="contract-detail-seal" aria-hidden="true">✓</i>
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
      <aside className="contract-edit-policy" aria-label="Política de alteração do contrato"><span aria-hidden="true">!</span><div><strong>Contrato ativo não pode ser editado diretamente</strong><p>Para corrigir condições, encerre a vigência atual e cadastre o substituto. Cobranças e histórico permanecem vinculados ao acordo original.</p></div></aside>
      <InfoNote text="Consultar o contrato não cria competências automaticamente. Use “Criar cobrança” quando quiser faturar um novo período." />
    </div>
    <footer className="drawer-footer contract-detail-footer"><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button" onClick={onCharge}>Criar cobrança</button></footer>
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
      <div className="expense-detail-hero-top"><p className="eyebrow eyebrow-light">Compromisso financeiro</p><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes">×</button></div>
      <div className="expense-detail-hero-copy"><div><span>{expense.id}</span><ExpenseStatusBadge status={expense.status} /></div><h2>{expense.supplier}</h2><p>{expense.description}</p></div>
      <i className="expense-detail-orbit" aria-hidden="true">↓</i>
    </header>
    <div className="drawer-body">
      <section className="expense-detail-summary" aria-label={`Resumo financeiro de ${expense.id}`}>
        <div className="expense-detail-amount"><span>Valor da despesa</span><strong>{brl.format(expense.amount)}</strong><small>{expense.status === "Pago" ? "compromisso quitado" : "valor a desembolsar"}</small></div>
        <div><span>Categoria</span><strong>{expense.category}</strong><small>classificação financeira</small></div>
        <div><span>Situação</span><strong>{expense.status}</strong><small>{timing || (expense.status === "Pago" ? "Pagamento concluído" : "Dentro do prazo")}</small></div>
      </section>
      <section className="expense-detail-timeline" aria-labelledby="expense-timeline-title"><header><div><span>Agenda financeira</span><h3 id="expense-timeline-title">Vencimento e pagamento</h3></div>{timing && <b className={expense.status === "Vencido" ? "expense-timeline-overdue" : "expense-timeline-soon"}>{timing}</b>}</header><div><span className="expense-timeline-due"><i aria-hidden="true" /><small>Vencimento</small><strong>{expense.dueDate}</strong></span><i aria-hidden="true" /><span className={expense.status === "Pago" ? "expense-timeline-complete" : ""}><i aria-hidden="true" /><small>Pagamento</small><strong>{expense.paidDate ?? "Ainda não realizado"}</strong></span></div></section>
      {expense.status === "Vencido" && <aside className="expense-alert"><span>!</span><div><strong>Pagamento em atraso</strong><p>Esta despesa está vencida e precisa de acompanhamento.</p></div></aside>}
      {expense.status === "Pendente" && timing && <aside className="expense-alert expense-alert-soon"><span>•</span><div><strong>Vencimento próximo</strong><p>Priorize a conferência desta despesa.</p></div></aside>}
      <section className="expense-status-editor" aria-labelledby="expense-status-title"><div><h3 id="expense-status-title">Atualizar situação</h3><p>Registre a evolução operacional deste compromisso.</p></div><label>Status<select value={status} onChange={(event) => { const nextStatus = event.target.value as ExpenseStatus; setStatus(nextStatus); if (nextStatus === "Pago" && !paidIso) setPaidIso(DEMO_DATE_ISO); }}><option>Pendente</option><option>Vencido</option><option>Pago</option></select></label>{status === "Pago" && <label>Data do pagamento<input type="date" value={paidIso} onChange={(event) => setPaidIso(event.target.value)} required /></label>}</section>
    </div>
    <footer className="drawer-footer expense-detail-footer"><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button" disabled={!statusChanged || (status === "Pago" && !paidIso)} onClick={() => onStatusChange(status, paidIso)}>Salvar status</button></footer>
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
  const [surcharge, setSurcharge] = useState(moneyInput(negotiation?.surcharge));
  const [downPayment, setDownPayment] = useState(moneyInput(negotiation?.downPayment));
  const [installmentCount, setInstallmentCount] = useState(String(negotiation?.installmentCount ?? 3));
  const [firstDueDate, setFirstDueDate] = useState(negotiation?.firstDueDate ?? "2026-09-10");
  const [reason, setReason] = useState(negotiation?.reason ?? "");
  const [paymentMethod, setPaymentMethod] = useState(negotiation?.paymentMethod ?? "Boleto bancário");
  const [notes, setNotes] = useState(negotiation?.notes ?? "");
  const [formError, setFormError] = useState("");
  const terms: NegotiationTerms = {
    originalBalance,
    discount: discount === "" ? 0 : Number(discount),
    surcharge: surcharge === "" ? 0 : Number(surcharge),
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
    const error = termsError || (!reason ? "Selecione o motivo da negociação." : "") || (!paymentMethod ? "Selecione a forma de pagamento." : "");
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
      paymentMethod,
      notes: notes.trim(),
      createdAt: negotiation?.createdAt ?? DEMO_DATE_ISO,
      updatedAt: DEMO_DATE_ISO,
    });
  };

  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Negociar cobrança ${charge.id}`}><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar negociação" /><form className="receipt-modal negotiation-modal" noValidate onSubmit={handleSubmit}><ModalHeader eyebrow={negotiation ? "Revisão do acordo" : "Cobrança em aberto"} title={negotiation ? `Editar negociação ${charge.id}` : `Negociar ${charge.id}`} onClose={onClose} /><div className="negotiation-modal-body">
    <div className="negotiation-context"><div><span>Locatário</span><strong>{charge.tenant}</strong></div><div><span>Competência</span><strong>{charge.competence}</strong></div><div><span>Saldo atual</span><strong>{brl.format(originalBalance)}</strong></div></div>
    <InlineFieldError message={formError || termsError} />
    <section className="negotiation-section" aria-labelledby="negotiation-values-title"><div className="negotiation-section-heading"><span aria-hidden="true">01</span><div><h3 id="negotiation-values-title">Condições financeiras</h3><p>Defina desconto, acréscimos e uma entrada prevista.</p></div></div><div className="negotiation-fields-grid">
      <label>Desconto<input type="number" inputMode="decimal" min="0" max={originalBalance} step="0.01" placeholder="0,00" value={discount} onChange={(event) => { setDiscount(event.target.value); clearError(); }} /><small>Reduz o saldo original.</small></label>
      <label>Acréscimos<input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={surcharge} onChange={(event) => { setSurcharge(event.target.value); clearError(); }} /><small>Multas, juros ou encargos acordados.</small></label>
      <label>Entrada prevista<input type="number" inputMode="decimal" min="0" max={Math.max(0, totals.negotiatedTotal - 0.01)} step="0.01" placeholder="0,00" value={downPayment} onChange={(event) => { setDownPayment(event.target.value); clearError(); }} /><small>Não será registrada como recebida automaticamente.</small></label>
    </div></section>
    <section className="negotiation-section" aria-labelledby="negotiation-installments-title"><div className="negotiation-section-heading"><span aria-hidden="true">02</span><div><h3 id="negotiation-installments-title">Parcelamento e vencimentos</h3><p>Monte o calendário mensal para o saldo após a entrada.</p></div></div><div className="negotiation-fields-grid negotiation-installment-fields">
      <label>Número de parcelas<input type="number" inputMode="numeric" min="1" max="24" step="1" value={installmentCount} onChange={(event) => { setInstallmentCount(event.target.value); clearError(); }} required /></label>
      <label>Primeiro vencimento<input type="date" min={DEMO_DATE_ISO} value={firstDueDate} onChange={(event) => { setFirstDueDate(event.target.value); clearError(); }} required /></label>
      <label>Forma de pagamento<select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); clearError(); }} required><option>Boleto bancário</option><option>Pix</option><option>Transferência bancária</option><option>Débito automático</option></select></label>
      <label>Motivo da negociação<select value={reason} onChange={(event) => { setReason(event.target.value); clearError(); }} required><option value="" disabled>Selecione o motivo</option><option>Atraso temporário</option><option>Readequação de fluxo</option><option>Contestação parcial</option><option>Acordo comercial</option><option>Outro</option></select></label>
    </div></section>
    <section className="negotiation-preview" aria-labelledby="negotiation-preview-title"><div className="section-title"><h3 id="negotiation-preview-title">Resumo do acordo</h3><span>{schedule.length ? `${schedule.length} ${schedule.length === 1 ? "parcela" : "parcelas"}` : "Revise as condições"}</span></div><div className="negotiation-preview-values"><span>Saldo original<strong>{brl.format(originalBalance)}</strong></span><span>Desconto<strong className="negotiation-discount">− {brl.format(terms.discount)}</strong></span><span>Acréscimos<strong>+ {brl.format(terms.surcharge)}</strong></span><span>Total acordado<strong>{brl.format(totals.negotiatedTotal)}</strong></span><span>Entrada prevista<strong>{brl.format(terms.downPayment)}</strong></span><span>Saldo parcelado<strong>{brl.format(totals.financedAmount)}</strong></span></div>{schedule.length > 0 && <div className="negotiation-schedule"><div className="negotiation-schedule-heading"><span>Calendário previsto</span><strong>{terms.installmentCount}× a partir de {brl.format(firstInstallment)}</strong></div><ol>{schedule.map((installment) => <li key={installment.number}><span>{String(installment.number).padStart(2, "0")}</span><strong>{formatExpenseDate(installment.dueDate)}</strong><b>{brl.format(installment.amount)}</b></li>)}</ol></div>}</section>
    <label className="standalone-label negotiation-notes">Observações<textarea rows={3} maxLength={500} placeholder="Registre condições adicionais ou o histórico do contato." value={notes} onChange={(event) => { setNotes(event.target.value); clearError(); }} /><small>{notes.length}/500 caracteres</small></label>
  </div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={Boolean(termsError)}>{negotiation ? "Salvar alterações" : "Confirmar negociação"}</button></footer></form></div>;
}

function ReceiptModal({ charge, onClose, onSave }: { charge: Charge; onClose: () => void; onSave: (event: FormEvent) => void }) {
  const pendingItems = charge.items.filter((item) => item.amount > item.received);
  const currentBalance = chargeBalance(charge);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [allocations, setAllocations] = useState(pendingItems.map(() => 0));
  const [receiptDate, setReceiptDate] = useState("2026-08-12");
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const receivedValue = Number(receivedAmount);
  const allocationTotal = allocations.reduce((sum, value) => sum + Number(value || 0), 0);
  const invalidAllocation = allocations.some((value, index) => value < 0 || value > pendingItems[index].amount - pendingItems[index].received);
  const receiptError = receivedAmount === "" ? ""
    : !Number.isFinite(receivedValue) || receivedValue <= 0 ? "Informe um valor recebido maior que zero."
    : receivedValue > currentBalance ? `O valor recebido não pode superar o saldo de ${brl.format(currentBalance)}.`
    : invalidAllocation ? "A distribuição não pode superar o saldo de nenhum item."
    : allocationTotal <= 0 ? "Distribua um valor maior que zero entre os itens."
    : allocationTotal > currentBalance ? `O total distribuído não pode superar o saldo de ${brl.format(currentBalance)}.`
    : Math.abs(allocationTotal - receivedValue) > 0.009 ? "A soma distribuída deve ser igual ao valor recebido."
    : "";
  const canConfirm = receivedAmount !== "" && allocationTotal > 0 && allocationTotal <= currentBalance && !receiptError;
  const distributeAmount = (amount: number) => {
    let remainingCents = Math.round(Math.max(0, Math.min(amount, currentBalance)) * 100);
    return pendingItems.map((item) => {
      const itemBalanceCents = Math.round((item.amount - item.received) * 100);
      const allocatedCents = Math.min(remainingCents, itemBalanceCents);
      remainingCents -= allocatedCents;
      return allocatedCents / 100;
    });
  };
  const changeReceivedAmount = (value: string) => {
    const amount = Number(value);
    setReceivedAmount(value);
    setAllocations(value === "" || !Number.isFinite(amount) ? pendingItems.map(() => 0) : distributeAmount(amount));
    setReviewing(false);
  };
  const handleReceiptSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canConfirm) return;
    if (!reviewing) {
      setReviewing(true);
      return;
    }
    onSave(event);
  };
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Registrar recebimento"><button className="drawer-backdrop" onClick={onClose} /><form className="receipt-modal allocation-modal" onSubmit={handleReceiptSubmit}><ModalHeader eyebrow="Baixa manual" title="Distribuir recebimento" onClose={onClose} /><div className="receipt-summary"><div><span>Valor da cobrança</span><strong>{brl.format(chargeTotal(charge))}</strong></div><div><span>Já recebido</span><strong>{brl.format(receivedTotal(charge))}</strong></div><div><span>Saldo atual</span><strong>{brl.format(currentBalance)}</strong></div></div><InlineFieldError message={receiptError} /><div className="form-grid"><label>Data do recebimento<input type="date" value={receiptDate} onChange={(event) => { setReceiptDate(event.target.value); setReviewing(false); }} disabled={reviewing} required /></label><label>Valor recebido<input type="number" inputMode="decimal" min="0.01" step="0.01" max={currentBalance} placeholder="0,00" value={receivedAmount} onChange={(event) => changeReceivedAmount(event.target.value)} disabled={reviewing} required /></label></div><section className="allocation-block"><div className="section-title"><h3>Prévia da distribuição</h3><span>{receivedAmount ? "Revise os valores por item" : "Informe o valor recebido"}</span></div>{pendingItems.map((item, index) => <label className="allocation-row" key={`${item.name}-${index}`}><span><strong>{item.name}</strong><small>Saldo {brl.format(item.amount - item.received)}</small></span><input aria-label={`Valor para ${item.name}`} type="number" min="0" step="0.01" max={item.amount - item.received} placeholder="0,00" value={allocations[index] || ""} disabled={!receivedAmount || reviewing} onChange={(event) => { setAllocations((values) => values.map((value, position) => position === index ? Number(event.target.value) : value)); setReviewing(false); }} /></label>)}<div className="allocation-total"><span>Total distribuído</span><strong>{brl.format(allocationTotal)}</strong></div></section><div className="post-balance"><span>Saldo após esta baixa</span><strong>{brl.format(Math.max(0, currentBalance - allocationTotal))}</strong></div>{reviewing && <aside className="receipt-review" role="status"><span aria-hidden="true">✓</span><div><strong>Revise antes de confirmar</strong><p>{brl.format(receivedValue)} será distribuído em {allocations.filter((value) => value > 0).length} {allocations.filter((value) => value > 0).length === 1 ? "item" : "itens"}. O saldo ficará em {brl.format(Math.max(0, currentBalance - allocationTotal))}.</p></div></aside>}<label className="standalone-label">Observação<textarea placeholder="Ex.: pagamento parcial, complemento..." rows={3} value={note} onChange={(event) => { setNote(event.target.value); setReviewing(false); }} disabled={reviewing} /></label><footer><button type="button" className="secondary-button" onClick={reviewing ? () => setReviewing(false) : onClose}>{reviewing ? "Voltar e editar" : "Cancelar"}</button><button className="primary-button" disabled={!canConfirm}>{reviewing ? "Confirmar recebimento" : "Revisar distribuição"}</button></footer></form></div>;
}

function ModalHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) { return <header><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button type="button" className="close-button" onClick={onClose}>×</button></header>; }
function ModalFooter({ onClose, action, pending = false, disabled = false, disabledReason }: { onClose: () => void; action: string; pending?: boolean; disabled?: boolean; disabledReason?: string }) { return <footer><button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button><button className="primary-button" disabled={pending || disabled} aria-busy={pending} title={disabled ? disabledReason : undefined}>{pending ? "Salvando…" : action}</button></footer>; }

function EntityForm({ kind, portfolio, property, unit, tenant, documents: initialDocuments = [], categorizedDocuments: initialCategorizedDocuments = createEmptyCategorizedDocuments(), chargeSourceContract, portfolioOptions, propertyOptions, unitOptions, tenantOptions, onClose, onSave }: { kind: Exclude<FormKind, null>; portfolio?: Portfolio | null; property?: Property | null; unit?: Unit | null; tenant?: Tenant | null; documents?: LocalDocument[]; categorizedDocuments?: CategorizedDocuments; chargeSourceContract?: Contract | null; portfolioOptions: Portfolio[]; propertyOptions: Property[]; unitOptions: Unit[]; tenantOptions: Tenant[]; onClose: () => void; onSave: (data: FormData, documents?: FormDocuments) => void }) {
  const initialChargeContract = chargeSourceContract ?? contracts[0];
  const baseConfig = {
    portfolio: ["Estrutura patrimonial", "Nova carteira", "Salvar carteira"], property: ["Estrutura patrimonial", "Novo imóvel", "Salvar imóvel"], unit: ["Estrutura locável", "Nova unidade", "Salvar unidade"], tenant: ["Cadastro essencial", "Novo locatário", "Salvar locatário"], contract: ["Locação", "Novo contrato", "Salvar contrato"], charge: ["Inclusão manual", "Nova cobrança", "Salvar cobrança"], expense: ["Controle financeiro", "Nova despesa", "Salvar despesa"],
  }[kind];
  const config = kind === "portfolio" && portfolio ? [baseConfig[0], `Editar ${portfolio.name}`, "Salvar alterações"] : kind === "property" && property ? [baseConfig[0], `Editar ${property.name}`, "Salvar alterações"] : kind === "unit" && unit ? [baseConfig[0], `Editar ${unit.name}`, "Salvar alterações"] : kind === "tenant" && tenant ? [baseConfig[0], `Editar ${tenant.name}`, "Salvar alterações"] : baseConfig;
  const [tenantType, setTenantType] = useState<Tenant["type"]>(tenant?.type ?? "PJ");
  const [tenantDocument, setTenantDocument] = useState(tenant?.document ?? "");
  const [tenantDocumentError, setTenantDocumentError] = useState("");
  const [contractPortfolio, setContractPortfolio] = useState(portfolioOptions[0]?.name ?? "");
  const [contractProperty, setContractProperty] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [contractItems, setContractItems] = useState(["Aluguel", "IPTU", "Condomínio"]);
  const [chargeContractId, setChargeContractId] = useState(initialChargeContract?.id ?? "");
  const [chargeCompetence, setChargeCompetence] = useState("2026-08");
  const [chargeItems, setChargeItems] = useState<ChargeDraftItem[]>(() => initialChargeContract ? buildChargeItemsFromContract(initialChargeContract, "2026-08") : []);
  const [chargeItemsDirty, setChargeItemsDirty] = useState(false);
  const [expenseStatus, setExpenseStatus] = useState<ExpenseStatus>("Pendente");
  const [documents, setDocuments] = useState<LocalDocument[]>(initialDocuments);
  const [categorizedDocuments, setCategorizedDocuments] = useState<CategorizedDocuments>(initialCategorizedDocuments);
  const initialDocumentIds = useRef(new Set([...initialDocuments, ...flattenCategorizedDocuments(initialCategorizedDocuments)].map((document) => document.id)));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const contractProperties = propertyOptions.filter((record) => record.portfolio === contractPortfolio);
  const contractUnits = unitOptions.filter((record) => record.property === contractProperty && !record.occupied);
  const selectedChargeContract = contracts.find((contract) => contract.id === chargeContractId);
  const chargeCompetenceParts = chargeCompetence.match(/^(\d{4})-(\d{2})$/);
  const chargeCompetenceLabel = chargeCompetenceParts ? `${chargeCompetenceParts[2]}/${chargeCompetenceParts[1]}` : "";
  const duplicateCharge = chargeCompetenceLabel ? charges.find((charge) => charge.contract === chargeContractId && charge.competence === chargeCompetenceLabel) : undefined;
  const chargeBusinessError = kind !== "charge" ? ""
    : !selectedChargeContract ? "Selecione um contrato válido para a cobrança."
    : !chargeCompetenceParts ? "Informe uma competência válida."
    : duplicateCharge ? `Já existe a cobrança ${duplicateCharge.id} para ${chargeContractId} na competência ${chargeCompetenceLabel}.`
    : chargeItems.length === 0 ? "Adicione ao menos um item à cobrança."
    : !chargeItems.some((item) => Number.isFinite(item.amount) && item.amount > 0) ? "A cobrança precisa ter ao menos um item com valor positivo."
    : chargeItems.some((item) => !item.name.trim() || !Number.isFinite(item.amount) || item.amount <= 0) ? "Todos os itens devem ter descrição e valor maior que zero."
    : chargeItems.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.due) || item.due.slice(0, 7) !== chargeCompetence) ? "Os vencimentos devem ser datas válidas dentro da competência selecionada."
    : "";
  const supportsDocuments = kind === "property" || kind === "unit" || kind === "tenant";
  const supportsDocumentTopics = kind === "property" || kind === "unit";
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
  const addContractItem = () => setContractItems((current) => [...current, "Outro"]);
  const addChargeItem = () => {
    const selectedContract = contracts.find((contract) => contract.id === chargeContractId);
    setChargeItems((current) => [...current, { name: "Outro", due: selectedContract ? contractDueDate(chargeCompetence, selectedContract.due) : "", amount: 0 }]);
    setChargeItemsDirty(true);
  };
  const confirmChargeItemsReplacement = (source: "contrato" | "competência") => !chargeItemsDirty || window.confirm(`Os itens desta cobrança foram alterados. Deseja substituí-los ao mudar ${source === "contrato" ? "o contrato" : "a competência"}?`);
  const changeChargeContract = (nextContractId: string) => {
    if (nextContractId === chargeContractId || !confirmChargeItemsReplacement("contrato")) return;
    const nextContract = contracts.find((contract) => contract.id === nextContractId);
    if (!nextContract) return;
    setChargeContractId(nextContractId);
    setChargeItems(buildChargeItemsFromContract(nextContract, chargeCompetence));
    setChargeItemsDirty(false);
  };
  const changeChargeCompetence = (nextCompetence: string) => {
    if (nextCompetence === chargeCompetence || !confirmChargeItemsReplacement("competência")) return;
    const selectedContract = contracts.find((contract) => contract.id === chargeContractId);
    setChargeCompetence(nextCompetence);
    if (selectedContract) setChargeItems(buildChargeItemsFromContract(selectedContract, nextCompetence));
    setChargeItemsDirty(false);
  };
  const getTenantDocumentError = (value: string, type: Tenant["type"]) => {
    const label = type === "PF" ? "CPF" : "CNPJ";
    const expectedLength = type === "PF" ? 11 : 14;
    if (documentDigits(value).length !== expectedLength) return `Informe um ${label} completo.`;
    if (!(type === "PF" ? hasValidCpf(value) : hasValidCnpj(value))) return `${label} inválido. Confira os dígitos.`;
    const duplicate = tenantOptions.some((record) => record.id !== tenant?.id && documentDigits(record.document) === documentDigits(value));
    return duplicate ? `${label} já cadastrado para outro locatário.` : "";
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (kind === "tenant") {
      const documentError = getTenantDocumentError(tenantDocument, tenantType);
      if (documentError) {
        setTenantDocumentError(documentError);
        const documentField = event.currentTarget.elements.namedItem("tenantDocument");
        if (documentField instanceof HTMLElement) documentField.focus();
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
    if (!navigator.onLine) {
      setFormError("Não foi possível salvar sem conexão. Reconecte e tente novamente.");
      return;
    }
    setFormError("");
    setSaving(true);
    const data = new FormData(event.currentTarget);
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
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={config[1]}><button className="drawer-backdrop" onClick={closeForm} /><form className={`receipt-modal entity-modal entity-${kind}-modal`} noValidate onSubmit={handleSubmit} onInputCapture={clearFieldError}><ModalHeader eyebrow={config[0]} title={config[1]} onClose={closeForm} /><div className="entity-modal-body"><InlineFieldError message={formError || chargeBusinessError} /><div className="form-grid entity-grid">
    {kind === "portfolio" && <><label>Nome da carteira<input name="portfolioName" placeholder="Ex.: Carteira Atlas" defaultValue={portfolio?.name ?? ""} required /></label><label>Titular<input name="portfolioHolder" placeholder="Razão social ou nome" defaultValue={portfolio?.holder ?? ""} required /></label><label className="full-field">CPF / CNPJ do titular<input name="portfolioDocument" placeholder="Documento fictício nesta demonstração" defaultValue={portfolio?.document ?? ""} required /></label></>}
    {kind === "property" && <><label>Carteira<select name="propertyPortfolio" defaultValue={property?.portfolio ?? portfolioOptions[0].name} required>{portfolioOptions.map((portfolio) => <option key={portfolio.id}>{portfolio.name}</option>)}</select></label><label>Nome do imóvel<input name="propertyName" placeholder="Ex.: Centro Empresarial" defaultValue={property?.name ?? ""} required /></label><label className="full-field">Endereço principal<input name="propertyAddress" placeholder="Logradouro, número e bairro" defaultValue={property?.address ?? ""} required /></label></>}
    {kind === "unit" && <><label>Imóvel<select name="unitProperty" defaultValue={unit?.property ?? propertyOptions[0].name} required>{propertyOptions.map((property) => <option key={property.id}>{property.name}</option>)}</select></label><label>Identificação da unidade<input name="unitName" placeholder="Ex.: Sala 101" defaultValue={unit?.name ?? ""} required /></label><label>Área privativa<span className="input-with-suffix"><input name="unitArea" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Ex.: 42" defaultValue={unit?.area ?? ""} required /><span className="input-suffix" aria-hidden="true">m²</span></span></label><label>Status inicial<select name="unitStatus" defaultValue={unit?.occupied ? "Ocupada" : "Disponível"} disabled={Boolean(unit?.occupied)} aria-describedby={unit?.occupied ? "unit-occupancy-help" : undefined}><option>Disponível</option><option>Ocupada</option></select>{unit?.occupied && <small id="unit-occupancy-help" className="field-help">Ocupação definida por contrato ativo.</small>}</label></>}
    {kind === "tenant" && <section className="tenant-form-identity full-field" aria-labelledby="tenant-form-identity-title">{tenant && <div className="edit-record-banner"><span>Modo de edição</span><strong>ID {tenant.id}</strong></div>}<header><span>01</span><div><h3 id="tenant-form-identity-title">Identificação do locatário</h3><p>Informe os dados que representam este relacionamento.</p></div></header><div className="tenant-form-fields"><label>Tipo de pessoa<select name="tenantType" value={tenantType} onChange={(event) => { const nextType = event.target.value as Tenant["type"]; setTenantType(nextType); setTenantDocument(maskTenantDocument(tenantDocument, nextType)); setTenantDocumentError(""); }} required><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></label><label>{tenantType === "PJ" ? "Razão social" : "Nome completo"}<input name="tenantName" placeholder={tenantType === "PJ" ? "Empresa locatária" : "Pessoa locatária"} defaultValue={tenant?.name ?? ""} required /></label><label className="tenant-document-field">{tenantType === "PJ" ? "CNPJ" : "CPF"}<input name="tenantDocument" inputMode="numeric" autoComplete="off" maxLength={tenantType === "PJ" ? 18 : 14} placeholder={tenantType === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} value={tenantDocument} onChange={(event) => { const masked = maskTenantDocument(event.target.value, tenantType); setTenantDocument(masked); const complete = documentDigits(masked).length === (tenantType === "PJ" ? 14 : 11); setTenantDocumentError(complete ? getTenantDocumentError(masked, tenantType) : ""); }} onBlur={() => tenantDocument && setTenantDocumentError(getTenantDocumentError(tenantDocument, tenantType))} aria-invalid={tenantDocumentError ? "true" : undefined} aria-describedby="tenant-document-help" required /><small id="tenant-document-help" className={tenantDocumentError ? "field-error" : "field-help"} role={tenantDocumentError ? "alert" : undefined}>{tenantDocumentError || `A máscara e os dígitos do ${tenantType === "PJ" ? "CNPJ" : "CPF"} serão verificados.`}</small></label></div></section>}
    {supportsDocumentTopics && <CategorizedDocumentManager documents={categorizedDocuments} onChange={setCategorizedDocuments} onRemove={handleDocumentRemoval} />}
    {kind === "tenant" && <DocumentManager documents={documents} onChange={setDocuments} onRemove={handleDocumentRemoval} />}
    {kind === "expense" && <>
      <label>Fornecedor / beneficiário<input name="expenseSupplier" placeholder="Ex.: Energia Azul Distribuição" required /></label>
      <label>Categoria<input name="expenseCategory" list="expense-category-options" placeholder="Ex.: Utilidades" required /><datalist id="expense-category-options">{Array.from(new Set(expenses.map((expense) => expense.category))).map((category) => <option value={category} key={category} />)}</datalist></label>
      <label className="full-field">Descrição<input name="expenseDescription" placeholder="Descreva a origem ou finalidade da despesa" required /></label>
      <label>Valor<input name="expenseAmount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0,00" required /></label>
      <label>Data de vencimento<input name="expenseDueDate" type="date" required /></label>
      <label>Status inicial<select name="expenseStatus" value={expenseStatus} onChange={(event) => setExpenseStatus(event.target.value as ExpenseStatus)} required><option>Pendente</option><option>Vencido</option><option>Pago</option></select></label>
      {expenseStatus === "Pago" && <label>Data do pagamento<input name="expensePaidDate" type="date" defaultValue={DEMO_DATE_ISO} required /></label>}
      <p className="form-help full-field">O status também poderá ser alterado depois, nos detalhes da despesa.</p>
    </>}
    {kind === "contract" && <>
      <section className="contract-form-section full-field" aria-labelledby="contract-links-title">
        <header className="contract-section-heading"><span>01</span><div><h3 id="contract-links-title">Vínculos</h3><p>Escolha a estrutura e o locatário deste contrato.</p></div></header>
        <div className="contract-section-grid">
          <label>Carteira<select name="contractPortfolio" value={contractPortfolio} onChange={(event) => { setContractPortfolio(event.target.value); setContractProperty(""); setSelectedUnits([]); setFormError(""); }} required>{portfolioOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
          <label>Imóvel<select name="contractProperty" value={contractProperty} onChange={(event) => { setContractProperty(event.target.value); setSelectedUnits([]); setFormError(""); }} required><option value="" disabled>Selecione o imóvel</option>{contractProperties.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
          <fieldset className="full-field check-field" aria-describedby="contract-units-help"><legend>Unidades vinculadas</legend>{contractUnits.map((option) => <label key={option.id}><input type="checkbox" name="contractUnits" value={option.id} checked={selectedUnits.includes(option.id)} onChange={() => toggleUnit(option.id)} />{option.name}</label>)}<p className="selection-hint" id="contract-units-help">{!contractProperty ? "Selecione um imóvel para ver suas unidades disponíveis." : contractUnits.length === 0 ? "Nenhuma unidade disponível ou elegível para este imóvel." : `${contractUnits.length} unidade${contractUnits.length === 1 ? " disponível" : "s disponíveis"} para o imóvel selecionado.`}</p></fieldset>
          <label className="full-field">Locatário<select>{tenantOptions.map((option) => <option key={option.id}>{option.name}</option>)}</select></label>
        </div>
      </section>
      <section className="contract-form-section full-field" aria-labelledby="contract-terms-title">
        <header className="contract-section-heading"><span>02</span><div><h3 id="contract-terms-title">Vigência e valores</h3><p>Defina período, aluguel, vencimento e reajuste.</p></div></header>
        <div className="contract-section-grid">
          <label>Início da vigência<input type="date" required /></label>
          <label>Fim da vigência<input type="date" required /></label>
          <label>Aluguel base<input type="number" min="0" required /></label>
          <label>Dia de vencimento<input type="number" min="1" max="31" required /></label>
          <label>Mês de reajuste<select>{["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((month) => <option key={month}>{month}</option>)}</select></label>
        </div>
      </section>
      <section className="contract-form-section contract-items-section full-field" aria-labelledby="contract-items-title">
        <header className="contract-section-heading"><span>03</span><div><h3 id="contract-items-title">Itens previstos</h3><p>Liste os componentes financeiros previstos no contrato.</p></div></header>
        <div className="repeatable-block"><div className="section-title"><h3>Composição mensal</h3><button type="button" className="text-button" onClick={addContractItem}>+ Adicionar item</button></div>{contractItems.map((item, index) => <div className="repeatable-row" key={`${item}-${index}`}><input value={item} onChange={(event) => setContractItems((items) => items.map((value, position) => position === index ? event.target.value : value))} /><button type="button" className="remove-button" onClick={() => setContractItems((items) => items.filter((_, position) => position !== index))}>Remover</button></div>)}</div>
        <p className="form-help">Salvar o contrato não cria cobranças automaticamente.</p>
      </section>
    </>}
    {kind === "charge" && <>
      {chargeSourceContract && <div className="edit-record-banner full-field"><span>Contrato de origem fixado</span><strong>{chargeSourceContract.id}</strong></div>}
      <label>Contrato
        <select name="chargeContract" value={chargeContractId} onChange={(event) => changeChargeContract(event.target.value)} disabled={Boolean(chargeSourceContract)} aria-describedby={chargeSourceContract ? "charge-contract-help" : undefined} required>
          {contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.id} · {contract.tenant}</option>)}
        </select>
        {chargeSourceContract && <><input type="hidden" name="chargeContract" value={chargeSourceContract.id} /><small id="charge-contract-help" className="field-help">Vínculo preservado a partir do contrato selecionado.</small></>}
      </label>
      <label>Competência<input name="chargeCompetence" type="month" required value={chargeCompetence} onChange={(event) => changeChargeCompetence(event.target.value)} /></label>
      <div className="full-field charge-builder">
        <div className="section-title"><h3>Itens da cobrança</h3><button type="button" className="text-button" onClick={addChargeItem}>+ Adicionar item</button></div>
        {chargeItems.map((item, index) => <div className="charge-builder-row" key={index}>
          <span className="item-index">{String(index + 1).padStart(2, "0")}</span>
          <label>Descrição<input value={item.name} onChange={(event) => { setChargeItems((items) => items.map((value, position) => position === index ? { ...value, name: event.target.value } : value)); setChargeItemsDirty(true); }} aria-invalid={!item.name.trim() ? "true" : undefined} aria-describedby={!item.name.trim() ? "entity-form-error" : undefined} required /></label>
          <label>Vencimento<input type="date" value={item.due} onChange={(event) => { setChargeItems((items) => items.map((value, position) => position === index ? { ...value, due: event.target.value } : value)); setChargeItemsDirty(true); }} aria-invalid={!/^\d{4}-\d{2}-\d{2}$/.test(item.due) || item.due.slice(0, 7) !== chargeCompetence ? "true" : undefined} aria-describedby={!/^\d{4}-\d{2}-\d{2}$/.test(item.due) || item.due.slice(0, 7) !== chargeCompetence ? "entity-form-error" : undefined} required /></label>
          <label>Valor<input type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => { setChargeItems((items) => items.map((value, position) => position === index ? { ...value, amount: Number(event.target.value) } : value)); setChargeItemsDirty(true); }} aria-invalid={!Number.isFinite(item.amount) || item.amount <= 0 ? "true" : undefined} aria-describedby={!Number.isFinite(item.amount) || item.amount <= 0 ? "entity-form-error" : undefined} required /></label>
          <button type="button" className="remove-button" onClick={() => { setChargeItems((items) => items.filter((_, position) => position !== index)); setChargeItemsDirty(true); }}>Remover</button>
        </div>)}
        <div className="builder-total"><span>Total previsto</span><strong>{brl.format(chargeItems.reduce((sum, item) => sum + item.amount, 0))}</strong></div>
      </div>
      <p className="form-help full-field">Itens preenchidos pelo contrato: aluguel base, composição prevista e dia de vencimento. Para os demais itens, é usado o último valor deste contrato quando disponível.</p>
    </>}
  </div></div><ModalFooter onClose={closeForm} action={config[2]} pending={saving} disabled={kind === "charge" && Boolean(chargeBusinessError)} disabledReason={chargeBusinessError} /></form></div>;
}
