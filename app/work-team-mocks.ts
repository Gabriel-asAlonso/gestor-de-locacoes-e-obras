import type { WorkRecord } from "./works-mocks";

export type WorkPersonType = "Funcionário" | "Prestador";
export type WorkPersonStatus = "Ativa" | "Inativa";
export type WorkCostMode = "Hora" | "Diária";

export type WorkPersonAllocation = {
  id: string;
  workId: string;
  role: string;
  startDateIso: string;
  endDateIso: string;
  status: "Atual" | "Encerrada";
};

export type WorkPerson = {
  id: string;
  name: string;
  type: WorkPersonType;
  role: string;
  contact: string;
  costMode?: WorkCostMode;
  costRate?: number;
  status: WorkPersonStatus;
  notes?: string;
  activeActivities: number;
  lateActivities: number;
  allocations: WorkPersonAllocation[];
};

export function createWorkTeamPeople(works: WorkRecord[]): WorkPerson[] {
  const workId = (index: number) => works[index % Math.max(works.length, 1)]?.id ?? "OBR-001";
  return [
    {
      id: "PES-001",
      name: "Rafael Almeida",
      type: "Funcionário",
      role: "Engenheiro responsável",
      contact: "rafael.almeida@demonstracao.com",
      costMode: "Hora",
      costRate: 145,
      status: "Ativa",
      notes: "Responsável técnico pelas obras de maior complexidade.",
      activeActivities: 5,
      lateActivities: 1,
      allocations: [
        { id: "ALO-001", workId: workId(0), role: "Responsável técnico", startDateIso: "2026-07-08", endDateIso: "2026-09-05", status: "Atual" },
        { id: "ALO-002", workId: workId(4), role: "Responsável técnico", startDateIso: "2026-08-10", endDateIso: "2026-09-30", status: "Atual" },
      ],
    },
    {
      id: "PES-002",
      name: "Carlos Mendes",
      type: "Funcionário",
      role: "Supervisor de campo",
      contact: "(11) 98842-1730",
      costMode: "Diária",
      costRate: 420,
      status: "Ativa",
      activeActivities: 4,
      lateActivities: 2,
      allocations: [
        { id: "ALO-003", workId: workId(1), role: "Supervisor de execução", startDateIso: "2026-08-03", endDateIso: "2026-08-30", status: "Atual" },
        { id: "ALO-004", workId: workId(5), role: "Apoio de vistoria", startDateIso: "2026-08-20", endDateIso: "2026-08-26", status: "Atual" },
      ],
    },
    {
      id: "PES-003",
      name: "Marina Costa",
      type: "Funcionário",
      role: "Arquiteta",
      contact: "marina.costa@demonstracao.com",
      costMode: "Hora",
      costRate: 130,
      status: "Ativa",
      activeActivities: 3,
      lateActivities: 0,
      allocations: [
        { id: "ALO-005", workId: workId(2), role: "Projeto e especificações", startDateIso: "2026-08-18", endDateIso: "2026-09-18", status: "Atual" },
        { id: "ALO-006", workId: workId(6), role: "Acompanhamento de acabamento", startDateIso: "2026-07-14", endDateIso: "2026-08-08", status: "Encerrada" },
      ],
    },
    {
      id: "PES-004",
      name: "Patrícia Nunes",
      type: "Funcionário",
      role: "Coordenadora de obras",
      contact: "(11) 97731-4062",
      costMode: "Hora",
      costRate: 155,
      status: "Ativa",
      activeActivities: 6,
      lateActivities: 1,
      allocations: [
        { id: "ALO-007", workId: workId(3), role: "Coordenação operacional", startDateIso: "2026-07-21", endDateIso: "2026-08-28", status: "Atual" },
        { id: "ALO-008", workId: workId(7), role: "Coordenação de planejamento", startDateIso: "2026-08-24", endDateIso: "2026-10-15", status: "Atual" },
      ],
    },
    {
      id: "PES-005",
      name: "Lucas Rocha",
      type: "Prestador",
      role: "Técnico de manutenção",
      contact: "(11) 96510-8892",
      costMode: "Diária",
      costRate: 390,
      status: "Ativa",
      activeActivities: 2,
      lateActivities: 0,
      allocations: [
        { id: "ALO-009", workId: workId(5), role: "Execução hidráulica", startDateIso: "2026-08-20", endDateIso: "2026-08-26", status: "Atual" },
      ],
    },
    {
      id: "PES-006",
      name: "Ana Beatriz Lima",
      type: "Funcionário",
      role: "Assistente operacional",
      contact: "ana.lima@demonstracao.com",
      costMode: "Hora",
      costRate: 68,
      status: "Ativa",
      activeActivities: 3,
      lateActivities: 0,
      allocations: [
        { id: "ALO-010", workId: workId(0), role: "Controle de registros", startDateIso: "2026-07-08", endDateIso: "2026-09-05", status: "Atual" },
      ],
    },
    {
      id: "PES-007",
      name: "João Victor Santos",
      type: "Prestador",
      role: "Eletricista",
      contact: "joao.santos@prestador.com",
      costMode: "Diária",
      costRate: 520,
      status: "Ativa",
      notes: "Acionamento conforme necessidade da adequação elétrica.",
      activeActivities: 2,
      lateActivities: 1,
      allocations: [
        { id: "ALO-011", workId: workId(1), role: "Eletricista de execução", startDateIso: "2026-08-03", endDateIso: "2026-08-28", status: "Atual" },
      ],
    },
    {
      id: "PES-008",
      name: "Fernanda Oliveira",
      type: "Prestador",
      role: "Consultora de segurança",
      contact: "fernanda@segurancaclara.com",
      costMode: "Hora",
      costRate: 180,
      status: "Inativa",
      notes: "Participação encerrada após a vistoria inicial.",
      activeActivities: 0,
      lateActivities: 0,
      allocations: [
        { id: "ALO-012", workId: workId(0), role: "Vistoria de segurança", startDateIso: "2026-07-08", endDateIso: "2026-07-10", status: "Encerrada" },
      ],
    },
  ];
}
