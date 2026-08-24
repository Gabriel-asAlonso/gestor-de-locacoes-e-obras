export type NegotiationTerms = {
  originalBalance: number;
  discount: number;
  surcharge: number;
  downPayment: number;
  installmentCount: number;
  firstDueDate: string;
};

export type NegotiationInstallment = {
  number: number;
  dueDate: string;
  amount: number;
};

export type ChargeNegotiation = NegotiationTerms & {
  id: string;
  chargeId: string;
  negotiatedTotal: number;
  financedAmount: number;
  schedule: NegotiationInstallment[];
  reason: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export function calculateNegotiationTotals(terms: Pick<NegotiationTerms, "originalBalance" | "discount" | "surcharge" | "downPayment">) {
  const negotiatedTotalCents = toCents(terms.originalBalance) - toCents(terms.discount) + toCents(terms.surcharge);
  const financedAmountCents = negotiatedTotalCents - toCents(terms.downPayment);
  return {
    negotiatedTotal: fromCents(negotiatedTotalCents),
    financedAmount: fromCents(financedAmountCents),
  };
}

function isValidIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function addMonthsClamped(isoDate: string, months: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function validateNegotiationTerms(terms: NegotiationTerms, minimumFirstDueDate: string) {
  const { negotiatedTotal, financedAmount } = calculateNegotiationTotals(terms);
  if (!Number.isFinite(terms.originalBalance) || terms.originalBalance <= 0) return "A cobrança precisa ter saldo positivo para ser negociada.";
  if (!Number.isFinite(terms.discount) || terms.discount < 0) return "O desconto não pode ser negativo.";
  if (terms.discount > terms.originalBalance) return "O desconto não pode superar o saldo original da cobrança.";
  if (!Number.isFinite(terms.surcharge) || terms.surcharge < 0) return "Os acréscimos não podem ser negativos.";
  if (negotiatedTotal <= 0) return "O total negociado precisa ser maior que zero.";
  if (!Number.isFinite(terms.downPayment) || terms.downPayment < 0) return "A entrada não pode ser negativa.";
  if (financedAmount <= 0) return "A entrada deve ser menor que o total negociado. Para quitação integral, registre um recebimento.";
  if (!Number.isInteger(terms.installmentCount) || terms.installmentCount < 1 || terms.installmentCount > 24) return "Escolha entre 1 e 24 parcelas.";
  if (!isValidIsoDate(terms.firstDueDate)) return "Informe uma data válida para o primeiro vencimento.";
  if (terms.firstDueDate < minimumFirstDueDate) return "O primeiro vencimento não pode ser anterior à data da negociação.";
  return "";
}

export function buildNegotiationSchedule(firstDueDate: string, installmentCount: number, financedAmount: number): NegotiationInstallment[] {
  if (!isValidIsoDate(firstDueDate) || !Number.isInteger(installmentCount) || installmentCount < 1 || financedAmount <= 0) return [];
  const totalCents = toCents(financedAmount);
  const baseCents = Math.floor(totalCents / installmentCount);
  let remainingCents = totalCents - baseCents * installmentCount;
  return Array.from({ length: installmentCount }, (_, index) => {
    const amountCents = baseCents + (remainingCents > 0 ? 1 : 0);
    if (remainingCents > 0) remainingCents -= 1;
    return {
      number: index + 1,
      dueDate: addMonthsClamped(firstDueDate, index),
      amount: fromCents(amountCents),
    };
  });
}
