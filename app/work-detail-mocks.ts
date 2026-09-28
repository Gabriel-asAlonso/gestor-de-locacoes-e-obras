export type WorkActivityStatus = "Não iniciada" | "Em andamento" | "Bloqueada" | "Concluída";
export type WorkActivity = {
  id: string;
  databaseId?: string;
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
  databaseId?: string;
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
  databaseId?: string;
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
  code?: string;
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
  cotaId?: string;
  partnerId: string;
  partnerName: string;
  participationPercent: number;
  amountDue: number;
  payments: WorkContributionPayment[];
};

export type WorkContribution = {
  id: string;
  databaseId?: string;
  dateIso: string;
  description: string;
  amount: number;
  shares: WorkContributionShare[];
};

export type WorkFinancialEntry = {
  id: string;
  databaseId?: string;
  canReverse?: boolean;
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
  databaseId?: string;
  kind: "Atualização" | "Ocorrência" | "Pendência" | "Arquivo";
  title: string;
  description: string;
  author: string;
  dateIso: string;
  progress?: number;
  files: string[];
  fileDocuments?: { id: string; name: string }[];
};

export type WorkPendingItem = {
  id: string;
  databaseId?: string;
  title: string;
  description: string;
  tone: "danger" | "warning" | "info";
};

