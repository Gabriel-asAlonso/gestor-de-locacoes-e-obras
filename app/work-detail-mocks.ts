import type { WorkRecord } from "./works-mocks";

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

export type WorkFinancialEntry = {
  id: string;
  kind: "Orçamento" | "Gasto" | "Aporte" | "Ajuste";
  description: string;
  party: string;
  amount: number;
  dateIso: string;
  status: "Selecionado" | "Em análise" | "Previsto" | "Pago" | "Registrado";
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
  financialEntries: WorkFinancialEntry[];
  journal: WorkJournalEntry[];
  pendingItems: WorkPendingItem[];
};

export function createWorkDetailMock(work: WorkRecord): WorkDetailMock {
  const secondaryManager = work.manager === "Marina Costa" ? "Rafael Almeida" : "Marina Costa";
  const paidAmount = Math.min(work.spent, Math.round(work.spent * 0.72));
  const remainingSpent = Math.max(0, work.spent - paidAmount);
  const executionStatus: WorkActivityStatus = work.progress >= 75 ? "Concluída" : work.progress > 15 ? "Em andamento" : "Não iniciada";
  const deliveryStatus: WorkActivityStatus = work.status === "Concluída" ? "Concluída" : "Não iniciada";

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
    financialEntries: [
      { id: "FIN-001", kind: "Orçamento", description: "Proposta aprovada para execução", party: "Construtora Base Clara", amount: work.budget, dateIso: "2026-07-02", status: "Selecionado" },
      { id: "FIN-002", kind: "Orçamento", description: "Proposta alternativa recebida", party: "Obras Horizonte Ltda.", amount: Math.round(work.budget * 1.08), dateIso: "2026-07-01", status: "Em análise" },
      ...(paidAmount > 0 ? [{ id: "FIN-003", kind: "Gasto" as const, description: "Materiais e primeira medição", party: "Construtora Base Clara", amount: paidAmount, dateIso: "2026-08-10", status: "Pago" as const }] : []),
      ...(remainingSpent > 0 ? [{ id: "FIN-004", kind: "Gasto" as const, description: "Serviços executados em conferência", party: "Equipe de execução", amount: remainingSpent, dateIso: "2026-08-23", status: "Previsto" as const }] : []),
      { id: "FIN-005", kind: "Aporte", description: "Saldo inicial destinado à obra", party: "Caixa administrativo", amount: work.budget, dateIso: work.startDateIso, status: "Registrado" },
    ],
    journal: [
      { id: "DIA-003", kind: "Atualização", title: "Frente principal em execução", description: work.nextActivity, author: work.manager, dateIso: "2026-08-24T09:20:00", progress: work.progress, files: ["registro-frente-principal.jpg"] },
      { id: "DIA-002", kind: work.risk === "Em atraso" ? "Pendência" : "Atualização", title: work.risk === "Em atraso" ? "Prazo requer reprogramação" : "Materiais conferidos", description: work.risk === "Em atraso" ? "A equipe registrou dependência de liberação para continuar o serviço." : "Materiais e equipamentos foram recebidos conforme o escopo.", author: "Carlos Mendes", dateIso: "2026-08-22T14:30:00", files: [] },
      { id: "DIA-001", kind: "Arquivo", title: "Documentos iniciais adicionados", description: "Escopo e proposta selecionada anexados ao diário.", author: work.manager, dateIso: "2026-08-18T10:00:00", files: ["escopo-aprovado.pdf", "proposta-selecionada.pdf"] },
    ],
    pendingItems: [
      ...(work.risk === "Em atraso" ? [{ id: "PEN-001", title: "Prazo ultrapassado", description: `Conclusão prevista em ${work.endLabel}.`, tone: "danger" as const }] : []),
      ...(work.risk === "Atenção" ? [{ id: "PEN-002", title: "Cronograma merece atenção", description: "Confira a próxima atividade e valide possíveis impedimentos.", tone: "warning" as const }] : []),
      ...(remainingSpent > 0 ? [{ id: "PEN-003", title: "Gasto aguardando confirmação", description: "Existe um lançamento previsto ainda não marcado como pago.", tone: "warning" as const }] : []),
      { id: "PEN-004", title: "Próxima decisão", description: work.nextActivity, tone: "info" },
    ],
  };
}
