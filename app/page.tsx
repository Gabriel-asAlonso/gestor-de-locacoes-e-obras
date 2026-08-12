"use client";

import { FormEvent, useMemo, useState } from "react";

type Status = "Vencida" | "Em aberto" | "Próxima" | "Parcial" | "Recebida";

type Charge = {
  id: string;
  contract: string;
  property: string;
  tenant: string;
  competence: string;
  dueDate: string;
  dueDateISO: string;
  amount: number;
  received: number;
  status: Status;
};

const charges: Charge[] = [
  { id: "COB-0084", contract: "CTR-014", property: "Sala 03 · Centro", tenant: "Ateliê Norte", competence: "07/2026", dueDate: "10 ago 2026", dueDateISO: "2026-08-10", amount: 3200, received: 0, status: "Vencida" },
  { id: "COB-0086", contract: "CTR-021", property: "Loja 02 · Galeria", tenant: "Café Brisa", competence: "08/2026", dueDate: "12 ago 2026", dueDateISO: "2026-08-12", amount: 4850, received: 2000, status: "Parcial" },
  { id: "COB-0087", contract: "CTR-009", property: "Sala 11 · Centro", tenant: "Instituto Horizonte", competence: "08/2026", dueDate: "14 ago 2026", dueDateISO: "2026-08-14", amount: 2900, received: 0, status: "Próxima" },
  { id: "COB-0088", contract: "CTR-018", property: "Módulo B · Anexo", tenant: "Oficina Sete", competence: "08/2026", dueDate: "15 ago 2026", dueDateISO: "2026-08-15", amount: 1750, received: 0, status: "Próxima" },
  { id: "COB-0079", contract: "CTR-004", property: "Loja 01 · Galeria", tenant: "Casa Amora", competence: "07/2026", dueDate: "05 ago 2026", dueDateISO: "2026-08-05", amount: 6100, received: 0, status: "Vencida" },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function StatusBadge({ status }: { status: Status }) {
  const normalized = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(" ", "-");
  return <span className={`status status-${normalized}`}><i />{status}</span>;
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [selected, setSelected] = useState<Charge | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [toast, setToast] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return charges.filter((charge) => {
      const matchesTerm = !term || [charge.id, charge.contract, charge.property, charge.tenant, charge.competence]
        .some((value) => value.toLowerCase().includes(term));
      const matchesStatus = statusFilter === "Todas" || charge.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [search, statusFilter]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      setAuthenticated(true);
      setLoading(false);
    }, 650);
  }

  function registerReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReceiptOpen(false);
    setSelected(null);
    setToast("Recebimento registrado. Saldo e histórico foram atualizados.");
    window.setTimeout(() => setToast(""), 4200);
  }

  if (!authenticated) {
    return (
      <main className="login-page">
        <section className="login-brand" aria-label="Apresentação do sistema">
          <div className="brand-mark brand-mark-light">LR</div>
          <div className="login-copy">
            <p className="eyebrow eyebrow-light">Módulo 1</p>
            <h1>Locações<br />& recebíveis</h1>
            <p>Controle operacional claro para contratos, cobranças e recebimentos.</p>
          </div>
          <div className="login-footer"><span /> Operação centralizada</div>
        </section>

        <section className="login-panel">
          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-heading">
              <p className="eyebrow">Acesso administrativo</p>
              <h2>Bem-vinda.</h2>
              <p>Entre para acompanhar as pendências do módulo.</p>
            </div>
            <label>E-mail<input type="email" defaultValue="administrativo@exemplo.com.br" required /></label>
            <label>Senha<input type="password" defaultValue="demonstracao" required /></label>
            <button className="primary-button login-button" type="submit" disabled={loading}>
              {loading ? <><span className="spinner" /> Preparando ambiente</> : "Acessar demonstração"}
            </button>
            <p className="demo-note">Ambiente demonstrativo com dados simulados.</p>
          </form>
        </section>
      </main>
    );
  }

  const outstanding = charges.reduce((total, charge) => total + (charge.amount - charge.received), 0);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <div className="brand-mark">LR</div>
            <div><strong>Locações</strong><span>Módulo 1</span></div>
          </div>
          <nav aria-label="Navegação principal">
            <p className="nav-label">Operação</p>
            <button className="nav-item active"><span className="nav-dot" />Pendências <b>{charges.length}</b></button>
          </nav>
        </div>
        <div className="sidebar-account">
          <div className="avatar">AD</div>
          <div><strong>Administrativo</strong><span>Acesso único</span></div>
          <button onClick={() => setAuthenticated(false)} aria-label="Sair">Sair</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><span className="breadcrumb">Operação /</span> Pendências</div>
          <div className="topbar-context"><span className="context-dot" /> Dados atualizados agora</div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">12 de agosto de 2026</p>
              <h1>Pendências</h1>
              <p>Acompanhe o que exige ação e registre recebimentos sem sair do contexto.</p>
            </div>
            <button className="primary-button">Nova cobrança</button>
          </section>

          <section className="summary-strip" aria-label="Resumo operacional">
            <div><span>Saldo pendente</span><strong>{brl.format(outstanding)}</strong><small>5 cobranças em acompanhamento</small></div>
            <div><span>Vencidas</span><strong>2</strong><small>{brl.format(9300)} em aberto</small></div>
            <div><span>Próximas do vencimento</span><strong>2</strong><small>Até 15 de agosto</small></div>
            <div><span>Com baixa parcial</span><strong>1</strong><small>{brl.format(2850)} de saldo</small></div>
          </section>

          <section className="table-section">
            <div className="table-toolbar">
              <div className="search-field"><span aria-hidden="true" /><input aria-label="Buscar pendências" placeholder="Buscar por imóvel, locatário ou contrato" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              <select aria-label="Filtrar por situação" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todas</option><option>Vencida</option><option>Em aberto</option><option>Próxima</option><option>Parcial</option></select>
              <button className="secondary-button">Mais filtros</button>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>Cobrança</th><th>Imóvel / locatário</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Saldo</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>
                  {filtered.map((charge) => (
                    <tr key={charge.id} onClick={() => setSelected(charge)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(charge)}>
                      <td><strong>{charge.id}</strong><small>{charge.contract}</small></td>
                      <td><strong>{charge.property}</strong><small>{charge.tenant}</small></td>
                      <td>{charge.competence}</td><td>{charge.dueDate}</td><td>{brl.format(charge.amount)}</td><td><strong>{brl.format(charge.amount - charge.received)}</strong></td><td><StatusBadge status={charge.status} /></td>
                      <td><button className="row-action" aria-label={`Abrir ${charge.id}`}>Abrir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="empty-state"><span>0</span><h3>Nenhuma pendência encontrada</h3><p>Ajuste a busca ou remova os filtros aplicados.</p><button className="secondary-button" onClick={() => { setSearch(""); setStatusFilter("Todas"); }}>Limpar filtros</button></div>}
            </div>
            <div className="table-footer"><span>{filtered.length} de {charges.length} pendências</span><span>Página 1 de 1</span></div>
          </section>
        </div>
      </section>

      {selected && (
        <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Detalhes da cobrança">
          <button className="drawer-backdrop" onClick={() => setSelected(null)} aria-label="Fechar detalhes" />
          <aside className="drawer">
            <header className="drawer-header"><div><p className="eyebrow">Cobrança</p><h2>{selected.id}</h2></div><button className="close-button" onClick={() => setSelected(null)} aria-label="Fechar">×</button></header>
            <div className="drawer-body">
              <StatusBadge status={selected.status} />
              <section className="balance-panel"><span>Saldo atual</span><strong>{brl.format(selected.amount - selected.received)}</strong><small>de {brl.format(selected.amount)}</small></section>
              <dl className="detail-list">
                <div><dt>Imóvel / módulo</dt><dd>{selected.property}</dd></div><div><dt>Locatário</dt><dd>{selected.tenant}</dd></div><div><dt>Contrato</dt><dd>{selected.contract}</dd></div><div><dt>Competência</dt><dd>{selected.competence}</dd></div><div><dt>Vencimento</dt><dd>{selected.dueDate}</dd></div>
              </dl>
              <section className="history-block"><div className="section-title"><h3>Histórico de recebimentos</h3><span>{selected.received > 0 ? "1 registro" : "Sem registros"}</span></div>
                {selected.received > 0 ? <div className="history-entry"><i /><div><strong>{brl.format(selected.received)}</strong><span>10 ago 2026 · Pagamento parcial</span></div></div> : <div className="history-empty">Nenhuma baixa registrada nesta cobrança.</div>}
              </section>
            </div>
            <footer className="drawer-footer"><button className="secondary-button" onClick={() => setSelected(null)}>Fechar</button><button className="primary-button" onClick={() => setReceiptOpen(true)}>Registrar recebimento</button></footer>
          </aside>
        </div>
      )}

      {receiptOpen && selected && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Registrar recebimento">
          <button className="drawer-backdrop" onClick={() => setReceiptOpen(false)} aria-label="Fechar" />
          <form className="receipt-modal" onSubmit={registerReceipt}>
            <header><div><p className="eyebrow">Baixa manual</p><h2>Registrar recebimento</h2></div><button type="button" className="close-button" onClick={() => setReceiptOpen(false)}>×</button></header>
            <div className="receipt-summary"><div><span>Valor da cobrança</span><strong>{brl.format(selected.amount)}</strong></div><div><span>Já recebido</span><strong>{brl.format(selected.received)}</strong></div><div><span>Saldo atual</span><strong>{brl.format(selected.amount - selected.received)}</strong></div></div>
            <div className="form-grid"><label>Data do recebimento<input type="date" defaultValue="2026-08-12" required /></label><label>Valor recebido<input type="number" min="0.01" step="0.01" max={selected.amount - selected.received} defaultValue={selected.amount - selected.received} required /></label><label className="full-field">Observação<textarea placeholder="Ex.: pagamento parcial, complemento..." rows={3} /></label></div>
            <footer><button type="button" className="secondary-button" onClick={() => setReceiptOpen(false)}>Cancelar</button><button type="submit" className="primary-button">Confirmar recebimento</button></footer>
          </form>
        </div>
      )}

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
