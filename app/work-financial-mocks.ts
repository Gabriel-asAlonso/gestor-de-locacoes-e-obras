import type { WorkRecord } from "./works-mocks";

export type WorkBudgetStatus = "Solicitado" | "Recebido" | "Selecionado" | "Rejeitado" | "Expirado";
export type WorkExpenseStatus = "Previsto" | "Pendente" | "Pago";
export type WorkCashMovementType = "Aporte" | "Reembolso" | "Ajuste" | "Saída de gasto";
export type WorkCashMovementStatus = "Previsto" | "Realizado";

export type WorkBudgetQuote = {
  id: string;
  workId: string;
  stage?: string;
  service: string;
  provider: string;
  amount: number;
  receivedDateIso: string;
  validityDateIso: string;
  status: WorkBudgetStatus;
  attachmentName?: string;
  selectionReason?: string;
};

export type WorkExpense = {
  id: string;
  workId: string;
  description: string;
  category: string;
  supplier: string;
  amount: number;
  expectedAmount: number;
  dateIso: string;
  status: WorkExpenseStatus;
  attachmentName?: string;
  sourceBudgetId?: string;
};

export type WorkCashMovement = {
  id: string;
  workId: string;
  type: WorkCashMovementType;
  direction: "Entrada" | "Saída";
  description: string;
  amount: number;
  dateIso: string;
  status: WorkCashMovementStatus;
  linkedExpenseId?: string;
};

export type WorkFinancialMock = {
  budgets: WorkBudgetQuote[];
  expenses: WorkExpense[];
  cashMovements: WorkCashMovement[];
};

export function createWorkFinancialMock(works: WorkRecord[]): WorkFinancialMock {
  const id = (index: number) => works[index % Math.max(works.length, 1)]?.id ?? "OBR-001";
  const budgets: WorkBudgetQuote[] = [
    { id: "ORC-001", workId: id(0), stage: "Execução", service: "Impermeabilização da cobertura", provider: "Construtora Base Clara", amount: 185000, receivedDateIso: "2026-07-02", validityDateIso: "2026-09-10", status: "Selecionado", attachmentName: "proposta-base-clara.pdf", selectionReason: "Melhor equilíbrio entre prazo, garantia e valor." },
    { id: "ORC-002", workId: id(0), stage: "Execução", service: "Impermeabilização da cobertura", provider: "Obras Horizonte Ltda.", amount: 199800, receivedDateIso: "2026-07-01", validityDateIso: "2026-09-05", status: "Recebido", attachmentName: "cotacao-horizonte.pdf" },
    { id: "ORC-003", workId: id(0), stage: "Execução", service: "Impermeabilização da cobertura", provider: "Teto Seguro Engenharia", amount: 177500, receivedDateIso: "2026-06-29", validityDateIso: "2026-07-30", status: "Expirado" },
    { id: "ORC-004", workId: id(1), stage: "Execução", service: "Adequação do quadro elétrico", provider: "Voltz Instalações", amount: 78000, receivedDateIso: "2026-08-05", validityDateIso: "2026-09-05", status: "Selecionado", attachmentName: "voltz-quadro-eletrico.pdf", selectionReason: "Fornecedor disponível para início imediato." },
    { id: "ORC-005", workId: id(1), stage: "Execução", service: "Adequação do quadro elétrico", provider: "Energia Norte Serviços", amount: 74600, receivedDateIso: "2026-08-06", validityDateIso: "2026-09-06", status: "Recebido" },
    { id: "ORC-006", workId: id(2), stage: "Preparação", service: "Recuperação da fachada", provider: "Fachada Viva", amount: 92000, receivedDateIso: "2026-08-20", validityDateIso: "2026-09-20", status: "Recebido", attachmentName: "fachada-viva.pdf" },
    { id: "ORC-007", workId: id(2), stage: "Preparação", service: "Recuperação da fachada", provider: "Vertical Engenharia", amount: 88400, receivedDateIso: "2026-08-21", validityDateIso: "2026-09-21", status: "Recebido" },
    { id: "ORC-008", workId: id(2), stage: "Preparação", service: "Recuperação da fachada", provider: "Prumo Reformas", amount: 96700, receivedDateIso: "2026-08-22", validityDateIso: "2026-09-22", status: "Recebido" },
    { id: "ORC-009", workId: id(3), stage: "Execução", service: "Revisão hidráulica dos sanitários", provider: "Hidroplan Manutenção", amount: 112000, receivedDateIso: "2026-07-18", validityDateIso: "2026-08-18", status: "Selecionado", attachmentName: "hidroplan-revisao.pdf", selectionReason: "Escopo mais completo para a intervenção." },
    { id: "ORC-010", workId: id(3), stage: "Execução", service: "Revisão hidráulica dos sanitários", provider: "Água Certa Serviços", amount: 104500, receivedDateIso: "2026-07-19", validityDateIso: "2026-08-19", status: "Rejeitado" },
    { id: "ORC-011", workId: id(4), stage: "Execução", service: "Modernização dos elevadores", provider: "Eleva Assistência", amount: 246000, receivedDateIso: "2026-08-01", validityDateIso: "2026-09-15", status: "Selecionado", attachmentName: "eleva-modernizacao.pdf", selectionReason: "Garantia ampliada e menor prazo de parada." },
    { id: "ORC-012", workId: id(5), stage: "Execução", service: "Reparo da rede pluvial", provider: "Fluxo Obras Rápidas", amount: 36500, receivedDateIso: "2026-08-18", validityDateIso: "2026-08-31", status: "Selecionado", selectionReason: "Atendimento emergencial disponível no mesmo dia." },
    { id: "ORC-013", workId: id(7), stage: "Preparação", service: "Reforma da recepção", provider: "Ambienta Interiores", amount: 134000, receivedDateIso: "2026-08-24", validityDateIso: "2026-09-24", status: "Solicitado" },
  ];

  const expenses: WorkExpense[] = [
    { id: "GAS-001", workId: id(0), description: "Membrana e insumos de impermeabilização", category: "Materiais", supplier: "Construtora Base Clara", amount: 38400, expectedAmount: 35000, dateIso: "2026-08-10", status: "Pago", attachmentName: "nf-membrana-1842.pdf", sourceBudgetId: "ORC-001" },
    { id: "GAS-002", workId: id(0), description: "Segunda medição da execução", category: "Mão de obra", supplier: "Construtora Base Clara", amount: 28500, expectedAmount: 30000, dateIso: "2026-08-27", status: "Pendente", sourceBudgetId: "ORC-001" },
    { id: "GAS-003", workId: id(1), description: "Quadro e dispositivos de proteção", category: "Equipamentos", supplier: "Voltz Instalações", amount: 26000, expectedAmount: 24000, dateIso: "2026-08-12", status: "Pago", attachmentName: "comprovante-voltz.pdf", sourceBudgetId: "ORC-004" },
    { id: "GAS-004", workId: id(1), description: "Instalação e testes elétricos", category: "Mão de obra", supplier: "Voltz Instalações", amount: 15650, expectedAmount: 18000, dateIso: "2026-08-26", status: "Pendente", sourceBudgetId: "ORC-004" },
    { id: "GAS-005", workId: id(2), description: "Laudo e ensaio de aderência", category: "Serviços técnicos", supplier: "Vertical Engenharia", amount: 8500, expectedAmount: 9000, dateIso: "2026-08-29", status: "Previsto" },
    { id: "GAS-006", workId: id(3), description: "Louças e metais sanitários", category: "Materiais", supplier: "Hidroplan Manutenção", amount: 49800, expectedAmount: 42000, dateIso: "2026-08-08", status: "Pago", attachmentName: "nf-hidroplan-0908.pdf", sourceBudgetId: "ORC-009" },
    { id: "GAS-007", workId: id(3), description: "Revisão adicional do escopo hidráulico", category: "Serviços técnicos", supplier: "Hidroplan Manutenção", amount: 70000, expectedAmount: 63000, dateIso: "2026-08-28", status: "Pendente", sourceBudgetId: "ORC-009" },
    { id: "GAS-008", workId: id(4), description: "Comando eletrônico da torre A", category: "Equipamentos", supplier: "Eleva Assistência", amount: 63700, expectedAmount: 65000, dateIso: "2026-08-18", status: "Pago", attachmentName: "medicao-eleva.pdf", sourceBudgetId: "ORC-011" },
    { id: "GAS-009", workId: id(5), description: "Tubos, conexões e recomposição", category: "Materiais", supplier: "Fluxo Obras Rápidas", amount: 28100, expectedAmount: 26000, dateIso: "2026-08-23", status: "Pago", attachmentName: "recibo-fluxo.pdf", sourceBudgetId: "ORC-012" },
    { id: "GAS-010", workId: id(6), description: "Materiais de pintura e proteção", category: "Materiais", supplier: "Cores do Pátio", amount: 42800, expectedAmount: 44500, dateIso: "2026-08-05", status: "Pago", attachmentName: "nota-cores-patio.pdf" },
    { id: "GAS-011", workId: id(7), description: "Levantamento executivo da recepção", category: "Serviços técnicos", supplier: "Ambienta Interiores", amount: 4200, expectedAmount: 5000, dateIso: "2026-08-24", status: "Pago" },
    { id: "GAS-012", workId: id(7), description: "Mobiliário sob medida", category: "Materiais", supplier: "Forma Mobiliário", amount: 48600, expectedAmount: 48000, dateIso: "2026-09-18", status: "Previsto" },
  ];

  const cashMovements: WorkCashMovement[] = works.map((work, index) => ({
    id: `CXA-${String(index + 1).padStart(3, "0")}`,
    workId: work.id,
    type: "Aporte",
    direction: "Entrada",
    description: "Saldo inicial destinado à obra",
    amount: Math.round(work.budget * 0.72),
    dateIso: work.startDateIso,
    status: "Realizado",
  }));

  expenses.forEach((expense, index) => {
    cashMovements.push({
      id: `CXA-${String(works.length + index + 1).padStart(3, "0")}`,
      workId: expense.workId,
      type: "Saída de gasto",
      direction: "Saída",
      description: expense.description,
      amount: expense.amount,
      dateIso: expense.dateIso,
      status: expense.status === "Pago" ? "Realizado" : "Previsto",
      linkedExpenseId: expense.id,
    });
  });

  cashMovements.push(
    { id: "CXA-030", workId: id(0), type: "Reembolso", direction: "Entrada", description: "Devolução de material não utilizado", amount: 2450, dateIso: "2026-08-21", status: "Realizado" },
    { id: "CXA-031", workId: id(3), type: "Ajuste", direction: "Entrada", description: "Complemento aprovado para o escopo", amount: 18000, dateIso: "2026-08-25", status: "Previsto" },
    { id: "CXA-032", workId: id(5), type: "Ajuste", direction: "Saída", description: "Correção manual de medição", amount: 1200, dateIso: "2026-08-24", status: "Realizado" },
  );

  return { budgets, expenses, cashMovements };
}
