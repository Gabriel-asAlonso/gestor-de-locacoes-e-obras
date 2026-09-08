export type WorkStatus = "Planejada" | "Em andamento" | "Pausada" | "Concluída" | "Cancelada";
export type WorkPriority = "Baixa" | "Média" | "Alta" | "Urgente";
export type WorkRisk = "Dentro do prazo" | "Atenção" | "Em atraso" | "Concluída";
export type WorkInterventionType = "Obra" | "Reforma" | "Reparo" | "Manutenção" | "Emergência";

export type WorkRecord = {
  id: string;
  title: string;
  property: string;
  unit?: string;
  manager: string;
  status: WorkStatus;
  priority: WorkPriority;
  risk: WorkRisk;
  progress: number;
  startDateIso: string;
  endDateIso: string;
  endLabel: string;
  updatedAtIso: string;
  budget: number;
  spent: number;
  projectedCashBalance: number;
  nextActivity: string;
  lastUpdateLabel: string;
  interventionType?: WorkInterventionType;
  description?: string;
  reserve?: number;
  team?: string[];
  notes?: string;
  attachments?: string[];
};

export type WorkAttention = {
  id: string;
  workId: string;
  property: string;
  dateIso: string;
  kind: "schedule" | "supplier" | "update" | "payment";
  title: string;
  description: string;
  meta: string;
  tone: "danger" | "warning" | "info";
};

export type WorkCommitment = {
  id: string;
  workId: string;
  property: string;
  dateIso: string;
  day: string;
  month: string;
  title: string;
  description: string;
  status: "Atrasado" | "Hoje" | "Próximo";
};

export const workRecords: WorkRecord[] = [
  {
    id: "OBR-001",
    title: "Reforma da cobertura e impermeabilização",
    property: "Centro Empresarial Nexo",
    manager: "Rafael Almeida",
    status: "Em andamento",
    priority: "Alta",
    risk: "Atenção",
    progress: 68,
    startDateIso: "2026-07-08",
    endDateIso: "2026-09-05",
    endLabel: "05 set 2026",
    updatedAtIso: "2026-08-24T09:20:00",
    budget: 185000,
    spent: 128400,
    projectedCashBalance: 31600,
    nextActivity: "Impermeabilização do setor B",
    lastUpdateLabel: "Atualizada hoje, 09:20",
  },
  {
    id: "OBR-002",
    title: "Adequação elétrica do Galpão 02",
    property: "Complexo Aurora",
    unit: "Galpão 02",
    manager: "Carlos Mendes",
    status: "Em andamento",
    priority: "Urgente",
    risk: "Em atraso",
    progress: 42,
    startDateIso: "2026-08-03",
    endDateIso: "2026-08-20",
    endLabel: "20 ago 2026",
    updatedAtIso: "2026-08-22T14:30:00",
    budget: 78000,
    spent: 41650,
    projectedCashBalance: 23350,
    nextActivity: "Troca do quadro de distribuição",
    lastUpdateLabel: "Atualizada há 2 dias",
  },
  {
    id: "OBR-003",
    title: "Reparo da fachada principal",
    property: "Edifício Horizonte",
    manager: "Marina Costa",
    status: "Planejada",
    priority: "Média",
    risk: "Dentro do prazo",
    progress: 12,
    startDateIso: "2026-08-31",
    endDateIso: "2026-09-18",
    endLabel: "18 set 2026",
    updatedAtIso: "2026-08-23T16:10:00",
    budget: 92000,
    spent: 8500,
    projectedCashBalance: 71500,
    nextActivity: "Selecionar orçamento da recuperação",
    lastUpdateLabel: "Atualizada ontem, 16:10",
  },
  {
    id: "OBR-004",
    title: "Renovação dos sanitários das lojas",
    property: "Shopping Alameda",
    manager: "Patrícia Nunes",
    status: "Pausada",
    priority: "Alta",
    risk: "Atenção",
    progress: 55,
    startDateIso: "2026-07-21",
    endDateIso: "2026-08-28",
    endLabel: "28 ago 2026",
    updatedAtIso: "2026-08-18T11:45:00",
    budget: 112000,
    spent: 119800,
    projectedCashBalance: -14800,
    nextActivity: "Aprovar revisão do escopo hidráulico",
    lastUpdateLabel: "Sem atualização há 6 dias",
  },
  {
    id: "OBR-005",
    title: "Modernização dos elevadores",
    property: "Edifício Jardim Central",
    manager: "Rafael Almeida",
    status: "Em andamento",
    priority: "Média",
    risk: "Dentro do prazo",
    progress: 31,
    startDateIso: "2026-08-10",
    endDateIso: "2026-09-30",
    endLabel: "30 set 2026",
    updatedAtIso: "2026-08-24T08:45:00",
    budget: 246000,
    spent: 63700,
    projectedCashBalance: 146300,
    nextActivity: "Instalação do comando da torre A",
    lastUpdateLabel: "Atualizada hoje, 08:45",
  },
  {
    id: "OBR-006",
    title: "Reparo emergencial na rede pluvial",
    property: "Parque Logístico Vereda",
    unit: "Galpão A",
    manager: "Carlos Mendes",
    status: "Em andamento",
    priority: "Urgente",
    risk: "Atenção",
    progress: 76,
    startDateIso: "2026-08-18",
    endDateIso: "2026-08-26",
    endLabel: "26 ago 2026",
    updatedAtIso: "2026-08-24T06:15:00",
    budget: 36500,
    spent: 28100,
    projectedCashBalance: 5900,
    nextActivity: "Teste de vazão e vistoria final",
    lastUpdateLabel: "Atualizada há 3 horas",
  },
  {
    id: "OBR-007",
    title: "Pintura das áreas de circulação",
    property: "Galeria Pátio Azul",
    manager: "Marina Costa",
    status: "Concluída",
    priority: "Baixa",
    risk: "Concluída",
    progress: 100,
    startDateIso: "2026-07-14",
    endDateIso: "2026-08-08",
    endLabel: "08 ago 2026",
    updatedAtIso: "2026-08-08T17:20:00",
    budget: 44500,
    spent: 42800,
    projectedCashBalance: 1700,
    nextActivity: "Entrega concluída",
    lastUpdateLabel: "Concluída em 08 ago",
  },
  {
    id: "OBR-008",
    title: "Reforma da recepção e acesso principal",
    property: "Centro Comercial Orla",
    manager: "Patrícia Nunes",
    status: "Planejada",
    priority: "Média",
    risk: "Dentro do prazo",
    progress: 5,
    startDateIso: "2026-09-14",
    endDateIso: "2026-10-15",
    endLabel: "15 out 2026",
    updatedAtIso: "2026-08-20T10:00:00",
    budget: 134000,
    spent: 4200,
    projectedCashBalance: 112800,
    nextActivity: "Validar projeto executivo",
    lastUpdateLabel: "Atualizada há 4 dias",
  },
];

export const workAttentionRecords: WorkAttention[] = [
  {
    id: "ATE-001",
    workId: "OBR-002",
    property: "Complexo Aurora",
    dateIso: "2026-08-24",
    kind: "schedule",
    title: "Atividade atrasada há 4 dias",
    description: "Troca do quadro de distribuição",
    meta: "Carlos Mendes",
    tone: "danger",
  },
  {
    id: "ATE-002",
    workId: "OBR-004",
    property: "Shopping Alameda",
    dateIso: "2026-08-24",
    kind: "supplier",
    title: "Fornecedor com pagamento vencido",
    description: "Renovação dos sanitários das lojas",
    meta: "R$ 7.800 pendentes",
    tone: "danger",
  },
  {
    id: "ATE-003",
    workId: "OBR-003",
    property: "Edifício Horizonte",
    dateIso: "2026-08-26",
    kind: "supplier",
    title: "Fornecedor aguardando cadastro",
    description: "Recuperação da fachada principal",
    meta: "Definir serviço contratado",
    tone: "warning",
  },
  {
    id: "ATE-004",
    workId: "OBR-004",
    property: "Shopping Alameda",
    dateIso: "2026-08-24",
    kind: "update",
    title: "Obra sem atualização recente",
    description: "Último registro realizado há 6 dias",
    meta: "Patrícia Nunes",
    tone: "warning",
  },
  {
    id: "ATE-005",
    workId: "OBR-001",
    property: "Centro Empresarial Nexo",
    dateIso: "2026-08-27",
    kind: "payment",
    title: "Pagamento previsto para esta semana",
    description: "2ª medição da impermeabilização",
    meta: "R$ 28.500",
    tone: "info",
  },
];

export const workCommitments: WorkCommitment[] = [
  {
    id: "COM-001",
    workId: "OBR-002",
    property: "Complexo Aurora",
    dateIso: "2026-08-24",
    day: "24",
    month: "AGO",
    title: "Regularizar quadro elétrico",
    description: "Galpão 02 · Carlos Mendes",
    status: "Atrasado",
  },
  {
    id: "COM-002",
    workId: "OBR-006",
    property: "Parque Logístico Vereda",
    dateIso: "2026-08-24",
    day: "24",
    month: "AGO",
    title: "Teste de vazão",
    description: "Galpão A · 15:00",
    status: "Hoje",
  },
  {
    id: "COM-003",
    workId: "OBR-001",
    property: "Centro Empresarial Nexo",
    dateIso: "2026-08-26",
    day: "26",
    month: "AGO",
    title: "Vistoria do setor B",
    description: "Rafael Almeida · 09:30",
    status: "Próximo",
  },
  {
    id: "COM-004",
    workId: "OBR-003",
    property: "Edifício Horizonte",
    dateIso: "2026-08-27",
    day: "27",
    month: "AGO",
    title: "Escolha do orçamento",
    description: "Reparo da fachada · 14:00",
    status: "Próximo",
  },
  {
    id: "COM-005",
    workId: "OBR-004",
    property: "Shopping Alameda",
    dateIso: "2026-08-28",
    day: "28",
    month: "AGO",
    title: "Revisão do escopo hidráulico",
    description: "Patrícia Nunes · 11:00",
    status: "Próximo",
  },
];
