import type { WorkRecord } from "./works.data";

export type WorkActivityStatus = "Não iniciada" | "Em andamento" | "Bloqueada" | "Concluída";
export type WorkActivity = {
  id: string;
  stage: "Preparação" | "Execução" | "Entrega";
  title: string;
  manager: string;
  startDateIso: string;
  endDateIso: string;
  status: WorkActivityStatus;
  blockedReason?: string;
};

export type WorkTeamAllocation = {
  id: string;
  name: string;
  role: string;
  startDateIso: string;
  endDateIso: string;
  workMode: "Horas" | "Diárias";
  quantity: number;
  unitRate: number;
  activityIds: string[];
};

export type WorkSupplierStatus = "Pendente" | "Parcialmente pago" | "Quitado" | "Vencido";
export type WorkSupplierPayment = {
  id: string;
  amount: number;
  dateIso: string;
  note?: string;
  document?: string;
};

export type WorkSupplier = {
  id: string;
  name: string;
  supplyType: "Serviço" | "Produto" | "Material";
  description: string;
  contractedAmount: number;
  paidAmount: number;
  status: WorkSupplierStatus;
  contractDateIso: string;
  dueDateIso: string;
  lastPaymentDateIso?: string;
  notes?: string;
  documents: string[];
  payments: WorkSupplierPayment[];
};

export type WorkPartner = {
  id: string;
  name: string;
  participationPercent: number;
};

export type WorkContributionPayment = {
  id: string;
  amount: number;
  dateIso: string;
  note?: string;
};

export type WorkContributionShare = {
  partnerId: string;
  partnerName: string;
  participationPercent: number;
  amountDue: number;
  payments: WorkContributionPayment[];
};

export type WorkContribution = {
  id: string;
  dateIso: string;
  description: string;
  amount: number;
  shares: WorkContributionShare[];
};

export type WorkFinancialEntry = {
  id: string;
  kind: "Aporte" | "Ajuste";
  description: string;
  party: string;
  amount: number;
  dateIso: string;
  status: "Registrado";
  sourceId?: string;
};

export type WorkJournalEntry = {
  id: string;
  kind: "Atualização" | "Ocorrência" | "Pendência" | "Arquivo";
  title: string;
  description: string;
  author: string;
  dateIso: string;
  progress?: number;
  files: string[];
};

export type WorkPendingItem = {
  id: string;
  title: string;
  description: string;
  tone: "danger" | "warning" | "info";
};

export type WorkDetailMock = {
  activities: WorkActivity[];
  team: WorkTeamAllocation[];
  suppliers: WorkSupplier[];
  partners: WorkPartner[];
  contributions: WorkContribution[];
  financialEntries: WorkFinancialEntry[];
  journal: WorkJournalEntry[];
  pendingItems: WorkPendingItem[];
};

export function createWorkDetailMock(work: WorkRecord): WorkDetailMock {
  const secondaryManager = work.manager === "Marina Costa" ? "Rafael Almeida" : "Marina Costa";
  const executionStatus: WorkActivityStatus = work.progress >= 75 ? "Concluída" : work.progress > 15 ? "Em andamento" : "Não iniciada";
  const deliveryStatus: WorkActivityStatus = work.status === "Concluída" ? "Concluída" : "Não iniciada";
  const teamCost = 32 * 145 + 12 * 420 + 18 * 130;
  const supplierContracted = Math.max(12000, Math.round(Math.max(work.budget - teamCost, work.budget * 0.68)));
  const materialsContracted = Math.round(supplierContracted * 0.62);
  const servicesContracted = supplierContracted - materialsContracted;
  const supplierPaid = Math.min(supplierContracted, Math.max(0, work.spent - teamCost));
  const materialsPaid = Math.min(materialsContracted, Math.round(supplierPaid * 0.72));
  const servicesPaid = Math.min(servicesContracted, supplierPaid - materialsPaid);
  const materialsStatus: WorkSupplierStatus = materialsPaid >= materialsContracted ? "Quitado" : materialsPaid > 0 ? "Parcialmente pago" : "Pendente";
  const servicesStatus: WorkSupplierStatus = servicesPaid >= servicesContracted ? "Quitado" : work.risk === "Em atraso" ? "Vencido" : servicesPaid > 0 ? "Parcialmente pago" : "Pendente";
  const partners: WorkPartner[] = [
    { id: "SOC-001", name: "Nexo Participações", participationPercent: 50 },
    { id: "SOC-002", name: "Augusto Lima", participationPercent: 30 },
    { id: "SOC-003", name: "Carolina Freitas", participationPercent: 20 },
  ];
  const contributionAmount = Math.max(10000, Math.round(work.budget * 0.72));
  const firstShare = Math.round(contributionAmount * 0.5 * 100) / 100;
  const secondShare = Math.round(contributionAmount * 0.3 * 100) / 100;
  const thirdShare = contributionAmount - firstShare - secondShare;
  const firstPartnerPaid = work.status === "Planejada" ? 0 : firstShare;
  const secondPartnerPaid = work.status === "Concluída" ? secondShare : work.progress >= 30 ? Math.round(secondShare * 0.55 * 100) / 100 : 0;
  const thirdPartnerPaid = work.status === "Concluída" ? thirdShare : 0;
  const initialContribution: WorkContribution = {
    id: "APT-001",
    dateIso: work.startDateIso,
    description: "Capital inicial para execução da obra",
    amount: contributionAmount,
    shares: [
      {
        partnerId: partners[0].id,
        partnerName: partners[0].name,
        participationPercent: partners[0].participationPercent,
        amountDue: firstShare,
        payments: firstPartnerPaid > 0 ? [
          { id: "PAG-APT-001", amount: Math.round(firstPartnerPaid * 0.45 * 100) / 100, dateIso: work.startDateIso, note: "Primeira parcela do aporte." },
          { id: "PAG-APT-002", amount: firstPartnerPaid - Math.round(firstPartnerPaid * 0.45 * 100) / 100, dateIso: "2026-08-10", note: "Complemento da participação no aporte." },
        ] : [],
      },
      {
        partnerId: partners[1].id,
        partnerName: partners[1].name,
        participationPercent: partners[1].participationPercent,
        amountDue: secondShare,
        payments: secondPartnerPaid > 0 ? [{ id: "PAG-APT-003", amount: secondPartnerPaid, dateIso: "2026-08-12", note: "Pagamento parcial registrado." }] : [],
      },
      {
        partnerId: partners[2].id,
        partnerName: partners[2].name,
        participationPercent: partners[2].participationPercent,
        amountDue: thirdShare,
        payments: thirdPartnerPaid > 0 ? [{ id: "PAG-APT-004", amount: thirdPartnerPaid, dateIso: "2026-08-18", note: "Participação quitada." }] : [],
      },
    ],
  };
  return {
    activities: [
      { id: "ATV-001", stage: "Preparação", title: "Vistoria técnica e validação do escopo", manager: work.manager, startDateIso: work.startDateIso, endDateIso: work.startDateIso, status: "Concluída" },
      { id: "ATV-002", stage: "Preparação", title: "Mobilização da equipe e proteção da área", manager: "Carlos Mendes", startDateIso: work.startDateIso, endDateIso: "2026-08-05", status: "Concluída" },
      { id: "ATV-003", stage: "Execução", title: work.nextActivity, manager: work.manager, startDateIso: "2026-08-18", endDateIso: "2026-08-28", status: executionStatus },
      { id: "ATV-004", stage: "Execução", title: "Conferência dos serviços e correções", manager: secondaryManager, startDateIso: "2026-08-29", endDateIso: "2026-09-02", status: work.status === "Concluída" ? "Concluída" : work.risk === "Em atraso" ? "Bloqueada" : "Não iniciada", blockedReason: work.status !== "Concluída" && work.risk === "Em atraso" ? "Aguardando liberação da área pelo responsável local." : undefined },
      { id: "ATV-005", stage: "Entrega", title: "Vistoria final e termo de entrega", manager: work.manager, startDateIso: work.endDateIso, endDateIso: work.endDateIso, status: deliveryStatus },
    ],
    team: [
      { id: "EQP-001", name: work.manager, role: "Responsável principal", startDateIso: work.startDateIso, endDateIso: work.endDateIso, workMode: "Horas", quantity: 32, unitRate: 145, activityIds: ["ATV-001", "ATV-003", "ATV-005"] },
      { id: "EQP-002", name: "Carlos Mendes", role: "Supervisor de campo", startDateIso: work.startDateIso, endDateIso: work.endDateIso, workMode: "Diárias", quantity: 12, unitRate: 420, activityIds: ["ATV-002", "ATV-003"] },
      { id: "EQP-003", name: secondaryManager, role: "Apoio técnico", startDateIso: "2026-08-18", endDateIso: work.endDateIso, workMode: "Horas", quantity: 18, unitRate: 130, activityIds: ["ATV-004", "ATV-005"] },
    ],
    suppliers: [
      {
        id: "FOR-001",
        name: "Suprimentos Base Clara",
        supplyType: "Material",
        description: "Materiais e insumos para a frente principal da obra",
        contractedAmount: materialsContracted,
        paidAmount: materialsPaid,
        status: materialsStatus,
        contractDateIso: "2026-07-04",
        dueDateIso: "2026-09-05",
        lastPaymentDateIso: materialsPaid > 0 ? "2026-08-10" : undefined,
        notes: "Entregas liberadas conforme medição e conferência do responsável da obra.",
        documents: ["contrato-fornecimento.pdf", ...(materialsPaid > 0 ? ["comprovante-primeira-parcela.pdf"] : [])],
        payments: materialsPaid > 0 ? [{ id: "PAG-FOR-001", amount: materialsPaid, dateIso: "2026-08-10", note: "Primeira parcela após entrega dos materiais.", document: "comprovante-primeira-parcela.pdf" }] : [],
      },
      {
        id: "FOR-002",
        name: "Serviços Horizonte",
        supplyType: "Serviço",
        description: "Execução especializada, testes e apoio à entrega",
        contractedAmount: servicesContracted,
        paidAmount: servicesPaid,
        status: servicesStatus,
        contractDateIso: "2026-07-08",
        dueDateIso: work.risk === "Em atraso" ? "2026-08-20" : work.endDateIso,
        lastPaymentDateIso: servicesPaid > 0 ? "2026-08-18" : undefined,
        notes: "Pagamento vinculado à validação da etapa executada.",
        documents: ["ordem-de-servico.pdf"],
        payments: servicesPaid > 0 ? [{ id: "PAG-FOR-002", amount: servicesPaid, dateIso: "2026-08-18", note: "Medição parcial aprovada." }] : [],
      },
    ],
    partners,
    contributions: [initialContribution],
    financialEntries: initialContribution.shares.flatMap((share) => share.payments).map((payment, index) => ({
      id: `FIN-${String(index + 1).padStart(3, "0")}`,
      kind: "Aporte" as const,
      description: `${initialContribution.description} · pagamento de sócio`,
      party: initialContribution.shares.find((share) => share.payments.some((item) => item.id === payment.id))?.partnerName ?? "Sócio da obra",
      amount: payment.amount,
      dateIso: payment.dateIso,
      status: "Registrado" as const,
      sourceId: initialContribution.id,
    })),
    journal: [
      { id: "DIA-003", kind: "Atualização", title: "Frente principal em execução", description: work.nextActivity, author: work.manager, dateIso: "2026-08-24T09:20:00", progress: work.progress, files: ["registro-frente-principal.jpg"] },
      { id: "DIA-002", kind: work.risk === "Em atraso" ? "Pendência" : "Atualização", title: work.risk === "Em atraso" ? "Prazo requer reprogramação" : "Materiais conferidos", description: work.risk === "Em atraso" ? "A equipe registrou dependência de liberação para continuar o serviço." : "Materiais e equipamentos foram recebidos conforme o escopo.", author: "Carlos Mendes", dateIso: "2026-08-22T14:30:00", files: [] },
      { id: "DIA-001", kind: "Arquivo", title: "Documentos iniciais adicionados", description: "Escopo e proposta selecionada anexados ao diário.", author: work.manager, dateIso: "2026-08-18T10:00:00", files: ["escopo-aprovado.pdf", "proposta-selecionada.pdf"] },
    ],
    pendingItems: [
      ...(work.risk === "Em atraso" ? [{ id: "PEN-001", title: "Prazo ultrapassado", description: `Conclusão prevista em ${work.endLabel}.`, tone: "danger" as const }] : []),
      ...(work.risk === "Atenção" ? [{ id: "PEN-002", title: "Cronograma merece atenção", description: "Confira a próxima atividade e valide possíveis impedimentos.", tone: "warning" as const }] : []),
      ...(servicesStatus === "Vencido" ? [{ id: "PEN-003", title: "Fornecedor com pagamento vencido", description: `${servicesStatus === "Vencido" ? "Serviços Horizonte" : "Fornecedor"} possui saldo pendente após o vencimento.`, tone: "warning" as const }] : []),
      { id: "PEN-004", title: "Próxima decisão", description: work.nextActivity, tone: "info" },
    ],
  };
}
