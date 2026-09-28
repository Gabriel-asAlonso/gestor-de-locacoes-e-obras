/**
 * Parcela calendar and cent distribution. This MUST reproduce two things exactly:
 *  - the DB trigger `parcelas_calendario` (same month clamped to month length), or the
 *    commit is aborted;
 *  - the front's `buildNegotiationSchedule` (first parcelas absorb the leftover cent), so
 *    the preview the user confirmed equals what is stored.
 */
const pad = (value: number) => String(value).padStart(2, '0');

/** Due date of parcela `numero` (1-based): same day-of-month as `firstDueIso`, clamped. */
export function installmentDue(firstDueIso: string, numero: number): string {
  const [year, month, day] = firstDueIso.split('-').map(Number);
  const target = new Date(Date.UTC(year!, month! - 1 + (numero - 1), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day!, lastDay))}`;
}

/** Splits `financedCents` into `count` parcelas preserving the total; earlier parcelas get the extra cent. */
export function distributeInstallments(financedCents: number, count: number): number[] {
  const base = Math.floor(financedCents / count);
  let remainder = financedCents - base * count;
  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return value;
  });
}
