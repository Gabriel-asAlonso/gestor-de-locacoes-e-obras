export type ChargeStatus = 'Vencida' | 'Em aberto' | 'Próxima' | 'Parcial' | 'Negociada' | 'Recebida';
export type ExpenseStatus = 'Pendente' | 'Pago' | 'Vencido';
export type AppModule = 'Módulo 1' | 'Módulo 2';
export type EntityKind = 'portfolio' | 'property' | 'unit' | 'tenant' | 'contract' | 'charge' | 'expense';

export interface Portfolio {
  id: string;
  name: string;
  holder: string;
  document: string;
  properties: number;
  units: number;
  manager?: string;
  description?: string;
  notes?: string;
}

export interface Property {
  id: string;
  portfolio: string;
  name: string;
  address: string;
  units: number;
  propertyType?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  municipalRegistration?: string;
  registryNumber?: string;
  registryOffice?: string;
  manager?: string;
  notes?: string;
}

export interface Unit {
  id: string;
  property: string;
  portfolio: string;
  name: string;
  area: number;
  occupied: boolean;
  unitType?: string;
  code?: string;
  block?: string;
  floor?: string;
  totalArea?: number;
  municipalRegistration?: string;
  notes?: string;
}

export interface Tenant {
  id: string;
  type: 'PJ' | 'PF';
  name: string;
  document: string;
  contracts: number;
  tradeName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  preferredChannel?: string;
  billingAddress?: string;
  municipalRegistration?: string;
  responsibleAgencyId?: string;
  notes?: string;
}

export interface RealEstateAgency {
  id: string;
  name: string;
  tradeName?: string;
  document: string;
  creci: string;
  contactName: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface ContractChargeRule {
  name: string;
  responsibility: string;
  calculation: string;
  amount: number;
  dueRule: string;
  recurrence: string;
  proofRequired: boolean;
}

export interface ChargeItem {
  name: string;
  dueDate: string;
  dueDateIso?: string;
  amount: number;
  received: number;
  reference?: string;
  supportDocumentName?: string;
}

export interface ChargeDraftItem {
  name: string;
  due: string;
  amount: number;
  reference?: string;
  supportDocumentName?: string;
}

export interface Charge {
  id: string;
  contract: string;
  portfolio: string;
  property: string;
  units: string[];
  tenant: string;
  competence: string;
  status: ChargeStatus;
  items: ChargeItem[];
  inclusionType?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface Contract {
  id: string;
  portfolio: string;
  property: string;
  units: string[];
  tenant: string;
  period: string;
  rent: number;
  due: number;
  adjustment: string;
  charges: string[];
  chargeRules?: ContractChargeRule[];
  startIso?: string;
  endIso?: string;
  occupancyDate?: string;
  purpose?: string;
  paymentReference?: string;
  adjustmentIndex?: string;
  adjustmentPeriod?: number;
  lateFee?: number;
  monthlyInterest?: number;
  paymentMethod?: string;
  deliveryChannel?: string;
  guaranteeType?: string;
  guaranteeDetails?: string;
  signatureDate?: string;
  firstChargeRule?: string;
  documentName?: string;
  notes?: string;
}

export interface Expense {
  id: string;
  supplier: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  dueIso: string;
  paidDate: string | null;
  status: ExpenseStatus;
  allocationType?: string;
  allocationId?: string;
  competence?: string;
  issueDate?: string;
  documentType?: string;
  documentNumber?: string;
  plannedDate?: string;
  entryType?: string;
  recurrence?: string;
  paymentMethod?: string;
  financialAccount?: string;
  attachmentName?: string;
  notes?: string;
}

export interface ReceiptAllocation { itemIndex: number; amount: number }

export interface Receipt {
  id: string;
  chargeId: string;
  receiptDate: string;
  creditDate: string;
  amount: number;
  discount: number;
  interest: number;
  paymentMethod: string;
  financialAccount: string;
  reference: string;
  thirdPartyPayer: string;
  proofName: string;
  note: string;
  allocations: ReceiptAllocation[];
}

export interface ToastMessage { message: string; reference: string }

