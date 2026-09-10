"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  FileSignature,
  HandCoins,
  PackageSearch,
  Paperclip,
  Plus,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import type { WorkSupplier, WorkSupplierStatus } from "./work-detail-mocks";
import { FileField } from "./file-field";

const DEMO_DATE_ISO = "2026-08-24";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(value?: string) {
  if (!value) return "Ainda não registrado";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day))
    .replace(".", "");
}

function statusFor(paidAmount: number, contractedAmount: number, dueDateIso: string): WorkSupplierStatus {
  if (paidAmount >= contractedAmount) return "Quitado";
  if (dueDateIso < DEMO_DATE_ISO) return "Vencido";
  return paidAmount > 0 ? "Parcialmente pago" : "Pendente";
}

function nextId(prefix: string, ids: string[]) {
  const highest = ids.reduce((max, id) => Math.max(max, Number(id.match(/(\d+)$/)?.[1] ?? 0)), 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

function SupplierStatus({ status }: { status: WorkSupplierStatus }) {
  const slug = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, "-");
  return <span className={`work-supplier-status work-supplier-status-${slug}`}><i aria-hidden="true" />{status}</span>;
}

type SupplierEvent = { title: string; description: string; files: string[] };

export function WorkSuppliersPanel({ suppliers, onChange, onNotify, onEvent }: {
  suppliers: WorkSupplier[];
  onChange: (suppliers: WorkSupplier[]) => void;
  onNotify: (message: string, reference: string) => void;
  onEvent: (event: SupplierEvent) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos os status");
  const [selected, setSelected] = useState<WorkSupplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<WorkSupplier | null>(null);
  const contracted = suppliers.reduce((sum, supplier) => sum + supplier.contractedAmount, 0);
  const paid = suppliers.reduce((sum, supplier) => sum + supplier.paidAmount, 0);
  const pending = Math.max(0, contracted - paid);
  const overdue = suppliers.filter((supplier) => supplier.status === "Vencido").length;
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    return suppliers.filter((supplier) => {
      const searchable = [supplier.id, supplier.name, supplier.supplyType, supplier.description].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && (status === "Todos os status" || supplier.status === status);
    });
  }, [query, status, suppliers]);

  const saveSupplier = (data: FormData) => {
    const files = data.getAll("documents").map(String).filter(Boolean);
    const contractedAmount = Number(data.get("contractedAmount") ?? 0);
    const dueDateIso = String(data.get("dueDateIso") ?? "");
    const supplier: WorkSupplier = {
      id: nextId("FOR", suppliers.map((item) => item.id)),
      name: String(data.get("name") ?? "").trim(),
      supplyType: String(data.get("supplyType") ?? "Serviço") as WorkSupplier["supplyType"],
      description: String(data.get("description") ?? "").trim(),
      contractedAmount,
      paidAmount: 0,
      status: statusFor(0, contractedAmount, dueDateIso),
      contractDateIso: String(data.get("contractDateIso") ?? ""),
      dueDateIso,
      notes: String(data.get("notes") ?? "").trim() || undefined,
      documents: files,
      payments: [],
    };
    onChange([supplier, ...suppliers]);
    onNotify("Fornecedor vinculado à obra.", supplier.id);
    onEvent({ title: "Fornecedor adicionado", description: `${supplier.name} · ${supplier.description} · ${brl.format(supplier.contractedAmount)}`, files });
    setCreating(false);
  };

  const savePayment = (supplier: WorkSupplier, data: FormData) => {
    const amount = Number(data.get("amount") ?? 0);
    const dateIso = String(data.get("dateIso") ?? "");
    const note = String(data.get("note") ?? "").trim() || undefined;
    const document = String(data.get("document") ?? "").trim() || undefined;
    const paidAmount = Math.min(supplier.contractedAmount, supplier.paidAmount + amount);
    const payment = { id: nextId("PAG-FOR", supplier.payments.map((item) => item.id)), amount, dateIso, note, document };
    const updated: WorkSupplier = {
      ...supplier,
      paidAmount,
      status: statusFor(paidAmount, supplier.contractedAmount, supplier.dueDateIso),
      lastPaymentDateIso: dateIso,
      documents: document && !supplier.documents.includes(document) ? [...supplier.documents, document] : supplier.documents,
      payments: [payment, ...supplier.payments],
    };
    onChange(suppliers.map((item) => item.id === supplier.id ? updated : item));
    onNotify("Pagamento do fornecedor registrado.", supplier.id);
    onEvent({ title: "Pagamento de fornecedor registrado", description: `${supplier.name} · ${brl.format(amount)}`, files: document ? [document] : [] });
    setPaymentTarget(null);
    setSelected(updated);
  };

  return <>
    <section className="work-detail-tab-panel work-suppliers-panel" aria-labelledby="work-suppliers-title">
      <header>
        <div><p className="eyebrow">Custos externos desta obra</p><h2 id="work-suppliers-title">Fornecedores</h2><span>Contratos, pagamentos e documentos vinculados exclusivamente a esta obra.</span></div>
        <button type="button" className="primary-button button-with-icon" onClick={() => setCreating(true)}><Plus aria-hidden="true" />Adicionar fornecedor</button>
      </header>

      <div className="work-suppliers-metrics" aria-label="Resumo financeiro dos fornecedores">
        <article><span><Building2 aria-hidden="true" /></span><div><small>Fornecedores</small><strong>{suppliers.length}</strong><em>{overdue ? `${overdue} com pagamento vencido` : "Nenhum pagamento vencido"}</em></div></article>
        <article><span><FileSignature aria-hidden="true" /></span><div><small>Valor contratado</small><strong>{brl.format(contracted)}</strong><em>Serviços, produtos e materiais</em></div></article>
        <article><span><Check aria-hidden="true" /></span><div><small>Valor pago</small><strong>{brl.format(paid)}</strong><em>{contracted ? `${Math.round((paid / contracted) * 100)}% dos contratos` : "Sem contratos cadastrados"}</em></div></article>
        <article className={overdue ? "attention" : ""}><span><WalletCards aria-hidden="true" /></span><div><small>Valor pendente</small><strong>{brl.format(pending)}</strong><em>{overdue ? "Há vencimentos que exigem atenção" : "Conforme datas dos contratos"}</em></div></article>
      </div>

      <div className="work-suppliers-toolbar">
        <label><Search aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar fornecedor ou fornecimento" aria-label="Buscar fornecedores" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar fornecedores por status"><option>Todos os status</option><option>Pendente</option><option>Parcialmente pago</option><option>Quitado</option><option>Vencido</option></select>
      </div>

      {filtered.length ? <div className="work-suppliers-table-wrap"><table className="work-suppliers-table">
        <caption className="sr-only">Fornecedores da obra: fornecimento, valores contratados e pagos, pendências, status e vencimento</caption>
        <thead><tr><th>Fornecedor</th><th>Fornecimento</th><th>Contratado / pago</th><th>Pendente</th><th>Status · vencimento</th><th><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>{filtered.map((supplier) => {
          const supplierPending = Math.max(0, supplier.contractedAmount - supplier.paidAmount);
          return <tr key={supplier.id}>
            <td data-label="Fornecedor"><button type="button" className="work-supplier-name" onClick={() => setSelected(supplier)}><span>{supplier.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><b>{supplier.name}</b><small>{supplier.id}</small></button></td>
            <td data-label="Fornecimento"><b>{supplier.description}</b><small>{supplier.supplyType}</small></td>
            <td data-label="Contratado / pago"><b>{brl.format(supplier.contractedAmount)}</b><small className="positive">pago {brl.format(supplier.paidAmount)}</small></td>
            <td data-label="Pendente"><b className={supplier.status === "Vencido" ? "negative" : ""}>{brl.format(supplierPending)}</b></td>
            <td data-label="Status e vencimento"><SupplierStatus status={supplier.status} /><small>vence {formatDate(supplier.dueDateIso)}</small></td>
            <td data-label="Ações"><button type="button" className="work-supplier-open" onClick={() => setSelected(supplier)} aria-label={`Abrir detalhes de ${supplier.name}`}>Detalhes<ArrowRight aria-hidden="true" /></button></td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="work-suppliers-empty"><PackageSearch aria-hidden="true" /><strong>{suppliers.length ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor vinculado"}</strong><p>{suppliers.length ? "Ajuste a busca ou o filtro para visualizar outros registros." : "Adicione o primeiro fornecedor para acompanhar contratos e pagamentos desta obra."}</p>{!suppliers.length && <button type="button" className="primary-button button-with-icon" onClick={() => setCreating(true)}><Plus aria-hidden="true" />Adicionar fornecedor</button>}</div>}
    </section>

    {selected && <SupplierDetail supplier={selected} onClose={() => setSelected(null)} onPayment={() => { setPaymentTarget(selected); setSelected(null); }} />}
    {creating && <SupplierForm onClose={() => setCreating(false)} onSave={saveSupplier} />}
    {paymentTarget && <SupplierPaymentForm supplier={paymentTarget} onClose={() => setPaymentTarget(null)} onSave={(data) => savePayment(paymentTarget, data)} />}
  </>;
}

function SupplierDetail({ supplier, onClose, onPayment }: { supplier: WorkSupplier; onClose: () => void; onPayment: () => void }) {
  const pending = Math.max(0, supplier.contractedAmount - supplier.paidAmount);
  return <div className="modal-layer supplier-detail-layer" role="dialog" aria-modal="true" aria-label={`Detalhes de ${supplier.name}`}>
    <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes do fornecedor" />
    <aside className="supplier-detail-drawer" tabIndex={-1}>
      <header><div><p className="eyebrow">{supplier.id} · {supplier.supplyType}</p><h2>{supplier.name}</h2><SupplierStatus status={supplier.status} /></div><button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header>
      <div className="supplier-detail-body">
        <section className="supplier-detail-amounts"><div><small>Contratado</small><strong>{brl.format(supplier.contractedAmount)}</strong></div><div><small>Pago</small><strong>{brl.format(supplier.paidAmount)}</strong></div><div><small>Pendente</small><strong className={supplier.status === "Vencido" ? "negative" : ""}>{brl.format(pending)}</strong></div></section>
        <section><h3>Fornecimento</h3><p>{supplier.description}</p></section>
        <section className="supplier-detail-dates"><h3>Datas relevantes</h3><dl><div><dt>Contratação</dt><dd>{formatDate(supplier.contractDateIso)}</dd></div><div><dt>Vencimento</dt><dd>{formatDate(supplier.dueDateIso)}</dd></div><div><dt>Último pagamento</dt><dd>{formatDate(supplier.lastPaymentDateIso)}</dd></div></dl></section>
        {supplier.notes && <section><h3>Observações</h3><p>{supplier.notes}</p></section>}
        <section><h3>Documentos e comprovantes</h3>{supplier.documents.length ? <ul className="supplier-document-list">{supplier.documents.map((document) => <li key={document}><Paperclip aria-hidden="true" /><span>{document}</span></li>)}</ul> : <p className="supplier-detail-muted">Nenhum documento anexado.</p>}</section>
        <section><h3>Histórico de pagamentos</h3>{supplier.payments.length ? <div className="supplier-payment-history">{supplier.payments.map((payment) => <article key={payment.id}><span><HandCoins aria-hidden="true" /></span><div><strong>{brl.format(payment.amount)}</strong><small>{formatDate(payment.dateIso)} · {payment.id}</small>{payment.note && <p>{payment.note}</p>}{payment.document && <em><Paperclip aria-hidden="true" />{payment.document}</em>}</div></article>)}</div> : <p className="supplier-detail-muted">Nenhum pagamento registrado.</p>}</section>
      </div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Fechar</button>{pending > 0 && <button type="button" className="primary-button button-with-icon" onClick={onPayment}><Plus aria-hidden="true" />Registrar pagamento</button>}</footer>
    </aside>
  </div>;
}

function SupplierForm({ onClose, onSave }: { onClose: () => void; onSave: (data: FormData) => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [documents, setDocuments] = useState<string[]>([]);
  useEffect(() => { window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("input")?.focus()); }, []);
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Adicionar fornecedor">
    <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar formulário" />
    <form ref={formRef} className="receipt-modal work-detail-modal supplier-form-modal" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}>
      <header className="modal-header"><div><p className="eyebrow">Fornecedores da obra</p><h2>Adicionar fornecedor</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header>
      <div className="work-detail-modal-body"><div className="form-grid">
        <label className="full-field">Nome do fornecedor<input name="name" placeholder="Razão social ou nome de identificação" required /></label>
        <label>Tipo de fornecimento<select name="supplyType"><option>Serviço</option><option>Produto</option><option>Material</option></select></label>
        <label>Valor contratado<input name="contractedAmount" type="number" min="0.01" step="0.01" required /></label>
        <label className="full-field">Serviço, produto ou material<textarea name="description" rows={3} placeholder="Descreva objetivamente o que foi contratado" required /></label>
        <label>Data da contratação<input name="contractDateIso" type="date" defaultValue={DEMO_DATE_ISO} required /></label>
        <label>Vencimento<input name="dueDateIso" type="date" required /></label>
        <label className="full-field">Observações<textarea name="notes" rows={3} placeholder="Condições, responsáveis ou orientações relevantes" /></label>
        <FileField className="full-field" name="documents" multiple label="Documentos ou comprovantes" optional hint="Somente os nomes dos arquivos são mantidos nesta demonstração." accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" value={documents} onChange={setDocuments} />
      </div></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />Adicionar fornecedor</button></footer>
    </form>
  </div>;
}

function SupplierPaymentForm({ supplier, onClose, onSave }: { supplier: WorkSupplier; onClose: () => void; onSave: (data: FormData) => void }) {
  const pending = Math.max(0, supplier.contractedAmount - supplier.paidAmount);
  const [document, setDocument] = useState<string[]>([]);
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Registrar pagamento para ${supplier.name}`}>
    <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar formulário" />
    <form className="receipt-modal work-detail-modal supplier-form-modal" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}>
      <header className="modal-header"><div><p className="eyebrow">{supplier.id} · Pagamento</p><h2>Registrar pagamento</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header>
      <div className="work-detail-modal-body"><div className="form-grid">
        <p className="work-detail-modal-context full-field"><strong>{supplier.name}</strong>Saldo pendente: {brl.format(pending)}</p>
        <label>Valor pago<input name="amount" type="number" min="0.01" max={pending} step="0.01" required autoFocus /></label>
        <label>Data do pagamento<input name="dateIso" type="date" defaultValue={DEMO_DATE_ISO} required /></label>
        <label className="full-field">Observação<textarea name="note" rows={3} placeholder="Parcela, medição ou referência do pagamento" /></label>
        <FileField className="full-field" name="document" label="Comprovante" optional hint="Somente o nome do arquivo é mantido nesta demonstração." accept=".pdf,.jpg,.jpeg,.png" value={document} onChange={setDocument} />
      </div></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />Registrar pagamento</button></footer>
    </form>
  </div>;
}
