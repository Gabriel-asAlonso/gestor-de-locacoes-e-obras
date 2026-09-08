import type { WorkContribution, WorkContributionShare, WorkPartner } from "./work-detail-mocks";

export type ContributionStatus = "Pendente" | "Parcialmente pago" | "Pago";

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function participationTotal(partners: WorkPartner[]) {
  return roundCurrency(partners.reduce((sum, partner) => sum + partner.participationPercent, 0));
}

export function createContributionShares(partners: WorkPartner[], amount: number): WorkContributionShare[] {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("O valor do aporte deve ser maior que zero.");
  if (!partners.length || Math.abs(participationTotal(partners) - 100) > 0.001) throw new Error("A participação dos sócios deve totalizar 100%.");
  let distributed = 0;
  return partners.map((partner, index) => {
    const amountDue = index === partners.length - 1
      ? roundCurrency(amount - distributed)
      : roundCurrency(amount * partner.participationPercent / 100);
    distributed = roundCurrency(distributed + amountDue);
    return {
      partnerId: partner.id,
      partnerName: partner.name,
      participationPercent: partner.participationPercent,
      amountDue,
      payments: [],
    };
  });
}

export function sharePaid(share: WorkContributionShare) {
  return roundCurrency(share.payments.reduce((sum, payment) => sum + payment.amount, 0));
}

export function shareRemaining(share: WorkContributionShare) {
  return Math.max(0, roundCurrency(share.amountDue - sharePaid(share)));
}

export function paymentStatus(amountDue: number, amountPaid: number): ContributionStatus {
  if (amountPaid >= amountDue) return "Pago";
  return amountPaid > 0 ? "Parcialmente pago" : "Pendente";
}

export function shareStatus(share: WorkContributionShare) {
  return paymentStatus(share.amountDue, sharePaid(share));
}

export function contributionPaid(contribution: WorkContribution) {
  return roundCurrency(contribution.shares.reduce((sum, share) => sum + sharePaid(share), 0));
}

export function contributionRemaining(contribution: WorkContribution) {
  return Math.max(0, roundCurrency(contribution.amount - contributionPaid(contribution)));
}

export function contributionStatus(contribution: WorkContribution) {
  return paymentStatus(contribution.amount, contributionPaid(contribution));
}

export function partnerTotals(partnerId: string, contributions: WorkContribution[]) {
  const shares = contributions.flatMap((contribution) => contribution.shares.filter((share) => share.partnerId === partnerId));
  const invested = roundCurrency(shares.reduce((sum, share) => sum + sharePaid(share), 0));
  const due = roundCurrency(shares.reduce((sum, share) => sum + share.amountDue, 0));
  return { invested, pending: Math.max(0, roundCurrency(due - invested)), status: paymentStatus(due, invested) };
}

export function nextPartnerRecordId(prefix: string, ids: string[]) {
  const highest = ids.reduce((max, id) => Math.max(max, Number(id.match(/(\d+)$/)?.[1] ?? 0)), 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}
