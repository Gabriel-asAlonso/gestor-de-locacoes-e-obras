import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import {
  ALL_REPORT_PORTFOLIOS,
  buildAccountingReportModel,
  competenceToInputValue,
  inputValueToCompetence,
  suggestedAccountingReportFilename,
} from "../src/app/core/utils/accounting-report.ts";
import { createAccountingReportWorkbook, downloadAccountingReport } from "../src/app/core/utils/accounting-report-workbook.ts";

const portfolios = [
  { id: "CAR-001", name: "Carteira Atlas", holder: "Atlas Patrimonial Ltda.", document: "12.345.678/0001-10" },
  { id: "CAR-002", name: "Carteira Horizonte", holder: "Horizonte Imóveis Ltda.", document: "98.765.432/0001-20" },
];

const properties = [
  { id: "IMO-001", portfolio: "Carteira Atlas", name: "Centro Empresarial Nexo", address: "Rua das Acácias, 240 · Centro" },
  { id: "IMO-002", portfolio: "Carteira Horizonte", name: "Edifício Horizonte", address: "Rua do Mercado, 84 · Centro" },
];

const tenants = [
  { id: "LOC-001", type: "PJ", name: "Estúdio Vereda Ltda.", document: "23.456.789/0001-95" },
  { id: "LOC-002", type: "PF", name: "Marina Duarte", document: "123.456.789-09" },
];

const charges = [
  { id: "COB-002", contract: "CTR-002", portfolio: "Carteira Horizonte", property: "Edifício Horizonte", units: ["Módulo A"], tenant: "Marina Duarte", competence: "08/2026", items: [{ name: "Aluguel", amount: 2_750 }, { name: "Condomínio", amount: 530 }] },
  { id: "COB-001", contract: "CTR-001", portfolio: "Carteira Atlas", property: "Centro Empresarial Nexo", units: ["Sala 101"], tenant: "Estúdio Vereda Ltda.", competence: "08/2026", items: [{ name: "ALUGUÉL", amount: 3_200 }, { name: "IPTU", amount: 385 }] },
  { id: "COB-003", contract: "CTR-001", portfolio: "Carteira Atlas", property: "Centro Empresarial Nexo", units: ["Sala 101"], tenant: "Estúdio Vereda Ltda.", competence: "07/2026", items: [{ name: "Aluguel", amount: 3_200 }] },
  { id: "COB-004", contract: "CTR-004", portfolio: "Carteira Atlas", property: "Centro Empresarial Nexo", units: ["Sala 201"], tenant: "Estúdio Vereda Ltda.", competence: "08/2026", items: [{ name: "IPTU", amount: 385 }] },
];

test("monta relatório geral reunindo carteiras e somente o item de aluguel", () => {
  const model = buildAccountingReportModel({ competence: "08/2026", portfolioScope: ALL_REPORT_PORTFOLIOS, portfolios, properties, tenants, charges });

  assert.equal(model.isGeneral, true);
  assert.equal(model.title, "RELATÓRIO GERAL DE CARTEIRAS - ALUGUEIS");
  assert.equal(model.month, "AGOSTO");
  assert.equal(model.rows.length, 2);
  assert.deepEqual(model.rows.map((row) => row.portfolio), ["Carteira Atlas", "Carteira Horizonte"]);
  assert.equal(model.total, 5_950);
  assert.equal(model.rows[0].tenantDocumentType, "CNPJ");
  assert.equal(model.rows[1].tenantDocumentType, "CPF");
});

test("filtra uma carteira e sugere nome de arquivo compatível", () => {
  const model = buildAccountingReportModel({ competence: "08/2026", portfolioScope: "Carteira Atlas", portfolios, properties, tenants, charges });

  assert.equal(model.isGeneral, false);
  assert.equal(model.title, "ATLAS PATRIMONIAL LTDA. - ALUGUEIS");
  assert.equal(model.rows.length, 1);
  assert.equal(model.total, 3_200);
  assert.equal(competenceToInputValue("08/2026"), "2026-08");
  assert.equal(inputValueToCompetence("2026-08"), "08/2026");
  assert.equal(suggestedAccountingReportFilename("08/2026", "Carteira São João"), "Relacao-Carteira-Sao-Joao-08-2026.xlsx");
});

test("gera XLSX com planilhas, cabeçalho, valores, fórmula e configuração de impressão do modelo", async () => {
  const model = buildAccountingReportModel({ competence: "08/2026", portfolioScope: ALL_REPORT_PORTFOLIOS, portfolios, properties, tenants, charges });
  const bytes = await createAccountingReportWorkbook(model);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);

  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Plan1", "Plan2", "Plan3"]);
  const sheet = workbook.getWorksheet("Plan1");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A2").value, `${model.title} `);
  assert.equal(sheet.getCell("A2").font.name, "Times New Roman");
  assert.equal(sheet.getCell("A2").font.size, 11);
  assert.equal(sheet.getCell("A5").value, "   LOCATÁRIO / IMÓVEL");
  assert.equal(sheet.getCell("B5").value, "AGOSTO ");
  assert.equal(sheet.getCell("B6").value, "2026");
  assert.equal(sheet.getCell("B8").value, 3_200);
  assert.equal(sheet.getColumn(1).width, 73.7109375);
  assert.equal(sheet.pageSetup.paperSize, 9);
  assert.equal(sheet.pageSetup.orientation, "portrait");
  assert.equal(sheet.pageSetup.fitToPage, false);
  assert.equal(sheet.pageSetup.scale, 100);
  assert.equal(sheet.views[0].showGridLines, true);
  assert.equal(sheet.getCell("A1").border.top.style, "medium");
  assert.equal(sheet.getCell("A3").border.bottom.style, "medium");
  assert.equal(sheet.getCell("A5").border.top.style, "medium");

  const totalRow = sheet.getColumn(1).values.findIndex((value) => value === "TOTAL ");
  assert.ok(totalRow > 0);
  assert.deepEqual(sheet.getCell(totalRow, 2).value, {
    formula: `SUM(B8:B${totalRow - 1})`,
    result: 5_950,
  });
  assert.match(sheet.getCell(totalRow, 2).numFmt, /R\$/);
});

test("pagina relatórios longos sem dividir os blocos de locatário", async () => {
  const baseModel = buildAccountingReportModel({ competence: "08/2026", portfolioScope: ALL_REPORT_PORTFOLIOS, portfolios, properties, tenants, charges });
  const rows = Array.from({ length: 20 }, (_, index) => ({
    ...baseModel.rows[index % baseModel.rows.length],
    chargeId: `COB-${String(index + 1).padStart(3, "0")}`,
    contract: `CTR-${String(index + 1).padStart(3, "0")}`,
  }));
  const bytes = await createAccountingReportWorkbook({ ...baseModel, rows, total: rows.reduce((sum, row) => sum + row.amount, 0) });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet("Plan1");
  assert.ok(sheet);
  assert.equal(sheet.getCell(46, 1).value, null);
  assert.equal(sheet.getCell(46, 1).border.bottom.style, "medium");
  assert.equal(sheet.getCell(47, 1).border?.top, undefined);
  assert.equal(sheet.getRow(47).height, 15);
  assert.equal(sheet.getRow(51).height, 15.75);
  assert.equal(sheet.getCell(52, 1).border.top.style, "medium");
  assert.match(String(sheet.getCell(53, 1).value), /Estúdio Vereda|Marina Duarte/);
});

test("aciona o download e mantém um link reutilizável para o arquivo gerado", () => {
  const originalDocument = globalThis.document;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  let clicked = false;
  let removed = false;
  let appended = false;
  const link = {
    href: "",
    download: "",
    style: {},
    click() { clicked = true; },
    remove() { removed = true; },
  };

  try {
    URL.createObjectURL = () => "blob:relatorio-teste";
    URL.revokeObjectURL = () => {};
    globalThis.document = {
      createElement: () => link,
      body: { appendChild() { appended = true; } },
    };
    const download = downloadAccountingReport(new Uint8Array([1, 2, 3]), "relatorio");
    assert.equal(download.filename, "relatorio.xlsx");
    assert.equal(download.objectUrl, "blob:relatorio-teste");
    assert.equal(link.href, "blob:relatorio-teste");
    assert.equal(link.download, "relatorio.xlsx");
    assert.equal(appended, true);
    assert.equal(clicked, true);
    assert.equal(removed, true);
  } finally {
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});

test("rejeita competência e carteira inválidas", () => {
  assert.throws(() => buildAccountingReportModel({ competence: "2026-08", portfolioScope: ALL_REPORT_PORTFOLIOS, portfolios, properties, tenants, charges }), /competência válida/);
  assert.throws(() => buildAccountingReportModel({ competence: "08/2026", portfolioScope: "Carteira inexistente", portfolios, properties, tenants, charges }), /carteira válida/);
});
