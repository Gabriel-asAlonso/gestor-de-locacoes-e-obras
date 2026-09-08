import assert from "node:assert/strict";
import test from "node:test";

import {
  contributionPaid,
  contributionRemaining,
  contributionStatus,
  createContributionShares,
  participationTotal,
  shareRemaining,
  shareStatus,
} from "../src/app/core/utils/work-partners.ts";

const partners = [
  { id: "SOC-001", name: "Sócio A", participationPercent: 50 },
  { id: "SOC-002", name: "Sócio B", participationPercent: 30 },
  { id: "SOC-003", name: "Sócio C", participationPercent: 20 },
];

test("rateia um aporte usando a distribuição atual de 100%", () => {
  const shares = createContributionShares(partners, 100_000);

  assert.deepEqual(shares.map((share) => share.amountDue), [50_000, 30_000, 20_000]);
  assert.equal(shares.reduce((total, share) => total + share.amountDue, 0), 100_000);
});

test("absorve o ajuste de centavos no último sócio sem perder valor", () => {
  const thirds = [
    { id: "A", name: "A", participationPercent: 33.33 },
    { id: "B", name: "B", participationPercent: 33.33 },
    { id: "C", name: "C", participationPercent: 33.34 },
  ];
  const shares = createContributionShares(thirds, 100);

  assert.equal(participationTotal(thirds), 100);
  assert.deepEqual(shares.map((share) => share.amountDue), [33.33, 33.33, 33.34]);
});

test("impede aporte com distribuição incompleta ou acima de 100%", () => {
  assert.throws(() => createContributionShares(partners.slice(0, 2), 5000), /100%/);
  assert.throws(() => createContributionShares([...partners, { id: "D", name: "D", participationPercent: 1 }], 5000), /100%/);
  assert.throws(() => createContributionShares(partners, 0), /maior que zero/);
});

test("preserva o rateio histórico quando a participação futura muda", () => {
  const original = createContributionShares(partners, 10_000);
  const updatedPartners = partners.map((partner, index) => ({ ...partner, participationPercent: [40, 35, 25][index] }));
  const future = createContributionShares(updatedPartners, 10_000);

  assert.deepEqual(original.map((share) => share.participationPercent), [50, 30, 20]);
  assert.deepEqual(future.map((share) => share.participationPercent), [40, 35, 25]);
});

test("soma pagamentos sucessivos sem sobrescrever o histórico", () => {
  const contribution = {
    id: "APT-001",
    dateIso: "2026-08-24",
    description: "Capital da etapa",
    amount: 1000,
    shares: createContributionShares([
      { id: "SOC-001", name: "Sócio A", participationPercent: 100 },
    ], 1000),
  };

  contribution.shares[0].payments.push(
    { id: "PAG-001", amount: 250, dateIso: "2026-08-25" },
    { id: "PAG-002", amount: 350, dateIso: "2026-08-26" },
  );

  assert.equal(contribution.shares[0].payments.length, 2);
  assert.equal(shareRemaining(contribution.shares[0]), 400);
  assert.equal(shareStatus(contribution.shares[0]), "Parcialmente pago");
  assert.equal(contributionPaid(contribution), 600);
  assert.equal(contributionRemaining(contribution), 400);
  assert.equal(contributionStatus(contribution), "Parcialmente pago");
});
