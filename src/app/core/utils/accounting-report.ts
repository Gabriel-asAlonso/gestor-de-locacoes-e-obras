export const ALL_REPORT_PORTFOLIOS = "__all_portfolios__";

export type ReportPortfolio = {
  id: string;
  name: string;
  holder: string;
  document: string;
};

export type ReportProperty = {
  id: string;
  portfolio: string;
  name: string;
  address: string;
};

export type ReportTenant = {
  id: string;
  type: "PJ" | "PF";
  name: string;
  document: string;
};

export type ReportCharge = {
  id: string;
  contract: string;
  portfolio: string;
  property: string;
  units: string[];
  tenant: string;
  competence: string;
  items: Array<{ name: string; amount: number }>;
};

export type AccountingReportInput = {
  competence: string;
  portfolioScope: string;
  portfolios: ReportPortfolio[];
  properties: ReportProperty[];
  tenants: ReportTenant[];
  charges: ReportCharge[];
};

export type AccountingReportRow = {
  chargeId: string;
  contract: string;
  portfolio: string;
  portfolioHolder: string;
  tenant: string;
  tenantDocument: string;
  tenantDocumentType: "CPF" | "CNPJ";
  property: string;
  units: string[];
  address: string;
  amount: number;
};

export type AccountingReportModel = {
  competence: string;
  month: string;
  year: string;
  title: string;
  isGeneral: boolean;
  rows: AccountingReportRow[];
  total: number;
};

const MONTHS = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

const normalizeLabel = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

const compareText = (left: string, right: string) => left.localeCompare(right, "pt-BR", { sensitivity: "base", numeric: true });

export function competenceToInputValue(competence: string) {
  const match = competence.match(/^(0[1-9]|1[0-2])\/(\d{4})$/);
  return match ? `${match[2]}-${match[1]}` : "";
}

export function inputValueToCompetence(value: string) {
  const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return match ? `${match[2]}/${match[1]}` : "";
}

export function suggestedAccountingReportFilename(competence: string, portfolioName?: string) {
  const scope = portfolioName || "Geral";
  const safeScope = scope
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Relacao-${safeScope || "Alugueis"}-${competence.replace("/", "-")}.xlsx`;
}

export function buildAccountingReportModel(input: AccountingReportInput): AccountingReportModel {
  const competenceMatch = input.competence.match(/^(0[1-9]|1[0-2])\/(\d{4})$/);
  if (!competenceMatch) throw new Error("Informe uma competência válida para o relatório.");

  const isGeneral = input.portfolioScope === ALL_REPORT_PORTFOLIOS;
  const selectedPortfolio = input.portfolios.find((portfolio) => portfolio.name === input.portfolioScope);
  if (!isGeneral && !selectedPortfolio) throw new Error("Selecione uma carteira válida para o relatório.");

  const portfoliosByName = new Map(input.portfolios.map((portfolio) => [portfolio.name, portfolio]));
  const propertiesByName = new Map(input.properties.map((property) => [property.name, property]));
  const tenantsByName = new Map(input.tenants.map((tenant) => [tenant.name, tenant]));

  const rows = input.charges.flatMap<AccountingReportRow>((charge) => {
    if (charge.competence !== input.competence) return [];
    if (!isGeneral && charge.portfolio !== input.portfolioScope) return [];

    const rentItem = charge.items.find((item) => normalizeLabel(item.name) === "aluguel");
    if (!rentItem || !Number.isFinite(rentItem.amount) || rentItem.amount <= 0) return [];

    const portfolio = portfoliosByName.get(charge.portfolio);
    const property = propertiesByName.get(charge.property);
    const tenant = tenantsByName.get(charge.tenant);
    return [{
      chargeId: charge.id,
      contract: charge.contract,
      portfolio: charge.portfolio,
      portfolioHolder: portfolio?.holder ?? charge.portfolio,
      tenant: charge.tenant,
      tenantDocument: tenant?.document ?? "",
      tenantDocumentType: tenant?.type === "PF" ? "CPF" : "CNPJ",
      property: charge.property,
      units: charge.units,
      address: property?.address ?? "",
      amount: rentItem.amount,
    }];
  }).sort((left, right) => (
    compareText(left.portfolio, right.portfolio)
    || compareText(left.property, right.property)
    || compareText(left.units.join(" "), right.units.join(" "))
    || compareText(left.tenant, right.tenant)
    || compareText(left.contract, right.contract)
  ));

  return {
    competence: input.competence,
    month: MONTHS[Number(competenceMatch[1]) - 1],
    year: competenceMatch[2],
    title: isGeneral
      ? "RELATÓRIO GERAL DE CARTEIRAS - ALUGUEIS"
      : `${selectedPortfolio!.holder.toLocaleUpperCase("pt-BR")} - ALUGUEIS`,
    isGeneral,
    rows,
    total: rows.reduce((sum, row) => sum + row.amount, 0),
  };
}
