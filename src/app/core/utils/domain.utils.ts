import type { Charge, ChargeDraftItem, ChargeItem, ChargeStatus, Contract, Expense, ExpenseStatus, Tenant } from '../models/domain.models';
import { DEMO_DATE_ISO, INITIAL_CHARGES } from '../data/demo-data';

export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
export const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const UPCOMING_WINDOW_DAYS = 7;

export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
export const slug = (value: string) => normalizeSearch(value).replace(/\s+/g, '-');
export const documentDigits = (value: string) => value.replace(/\D/g, '');
export const nextRecordId = (prefix: string, records: Array<{ id: string }>, size = 3) => {
  const next = records.reduce((largest, record) => Math.max(largest, Number(record.id.match(/\d+/)?.[0] ?? 0)), 0) + 1;
  return `${prefix}-${String(next).padStart(size, '0')}`;
};

export const formatDate = (value?: string) => {
  if (!value) return 'Não informado';
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day)).replace(/\./g, '').replace(/\s+de\s+/g, ' ');
};

export const chargeTotal = (charge: Charge) => charge.items.reduce((sum, item) => sum + item.amount, 0);
export const receivedTotal = (charge: Charge) => charge.items.reduce((sum, item) => sum + item.received, 0);
export const chargeBalance = (charge: Charge) => chargeTotal(charge) - receivedTotal(charge);
export const operationalChargeBalance = (charge: Charge, negotiatedTotal?: number) => negotiatedTotal ?? chargeBalance(charge);

export function contractDueDate(competence: string, dueDay: number, paymentReference = 'Mês a vencer') {
  const [sourceYear, sourceMonth] = competence.split('-').map(Number);
  const target = new Date(Date.UTC(sourceYear, sourceMonth - 1 + (paymentReference === 'Mês vencido' ? 1 : 0), 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  if (!year || !month) return '';
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`;
}

export function buildChargeItemsFromContract(contract: Contract, competence: string): ChargeDraftItem[] {
  const rules = contract.chargeRules?.length ? contract.chargeRules : contract.charges.map((name) => ({ name, amount: name === 'Aluguel' ? contract.rent : 0 }));
  return rules.map((rule) => {
    const previousCharge = INITIAL_CHARGES.find((charge) => charge.contract === contract.id && charge.items.some((item) => item.name === rule.name));
    const previousAmount = previousCharge?.items.find((item) => item.name === rule.name)?.amount;
    return { name: rule.name, due: contractDueDate(competence, contract.due, contract.paymentReference), amount: rule.name === 'Aluguel' ? contract.rent : rule.amount || previousAmount || 0, reference: '' };
  });
}

export function chargeStatusFromItems(items: ChargeItem[]): ChargeStatus {
  const earliest = items.map((item) => item.dueDateIso).filter((value): value is string => Boolean(value)).sort()[0];
  if (!earliest) return 'Em aberto';
  if (earliest < DEMO_DATE_ISO) return 'Vencida';
  const difference = Date.parse(`${earliest}T00:00:00Z`) - Date.parse(`${DEMO_DATE_ISO}T00:00:00Z`);
  return difference <= UPCOMING_WINDOW_DAYS * DAY_IN_MS ? 'Próxima' : 'Em aberto';
}

export function expenseTiming(expense: Expense) {
  const days = Math.round((Date.parse(`${expense.dueIso}T00:00:00Z`) - Date.parse(`${DEMO_DATE_ISO}T00:00:00Z`)) / DAY_IN_MS);
  if (expense.status === 'Vencido') return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'} em atraso`;
  if (expense.status === 'Pago') return '';
  if (days === 0) return 'Vence hoje';
  if (days > 0 && days <= UPCOMING_WINDOW_DAYS) return `Em ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return '';
}

export function maskDocument(value: string, type: Tenant['type']) {
  const digits = documentDigits(value).slice(0, type === 'PF' ? 11 : 14);
  if (type === 'PF') return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function hasValidCpf(value: string) {
  const digits = documentDigits(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (length: number) => {
    const sum = digits.slice(0, length).split('').reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return calculate(9) === Number(digits[9]) && calculate(10) === Number(digits[10]);
}

export function hasValidCnpj(value: string) {
  const digits = documentDigits(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = digits.slice(0, length).split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
}

export const expenseStatusPriority: Record<ExpenseStatus, number> = { Vencido: 0, Pendente: 1, Pago: 2 };
