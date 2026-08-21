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
import { DocumentCollection, DocumentManager } from "./document-manager";
import { revokeDocumentUrls, type LocalDocument } from "./local-documents";

type Status = "Vencida" | "Em aberto" | "Próxima" | "Parcial" | "Recebida";
type ExpenseStatus = "Pendente" | "Pago" | "Vencido";
type Page = "Visão geral" | "Carteiras" | "Imóveis" | "Unidades" | "Locatários" | "Contratos" | "Cobranças" | "Despesas";
type FormKind = "portfolio" | "property" | "unit" | "tenant" | "contract" | "charge" | "expense" | null;
type ContentState = "ready" | "loading" | "error";
type ToastMessage = { message: string; reference: string } | null;
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
  const [documentsByOwner, setDocumentsByOwner] = useState<Record<string, LocalDocument[]>>({});
  const documentsByOwnerRef = useRef(documentsByOwner);
  const [expenseRecords, setExpenseRecords] = useState<Expense[]>(expenses);
  const [toast, setToast] = useState<ToastMessage>(null);
  const [contentState, setContentState] = useState<ContentState>("ready");
  const [online, setOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => { documentsByOwnerRef.current = documentsByOwner; }, [documentsByOwner]);
  useEffect(() => () => revokeDocumentUrls(Object.values(documentsByOwnerRef.current).flat()), []);

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

  const chargeAttentionCount = charges.filter((charge) => charge.status === "Vencida" || charge.status === "Parcial").length;
  const chargesInScope = useMemo(() => charges.filter((charge) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [charge.id, charge.contract, charge.property, charge.tenant, charge.competence, ...charge.units, ...charge.items.map((item) => item.name)].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (portfolioFilter === "Todas as carteiras" || charge.portfolio === portfolioFilter);
  }), [portfolioFilter, search]);
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
  const saveForm = (data: FormData, documents?: LocalDocument[]) => {
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
    if (documents && (form === "property" || form === "unit" || form === "tenant")) {
      setDocumentsByOwner((current) => {
        const retainedIds = new Set(documents.map((document) => document.id));
        revokeDocumentUrls((current[savedReference] ?? []).filter((document) => !retainedIds.has(document.id)));
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
          {page === "Visão geral" && <DashboardPage charges={charges} expenses={expenseRecords} units={unitRecords} contracts={contracts} onNavigate={(next, status) => { changePage(next); if (status) setStatusFilter(status); }} />}
          {page === "Cobranças" && <ChargesPage charges={filteredCharges} summaryCharges={chargesInScope} total={charges.length} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onOpen={setSelectedCharge} onNew={() => { setChargeSourceContract(null); setForm("charge"); }} onReport={() => setReportOpen(true)} />}
          {page === "Carteiras" && <PortfoliosPage portfolios={portfolioRecords} search={search} setSearch={setSearch} onNew={() => { setEditingPortfolio(null); setForm("portfolio"); }} onEdit={(portfolio) => { setEditingPortfolio(portfolio); setForm("portfolio"); }} />}
          {page === "Imóveis" && <PropertiesPage properties={propertyRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => { setEditingProperty(null); setForm("property"); }} onOpen={(property) => setRegistryDetail({ kind: "property", record: property })} />}
          {page === "Unidades" && <UnitsPage units={unitRecords} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => { setEditingUnit(null); setForm("unit"); }} onOpen={(unit) => setRegistryDetail({ kind: "unit", record: unit })} onEdit={(unit) => { setEditingUnit(unit); setForm("unit"); }} />}
          {page === "Locatários" && <TenantsPage tenants={tenantRecords} search={search} setSearch={setSearch} onNew={() => { setEditingTenant(null); setForm("tenant"); }} onOpen={(tenant) => setRegistryDetail({ kind: "tenant", record: tenant })} onEdit={(tenant) => { setEditingTenant(tenant); setForm("tenant"); }} />}
          {page === "Contratos" && <ContractsPage search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => setForm("contract")} onOpen={setSelectedContract} />}
          {page === "Despesas" && <ExpensesPage rows={filteredExpenses} total={expenseRecords.length} categories={Array.from(new Set(expenseRecords.map((expense) => expense.category)))} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onOpen={setSelectedExpense} onNew={() => setForm("expense")} />}
        </></FilterStateContext.Provider>}
      </div>
    </section>
    {selectedCharge && <ChargeDrawer charge={selectedCharge} onClose={() => setSelectedCharge(null)} onReceipt={() => setReceiptOpen(true)} />}
    {selectedContract && <ContractDrawer contract={selectedContract} onClose={() => setSelectedContract(null)} onCharge={() => { setChargeSourceContract(selectedContract); setSelectedContract(null); setForm("charge"); }} />}
    {registryDetail && <RegistryDetailDrawer detail={registryDetail} documents={documentsByOwner[registryDetail.record.id] ?? []} onClose={() => setRegistryDetail(null)} onEdit={editRegistryDetail} />}
    {selectedExpense && <ExpenseDrawer expense={selectedExpense} onClose={() => setSelectedExpense(null)} onStatusChange={(status, paidIso) => {
      const paidDate = status === "Pago" && paidIso ? formatExpenseDate(paidIso) : null;
      setExpenseRecords((records) => records.map((record) => record.id === selectedExpense.id ? { ...record, status, paidDate } : record));
      setSelectedExpense((record) => record ? { ...record, status, paidDate } : null);
      notify("Status da despesa atualizado.", selectedExpense.id);
    }} />}
    {receiptOpen && selectedCharge && <ReceiptModal charge={selectedCharge} onClose={() => setReceiptOpen(false)} onSave={saveReceipt} />}
    {reportOpen && <ReportExportModal initialPortfolio={portfolioFilter} portfolioOptions={portfolioRecords} propertyOptions={propertyRecords} tenantOptions={tenantRecords} chargeOptions={charges} onClose={() => setReportOpen(false)} onExported={(filename) => notify("Relatório contábil gerado e pronto para download.", filename)} />}
    {form && <EntityForm kind={form} portfolio={form === "portfolio" ? editingPortfolio : null} property={form === "property" ? editingProperty : null} unit={form === "unit" ? editingUnit : null} tenant={form === "tenant" ? editingTenant : null} documents={form === "property" && editingProperty ? documentsByOwner[editingProperty.id] ?? [] : form === "unit" && editingUnit ? documentsByOwner[editingUnit.id] ?? [] : form === "tenant" && editingTenant ? documentsByOwner[editingTenant.id] ?? [] : []} chargeSourceContract={form === "charge" ? chargeSourceContract : null} portfolioOptions={portfolioRecords} propertyOptions={propertyRecords} unitOptions={unitRecords} tenantOptions={tenantRecords} onClose={() => { setForm(null); setEditingPortfolio(null); setEditingProperty(null); setEditingUnit(null); setEditingTenant(null); setChargeSourceContract(null); }} onSave={saveForm} />}
    {toast && <SuccessToast message={toast} />}
  </main>;
}

function Login({ loading, onSubmit }: { loading: boolean; onSubmit: (event: FormEvent) => void }) {
  return <main className="login-page">
    <section className="login-brand">
      <div className="brand-mark brand-mark-light">LR</div>
      <div className="login-copy"><p className="eyebrow eyebrow-light">Módulo 1</p><h1>Locações<br />& recebíveis</h1><p>Controle operacional de estruturas, contratos, cobranças compostas e baixas manuais.</p></div>
      <div className="login-footer"><span /> Ambiente demonstrativo</div>
    </section>
    <section className="login-panel"><form className="login-form" onSubmit={onSubmit}>
      <div className="login-heading"><p className="eyebrow">Acesso administrativo</p><h2>Boas-vindas</h2><p>Entre para explorar o Módulo 1 com dados totalmente fictícios.</p></div>
      <label>E-mail<input type="email" defaultValue="administrativo@exemplo.com.br" required /></label>
      <label>Senha<input type="password" defaultValue="demonstracao" required /></label>
      <button className="primary-button login-button" disabled={loading} aria-busy={loading}>{loading ? <><span className="spinner" /> Preparando ambiente</> : "Acessar demonstração"}</button>
      <p className="demo-note">Nenhum dado real do cliente é exibido nesta versão.</p>
    </form></section>
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

function DashboardPage({ charges, expenses, units, contracts, onNavigate }: { charges: Charge[]; expenses: Expense[]; units: Unit[]; contracts: Contract[]; onNavigate: (page: Page, status?: string) => void }) {
  const openCharges = charges.filter((charge) => charge.status !== "Recebida");
  const overdueCharges = charges.filter((charge) => charge.status === "Vencida");
  const partialCharges = charges.filter((charge) => charge.status === "Parcial");
  const openExpenses = expenses.filter((expense) => expense.status !== "Pago");
  const overdueExpenses = expenses.filter((expense) => expense.status === "Vencido");
  const receivableBalance = openCharges.reduce((sum, charge) => sum + chargeBalance(charge), 0);
  const overdueReceivable = overdueCharges.reduce((sum, charge) => sum + chargeBalance(charge), 0);
  const payableBalance = openExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const occupiedUnits = units.filter((unit) => unit.occupied).length;
  const availableUnits = units.length - occupiedUnits;
  const occupancyRate = units.length ? Math.round((occupiedUnits / units.length) * 100) : 0;
  const statusRows = (["Vencida", "Parcial", "Próxima", "Em aberto", "Recebida"] as Status[]).map((status) => ({ status, count: charges.filter((charge) => charge.status === status).length }));
  const statusColors: Record<Status, string> = { Vencida: "#b44853", Parcial: "#c18424", "Próxima": "#4b78cf", "Em aberto": "#8693a5", Recebida: "#2d7b58" };
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
  return <>
    <PageHeading eyebrow="12 de agosto de 2026" title="Visão geral" description="Uma leitura clara da operação patrimonial e da posição financeira." />
    <article className="dashboard-panel attention-panel financial-attention dashboard-priorities-first">
      <header className="dashboard-panel-header"><div><p className="eyebrow">Prioridades financeiras</p><h2>Valores que exigem atenção</h2></div><span className="attention-count">{overdueCharges.length + overdueExpenses.length + partialCharges.length}</span></header>
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
        <article className="dashboard-panel occupancy-panel">
          <header className="dashboard-panel-header"><div><p className="eyebrow">Desempenho operacional</p><h2>Ocupação por carteira</h2></div><span className="panel-meta">{availableUnits} unidades disponíveis</span></header>
          <div className="occupancy-list">{portfolios.map((row) => <div className="occupancy-row" key={row.portfolio}><div><strong>{row.portfolio}</strong><span>{row.occupied} de {row.total} unidades</span></div><div className="occupancy-track" role="progressbar" aria-valuenow={row.rate} aria-valuemin={0} aria-valuemax={100} aria-label={`Ocupação de ${row.portfolio}`}><i style={{ width: `${row.rate}%` }} /></div><b>{row.rate}%</b></div>)}</div>
          <button type="button" className="panel-link" onClick={() => onNavigate("Unidades")}>Ver todas as unidades <span aria-hidden="true">→</span></button>
        </article>
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

function ChargesPage({ charges: rows, summaryCharges, total, search, setSearch, portfolioFilter, setPortfolioFilter, statusFilter, setStatusFilter, onOpen, onNew, onReport }: { charges: Charge[]; summaryCharges: Charge[]; total: number; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; onOpen: (charge: Charge) => void; onNew: () => void; onReport: () => void }) {
  const pendingCharges = summaryCharges.filter((charge) => charge.status !== "Recebida");
  const pending = pendingCharges.reduce((sum, charge) => sum + chargeBalance(charge), 0);
  const countByStatus = (status: Status) => pendingCharges.filter((charge) => charge.status === status).length;
  const toggleStatus = (status: Status) => setStatusFilter(statusFilter === status ? "Todas" : status);
  return <>
    <PageHeading eyebrow="Consulta operacional" title="Cobranças" description="Localize cobranças por carteira, contrato, unidade, locatário ou item." action="Nova cobrança" onAction={onNew} />
    <section className="summary-strip pending-summary" aria-label="Indicadores de cobranças">
      <div className="summary-card summary-card-tracking"><span>Saldo em aberto</span><strong>{brl.format(pending)}</strong><small>{pendingCharges.length} cobranças em acompanhamento</small></div>
      <button type="button" className="summary-card summary-card-button summary-card-overdue" aria-pressed={statusFilter === "Vencida"} onClick={() => toggleStatus("Vencida")} title="Filtrar cobranças vencidas"><span>Vencidas</span><strong>{countByStatus("Vencida")}</strong><small>Exige ação</small></button>
      <button type="button" className="summary-card summary-card-button summary-card-upcoming" aria-pressed={statusFilter === "Próxima"} onClick={() => toggleStatus("Próxima")} title="Filtrar cobranças próximas"><span>Próximas</span><strong>{countByStatus("Próxima")}</strong><small>Nos próximos dias</small></button>
      <button type="button" className="summary-card summary-card-button summary-card-partial" aria-pressed={statusFilter === "Parcial"} onClick={() => toggleStatus("Parcial")} title="Filtrar cobranças com baixa parcial"><span>Baixa parcial</span><strong>{countByStatus("Parcial")}</strong><small>Saldo distribuído por item</small></button>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por contrato, unidade, locatário ou item" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><FilterSelect label="Filtrar por situação" value={statusFilter} onChange={setStatusFilter} active={statusFilter !== "Todas"}><option>Todas</option><option>Vencida</option><option>Em aberto</option><option>Próxima</option><option>Parcial</option><option>Recebida</option></FilterSelect><button type="button" className="secondary-button report-export-button" onClick={onReport}><span className="report-export-icon" aria-hidden="true">↓</span>Exportar relatório</button></>} footer={<><span>{rows.length} de {total} cobranças</span><span>Inclusão e baixa manuais</span></>}>
      <table className="charges-table"><thead><tr><th>Cobrança</th><th>Contrato / unidades</th><th>Locatário</th><th>Competência</th><th>Composição</th><th>Total</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{rows.map((charge) => <tr key={charge.id} onClick={() => onOpen(charge)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen(charge)}><td><strong>{charge.id}</strong><small>{charge.portfolio}</small></td><td><strong>{charge.contract}</strong><small>{charge.property}</small><UnitPills values={charge.units} /></td><td>{charge.tenant}</td><td>{charge.competence}</td><td>{charge.items.length} {charge.items.length === 1 ? "item" : "itens"}<small>{charge.items.map((item) => item.name).join(" · ")}</small></td><td>{brl.format(chargeTotal(charge))}</td><td><strong>{brl.format(chargeBalance(charge))}</strong></td><td><StatusBadge status={charge.status} /></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}
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
  const hasExpenseFilters = Boolean(search.trim() || statusFilter !== "Todas" || categoryFilter !== "Todas as categorias");
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
  const sortByHeader = (key: Exclude<ExpenseSortKey, "urgent">) => {
    if (sortKey === key) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection(key === "amount" ? "desc" : "asc");
  };
  const sortableHeader = (key: Exclude<ExpenseSortKey, "urgent">, label: string) => <th className="sortable-th" aria-sort={sortKey === key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" className={`sort-header-button ${sortKey === key ? "is-active" : ""}`} onClick={() => sortByHeader(key)} title={`Ordenar por ${label.toLowerCase()}`}>{label}<span aria-hidden="true">{sortKey === key ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span></button></th>;
  return <>
    <PageHeading eyebrow="Controle financeiro operacional" title="Despesas" description="Cadastre despesas e acompanhe vencimentos, pagamentos e status em uma única visão." action="Nova despesa" onAction={onNew} />
    <section className="summary-strip payable-summary" aria-label="Resumo financeiro das despesas" aria-live="polite">
      <div className="summary-payable"><span>Total a pagar</span><strong>{brl.format(totalPayable)}</strong><small>{openAccounts} {openAccounts === 1 ? "despesa em aberto" : "despesas em aberto"}</small></div>
      <div className="summary-overdue"><span>Total vencido</span><strong>{brl.format(totalOverdue)}</strong><small>{overdueAccounts} {overdueAccounts === 1 ? "despesa exige" : "despesas exigem"} atenção</small></div>
      <div className="summary-paid"><span>Total pago</span><strong>{brl.format(totalPaid)}</strong><small>{paidAccounts} {paidAccounts === 1 ? "despesa quitada" : "despesas quitadas"}</small></div>
      <div className="summary-upcoming"><span>Próximos vencimentos</span><strong>{nextDue}</strong><small>Nos próximos 7 dias</small></div>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por fornecedor, descrição ou despesa" /><FilterSelect label="Filtrar despesas por status" value={statusFilter} onChange={setStatusFilter} active={statusFilter !== "Todas"}><option>Todas</option><option>Pendente</option><option>Pago</option><option>Vencido</option></FilterSelect><FilterSelect label="Filtrar despesas por categoria" value={categoryFilter} onChange={setCategoryFilter} active={categoryFilter !== "Todas as categorias"}><option>Todas as categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</FilterSelect><FilterSelect label="Ordenar despesas" value={`${sortKey}:${sortDirection}`} onChange={selectSort} active={`${sortKey}:${sortDirection}` !== "urgent:asc"} variant="sort" wide><option value="urgent:asc">Mais urgentes</option><option value="due:asc">Vencimento: mais próximo</option><option value="due:desc">Vencimento: mais distante</option><option value="amount:desc">Valor: maior primeiro</option><option value="amount:asc">Valor: menor primeiro</option><option value="supplier:asc">Fornecedor: A–Z</option><option value="supplier:desc">Fornecedor: Z–A</option><option value="status:asc">Status: críticos primeiro</option><option value="status:desc">Status: pagos primeiro</option></FilterSelect><button type="button" className="secondary-button expense-clear-filters" onClick={clearExpenseFilters} disabled={!hasExpenseFilters}>Limpar filtros</button></>} footer={<><span>{rows.length} de {total} despesas</span><span>{hasExpenseFilters ? "Resumo do resultado filtrado" : "Visão geral da base"}</span></>}>
      <table className="expense-table" aria-label="Listagem de despesas"><thead><tr><th>Despesa</th>{sortableHeader("supplier", "Fornecedor / beneficiário")}<th>Descrição</th><th>Categoria</th>{sortableHeader("due", "Vencimento")}<th>Pagamento</th>{sortableHeader("amount", "Valor")}{sortableHeader("status", "Status")}<th><span className="sr-only">Ações</span></th></tr></thead><tbody>{sortedRows.map((expense) => {
        const timing = expenseTiming(expense);
        const rowClass = expense.status === "Vencido" ? "expense-overdue" : timing ? "expense-due-soon" : "";
        return <tr className={rowClass} key={expense.id} onClick={() => onOpen(expense)}><td><strong>{expense.id}</strong></td><td><strong>{expense.supplier}</strong></td><td>{expense.description}</td><td><span className="category-label">{expense.category}</span></td><td><strong>{expense.dueDate}</strong>{timing && <small className={expense.status === "Vencido" ? "timing-overdue" : "timing-soon"}>{timing}</small>}</td><td>{expense.paidDate ?? "—"}</td><td><strong>{brl.format(expense.amount)}</strong></td><td><ExpenseStatusBadge status={expense.status} /></td><td><button type="button" className="row-action" aria-label={`Abrir detalhes da despesa ${expense.id}`} onClick={(event) => { event.stopPropagation(); onOpen(expense); }}>Abrir</button></td></tr>;
      })}</tbody></table>{rows.length === 0 && <EmptyState />}
    </TableSection>
  </>;
}

function PortfoliosPage({ portfolios, search, setSearch, onNew, onEdit }: { portfolios: Portfolio[]; search: string; setSearch: (value: string) => void; onNew: () => void; onEdit: (portfolio: Portfolio) => void }) {
  const rows = portfolios.filter((portfolio) => `${portfolio.name}${portfolio.holder}${portfolio.document}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="Estrutura patrimonial" title="Carteiras" description="Agrupe imóveis sob a titularidade ou organização usada na operação." action="Nova carteira" onAction={onNew} /><TableSection toolbar={<SearchBar value={search} onChange={setSearch} placeholder="Buscar por carteira, titular ou CNPJ" />} footer={<><span>{rows.length} carteiras</span><span>Base demonstrativa</span></>}><table className="compact-table"><thead><tr><th>Carteira</th><th>Titular</th><th>Documento</th><th>Imóveis</th><th>Unidades</th><th /></tr></thead><tbody>{rows.map((portfolio) => <tr key={portfolio.id}><td><strong>{portfolio.name}</strong><small>{portfolio.id}</small></td><td>{portfolio.holder}</td><td>{portfolio.document}</td><td>{portfolio.properties}</td><td>{portfolio.units}</td><td><button className="row-action" onClick={() => onEdit(portfolio)}>Editar</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}</TableSection></>;
}

function PropertiesPage({ properties, search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen }: { properties: Property[]; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (property: Property) => void }) {
  const rows = properties.filter((property) => `${property.name}${property.address}${property.id}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || property.portfolio === portfolioFilter));
  return <><PageHeading eyebrow="Estrutura patrimonial" title="Imóveis" description="Mantenha o endereço principal e a carteira de cada empreendimento." action="Novo imóvel" onAction={onNew} /><TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por imóvel ou endereço" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /></>} footer={<><span>{rows.length} imóveis</span><span>Carteira → imóvel → unidade</span></>}>
    {rows.length > 0 ? <div className="property-card-grid" aria-label="Imóveis cadastrados">{rows.map((property) => <button type="button" className="property-card" key={property.id} onClick={() => onOpen(property)} aria-label={`Abrir detalhes de ${property.name}`}>
      <span className="property-card-media">
        <img src={propertyCoverImages[property.id] ?? fallbackPropertyCover} alt={`Fachada ilustrativa de ${property.name}`} width="640" height="400" loading="lazy" />
        <span className="property-card-id">{property.id}</span>
      </span>
      <span className="property-card-body">
        <strong>{property.name}</strong>
        <span className="property-card-address">{property.address}</span>
        <span className="property-card-meta">
          <b>{property.portfolio}</b>
          <span>{property.units} {property.units === 1 ? "unidade" : "unidades"}</span>
        </span>
      </span>
    </button>)}</div> : <EmptyState entity="imóvel" />}
  </TableSection></>;
}

function UnitsPage({ units, search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen, onEdit }: { units: Unit[]; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (unit: Unit) => void; onEdit: (unit: Unit) => void }) {
  const rows = units.filter((unit) => `${unit.name}${unit.property}${unit.id}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || unit.portfolio === portfolioFilter));
  return <><PageHeading eyebrow="Estrutura locável" title="Unidades" description="Identifique os espaços que podem ser vinculados, inclusive em conjunto, a um contrato." action="Nova unidade" onAction={onNew} /><TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por unidade ou imóvel" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /></>} footer={<><span>{rows.length} unidades</span><span>{rows.filter((unit) => !unit.occupied).length} disponíveis no filtro</span></>}><table className="compact-table"><thead><tr><th>Unidade</th><th>Imóvel</th><th>Carteira</th><th>Área</th><th>Ocupação</th><th /></tr></thead><tbody>{rows.map((unit) => <tr className="entity-row" key={unit.id} tabIndex={0} aria-label={`Abrir detalhes de ${unit.name}`} onClick={() => onOpen(unit)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(unit); } }}><td><strong>{unit.name}</strong><small>{unit.id}</small></td><td>{unit.property}</td><td>{unit.portfolio}</td><td>{decimal.format(unit.area)} m²</td><td><span className={`unit-status ${unit.occupied ? "occupied" : "available"}`}>{unit.occupied ? "Ocupada" : "Disponível"}</span></td><td><button type="button" className="row-action" onClick={(event) => { event.stopPropagation(); onEdit(unit); }}>Editar</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}</TableSection></>;
}

function TenantsPage({ tenants, search, setSearch, onNew, onOpen, onEdit }: { tenants: Tenant[]; search: string; setSearch: (value: string) => void; onNew: () => void; onOpen: (tenant: Tenant) => void; onEdit: (tenant: Tenant) => void }) {
  const rows = tenants.filter((tenant) => `${tenant.name}${tenant.document}${tenant.id}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="Cadastros essenciais" title="Locatários" description="Cadastre pessoa física ou jurídica e vincule-a aos contratos." action="Novo locatário" onAction={onNew} /><TableSection toolbar={<SearchBar value={search} onChange={setSearch} placeholder="Buscar por nome, CPF ou CNPJ" />} footer={<><span>{rows.length} locatários</span><span>PF e PJ</span></>}><table className="compact-table"><thead><tr><th>Locatário</th><th>Tipo</th><th>CPF / CNPJ</th><th>Contratos</th><th /></tr></thead><tbody>{rows.map((tenant) => <tr className="entity-row" key={tenant.id} tabIndex={0} aria-label={`Abrir detalhes de ${tenant.name}`} onClick={() => onOpen(tenant)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(tenant); } }}><td><strong>{tenant.name}</strong><small>{tenant.id}</small></td><td>{tenant.type}</td><td>{tenant.document}</td><td>{tenant.contracts}</td><td><button type="button" className="row-action" onClick={(event) => { event.stopPropagation(); onEdit(tenant); }}>Editar</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}</TableSection></>;
}

function ContractsPage({ search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen }: { search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (contract: Contract) => void }) {
  const rows = contracts.filter((contract) => `${contract.id}${contract.property}${contract.tenant}${contract.units.join("")}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || contract.portfolio === portfolioFilter));
  return <><PageHeading eyebrow="Locações" title="Contratos" description="Conecte locatário, carteira, imóvel e uma ou mais unidades à condição financeira acordada." action="Novo contrato" onAction={onNew} /><TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por contrato, unidade ou locatário" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /></>} footer={<><span>{rows.length} contratos</span><span>Cobranças não são geradas automaticamente</span></>}><table><thead><tr><th>Contrato</th><th>Imóvel / unidades</th><th>Locatário</th><th>Vigência</th><th>Aluguel</th><th>Vencimento</th><th /></tr></thead><tbody>{rows.map((contract) => <tr key={contract.id} onClick={() => onOpen(contract)}><td><strong>{contract.id}</strong><small>{contract.portfolio}</small></td><td><strong>{contract.property}</strong><UnitPills values={contract.units} /></td><td>{contract.tenant}</td><td>{contract.period}</td><td><strong>{brl.format(contract.rent)}</strong></td><td>Dia {contract.due}</td><td><button className="row-action" onClick={(event) => { event.stopPropagation(); onOpen(contract); }}>Abrir</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}</TableSection><InfoNote text="O contrato define os itens previstos, mas cada cobrança continua sendo incluída manualmente por competência." /></>;
}

function InfoNote({ text }: { text: string }) { return <aside className="info-note"><span>i</span><p>{text}</p></aside>; }

function RegistryDetailDrawer({ detail, documents, onClose, onEdit }: { detail: RegistryDetail; documents: LocalDocument[]; onClose: () => void; onEdit: () => void }) {
  let eyebrow = "Detalhes do cadastro";
  const title = detail.record.name;
  let fields: Array<{ label: string; value: ReactNode }>;

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
      { label: "Área privativa", value: `${decimal.format(detail.record.area)} m²` },
      { label: "Ocupação", value: <span className={`unit-status ${detail.record.occupied ? "occupied" : "available"}`}>{detail.record.occupied ? "Ocupada" : "Disponível"}</span> },
    ];
  } else {
    eyebrow = "Detalhes do locatário";
    fields = [
      { label: "Identificador", value: detail.record.id },
      { label: "Tipo", value: detail.record.type === "PJ" ? "Pessoa jurídica" : "Pessoa física" },
      { label: detail.record.type === "PJ" ? "CNPJ" : "CPF", value: detail.record.document },
      { label: "Contratos", value: detail.record.contracts },
    ];
  }

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${eyebrow}: ${title}`}><button className="drawer-backdrop" onClick={onClose} /><aside className="drawer wide-drawer registry-detail-drawer"><header className="drawer-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes">×</button></header><div className="drawer-body">
    <dl className="detail-list registry-detail-list">{fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
    <section className="registry-documents" aria-labelledby="registry-documents-title"><div className="section-title"><h3 id="registry-documents-title">Documentos e imagens</h3><span>{documents.length ? `${documents.length} ${documents.length === 1 ? "anexo" : "anexos"}` : "Sem anexos"}</span></div><DocumentCollection documents={documents} emptyDescription="Nenhuma imagem ou arquivo foi anexado a este registro nesta sessão." /></section>
  </div><footer className="drawer-footer"><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button" onClick={onEdit}>Editar cadastro</button></footer></aside></div>;
}

function ChargeDrawer({ charge, onClose, onReceipt }: { charge: Charge; onClose: () => void; onReceipt: () => void }) {
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Detalhes da cobrança"><button className="drawer-backdrop" onClick={onClose} /><aside className="drawer wide-drawer"><header className="drawer-header"><div><p className="eyebrow">Cobrança composta</p><h2>{charge.id}</h2></div><button className="close-button" onClick={onClose}>×</button></header><div className="drawer-body"><div className="contract-identity"><StatusBadge status={charge.status} /><span>{charge.competence}</span></div><section className="balance-panel"><span>Saldo atual</span><strong>{brl.format(chargeBalance(charge))}</strong><small>de {brl.format(chargeTotal(charge))}</small></section><dl className="detail-list"><div><dt>Carteira</dt><dd>{charge.portfolio}</dd></div><div><dt>Contrato</dt><dd>{charge.contract}</dd></div><div><dt>Imóvel</dt><dd>{charge.property}</dd></div><div><dt>Unidades</dt><dd><UnitPills values={charge.units} /></dd></div><div><dt>Locatário</dt><dd>{charge.tenant}</dd></div></dl><section className="charge-items-block"><div className="section-title"><h3>Composição da cobrança</h3><span>{charge.items.length} itens</span></div><div className="charge-items">{charge.items.map((item) => <article className="charge-item" key={`${item.name}-${item.dueDate}`}><div className="charge-item-head"><strong>{item.name}</strong><span>Vence {item.dueDate}</span></div><div className="charge-item-values"><span>Previsto <b>{brl.format(item.amount)}</b></span><span>Recebido <b>{brl.format(item.received)}</b></span><span>Saldo <b>{brl.format(item.amount - item.received)}</b></span></div></article>)}</div></section><section className="history-block"><div className="section-title"><h3>Histórico de recebimentos</h3><span>{receivedTotal(charge) ? "1 registro" : "Sem registros"}</span></div>{receivedTotal(charge) ? <div className="history-entry"><i /><div><strong>{brl.format(receivedTotal(charge))}</strong><span>10 ago 2026 · Baixa manual distribuída por item</span></div></div> : <div className="history-empty">Nenhuma baixa registrada nesta cobrança.</div>}</section></div><footer className="drawer-footer"><button className="secondary-button" onClick={onClose}>Fechar</button>{charge.status !== "Recebida" && <button className="primary-button" onClick={onReceipt}>Registrar recebimento</button>}</footer></aside></div>;
}

function ContractDrawer({ contract, onClose, onCharge }: { contract: Contract; onClose: () => void; onCharge: () => void }) {
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Detalhes do contrato"><button className="drawer-backdrop" onClick={onClose} /><aside className="drawer"><header className="drawer-header"><div><p className="eyebrow">Contrato ativo</p><h2>{contract.id}</h2></div><button className="close-button" onClick={onClose}>×</button></header><div className="drawer-body"><section className="balance-panel"><span>Aluguel base</span><strong>{brl.format(contract.rent)}</strong><small>Vencimento no dia {contract.due}</small></section><dl className="detail-list"><div><dt>Carteira</dt><dd>{contract.portfolio}</dd></div><div><dt>Imóvel</dt><dd>{contract.property}</dd></div><div><dt>Unidades vinculadas</dt><dd><UnitPills values={contract.units} /></dd></div><div><dt>Locatário</dt><dd>{contract.tenant}</dd></div><div><dt>Vigência</dt><dd>{contract.period}</dd></div><div><dt>Mês de reajuste</dt><dd>{contract.adjustment}</dd></div><div><dt>Itens previstos</dt><dd><UnitPills values={contract.charges} /></dd></div></dl><aside className="contract-edit-policy" aria-label="Política de alteração do contrato"><span aria-hidden="true">!</span><div><strong>Contrato ativo não pode ser editado diretamente</strong><p>Para corrigir condições, encerre a vigência atual e use “Novo contrato” para cadastrar o substituto. Cobranças e histórico permanecem vinculados ao contrato original.</p></div></aside><InfoNote text="Salvar ou consultar o contrato não cria competências automaticamente." /></div><footer className="drawer-footer"><button className="secondary-button" onClick={onClose}>Fechar</button><button className="primary-button" onClick={onCharge}>Criar cobrança</button></footer></aside></div>;
}

function ExpenseDrawer({ expense, onClose, onStatusChange }: { expense: Expense; onClose: () => void; onStatusChange: (status: ExpenseStatus, paidIso: string) => void }) {
  const timing = expenseTiming(expense);
  const [status, setStatus] = useState<ExpenseStatus>(expense.status);
  const [paidIso, setPaidIso] = useState(expense.status === "Pago" ? DEMO_DATE_ISO : "");
  const statusChanged = status !== expense.status || (status === "Pago" && !expense.paidDate);
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Detalhes da despesa"><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer"><header className="drawer-header"><div><p className="eyebrow">Despesa</p><h2>{expense.id}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes">×</button></header><div className="drawer-body"><div className="contract-identity"><ExpenseStatusBadge status={expense.status} />{timing && <span className={expense.status === "Vencido" ? "drawer-overdue-text" : "drawer-due-text"}>{timing}</span>}</div><section className={`balance-panel expense-balance ${expense.status === "Vencido" ? "expense-balance-overdue" : ""}`}><span>Valor da despesa</span><strong>{brl.format(expense.amount)}</strong><small>{expense.status === "Pago" ? "Despesa quitada" : `Vence ${expense.dueDate}`}</small></section><section className="expense-supplier"><span>Fornecedor / beneficiário</span><strong>{expense.supplier}</strong><p>{expense.description}</p></section><dl className="detail-list expense-details"><div><dt>Categoria</dt><dd>{expense.category}</dd></div><div><dt>Vencimento</dt><dd>{expense.dueDate}</dd></div><div><dt>Data de pagamento</dt><dd>{expense.paidDate ?? "Ainda não pago"}</dd></div><div><dt>Status</dt><dd>{expense.status}</dd></div></dl>{expense.status === "Vencido" && <aside className="expense-alert"><span>!</span><div><strong>Pagamento em atraso</strong><p>Esta despesa está vencida e precisa de acompanhamento.</p></div></aside>}{expense.status === "Pendente" && timing && <aside className="expense-alert expense-alert-soon"><span>•</span><div><strong>Vencimento próximo</strong><p>Priorize a conferência desta despesa.</p></div></aside>}<section className="expense-status-editor" aria-labelledby="expense-status-title"><div><h3 id="expense-status-title">Alterar status</h3><p>Atualize a situação operacional desta despesa.</p></div><label>Status<select value={status} onChange={(event) => { const nextStatus = event.target.value as ExpenseStatus; setStatus(nextStatus); if (nextStatus === "Pago" && !paidIso) setPaidIso(DEMO_DATE_ISO); }}><option>Pendente</option><option>Vencido</option><option>Pago</option></select></label>{status === "Pago" && <label>Data do pagamento<input type="date" value={paidIso} onChange={(event) => setPaidIso(event.target.value)} required /></label>}</section></div><footer className="drawer-footer"><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button" disabled={!statusChanged || (status === "Pago" && !paidIso)} onClick={() => onStatusChange(status, paidIso)}>Salvar status</button></footer></aside></div>;
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

function EntityForm({ kind, portfolio, property, unit, tenant, documents: initialDocuments = [], chargeSourceContract, portfolioOptions, propertyOptions, unitOptions, tenantOptions, onClose, onSave }: { kind: Exclude<FormKind, null>; portfolio?: Portfolio | null; property?: Property | null; unit?: Unit | null; tenant?: Tenant | null; documents?: LocalDocument[]; chargeSourceContract?: Contract | null; portfolioOptions: Portfolio[]; propertyOptions: Property[]; unitOptions: Unit[]; tenantOptions: Tenant[]; onClose: () => void; onSave: (data: FormData, documents?: LocalDocument[]) => void }) {
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
  const initialDocumentIds = useRef(new Set(initialDocuments.map((document) => document.id)));
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
  const closeForm = () => {
    if (saving) return;
    revokeDocumentUrls(documents.filter((document) => !initialDocumentIds.current.has(document.id)));
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
    window.setTimeout(() => onSave(data, supportsDocuments ? documents : undefined), 450);
  };
  const clearFieldError = (event: FormEvent<HTMLFormElement>) => {
    const field = event.target;
    if (field instanceof HTMLElement && field.hasAttribute("aria-invalid")) {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    }
    if (formError) setFormError("");
  };
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={config[1]}><button className="drawer-backdrop" onClick={closeForm} /><form className="receipt-modal entity-modal" noValidate onSubmit={handleSubmit} onInputCapture={clearFieldError}><ModalHeader eyebrow={config[0]} title={config[1]} onClose={closeForm} /><div className="entity-modal-body"><InlineFieldError message={formError || chargeBusinessError} /><div className="form-grid entity-grid">
    {kind === "portfolio" && <><label>Nome da carteira<input name="portfolioName" placeholder="Ex.: Carteira Atlas" defaultValue={portfolio?.name ?? ""} required /></label><label>Titular<input name="portfolioHolder" placeholder="Razão social ou nome" defaultValue={portfolio?.holder ?? ""} required /></label><label className="full-field">CPF / CNPJ do titular<input name="portfolioDocument" placeholder="Documento fictício nesta demonstração" defaultValue={portfolio?.document ?? ""} required /></label></>}
    {kind === "property" && <><label>Carteira<select name="propertyPortfolio" defaultValue={property?.portfolio ?? portfolioOptions[0].name} required>{portfolioOptions.map((portfolio) => <option key={portfolio.id}>{portfolio.name}</option>)}</select></label><label>Nome do imóvel<input name="propertyName" placeholder="Ex.: Centro Empresarial" defaultValue={property?.name ?? ""} required /></label><label className="full-field">Endereço principal<input name="propertyAddress" placeholder="Logradouro, número e bairro" defaultValue={property?.address ?? ""} required /></label></>}
    {kind === "unit" && <><label>Imóvel<select name="unitProperty" defaultValue={unit?.property ?? propertyOptions[0].name} required>{propertyOptions.map((property) => <option key={property.id}>{property.name}</option>)}</select></label><label>Identificação da unidade<input name="unitName" placeholder="Ex.: Sala 101" defaultValue={unit?.name ?? ""} required /></label><label>Área privativa<span className="input-with-suffix"><input name="unitArea" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Ex.: 42" defaultValue={unit?.area ?? ""} required /><span className="input-suffix" aria-hidden="true">m²</span></span></label><label>Status inicial<select name="unitStatus" defaultValue={unit?.occupied ? "Ocupada" : "Disponível"} disabled={Boolean(unit?.occupied)} aria-describedby={unit?.occupied ? "unit-occupancy-help" : undefined}><option>Disponível</option><option>Ocupada</option></select>{unit?.occupied && <small id="unit-occupancy-help" className="field-help">Ocupação definida por contrato ativo.</small>}</label></>}
    {kind === "tenant" && <>{tenant && <div className="edit-record-banner full-field"><span>Modo de edição</span><strong>ID {tenant.id}</strong></div>}<label>Tipo<select name="tenantType" value={tenantType} onChange={(event) => { const nextType = event.target.value as Tenant["type"]; setTenantType(nextType); setTenantDocument(maskTenantDocument(tenantDocument, nextType)); setTenantDocumentError(""); }} required><option>PJ</option><option>PF</option></select></label><label>{tenantType === "PJ" ? "Razão social" : "Nome completo"}<input name="tenantName" placeholder={tenantType === "PJ" ? "Empresa locatária" : "Pessoa locatária"} defaultValue={tenant?.name ?? ""} required /></label><label className="full-field">{tenantType === "PJ" ? "CNPJ" : "CPF"}<input name="tenantDocument" inputMode="numeric" autoComplete="off" maxLength={tenantType === "PJ" ? 18 : 14} placeholder={tenantType === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} value={tenantDocument} onChange={(event) => { const masked = maskTenantDocument(event.target.value, tenantType); setTenantDocument(masked); const complete = documentDigits(masked).length === (tenantType === "PJ" ? 14 : 11); setTenantDocumentError(complete ? getTenantDocumentError(masked, tenantType) : ""); }} onBlur={() => tenantDocument && setTenantDocumentError(getTenantDocumentError(tenantDocument, tenantType))} aria-invalid={tenantDocumentError ? "true" : undefined} aria-describedby="tenant-document-help" required /><small id="tenant-document-help" className={tenantDocumentError ? "field-error" : "field-help"} role={tenantDocumentError ? "alert" : undefined}>{tenantDocumentError || `A máscara e os dígitos do ${tenantType === "PJ" ? "CNPJ" : "CPF"} serão verificados.`}</small></label></>}
    {supportsDocuments && <DocumentManager documents={documents} onChange={setDocuments} onRemove={handleDocumentRemoval} />}
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
