import { Injectable, signal } from '@angular/core';
import {
  INITIAL_AGENCIES,
  INITIAL_CHARGES,
  INITIAL_CONTRACTS,
  INITIAL_EXPENSES,
  INITIAL_PORTFOLIOS,
  INITIAL_PROPERTIES,
  INITIAL_TENANTS,
  INITIAL_UNITS,
} from '../data/demo-data';
import { createWorkDetailMock, type WorkActivity, type WorkContribution, type WorkDetailMock, type WorkFinancialEntry, type WorkJournalEntry, type WorkPartner, type WorkPendingItem, type WorkSupplier, type WorkTeamAllocation } from '../data/work-details.data';
import { workRecords, type WorkRecord } from '../data/works.data';
import type { Charge, Contract, Expense, Portfolio, Property, RealEstateAgency, Receipt, Tenant, Unit } from '../models/domain.models';
import type { ChargeNegotiation } from '../utils/charge-negotiation';

const clone = <T>(value: T): T => structuredClone(value);

@Injectable({ providedIn: 'root' })
export class AppStore {
  readonly portfolios = signal<Portfolio[]>(clone(INITIAL_PORTFOLIOS));
  readonly properties = signal<Property[]>(clone(INITIAL_PROPERTIES));
  readonly units = signal<Unit[]>(clone(INITIAL_UNITS));
  readonly tenants = signal<Tenant[]>(clone(INITIAL_TENANTS));
  readonly agencies = signal<RealEstateAgency[]>(clone(INITIAL_AGENCIES));
  readonly contracts = signal<Contract[]>(clone(INITIAL_CONTRACTS));
  readonly charges = signal<Charge[]>(clone(INITIAL_CHARGES));
  readonly expenses = signal<Expense[]>(clone(INITIAL_EXPENSES));
  readonly works = signal<WorkRecord[]>(clone(workRecords));
  readonly negotiations = signal<Record<string, ChargeNegotiation>>({});
  readonly receipts = signal<Record<string, Receipt[]>>({});
  readonly workDetails = signal<Record<string, WorkDetailMock>>({});

  savePortfolio(portfolio: Portfolio): void {
    this.portfolios.update((records) => records.some((record) => record.id === portfolio.id)
      ? records.map((record) => record.id === portfolio.id ? portfolio : record)
      : [...records, portfolio]);
  }

  saveProperty(property: Property): void {
    this.properties.update((records) => records.some((record) => record.id === property.id)
      ? records.map((record) => record.id === property.id ? property : record)
      : [...records, property]);
  }

  saveUnit(unit: Unit): void {
    this.units.update((records) => records.some((record) => record.id === unit.id)
      ? records.map((record) => record.id === unit.id ? unit : record)
      : [...records, unit]);
  }

  saveTenant(tenant: Tenant, previousName?: string): void {
    this.tenants.update((records) => records.some((record) => record.id === tenant.id)
      ? records.map((record) => record.id === tenant.id ? tenant : record)
      : [...records, tenant]);
    if (previousName && previousName !== tenant.name) {
      this.contracts.update((records) => records.map((record) => record.tenant === previousName ? { ...record, tenant: tenant.name } : record));
      this.charges.update((records) => records.map((record) => record.tenant === previousName ? { ...record, tenant: tenant.name } : record));
    }
  }

  addAgency(agency: RealEstateAgency): void {
    this.agencies.update((records) => [...records, agency]);
  }

  addContract(contract: Contract, unitIds: string[], tenantId: string): void {
    this.contracts.update((records) => [...records, contract]);
    this.units.update((records) => records.map((unit) => unitIds.includes(unit.id) ? { ...unit, occupied: true } : unit));
    this.tenants.update((records) => records.map((tenant) => tenant.id === tenantId ? { ...tenant, contracts: tenant.contracts + 1 } : tenant));
  }

  addCharge(charge: Charge): void {
    this.charges.update((records) => [...records, charge]);
  }

  updateCharge(charge: Charge): void {
    this.charges.update((records) => records.map((record) => record.id === charge.id ? charge : record));
  }

  saveNegotiation(negotiation: ChargeNegotiation): void {
    const priorReceiptAmount = (this.receipts()[negotiation.chargeId] ?? []).reduce((sum, receipt) => sum + receipt.amount, 0);
    this.negotiations.update((current) => ({ ...current, [negotiation.chargeId]: { ...negotiation, priorReceiptAmount } }));
    this.charges.update((records) => records.map((charge) => charge.id === negotiation.chargeId ? { ...charge, status: 'Negociada' } : charge));
  }

  saveReceipt(receipt: Receipt): void {
    const negotiation = this.negotiations()[receipt.chargeId];
    const receiptTotal = (this.receipts()[receipt.chargeId] ?? []).reduce((sum, item) => sum + item.amount, 0) + receipt.amount;
    this.charges.update((records) => records.map((charge) => {
      if (charge.id !== receipt.chargeId) return charge;
      const items = charge.items.map((item, index) => {
        const allocation = receipt.allocations.find((entry) => entry.itemIndex === index)?.amount ?? 0;
        return { ...item, received: Math.min(item.amount, item.received + allocation) };
      });
      const settled = negotiation
        ? receiptTotal - (negotiation.priorReceiptAmount ?? 0) >= negotiation.negotiatedTotal - 0.009
        : items.every((item) => item.received >= item.amount - 0.009);
      return { ...charge, items, status: settled ? 'Recebida' : 'Parcial' };
    }));
    this.receipts.update((current) => ({ ...current, [receipt.chargeId]: [...(current[receipt.chargeId] ?? []), receipt] }));
  }

  addExpense(expense: Expense): void {
    this.expenses.update((records) => [...records, expense]);
  }

  updateExpense(expense: Expense): void {
    this.expenses.update((records) => records.map((record) => record.id === expense.id ? expense : record));
  }

  saveWork(work: WorkRecord): void {
    const editing = this.works().some((record) => record.id === work.id);
    this.works.update((records) => editing ? records.map((record) => record.id === work.id ? work : record) : [work, ...records]);
    if (!this.workDetails()[work.id]) this.workDetails.update((details) => ({ ...details, [work.id]: editing ? createWorkDetailMock(work) : { activities: [], team: [], suppliers: [], partners: [], contributions: [], financialEntries: [], journal: [], pendingItems: [] } }));
  }

  ensureWorkDetail(work: WorkRecord): WorkDetailMock {
    const existing = this.workDetails()[work.id];
    if (existing) return existing;
    const detail = createWorkDetailMock(work);
    this.workDetails.update((details) => ({ ...details, [work.id]: detail }));
    return detail;
  }

  updateWorkDetail(workId: string, changes: Partial<{ activities: WorkActivity[]; team: WorkTeamAllocation[]; suppliers: WorkSupplier[]; partners: WorkPartner[]; contributions: WorkContribution[]; financialEntries: WorkFinancialEntry[]; journal: WorkJournalEntry[]; pendingItems: WorkPendingItem[] }>): void {
    const work = this.works().find((record) => record.id === workId);
    if (!work) return;
    const current = this.ensureWorkDetail(work);
    this.workDetails.update((details) => ({ ...details, [workId]: { ...current, ...changes } }));
  }
}
