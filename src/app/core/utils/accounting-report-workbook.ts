import ExcelJS from "exceljs";
import type { AccountingReportModel } from "./accounting-report";

const ACCOUNTING_NUMBER_FORMAT = '_-"R$" * #,##0.00_-;-"R$" * #,##0.00_-;_-"R$" * "-"??_-;_-@_-';
const FIRST_DATA_ROW = 8;
const FONT_NAME = "Times New Roman";
const FRAME_BORDER: Partial<ExcelJS.Border> = { style: "medium", color: { argb: "FF000000" } };

type PageFrame = {
  frameStart: number;
  dataStart: number;
  dataEnd: number;
  fullFrameEnd: number;
};

export type AccountingReportDownload = {
  filename: string;
  objectUrl: string;
};

function pageFrame(index: number): PageFrame {
  if (index === 0) return { frameStart: 5, dataStart: 8, dataEnd: 45, fullFrameEnd: 46 };
  const frameStart = index === 1 ? 52 : 106 + ((index - 2) * 54);
  return { frameStart, dataStart: frameStart + 1, dataEnd: frameStart + 44, fullFrameEnd: frameStart + 45 };
}

function setOuterBorder(worksheet: ExcelJS.Worksheet, startRow: number, endRow: number) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const leftCell = worksheet.getCell(rowNumber, 1);
    const rightCell = worksheet.getCell(rowNumber, 2);
    leftCell.border = { ...leftCell.border, left: FRAME_BORDER };
    rightCell.border = { ...rightCell.border, right: FRAME_BORDER };
    if (rowNumber === startRow) {
      leftCell.border = { ...leftCell.border, top: FRAME_BORDER };
      rightCell.border = { ...rightCell.border, top: FRAME_BORDER };
    }
    if (rowNumber === endRow) {
      leftCell.border = { ...leftCell.border, bottom: FRAME_BORDER };
      rightCell.border = { ...rightCell.border, bottom: FRAME_BORDER };
    }
  }
}

function styleDataFrame(worksheet: ExcelJS.Worksheet, startRow: number, endRow: number) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const leftCell = worksheet.getCell(rowNumber, 1);
    const rightCell = worksheet.getCell(rowNumber, 2);
    if (leftCell.value === null) leftCell.font = { name: FONT_NAME, size: 11 };
    if (rightCell.value === null) rightCell.font = { name: FONT_NAME, size: 11, bold: true };
    rightCell.numFmt = ACCOUNTING_NUMBER_FORMAT;
  }
  setOuterBorder(worksheet, startRow, endRow);
}

function setPageGapHeights(worksheet: ExcelJS.Worksheet, previousFrameEnd: number, nextFrameStart: number) {
  for (let rowNumber = previousFrameEnd + 1; rowNumber < nextFrameStart; rowNumber += 1) {
    worksheet.getRow(rowNumber).height = rowNumber === nextFrameStart - 1 ? 15.75 : 15;
  }
}

function styleBaseSheet(worksheet: ExcelJS.Worksheet) {
  worksheet.properties.defaultRowHeight = 14.25;
  worksheet.columns = [{ width: 73.7109375 }, { width: 18.85546875 }];
  worksheet.views = [{ showGridLines: true, zoomScale: 100, zoomScaleNormal: 100 }];
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: false,
    fitToWidth: 1,
    fitToHeight: 1,
    scale: 100,
    pageOrder: "downThenOver",
    horizontalCentered: false,
    verticalCentered: false,
    margins: {
      left: 0.511811024,
      right: 0.511811024,
      top: 0.787401575,
      bottom: 0.787401575,
      header: 0.31496062,
      footer: 0.31496062,
    },
  };
}

function createReportSheet(workbook: ExcelJS.Workbook, model: AccountingReportModel) {
  const worksheet = workbook.addWorksheet("Plan1");
  styleBaseSheet(worksheet);

  worksheet.mergeCells("A2:B2");
  setOuterBorder(worksheet, 1, 3);
  worksheet.getRow(2).height = 15;
  worksheet.getRow(3).height = 15;
  const titleCell = worksheet.getCell("A2");
  titleCell.value = `${model.title} `;
  titleCell.font = { name: FONT_NAME, size: 11, bold: true, underline: true };
  titleCell.alignment = { horizontal: "center" };

  const leftHeader = worksheet.getCell("A5");
  leftHeader.value = "   LOCATÁRIO / IMÓVEL";
  leftHeader.font = { name: FONT_NAME, size: 11, bold: true, underline: true };

  const monthCell = worksheet.getCell("B5");
  monthCell.value = `${model.month} `;
  monthCell.font = { name: FONT_NAME, size: 11, bold: true, underline: true };
  monthCell.numFmt = "@";

  const yearCell = worksheet.getCell("B6");
  yearCell.value = model.year;
  yearCell.font = { name: FONT_NAME, size: 11, bold: true };
  yearCell.numFmt = "@";

  let pageIndex = 0;
  let frame = pageFrame(pageIndex);
  let currentRow = frame.dataStart;
  const completedFrames: Array<{ start: number; end: number }> = [];

  const advancePage = () => {
    completedFrames.push({ start: frame.frameStart, end: frame.fullFrameEnd });
    worksheet.getRow(frame.fullFrameEnd).height = 15.75;
    pageIndex += 1;
    const nextFrame = pageFrame(pageIndex);
    setPageGapHeights(worksheet, frame.fullFrameEnd, nextFrame.frameStart);
    frame = nextFrame;
    currentRow = frame.dataStart;
  };

  for (const reportRow of model.rows) {
    if (currentRow + 2 > frame.dataEnd) advancePage();

    const documentSuffix = reportRow.tenantDocument ? `   ${reportRow.tenantDocumentType} ${reportRow.tenantDocument}` : "";
    const portfolioSuffix = model.isGeneral ? `   CARTEIRA ${reportRow.portfolio.toLocaleUpperCase("pt-BR")}` : "";
    const tenantCell = worksheet.getCell(currentRow, 1);
    tenantCell.value = `${reportRow.tenant}${documentSuffix}${portfolioSuffix}`;
    tenantCell.font = { name: FONT_NAME, size: 11, bold: true };

    const amountCell = worksheet.getCell(currentRow, 2);
    amountCell.value = reportRow.amount;
    amountCell.numFmt = ACCOUNTING_NUMBER_FORMAT;
    amountCell.font = { name: FONT_NAME, size: 11, bold: true };

    const locationParts = [
      reportRow.property,
      reportRow.units.join(", "),
      reportRow.address,
    ].filter(Boolean);
    const locationCell = worksheet.getCell(currentRow + 1, 1);
    locationCell.value = locationParts.join(" - ");
    locationCell.font = { name: FONT_NAME, size: 11 };
    worksheet.getRow(currentRow + 1).height = 15;

    currentRow += 3;
  }

  if (currentRow + 1 > frame.dataEnd) advancePage();
  const totalRowNumber = currentRow + 1;
  const bottomRowNumber = totalRowNumber + 1;

  const totalLabel = worksheet.getCell(totalRowNumber, 1);
  totalLabel.value = "TOTAL ";
  totalLabel.font = { name: FONT_NAME, size: 11, bold: true, underline: true };

  const totalCell = worksheet.getCell(totalRowNumber, 2);
  totalCell.value = { formula: `SUM(B${FIRST_DATA_ROW}:B${totalRowNumber - 1})`, result: model.total };
  totalCell.numFmt = ACCOUNTING_NUMBER_FORMAT;
  totalCell.font = { name: FONT_NAME, size: 11, bold: true, underline: true };
  worksheet.getRow(bottomRowNumber).height = 17.25;

  completedFrames.push({ start: frame.frameStart, end: bottomRowNumber });
  completedFrames.forEach(({ start, end }) => styleDataFrame(worksheet, start, end));

  return worksheet;
}

export async function createAccountingReportWorkbook(model: AccountingReportModel) {
  if (model.rows.length === 0) throw new Error("Não há cobranças com item de aluguel para os filtros selecionados.");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Locações e Recebíveis";
  workbook.company = "Locações e Recebíveis";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  createReportSheet(workbook, model);
  workbook.addWorksheet("Plan2");
  workbook.addWorksheet("Plan3");

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export function downloadAccountingReport(bytes: Uint8Array, filename: string): AccountingReportDownload {
  if (bytes.byteLength === 0) throw new Error("O arquivo gerado está vazio.");
  const finalFilename = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const blob = new Blob([bytes.slice().buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = finalFilename;
  link.style.display = "none";
  document.body.appendChild(link);
  try {
    link.click();
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  } finally {
    link.remove();
  }
  return { filename: finalFilename, objectUrl };
}

export function revokeAccountingReportDownload(download: AccountingReportDownload | null) {
  if (download) URL.revokeObjectURL(download.objectUrl);
}
