"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  History,
  Landmark,
  PencilLine,
  Plus,
  Trash2,
  TriangleAlert,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import type { WorkContribution, WorkContributionShare, WorkPartner } from "./work-detail-mocks";
import {
  contributionPaid,
  contributionRemaining,
  contributionStatus,
  createContributionShares,
  nextPartnerRecordId,
  participationTotal,
  partnerTotals,
  sharePaid,
  shareRemaining,
  shareStatus,
} from "./work-partners-model";

const DEMO_DATE_ISO = "2026-08-24";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day))
    .replace(".", "");
}

function ContributionStatusBadge({ status }: { status: "Pendente" | "Parcialmente pago" | "Pago" }) {
  const slug = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, "-");
  return <span className={`work-contribution-status work-contribution-${slug}`}><i aria-hidden="true" />{status}</span>;
}

export type PartnerPaymentEvent = {
  contributionId: string;
  contributionDescription: string;
  partnerName: string;
  paymentId: string;
  amount: number;
  dateIso: string;
};

type PartnerEvent = { title: string; description: string };

export function WorkPartnersPanel({ partners, contributions, openContributionRequest, onContributionRequestConsumed, onPartnersChange, onContributionsChange, onPayment, onNotify, onEvent }: {
  partners: WorkPartner[];
  contributions: WorkContribution[];
  openContributionRequest: number;
  onContributionRequestConsumed: () => void;
  onPartnersChange: (partners: WorkPartner[]) => void;
  onContributionsChange: (contributions: WorkContribution[]) => void;
  onPayment: (event: PartnerPaymentEvent) => void;
  onNotify: (message: string, reference: string) => void;
  onEvent: (event: PartnerEvent) => void;
}) {
  const [editingPartner, setEditingPartner] = useState<WorkPartner | null | undefined>(undefined);
  const [creatingContribution, setCreatingContribution] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<WorkContribution | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<{ contribution: WorkContribution; share: WorkContributionShare } | null>(null);
  const distributed = participationTotal(partners);
  const distributionComplete = Math.abs(distributed - 100) < 0.001;
  const totalRequested = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  const totalReceived = contributions.reduce((sum, contribution) => sum + contributionPaid(contribution), 0);
  const totalPending = Math.max(0, totalRequested - totalReceived);
  const pendingShares = contributions.flatMap((contribution) => contribution.shares).filter((share) => shareRemaining(share) > 0);
  const nextPending = pendingShares.sort((left, right) => shareRemaining(right) - shareRemaining(left))[0];
  const partnerSummaries = useMemo(() => partners.map((partner) => ({ partner, ...partnerTotals(partner.id, contributions) })), [contributions, partners]);

  useEffect(() => {
    if (openContributionRequest <= 0) return;
    window.queueMicrotask(() => {
      if (distributionComplete) setCreatingContribution(true);
      onContributionRequestConsumed();
    });
  }, [distributionComplete, onContributionRequestConsumed, openContributionRequest]);

  const savePartner = (partner: WorkPartner) => {
    const existing = partners.some((item) => item.id === partner.id);
    const nextPartners = existing ? partners.map((item) => item.id === partner.id ? partner : item) : [...partners, partner];
    onPartnersChange(nextPartners);
    onNotify(existing ? "Participação do sócio atualizada." : "Sócio vinculado à obra.", partner.id);
    onEvent({ title: existing ? "Participação societária atualizada" : "Sócio adicionado à obra", description: `${partner.name} · ${partner.participationPercent}% nos novos aportes.` });
    setEditingPartner(undefined);
  };

  const removePartner = (partner: WorkPartner) => {
    if (!window.confirm(`Remover ${partner.name} da distribuição dos novos aportes? O histórico será preservado.`)) return;
    onPartnersChange(partners.filter((item) => item.id !== partner.id));
    onNotify("Sócio removido da distribuição atual. O histórico foi preservado.", partner.id);
    onEvent({ title: "Sócio removido da distribuição atual", description: `${partner.name} não participará de novos aportes até ser vinculado novamente.` });
  };

  const saveContribution = (data: { amount: number; dateIso: string; description: string }) => {
    const contribution: WorkContribution = {
      id: nextPartnerRecordId("APT", contributions.map((item) => item.id)),
      amount: data.amount,
      dateIso: data.dateIso,
      description: data.description,
      shares: createContributionShares(partners, data.amount),
    };
    onContributionsChange([contribution, ...contributions]);
    onNotify("Aporte solicitado e distribuído entre os sócios.", contribution.id);
    onEvent({ title: "Novo aporte solicitado", description: `${contribution.description} · ${brl.format(contribution.amount)} distribuídos conforme a participação vigente.` });
    setCreatingContribution(false);
    setSelectedContribution(contribution);
  };

  const savePayment = (data: { amount: number; dateIso: string; note?: string }) => {
    if (!paymentTarget) return;
    const paymentId = nextPartnerRecordId("PAG-APT", contributions.flatMap((contribution) => contribution.shares.flatMap((share) => share.payments.map((payment) => payment.id))));
    const payment = { id: paymentId, amount: data.amount, dateIso: data.dateIso, note: data.note };
    const updatedContribution: WorkContribution = {
      ...paymentTarget.contribution,
      shares: paymentTarget.contribution.shares.map((share) => share.partnerId === paymentTarget.share.partnerId ? { ...share, payments: [...share.payments, payment] } : share),
    };
    onContributionsChange(contributions.map((contribution) => contribution.id === updatedContribution.id ? updatedContribution : contribution));
    onPayment({ contributionId: updatedContribution.id, contributionDescription: updatedContribution.description, partnerName: paymentTarget.share.partnerName, paymentId, amount: data.amount, dateIso: data.dateIso });
    setPaymentTarget(null);
    setSelectedContribution(updatedContribution);
  };

  return <>
    <section className="work-detail-tab-panel work-partners-panel" aria-labelledby="work-partners-title">
      <header>
        <div><p className="eyebrow">Participação financeira desta obra</p><h2 id="work-partners-title">Sócios da obra</h2><span>Distribuição societária, aportes solicitados e pagamentos efetivamente recebidos.</span></div>
        <div className="work-partners-header-actions"><button type="button" className="secondary-button button-with-icon" disabled={distributed >= 100} onClick={() => setEditingPartner(null)}><Plus aria-hidden="true" />Adicionar sócio</button><button type="button" className="primary-button button-with-icon" disabled={!distributionComplete} title={!distributionComplete ? "Complete 100% da participação para solicitar um aporte." : undefined} onClick={() => setCreatingContribution(true)}><CircleDollarSign aria-hidden="true" />Solicitar aporte</button></div>
      </header>

      <div className="work-partners-metrics" aria-label="Resumo financeiro dos sócios">
        <article><span><WalletCards aria-hidden="true" /></span><div><small>Total aportado</small><strong>{brl.format(totalReceived)}</strong><em>Somente valores efetivamente recebidos</em></div></article>
        <article className={totalPending > 0 ? "attention" : ""}><span><TriangleAlert aria-hidden="true" /></span><div><small>Aportes pendentes</small><strong>{brl.format(totalPending)}</strong><em>{pendingShares.length} participação(ões) com saldo</em></div></article>
        <article><span><UsersRound aria-hidden="true" /></span><div><small>Sócios</small><strong>{partners.length}</strong><em>Vinculados à distribuição atual</em></div></article>
        <article className={!distributionComplete ? "attention" : "complete"}><span><BriefcaseBusiness aria-hidden="true" /></span><div><small>Participação distribuída</small><strong>{distributed}%</strong><em>{distributionComplete ? "Distribuição completa" : `Faltam ${Math.max(0, 100 - distributed)}% para completar`}</em></div></article>
      </div>

      <section className={`partner-distribution ${distributionComplete ? "complete" : "incomplete"}`} aria-label="Situação da distribuição societária">
        <div><span><strong>{distributed}%</strong><small>de 100% distribuídos</small></span><i role="progressbar" aria-valuenow={Math.min(100, distributed)} aria-valuemin={0} aria-valuemax={100} aria-label={`${distributed}% da participação distribuída`}><b style={{ width: `${Math.min(100, distributed)}%` }} /></i></div>
        <p>{distributionComplete ? <><Check aria-hidden="true" /><span><strong>Distribuição completa.</strong> Novos aportes serão divididos automaticamente.</span></> : <><TriangleAlert aria-hidden="true" /><span><strong>Distribuição incompleta.</strong> Ajuste as participações até atingir 100% para criar aportes.</span></>}</p>
        <aside><small>Próximo valor pendente</small><strong>{nextPending ? brl.format(shareRemaining(nextPending)) : "Nenhum"}</strong><span>{nextPending?.partnerName ?? "Todos os aportes estão quitados"}</span></aside>
      </section>

      <section className="work-partner-list" aria-labelledby="work-partner-list-title">
        <header><div><p className="eyebrow">Distribuição vigente</p><h3 id="work-partner-list-title">Sócios</h3></div><span>Alterações valem somente para novos aportes</span></header>
        {partnerSummaries.length ? <div>{partnerSummaries.map(({ partner, invested, pending }) => <article key={partner.id} className={pending > 0 ? "has-pending" : ""}>
          <header><span className="partner-avatar">{partner.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div><small>{partner.id}</small><strong>{partner.name}</strong><em>{pending > 0 ? "Com pagamento pendente" : "Em dia"}</em></div><span className="partner-percentage" style={{ "--partner-percent": `${partner.participationPercent * 3.6}deg` } as CSSProperties}><b>{partner.participationPercent}%</b></span></header>
          <dl><div><dt>Total investido</dt><dd>{brl.format(invested)}</dd></div><div><dt>Pendente</dt><dd className={pending > 0 ? "negative" : ""}>{brl.format(pending)}</dd></div></dl>
          <footer><button type="button" onClick={() => setEditingPartner(partner)}><PencilLine aria-hidden="true" />Editar participação</button><button type="button" className="danger" onClick={() => removePartner(partner)} aria-label={`Remover ${partner.name}`}><Trash2 aria-hidden="true" /></button></footer>
        </article>)}</div> : <div className="work-partners-empty"><UsersRound aria-hidden="true" /><strong>Nenhum sócio vinculado</strong><p>Adicione os participantes e distribua 100% antes de solicitar o primeiro aporte.</p><button type="button" className="primary-button button-with-icon" onClick={() => setEditingPartner(null)}><Plus aria-hidden="true" />Adicionar sócio</button></div>}
      </section>

      <section className="work-contributions" aria-labelledby="work-contributions-title">
        <header><div><p className="eyebrow">Histórico financeiro</p><h3 id="work-contributions-title">Aportes</h3></div><span>{contributions.length} aporte(s) solicitado(s)</span></header>
        {contributions.length ? <div className="work-contributions-table-wrap"><table className="work-contributions-table"><thead><tr><th>Aporte</th><th>Data</th><th>Valor solicitado</th><th>Recebido</th><th>Pendente</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{contributions.map((contribution) => <tr key={contribution.id}><td><button type="button" onClick={() => setSelectedContribution(contribution)}><small>{contribution.id}</small><strong>{contribution.description}</strong></button></td><td>{formatDate(contribution.dateIso)}</td><td><b>{brl.format(contribution.amount)}</b></td><td><b className="positive">{brl.format(contributionPaid(contribution))}</b></td><td><b className={contributionRemaining(contribution) > 0 ? "negative" : ""}>{brl.format(contributionRemaining(contribution))}</b></td><td><ContributionStatusBadge status={contributionStatus(contribution)} /></td><td><button type="button" className="work-contribution-open" onClick={() => setSelectedContribution(contribution)}>Detalhes<ArrowRight aria-hidden="true" /></button></td></tr>)}</tbody></table></div> : <div className="work-contributions-empty"><History aria-hidden="true" /><strong>Nenhum aporte solicitado</strong><p>Quando a participação totalizar 100%, crie o primeiro aporte para gerar a divisão automática.</p></div>}
      </section>
    </section>

    {editingPartner !== undefined && <PartnerForm partner={editingPartner} partners={partners} onClose={() => setEditingPartner(undefined)} onSave={savePartner} />}
    {creatingContribution && <ContributionForm partners={partners} onClose={() => setCreatingContribution(false)} onSave={saveContribution} />}
    {selectedContribution && <ContributionDetail contribution={selectedContribution} onClose={() => setSelectedContribution(null)} onPayment={(share) => { setPaymentTarget({ contribution: selectedContribution, share }); setSelectedContribution(null); }} />}
    {paymentTarget && <ContributionPaymentForm contribution={paymentTarget.contribution} share={paymentTarget.share} onClose={() => setPaymentTarget(null)} onSave={savePayment} />}
  </>;
}

function PartnerForm({ partner, partners, onClose, onSave }: { partner: WorkPartner | null; partners: WorkPartner[]; onClose: () => void; onSave: (partner: WorkPartner) => void }) {
  const [error, setError] = useState("");
  const othersTotal = participationTotal(partners.filter((item) => item.id !== partner?.id));
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={partner ? "Editar sócio" : "Adicionar sócio"}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar formulário" /><form className="receipt-modal work-detail-modal partner-form-modal" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const participationPercent = Number(data.get("participationPercent") ?? 0); if (othersTotal + participationPercent > 100) { setError(`A participação total não pode ultrapassar 100%. Há ${100 - othersTotal}% disponíveis.`); return; } onSave({ id: partner?.id ?? nextPartnerRecordId("SOC", partners.map((item) => item.id)), name: String(data.get("name") ?? "").trim(), participationPercent }); }}><header className="modal-header"><div><p className="eyebrow">Distribuição dos novos aportes</p><h2>{partner ? "Editar sócio" : "Adicionar sócio"}</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header><div className="work-detail-modal-body"><div className="form-grid"><p className="work-detail-modal-context full-field"><strong>{100 - othersTotal}% disponíveis</strong>A alteração não modifica a distribuição registrada em aportes anteriores.</p>{error && <p className="form-error-banner full-field" role="alert"><TriangleAlert aria-hidden="true" />{error}</p>}<label className="full-field">Nome do sócio<input name="name" defaultValue={partner?.name ?? ""} placeholder="Pessoa ou empresa participante" required autoFocus /></label><label>Participação nos novos aportes (%)<input name="participationPercent" type="number" min="0.01" max={100 - othersTotal} step="0.01" defaultValue={partner?.participationPercent ?? ""} required onChange={() => setError("")} /></label></div></div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />Salvar sócio</button></footer></form></div>;
}

function ContributionForm({ partners, onClose, onSave }: { partners: WorkPartner[]; onClose: () => void; onSave: (data: { amount: number; dateIso: string; description: string }) => void }) {
  const [amount, setAmount] = useState(0);
  const shares = amount > 0 ? createContributionShares(partners, amount) : [];
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Solicitar aporte"><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar formulário" /><form className="receipt-modal work-detail-modal contribution-form-modal" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ amount: Number(data.get("amount") ?? 0), dateIso: String(data.get("dateIso") ?? ""), description: String(data.get("description") ?? "").trim() }); }}><header className="modal-header"><div><p className="eyebrow">Sócios da obra</p><h2>Solicitar novo aporte</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header><div className="work-detail-modal-body"><div className="form-grid"><label className="full-field">Motivo ou descrição<input name="description" placeholder="Ex.: Capital para a próxima etapa da obra" required autoFocus /></label><label>Valor total<input name="amount" type="number" min="0.01" step="0.01" required onChange={(event) => setAmount(Number(event.target.value))} /></label><label>Data da solicitação<input name="dateIso" type="date" defaultValue={DEMO_DATE_ISO} required /></label><section className="contribution-preview full-field"><header><div><strong>Divisão automática</strong><small>Participação vigente preservada neste aporte</small></div><b>{amount > 0 ? brl.format(amount) : "Informe o valor"}</b></header><div>{shares.map((share) => <span key={share.partnerId}><i>{share.participationPercent}%</i><strong>{share.partnerName}</strong><b>{brl.format(share.amountDue)}</b></span>)}</div></section></div></div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Check aria-hidden="true" />Criar aporte</button></footer></form></div>;
}

function ContributionDetail({ contribution, onClose, onPayment }: { contribution: WorkContribution; onClose: () => void; onPayment: (share: WorkContributionShare) => void }) {
  return <div className="modal-layer partner-detail-layer" role="dialog" aria-modal="true" aria-label={`Detalhes do aporte ${contribution.id}`}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar detalhes" /><aside className="contribution-detail-drawer" tabIndex={-1}><header><div><p className="eyebrow">{contribution.id} · {formatDate(contribution.dateIso)}</p><h2>{contribution.description}</h2><ContributionStatusBadge status={contributionStatus(contribution)} /></div><button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header><div className="contribution-detail-body"><section className="contribution-detail-totals"><div><small>Solicitado</small><strong>{brl.format(contribution.amount)}</strong></div><div><small>Recebido</small><strong>{brl.format(contributionPaid(contribution))}</strong></div><div><small>Pendente</small><strong className={contributionRemaining(contribution) > 0 ? "negative" : ""}>{brl.format(contributionRemaining(contribution))}</strong></div></section><section className="contribution-share-list"><header><div><h3>Participação dos sócios</h3><p>Percentuais preservados na criação deste aporte.</p></div><span>{contribution.shares.length} sócios</span></header><div>{contribution.shares.map((share) => <article key={share.partnerId}><span className="partner-avatar">{share.partnerName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div className="contribution-share-identity"><small>{share.participationPercent}% de participação</small><strong>{share.partnerName}</strong><ContributionStatusBadge status={shareStatus(share)} /></div><dl><div><dt>Devido</dt><dd>{brl.format(share.amountDue)}</dd></div><div><dt>Pago</dt><dd>{brl.format(sharePaid(share))}</dd></div><div><dt>Restante</dt><dd className={shareRemaining(share) > 0 ? "negative" : ""}>{brl.format(shareRemaining(share))}</dd></div></dl>{shareRemaining(share) > 0 && <button type="button" onClick={() => onPayment(share)}><Plus aria-hidden="true" />Registrar pagamento</button>}{share.payments.length ? <ul>{share.payments.map((payment) => <li key={payment.id}><History aria-hidden="true" /><span><strong>{brl.format(payment.amount)}</strong><small>{formatDate(payment.dateIso)} · {payment.note ?? payment.id}</small></span></li>)}</ul> : <p className="contribution-no-payments">Nenhum pagamento registrado.</p>}</article>)}</div></section></div><footer><button type="button" className="secondary-button" onClick={onClose}>Fechar</button></footer></aside></div>;
}

function ContributionPaymentForm({ contribution, share, onClose, onSave }: { contribution: WorkContribution; share: WorkContributionShare; onClose: () => void; onSave: (data: { amount: number; dateIso: string; note?: string }) => void }) {
  const remaining = shareRemaining(share);
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Registrar pagamento de ${share.partnerName}`}><button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Fechar formulário" /><form className="receipt-modal work-detail-modal partner-form-modal" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ amount: Number(data.get("amount") ?? 0), dateIso: String(data.get("dateIso") ?? ""), note: String(data.get("note") ?? "").trim() || undefined }); }}><header className="modal-header"><div><p className="eyebrow">{contribution.id} · Pagamento de sócio</p><h2>Registrar pagamento</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header><div className="work-detail-modal-body"><div className="form-grid"><p className="work-detail-modal-context full-field"><strong>{share.partnerName} · {share.participationPercent}%</strong>Valor devido: {brl.format(share.amountDue)} · saldo pendente: {brl.format(remaining)}</p><label>Valor recebido<input name="amount" type="number" min="0.01" max={remaining} step="0.01" required autoFocus /></label><label>Data do pagamento<input name="dateIso" type="date" defaultValue={DEMO_DATE_ISO} required /></label><label className="full-field">Observação<textarea name="note" rows={3} placeholder="Parcela ou referência do pagamento" /></label></div></div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button button-with-icon"><Landmark aria-hidden="true" />Confirmar recebimento</button></footer></form></div>;
}
