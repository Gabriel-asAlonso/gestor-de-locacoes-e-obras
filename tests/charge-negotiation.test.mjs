import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNegotiationSchedule,
  calculateNegotiationTotals,
  validateNegotiationTerms,
} from "../src/app/core/utils/charge-negotiation.ts";

test("calcula desconto, acréscimo, entrada e saldo parcelado em centavos", () => {
  assert.deepEqual(calculateNegotiationTotals({
    originalBalance: 4225,
    discount: 225,
    surcharge: 100,
    downPayment: 600,
  }), {
    negotiatedTotal: 4100,
    financedAmount: 3500,
  });
});

test("distribui centavos entre parcelas sem perder valor", () => {
  const schedule = buildNegotiationSchedule("2026-09-30", 3, 1000);
  assert.deepEqual(schedule, [
    { number: 1, dueDate: "2026-09-30", amount: 333.34 },
    { number: 2, dueDate: "2026-10-30", amount: 333.33 },
    { number: 3, dueDate: "2026-11-30", amount: 333.33 },
  ]);
  assert.equal(schedule.reduce((total, installment) => total + installment.amount, 0), 1000);
});

test("ajusta vencimentos mensais para o último dia de meses curtos", () => {
  const schedule = buildNegotiationSchedule("2026-01-31", 3, 300);
  assert.deepEqual(schedule.map((installment) => installment.dueDate), ["2026-01-31", "2026-02-28", "2026-03-31"]);
});

test("valida limites financeiros, quantidade de parcelas e primeira data", () => {
  const valid = { originalBalance: 2000, discount: 200, surcharge: 50, downPayment: 300, installmentCount: 4, firstDueDate: "2026-09-10" };
  assert.equal(validateNegotiationTerms(valid, "2026-08-12"), "");
  assert.match(validateNegotiationTerms({ ...valid, discount: 2100 }, "2026-08-12"), /desconto não pode superar/i);
  assert.match(validateNegotiationTerms({ ...valid, downPayment: 1850 }, "2026-08-12"), /entrada deve ser menor/i);
  assert.match(validateNegotiationTerms({ ...valid, installmentCount: 25 }, "2026-08-12"), /1 e 24 parcelas/i);
  assert.match(validateNegotiationTerms({ ...valid, firstDueDate: "2026-08-01" }, "2026-08-12"), /não pode ser anterior/i);
});
