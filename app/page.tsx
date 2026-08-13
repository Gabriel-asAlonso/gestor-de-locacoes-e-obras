"use client";

import type { ReactNode } from "react";
import { FormEvent, useMemo, useState } from "react";

type Status = "Vencida" | "Em aberto" | "Próxima" | "Parcial" | "Recebida";
type ExpenseStatus = "Pendente" | "Pago" | "Vencido";
type Page = "Pendências" | "Carteiras" | "Imóveis" | "Unidades" | "Locatários" | "Contratos" | "Cobranças" | "Despesas / Contas a Pagar";
type FormKind = "portfolio" | "property" | "unit" | "tenant" | "contract" | "charge" | null;
type ChargeItem = { name: string; dueDate: string; amount: number; received: number };
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

const portfolios = [
  { id: "CAR-001", name: "Carteira Atlas", holder: "Atlas Patrimonial Ltda.", document: "12.345.678/0001-10", properties: 2, units: 5 },
  { id: "CAR-002", name: "Carteira Horizonte", holder: "Horizonte Imóveis Ltda.", document: "98.765.432/0001-20", properties: 2, units: 2 },
];

const properties = [
  { id: "IMO-001", portfolio: "Carteira Atlas", name: "Centro Empresarial Nexo", address: "Rua das Acácias, 240 · Centro", units: 3 },
  { id: "IMO-002", portfolio: "Carteira Atlas", name: "Complexo Aurora", address: "Av. do Contorno, 1180 · Norte", units: 2 },
  { id: "IMO-003", portfolio: "Carteira Horizonte", name: "Edifício Horizonte", address: "Rua do Mercado, 84 · Centro", units: 1 },
  { id: "IMO-004", portfolio: "Carteira Horizonte", name: "Galeria Pátio Azul", address: "Alameda Sul, 510 · Jardins", units: 1 },
];

const units = [
  { id: "UNI-001", property: "Centro Empresarial Nexo", portfolio: "Carteira Atlas", name: "Sala 101", area: "42 m²", occupied: true },
  { id: "UNI-002", property: "Centro Empresarial Nexo", portfolio: "Carteira Atlas", name: "Sala 102", area: "39 m²", occupied: true },
  { id: "UNI-003", property: "Centro Empresarial Nexo", portfolio: "Carteira Atlas", name: "Sala 201", area: "68 m²", occupied: false },
  { id: "UNI-004", property: "Complexo Aurora", portfolio: "Carteira Atlas", name: "Galpão 01", area: "310 m²", occupied: true },
  { id: "UNI-005", property: "Complexo Aurora", portfolio: "Carteira Atlas", name: "Galpão 02", area: "280 m²", occupied: true },
  { id: "UNI-006", property: "Edifício Horizonte", portfolio: "Carteira Horizonte", name: "Módulo A", area: "96 m²", occupied: true },
  { id: "UNI-007", property: "Galeria Pátio Azul", portfolio: "Carteira Horizonte", name: "Loja 04", area: "74 m²", occupied: false },
];

const tenants = [
  { id: "LOC-018", type: "PJ", name: "Estúdio Vereda Ltda.", document: "23.456.789/0001-11", contracts: 1 },
  { id: "LOC-021", type: "PJ", name: "Clínica Lumina Ltda.", document: "34.567.890/0001-22", contracts: 1 },
  { id: "LOC-009", type: "PJ", name: "Logística Prisma Ltda.", document: "45.678.901/0001-33", contracts: 1 },
  { id: "LOC-014", type: "PJ", name: "Oficina Sete Ltda.", document: "56.789.012/0001-44", contracts: 1 },
  { id: "LOC-004", type: "PF", name: "Marina Duarte", document: "123.456.789-00", contracts: 0 },
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

const expenses: Expense[] = [
  { id: "PAG-0031", supplier: "Energia Azul Distribuição", description: "Energia elétrica · Centro Empresarial Nexo", category: "Utilidades", amount: 1840.70, dueDate: "09 ago 2026", dueIso: "2026-08-09", paidDate: null, status: "Vencido" },
  { id: "PAG-0032", supplier: "Condomínio Empresarial Nexo", description: "Cota condominial · agosto/2026", category: "Condomínio", amount: 2460, dueDate: "12 ago 2026", dueIso: "2026-08-12", paidDate: null, status: "Pendente" },
  { id: "PAG-0033", supplier: "Manutenção Nova Chave", description: "Revisão preventiva do portão de acesso", category: "Manutenção", amount: 780, dueDate: "15 ago 2026", dueIso: "2026-08-15", paidDate: null, status: "Pendente" },
  { id: "PAG-0034", supplier: "Prefeitura Municipal", description: "IPTU · parcela 08/10", category: "Tributos", amount: 1340, dueDate: "20 ago 2026", dueIso: "2026-08-20", paidDate: null, status: "Pendente" },
  { id: "PAG-0028", supplier: "Seguradora Farol", description: "Apólice patrimonial · parcela 04/06", category: "Seguros", amount: 2250, dueDate: "05 ago 2026", dueIso: "2026-08-05", paidDate: "04 ago 2026", status: "Pago" },
  { id: "PAG-0027", supplier: "Conecta Telecom", description: "Internet corporativa · julho/2026", category: "Telecom", amount: 389.90, dueDate: "02 ago 2026", dueIso: "2026-08-02", paidDate: "01 ago 2026", status: "Pago" },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DEMO_DATE_ISO = "2026-08-12";
const UPCOMING_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const chargeTotal = (charge: Charge) => charge.items.reduce((sum, item) => sum + item.amount, 0);
const receivedTotal = (charge: Charge) => charge.items.reduce((sum, item) => sum + item.received, 0);
const chargeBalance = (charge: Charge) => chargeTotal(charge) - receivedTotal(charge);

function StatusBadge({ status }: { status: Status }) {
  const name = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(" ", "-");
  return <span className={`status status-${name}`}><i />{status}</span>;
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<Page>("Pendências");
  const [search, setSearch] = useState("");
  const [portfolioFilter, setPortfolioFilter] = useState("Todas as carteiras");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [categoryFilter, setCategoryFilter] = useState("Todas as categorias");
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [form, setForm] = useState<FormKind>(null);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const operational = charges.filter((charge) => charge.status !== "Recebida");
  const baseCharges = page === "Pendências" ? operational : charges;
  const filteredCharges = useMemo(() => baseCharges.filter((charge) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [charge.id, charge.contract, charge.property, charge.tenant, charge.competence, ...charge.units, ...charge.items.map((item) => item.name)].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === "Todas" || charge.status === statusFilter) && (portfolioFilter === "Todas as carteiras" || charge.portfolio === portfolioFilter);
  }), [baseCharges, portfolioFilter, search, statusFilter]);
  const filteredExpenses = useMemo(() => expenses.filter((expense) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [expense.id, expense.supplier, expense.description, expense.category].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === "Todas" || expense.status === statusFilter) && (categoryFilter === "Todas as categorias" || expense.category === categoryFilter);
  }), [categoryFilter, search, statusFilter]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  };
  const changePage = (next: Page) => {
    setPage(next);
    setSearch("");
    setPortfolioFilter("Todas as carteiras");
    setStatusFilter("Todas");
    setCategoryFilter("Todas as categorias");
    setMenuOpen(false);
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
    notify("Recebimento demonstrativo registrado e distribuído entre os itens.");
  };
  const saveForm = (event: FormEvent) => {
    event.preventDefault();
    setForm(null);
    notify("Cadastro salvo somente neste ambiente demonstrativo.");
  };

  if (!authenticated) return <Login loading={loading} onSubmit={login} />;

  return <main className="app-shell">
    <Sidebar page={page} operationalCount={operational.length} onNavigate={changePage} onLogout={() => setAuthenticated(false)} open={menuOpen} onClose={() => setMenuOpen(false)} />
    <section className="workspace">
      <header className="topbar">
        <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir navegação">☰</button>
        <div><span className="breadcrumb">Módulo 1 /</span> {page}</div>
        <div className="topbar-context"><span className="context-dot" /> Dados fictícios</div>
      </header>
      <div className="content">
        {(page === "Pendências" || page === "Cobranças") && <ChargesPage page={page} charges={filteredCharges} total={baseCharges.length} search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onOpen={setSelectedCharge} onNew={() => setForm("charge")} />}
        {page === "Carteiras" && <PortfoliosPage search={search} setSearch={setSearch} onNew={() => setForm("portfolio")} />}
        {page === "Imóveis" && <PropertiesPage search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => setForm("property")} />}
        {page === "Unidades" && <UnitsPage search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => setForm("unit")} />}
        {page === "Locatários" && <TenantsPage search={search} setSearch={setSearch} onNew={() => setForm("tenant")} />}
        {page === "Contratos" && <ContractsPage search={search} setSearch={setSearch} portfolioFilter={portfolioFilter} setPortfolioFilter={setPortfolioFilter} onNew={() => setForm("contract")} onOpen={setSelectedContract} />}
        {page === "Despesas / Contas a Pagar" && <ExpensesPage rows={filteredExpenses} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onOpen={setSelectedExpense} />}
      </div>
    </section>
    {selectedCharge && <ChargeDrawer charge={selectedCharge} onClose={() => setSelectedCharge(null)} onReceipt={() => setReceiptOpen(true)} />}
    {selectedContract && <ContractDrawer contract={selectedContract} onClose={() => setSelectedContract(null)} onCharge={() => { setSelectedContract(null); setForm("charge"); }} />}
    {selectedExpense && <ExpenseDrawer expense={selectedExpense} onClose={() => setSelectedExpense(null)} />}
    {receiptOpen && selectedCharge && <ReceiptModal charge={selectedCharge} onClose={() => setReceiptOpen(false)} onSave={saveReceipt} />}
    {form && <EntityForm kind={form} onClose={() => setForm(null)} onSave={saveForm} />}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
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
      <div className="login-heading"><p className="eyebrow">Acesso administrativo</p><h2>Bem-vinda.</h2><p>Entre para explorar o Módulo 1 com dados totalmente fictícios.</p></div>
      <label>E-mail<input type="email" defaultValue="administrativo@exemplo.com.br" required /></label>
      <label>Senha<input type="password" defaultValue="demonstracao" required /></label>
      <button className="primary-button login-button" disabled={loading}>{loading ? <><span className="spinner" /> Preparando ambiente</> : "Acessar demonstração"}</button>
      <p className="demo-note">Nenhum dado real do cliente é exibido nesta versão.</p>
    </form></section>
  </main>;
}

function Sidebar({ page, operationalCount, onNavigate, onLogout, open, onClose }: { page: Page; operationalCount: number; onNavigate: (page: Page) => void; onLogout: () => void; open: boolean; onClose: () => void }) {
  const [openTheme, setOpenTheme] = useState<string | null>("Operação");
  const groups: Array<{ name: string; description: string; pages: Array<{ name: Page; count?: number }> }> = [
    { name: "Operação", description: "Acompanhamento diário", pages: [{ name: "Pendências", count: operationalCount }] },
    { name: "Estrutura", description: "Cadastros e patrimônio", pages: [{ name: "Carteiras" }, { name: "Imóveis" }, { name: "Unidades" }, { name: "Locatários" }] },
    { name: "Locação", description: "Contratos e recebíveis", pages: [{ name: "Contratos" }, { name: "Cobranças" }] },
    { name: "Financeiro", description: "Obrigações financeiras", pages: [{ name: "Despesas / Contas a Pagar" }] },
  ];
  const item = (name: Page, count?: number) => <button onClick={() => onNavigate(name)} className={`nav-item ${page === name ? "active" : ""}`}><span className="nav-node" aria-hidden="true" /><span className="nav-item-label">{name}</span>{count !== undefined && <b>{count}</b>}</button>;
  return <>
    {open && <button className="mobile-backdrop" onClick={onClose} aria-label="Fechar navegação" />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div><div className="sidebar-brand"><div className="brand-mark">LR</div><div><strong>Locações</strong><span>Módulo 1</span></div></div>
        <nav aria-label="Navegação principal">
          <p className="nav-label">Áreas do módulo</p>
          <div className="theme-list">{groups.map((group, index) => {
            const expanded = openTheme === group.name;
            const hasActivePage = group.pages.some((entry) => entry.name === page);
            const regionId = `sidebar-theme-${index}`;
            return <section className="theme-group" key={group.name}>
              <button className={`theme-toggle ${expanded ? "open" : ""} ${hasActivePage ? "has-active-page" : ""}`} onClick={() => setOpenTheme(expanded ? null : group.name)} aria-expanded={expanded} aria-controls={regionId}>
                <span className="theme-identity"><span className="theme-copy"><strong>{group.name}</strong><small>{group.description}</small></span></span>
                <span className="theme-chevron-shell" aria-hidden="true"><span className="theme-chevron" /></span>
              </button>
              {expanded && <div className="theme-pages" id={regionId}>{group.pages.map((entry) => <div key={entry.name}>{item(entry.name, entry.count)}</div>)}</div>}
            </section>;
          })}</div>
        </nav>
      </div>
      <div className="sidebar-account"><div className="avatar">AD</div><div><strong>Administrativo</strong><span>Acesso único</span></div><button onClick={onLogout}>Sair</button></div>
    </aside>
  </>;
}

function PageHeading({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action && onAction && <button className="primary-button" onClick={onAction}>{action}</button>}</section>;
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="search-field"><span aria-hidden="true" /><input aria-label="Buscar" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function PortfolioFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <select aria-label="Filtrar por carteira" value={value} onChange={(event) => onChange(event.target.value)}><option>Todas as carteiras</option>{portfolios.map((portfolio) => <option key={portfolio.id}>{portfolio.name}</option>)}</select>;
}

function TableSection({ toolbar, children, footer }: { toolbar: ReactNode; children: ReactNode; footer: ReactNode }) {
  return <section className="table-section"><div className="table-toolbar">{toolbar}</div><div className="table-wrap">{children}</div><div className="table-footer">{footer}</div></section>;
}

function EmptyState() { return <div className="empty-state"><span>0</span><h3>Nenhum resultado</h3><p>Ajuste a busca ou os filtros aplicados.</p></div>; }
function UnitPills({ values }: { values: string[] }) { return <div className="tag-list">{values.map((value) => <span key={value}>{value}</span>)}</div>; }

function ChargesPage({ page, charges: rows, total, search, setSearch, portfolioFilter, setPortfolioFilter, statusFilter, setStatusFilter, onOpen, onNew }: { page: Page; charges: Charge[]; total: number; search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; onOpen: (charge: Charge) => void; onNew: () => void }) {
  const pending = charges.filter((charge) => charge.status !== "Recebida").reduce((sum, charge) => sum + chargeBalance(charge), 0);
  return <>
    <PageHeading eyebrow={page === "Pendências" ? "12 de agosto de 2026" : "Consulta operacional"} title={page} description={page === "Pendências" ? "Veja o que exige ação, a composição de cada cobrança e os saldos por competência." : "Localize cobranças por carteira, contrato, unidade, locatário ou item."} action="Nova cobrança" onAction={onNew} />
    {page === "Pendências" && <section className="summary-strip"><div><span>Saldo em acompanhamento</span><strong>{brl.format(pending)}</strong><small>Valores fictícios</small></div><div><span>Vencidas</span><strong>1</strong><small>Exige ação</small></div><div><span>Próximas</span><strong>2</strong><small>Até 15 de agosto</small></div><div><span>Baixa parcial</span><strong>1</strong><small>Saldo distribuído por item</small></div></section>}
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por contrato, unidade, locatário ou item" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /><select aria-label="Filtrar por situação" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todas</option><option>Vencida</option><option>Em aberto</option><option>Próxima</option><option>Parcial</option><option>Recebida</option></select></>} footer={<><span>{rows.length} de {total} cobranças</span><span>Inclusão e baixa manuais</span></>}>
      <table><thead><tr><th>Cobrança</th><th>Contrato / unidades</th><th>Locatário</th><th>Competência</th><th>Composição</th><th>Total</th><th>Saldo</th><th>Situação</th><th /></tr></thead><tbody>{rows.map((charge) => <tr key={charge.id} onClick={() => onOpen(charge)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen(charge)}><td><strong>{charge.id}</strong><small>{charge.portfolio}</small></td><td><strong>{charge.contract}</strong><small>{charge.property}</small><UnitPills values={charge.units} /></td><td>{charge.tenant}</td><td>{charge.competence}</td><td>{charge.items.length} {charge.items.length === 1 ? "item" : "itens"}<small>{charge.items.map((item) => item.name).join(" · ")}</small></td><td>{brl.format(chargeTotal(charge))}</td><td><strong>{brl.format(chargeBalance(charge))}</strong></td><td><StatusBadge status={charge.status} /></td><td><button className="row-action" aria-label={`Abrir ${charge.id}`}>Abrir</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}
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

function ExpensesPage({ rows, search, setSearch, statusFilter, setStatusFilter, categoryFilter, setCategoryFilter, onOpen }: { rows: Expense[]; search: string; setSearch: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; categoryFilter: string; setCategoryFilter: (value: string) => void; onOpen: (expense: Expense) => void }) {
  const totalPayable = expenses.filter((expense) => expense.status !== "Pago").reduce((sum, expense) => sum + expense.amount, 0);
  const totalOverdue = expenses.filter((expense) => expense.status === "Vencido").reduce((sum, expense) => sum + expense.amount, 0);
  const totalPaid = expenses.filter((expense) => expense.status === "Pago").reduce((sum, expense) => sum + expense.amount, 0);
  const openAccounts = expenses.filter((expense) => expense.status !== "Pago").length;
  const overdueAccounts = expenses.filter((expense) => expense.status === "Vencido").length;
  const paidAccounts = expenses.filter((expense) => expense.status === "Pago").length;
  const nextDue = expenses.filter(isUpcomingExpense).length;
  const categories = Array.from(new Set(expenses.map((expense) => expense.category)));
  return <>
    <PageHeading eyebrow="Controle financeiro operacional" title="Despesas / Contas a Pagar" description="Acompanhe obrigações financeiras, vencimentos e pagamentos em uma única visão." />
    <section className="summary-strip payable-summary" aria-label="Resumo financeiro das contas a pagar">
      <div><span>Total a pagar</span><strong>{brl.format(totalPayable)}</strong><small>{openAccounts} contas em aberto</small></div>
      <div className="summary-overdue"><span>Total vencido</span><strong>{brl.format(totalOverdue)}</strong><small>{overdueAccounts} conta exige atenção</small></div>
      <div><span>Total pago</span><strong>{brl.format(totalPaid)}</strong><small>{paidAccounts} contas quitadas</small></div>
      <div><span>Próximos vencimentos</span><strong>{nextDue}</strong><small>Nos próximos 7 dias</small></div>
    </section>
    <TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por fornecedor, descrição ou conta" /><select aria-label="Filtrar contas por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todas</option><option>Pendente</option><option>Pago</option><option>Vencido</option></select><select aria-label="Filtrar contas por categoria" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>Todas as categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></>} footer={<><span>{rows.length} de {expenses.length} contas</span><span>Valores demonstrativos</span></>}>
      <table className="expense-table" aria-label="Listagem de despesas e contas a pagar"><thead><tr><th>Conta</th><th>Fornecedor / beneficiário</th><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Pagamento</th><th>Valor</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{rows.map((expense) => {
        const timing = expenseTiming(expense);
        const rowClass = expense.status === "Vencido" ? "expense-overdue" : timing ? "expense-due-soon" : "";
        return <tr className={rowClass} key={expense.id} onClick={() => onOpen(expense)}><td><strong>{expense.id}</strong></td><td><strong>{expense.supplier}</strong></td><td>{expense.description}</td><td><span className="category-label">{expense.category}</span></td><td><strong>{expense.dueDate}</strong>{timing && <small className={expense.status === "Vencido" ? "timing-overdue" : "timing-soon"}>{timing}</small>}</td><td>{expense.paidDate ?? "—"}</td><td><strong>{brl.format(expense.amount)}</strong></td><td><ExpenseStatusBadge status={expense.status} /></td><td><button type="button" className="row-action" aria-label={`Abrir detalhes da conta ${expense.id}`} onClick={(event) => { event.stopPropagation(); onOpen(expense); }}>Abrir</button></td></tr>;
      })}</tbody></table>{rows.length === 0 && <EmptyState />}
    </TableSection>
    <InfoNote text="A forma de pagamento não foi incluída porque esse campo não está definido na documentação aprovada." />
  </>;
}

function PortfoliosPage({ search, setSearch, onNew }: { search: string; setSearch: (value: string) => void; onNew: () => void }) {
  const rows = portfolios.filter((portfolio) => `${portfolio.name}${portfolio.holder}${portfolio.document}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="Estrutura patrimonial" title="Carteiras" description="Agrupe imóveis sob a titularidade ou organização usada na operação." action="Nova carteira" onAction={onNew} /><TableSection toolbar={<SearchBar value={search} onChange={setSearch} placeholder="Buscar por carteira, titular ou CNPJ" />} footer={<><span>{rows.length} carteiras</span><span>Base demonstrativa</span></>}><table className="compact-table"><thead><tr><th>Carteira</th><th>Titular</th><th>Documento</th><th>Imóveis</th><th>Unidades</th><th /></tr></thead><tbody>{rows.map((portfolio) => <tr key={portfolio.id}><td><strong>{portfolio.name}</strong><small>{portfolio.id}</small></td><td>{portfolio.holder}</td><td>{portfolio.document}</td><td>{portfolio.properties}</td><td>{portfolio.units}</td><td><button className="row-action" onClick={onNew}>Editar</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}</TableSection></>;
}

function PropertiesPage({ search, setSearch, portfolioFilter, setPortfolioFilter, onNew }: { search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void }) {
  const rows = properties.filter((property) => `${property.name}${property.address}${property.id}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || property.portfolio === portfolioFilter));
  return <><PageHeading eyebrow="Estrutura patrimonial" title="Imóveis" description="Mantenha o endereço principal e a carteira de cada empreendimento." action="Novo imóvel" onAction={onNew} /><TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por imóvel ou endereço" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /></>} footer={<><span>{rows.length} imóveis</span><span>Carteira → imóvel → unidade</span></>}><table className="compact-table"><thead><tr><th>Imóvel</th><th>Carteira</th><th>Endereço</th><th>Unidades</th><th /></tr></thead><tbody>{rows.map((property) => <tr key={property.id}><td><strong>{property.name}</strong><small>{property.id}</small></td><td>{property.portfolio}</td><td>{property.address}</td><td>{property.units}</td><td><button className="row-action" onClick={onNew}>Editar</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}</TableSection></>;
}

function UnitsPage({ search, setSearch, portfolioFilter, setPortfolioFilter, onNew }: { search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void }) {
  const rows = units.filter((unit) => `${unit.name}${unit.property}${unit.id}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || unit.portfolio === portfolioFilter));
  return <><PageHeading eyebrow="Estrutura locável" title="Unidades" description="Identifique os espaços que podem ser vinculados, inclusive em conjunto, a um contrato." action="Nova unidade" onAction={onNew} /><TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por unidade ou imóvel" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /></>} footer={<><span>{rows.length} unidades</span><span>{rows.filter((unit) => !unit.occupied).length} disponíveis no filtro</span></>}><table className="compact-table"><thead><tr><th>Unidade</th><th>Imóvel</th><th>Carteira</th><th>Área</th><th>Ocupação</th><th /></tr></thead><tbody>{rows.map((unit) => <tr key={unit.id}><td><strong>{unit.name}</strong><small>{unit.id}</small></td><td>{unit.property}</td><td>{unit.portfolio}</td><td>{unit.area}</td><td><span className={`unit-status ${unit.occupied ? "occupied" : "available"}`}>{unit.occupied ? "Ocupada" : "Disponível"}</span></td><td><button className="row-action" onClick={onNew}>Editar</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}</TableSection></>;
}

function TenantsPage({ search, setSearch, onNew }: { search: string; setSearch: (value: string) => void; onNew: () => void }) {
  const rows = tenants.filter((tenant) => `${tenant.name}${tenant.document}${tenant.id}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="Cadastros essenciais" title="Locatários" description="Cadastre pessoa física ou jurídica e vincule-a aos contratos." action="Novo locatário" onAction={onNew} /><TableSection toolbar={<SearchBar value={search} onChange={setSearch} placeholder="Buscar por nome, CPF ou CNPJ" />} footer={<><span>{rows.length} locatários</span><span>PF e PJ</span></>}><table className="compact-table"><thead><tr><th>Locatário</th><th>Tipo</th><th>CPF / CNPJ</th><th>Contratos</th><th /></tr></thead><tbody>{rows.map((tenant) => <tr key={tenant.id}><td><strong>{tenant.name}</strong><small>{tenant.id}</small></td><td>{tenant.type}</td><td>{tenant.document}</td><td>{tenant.contracts}</td><td><button className="row-action" onClick={onNew}>Editar</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}</TableSection></>;
}

function ContractsPage({ search, setSearch, portfolioFilter, setPortfolioFilter, onNew, onOpen }: { search: string; setSearch: (value: string) => void; portfolioFilter: string; setPortfolioFilter: (value: string) => void; onNew: () => void; onOpen: (contract: Contract) => void }) {
  const rows = contracts.filter((contract) => `${contract.id}${contract.property}${contract.tenant}${contract.units.join("")}`.toLowerCase().includes(search.toLowerCase()) && (portfolioFilter === "Todas as carteiras" || contract.portfolio === portfolioFilter));
  return <><PageHeading eyebrow="Locações" title="Contratos" description="Conecte locatário, carteira, imóvel e uma ou mais unidades à condição financeira acordada." action="Novo contrato" onAction={onNew} /><TableSection toolbar={<><SearchBar value={search} onChange={setSearch} placeholder="Buscar por contrato, unidade ou locatário" /><PortfolioFilter value={portfolioFilter} onChange={setPortfolioFilter} /></>} footer={<><span>{rows.length} contratos</span><span>Cobranças não são geradas automaticamente</span></>}><table><thead><tr><th>Contrato</th><th>Imóvel / unidades</th><th>Locatário</th><th>Vigência</th><th>Aluguel</th><th>Vencimento</th><th /></tr></thead><tbody>{rows.map((contract) => <tr key={contract.id} onClick={() => onOpen(contract)}><td><strong>{contract.id}</strong><small>{contract.portfolio}</small></td><td><strong>{contract.property}</strong><UnitPills values={contract.units} /></td><td>{contract.tenant}</td><td>{contract.period}</td><td><strong>{brl.format(contract.rent)}</strong></td><td>Dia {contract.due}</td><td><button className="row-action" onClick={(event) => { event.stopPropagation(); onOpen(contract); }}>Abrir</button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState />}</TableSection><InfoNote text="O contrato define os itens previstos, mas cada cobrança continua sendo incluída manualmente por competência." /></>;
}

function InfoNote({ text }: { text: string }) { return <aside className="info-note"><span>i</span><p>{text}</p></aside>; }

function ChargeDrawer({ charge, onClose, onReceipt }: { charge: Charge; onClose: () => void; onReceipt: () => void }) {
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Detalhes da cobrança"><button className="drawer-backdrop" onClick={onClose} /><aside className="drawer wide-drawer"><header className="drawer-header"><div><p className="eyebrow">Cobrança composta</p><h2>{charge.id}</h2></div><button className="close-button" onClick={onClose}>×</button></header><div className="drawer-body"><div className="contract-identity"><StatusBadge status={charge.status} /><span>{charge.competence}</span></div><section className="balance-panel"><span>Saldo atual</span><strong>{brl.format(chargeBalance(charge))}</strong><small>de {brl.format(chargeTotal(charge))}</small></section><dl className="detail-list"><div><dt>Carteira</dt><dd>{charge.portfolio}</dd></div><div><dt>Contrato</dt><dd>{charge.contract}</dd></div><div><dt>Imóvel</dt><dd>{charge.property}</dd></div><div><dt>Unidades</dt><dd><UnitPills values={charge.units} /></dd></div><div><dt>Locatário</dt><dd>{charge.tenant}</dd></div></dl><section className="charge-items-block"><div className="section-title"><h3>Composição da cobrança</h3><span>{charge.items.length} itens</span></div><div className="charge-items">{charge.items.map((item) => <article className="charge-item" key={`${item.name}-${item.dueDate}`}><div className="charge-item-head"><strong>{item.name}</strong><span>Vence {item.dueDate}</span></div><div className="charge-item-values"><span>Previsto <b>{brl.format(item.amount)}</b></span><span>Recebido <b>{brl.format(item.received)}</b></span><span>Saldo <b>{brl.format(item.amount - item.received)}</b></span></div></article>)}</div></section><section className="history-block"><div className="section-title"><h3>Histórico de recebimentos</h3><span>{receivedTotal(charge) ? "1 registro" : "Sem registros"}</span></div>{receivedTotal(charge) ? <div className="history-entry"><i /><div><strong>{brl.format(receivedTotal(charge))}</strong><span>10 ago 2026 · Baixa manual distribuída por item</span></div></div> : <div className="history-empty">Nenhuma baixa registrada nesta cobrança.</div>}</section></div><footer className="drawer-footer"><button className="secondary-button" onClick={onClose}>Fechar</button>{charge.status !== "Recebida" && <button className="primary-button" onClick={onReceipt}>Registrar recebimento</button>}</footer></aside></div>;
}

function ContractDrawer({ contract, onClose, onCharge }: { contract: Contract; onClose: () => void; onCharge: () => void }) {
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Detalhes do contrato"><button className="drawer-backdrop" onClick={onClose} /><aside className="drawer"><header className="drawer-header"><div><p className="eyebrow">Contrato ativo</p><h2>{contract.id}</h2></div><button className="close-button" onClick={onClose}>×</button></header><div className="drawer-body"><section className="balance-panel"><span>Aluguel base</span><strong>{brl.format(contract.rent)}</strong><small>Vencimento no dia {contract.due}</small></section><dl className="detail-list"><div><dt>Carteira</dt><dd>{contract.portfolio}</dd></div><div><dt>Imóvel</dt><dd>{contract.property}</dd></div><div><dt>Unidades vinculadas</dt><dd><UnitPills values={contract.units} /></dd></div><div><dt>Locatário</dt><dd>{contract.tenant}</dd></div><div><dt>Vigência</dt><dd>{contract.period}</dd></div><div><dt>Mês de reajuste</dt><dd>{contract.adjustment}</dd></div><div><dt>Itens previstos</dt><dd><UnitPills values={contract.charges} /></dd></div></dl><InfoNote text="Salvar ou consultar o contrato não cria competências automaticamente." /></div><footer className="drawer-footer"><button className="secondary-button" onClick={onClose}>Fechar</button><button className="primary-button" onClick={onCharge}>Criar cobrança</button></footer></aside></div>;
}

function ExpenseDrawer({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const timing = expenseTiming(expense);
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Detalhes da conta a pagar"><button className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="drawer"><header className="drawer-header"><div><p className="eyebrow">Conta a pagar</p><h2>{expense.id}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar detalhes">×</button></header><div className="drawer-body"><div className="contract-identity"><ExpenseStatusBadge status={expense.status} />{timing && <span className={expense.status === "Vencido" ? "drawer-overdue-text" : "drawer-due-text"}>{timing}</span>}</div><section className={`balance-panel expense-balance ${expense.status === "Vencido" ? "expense-balance-overdue" : ""}`}><span>Valor da conta</span><strong>{brl.format(expense.amount)}</strong><small>{expense.status === "Pago" ? "Conta quitada" : `Vence ${expense.dueDate}`}</small></section><section className="expense-supplier"><span>Fornecedor / beneficiário</span><strong>{expense.supplier}</strong><p>{expense.description}</p></section><dl className="detail-list expense-details"><div><dt>Categoria</dt><dd>{expense.category}</dd></div><div><dt>Vencimento</dt><dd>{expense.dueDate}</dd></div><div><dt>Data de pagamento</dt><dd>{expense.paidDate ?? "Ainda não pago"}</dd></div><div><dt>Status</dt><dd>{expense.status}</dd></div></dl>{expense.status === "Vencido" && <aside className="expense-alert"><span>!</span><div><strong>Pagamento em atraso</strong><p>Esta conta está vencida e precisa de acompanhamento.</p></div></aside>}{expense.status === "Pendente" && timing && <aside className="expense-alert expense-alert-soon"><span>•</span><div><strong>Vencimento próximo</strong><p>Priorize a conferência desta obrigação financeira.</p></div></aside>}</div><footer className="drawer-footer"><button type="button" className="primary-button" onClick={onClose}>Fechar detalhes</button></footer></aside></div>;
}

function ReceiptModal({ charge, onClose, onSave }: { charge: Charge; onClose: () => void; onSave: (event: FormEvent) => void }) {
  const pendingItems = charge.items.filter((item) => item.amount > item.received);
  const [allocations, setAllocations] = useState(pendingItems.map((item) => item.amount - item.received));
  const allocationTotal = allocations.reduce((sum, value) => sum + Number(value || 0), 0);
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Registrar recebimento"><button className="drawer-backdrop" onClick={onClose} /><form className="receipt-modal allocation-modal" onSubmit={onSave}><ModalHeader eyebrow="Baixa manual" title="Distribuir recebimento" onClose={onClose} /><div className="receipt-summary"><div><span>Valor da cobrança</span><strong>{brl.format(chargeTotal(charge))}</strong></div><div><span>Já recebido</span><strong>{brl.format(receivedTotal(charge))}</strong></div><div><span>Saldo atual</span><strong>{brl.format(chargeBalance(charge))}</strong></div></div><div className="form-grid"><label>Data do recebimento<input type="date" defaultValue="2026-08-12" required /></label><label>Valor distribuído<input value={brl.format(allocationTotal)} readOnly /></label></div><section className="allocation-block"><div className="section-title"><h3>Distribuição por item</h3><span>Edite os valores</span></div>{pendingItems.map((item, index) => <label className="allocation-row" key={`${item.name}-${index}`}><span><strong>{item.name}</strong><small>Saldo {brl.format(item.amount - item.received)}</small></span><input aria-label={`Valor para ${item.name}`} type="number" min="0" step="0.01" max={item.amount - item.received} value={allocations[index]} onChange={(event) => setAllocations((values) => values.map((value, position) => position === index ? Number(event.target.value) : value))} /></label>)}</section><div className="post-balance"><span>Saldo após esta baixa</span><strong>{brl.format(Math.max(0, chargeBalance(charge) - allocationTotal))}</strong></div><label className="standalone-label">Observação<textarea placeholder="Ex.: pagamento parcial, complemento..." rows={3} /></label><ModalFooter onClose={onClose} action="Confirmar recebimento" /></form></div>;
}

function ModalHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) { return <header><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button type="button" className="close-button" onClick={onClose}>×</button></header>; }
function ModalFooter({ onClose, action }: { onClose: () => void; action: string }) { return <footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button">{action}</button></footer>; }

function EntityForm({ kind, onClose, onSave }: { kind: Exclude<FormKind, null>; onClose: () => void; onSave: (event: FormEvent) => void }) {
  const config = {
    portfolio: ["Estrutura patrimonial", "Nova carteira", "Salvar carteira"], property: ["Estrutura patrimonial", "Novo imóvel", "Salvar imóvel"], unit: ["Estrutura locável", "Nova unidade", "Salvar unidade"], tenant: ["Cadastro essencial", "Novo locatário", "Salvar locatário"], contract: ["Locação", "Novo contrato", "Salvar contrato"], charge: ["Inclusão manual", "Nova cobrança", "Salvar cobrança"],
  }[kind];
  const [tenantType, setTenantType] = useState("PJ");
  const [selectedUnits, setSelectedUnits] = useState<string[]>(["Sala 101"]);
  const [contractItems, setContractItems] = useState(["Aluguel", "IPTU", "Condomínio"]);
  const [chargeItems, setChargeItems] = useState([{ name: "Aluguel", due: "2026-08-10", amount: 3200 }, { name: "IPTU", due: "2026-08-10", amount: 385 }]);
  const toggleUnit = (unit: string) => setSelectedUnits((current) => current.includes(unit) ? current.filter((value) => value !== unit) : [...current, unit]);
  const addContractItem = () => setContractItems((current) => [...current, "Outro"]);
  const addChargeItem = () => setChargeItems((current) => [...current, { name: "Outro", due: "2026-08-10", amount: 0 }]);
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={config[1]}><button className="drawer-backdrop" onClick={onClose} /><form className="receipt-modal entity-modal" onSubmit={onSave}><ModalHeader eyebrow={config[0]} title={config[1]} onClose={onClose} /><div className="form-grid entity-grid">
    {kind === "portfolio" && <><label>Nome da carteira<input placeholder="Ex.: Carteira Atlas" required /></label><label>Titular<input placeholder="Razão social ou nome" required /></label><label className="full-field">CPF / CNPJ do titular<input placeholder="Documento fictício nesta demonstração" required /></label></>}
    {kind === "property" && <><label>Carteira<select required>{portfolios.map((portfolio) => <option key={portfolio.id}>{portfolio.name}</option>)}</select></label><label>Nome do imóvel<input placeholder="Ex.: Centro Empresarial" required /></label><label className="full-field">Endereço principal<input placeholder="Logradouro, número e bairro" required /></label></>}
    {kind === "unit" && <><label>Imóvel<select required>{properties.map((property) => <option key={property.id}>{property.name}</option>)}</select></label><label>Identificação da unidade<input placeholder="Ex.: Sala 101" required /></label><label>Área privativa<input placeholder="Ex.: 42 m²" /></label><label>Status inicial<select><option>Disponível</option><option>Ocupada</option></select></label></>}
    {kind === "tenant" && <><label>Tipo<select value={tenantType} onChange={(event) => setTenantType(event.target.value)}><option>PJ</option><option>PF</option></select></label><label>{tenantType === "PJ" ? "Razão social" : "Nome completo"}<input placeholder={tenantType === "PJ" ? "Empresa locatária" : "Pessoa locatária"} required /></label><label className="full-field">{tenantType === "PJ" ? "CNPJ" : "CPF"}<input placeholder={tenantType === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} required /></label></>}
    {kind === "contract" && <><label>Carteira<select><option>Carteira Atlas</option><option>Carteira Horizonte</option></select></label><label>Imóvel<select><option>Centro Empresarial Nexo</option><option>Complexo Aurora</option></select></label><fieldset className="full-field check-field"><legend>Unidades vinculadas</legend>{["Sala 101", "Sala 102", "Sala 201"].map((unit) => <label key={unit}><input type="checkbox" checked={selectedUnits.includes(unit)} onChange={() => toggleUnit(unit)} />{unit}</label>)}</fieldset><label className="full-field">Locatário<select>{tenants.map((tenant) => <option key={tenant.id}>{tenant.name}</option>)}</select></label><label>Início da vigência<input type="date" required /></label><label>Fim da vigência<input type="date" required /></label><label>Aluguel base<input type="number" min="0" required /></label><label>Dia de vencimento<input type="number" min="1" max="31" required /></label><label>Mês de reajuste<select>{["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((month) => <option key={month}>{month}</option>)}</select></label><div className="full-field repeatable-block"><div className="section-title"><h3>Itens previstos no contrato</h3><button type="button" className="text-button" onClick={addContractItem}>+ Adicionar item</button></div>{contractItems.map((item, index) => <div className="repeatable-row" key={`${item}-${index}`}><input value={item} onChange={(event) => setContractItems((items) => items.map((value, position) => position === index ? event.target.value : value))} /><button type="button" className="remove-button" onClick={() => setContractItems((items) => items.filter((_, position) => position !== index))}>Remover</button></div>)}</div><p className="form-help full-field">Salvar o contrato não cria cobranças automaticamente.</p></>}
    {kind === "charge" && <><label>Contrato<select required>{contracts.map((contract) => <option key={contract.id}>{contract.id} · {contract.tenant}</option>)}</select></label><label>Competência<input type="month" required defaultValue="2026-08" /></label><div className="full-field charge-builder"><div className="section-title"><h3>Itens da cobrança</h3><button type="button" className="text-button" onClick={addChargeItem}>+ Adicionar item</button></div>{chargeItems.map((item, index) => <div className="charge-builder-row" key={index}><span className="item-index">{String(index + 1).padStart(2, "0")}</span><label>Descrição<input value={item.name} onChange={(event) => setChargeItems((items) => items.map((value, position) => position === index ? { ...value, name: event.target.value } : value))} required /></label><label>Vencimento<input type="date" value={item.due} onChange={(event) => setChargeItems((items) => items.map((value, position) => position === index ? { ...value, due: event.target.value } : value))} required /></label><label>Valor<input type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => setChargeItems((items) => items.map((value, position) => position === index ? { ...value, amount: Number(event.target.value) } : value))} required /></label><button type="button" className="remove-button" onClick={() => setChargeItems((items) => items.filter((_, position) => position !== index))}>Remover</button></div>)}<div className="builder-total"><span>Total previsto</span><strong>{brl.format(chargeItems.reduce((sum, item) => sum + item.amount, 0))}</strong></div></div><p className="form-help full-field">A cobrança será criada manualmente apenas para esta competência.</p></>}
  </div><ModalFooter onClose={onClose} action={config[2]} /></form></div>;
}
