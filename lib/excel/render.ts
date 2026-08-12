import 'server-only';

import ExcelJS from 'exceljs';

import { loadDocumentPdfData } from '@/lib/pdf/render';
import type { DocumentType } from '@/lib/types/database';

/**
 * Same source data as the PDF (loadDocumentPdfData), a different renderer.
 * Keeping one data-loading path means the spreadsheet and the PDF can never
 * disagree about a figure — only how it's laid out.
 *
 * Amounts are written as real numbers (rupees, not paise — paise is a
 * storage/calculation detail, not something a customer's accountant wants to
 * see) with a currency format, not pre-formatted strings, so the sheet is
 * actually usable in a spreadsheet (SUM works, sorting works).
 */
export async function renderDocumentExcel(
  docType: DocumentType,
  docId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const { data } = await loadDocumentPdfData(docType, docId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.from.company || data.from.name;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(data.docLabel.slice(0, 31) || 'Document', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const currencyFmt = `${currencySymbol(data.currency)}#,##0.00`;

  // ---- header block ---------------------------------------------------
  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = `${data.docLabel} ${data.number}`;
  sheet.getCell('A1').font = { size: 16, bold: true };

  let row = 2;
  const meta: [string, string][] = [
    ['From', data.from.company || data.from.name],
    ['To', data.to?.company || data.to?.name || '—'],
    ['Issue date', data.issueDate],
    [data.secondaryDateLabel, data.secondaryDate || '—'],
    ['Status', data.status],
  ];
  for (const [label, value] of meta) {
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`A${row}`).font = { bold: true, color: { argb: 'FF64748B' } };
    sheet.getCell(`B${row}`).value = value;
    row += 1;
  }
  row += 1;

  // ---- line items -------------------------------------------------------
  const headerRow = sheet.getRow(row);
  headerRow.values = ['#', 'Item', 'Qty', 'Unit', 'Rate', 'Tax %', 'Amount'];
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
  const headerRowNumber = row;
  row += 1;

  data.lines.forEach((line, index) => {
    const excelRow = sheet.getRow(row);
    excelRow.values = [
      index + 1,
      line.description ? `${line.name} — ${line.description}` : line.name,
      line.qty,
      line.unit,
      line.ratePaise / 100,
      line.taxRate,
      line.lineTotalPaise / 100,
    ];
    excelRow.getCell(5).numFmt = currencyFmt;
    excelRow.getCell(7).numFmt = currencyFmt;
    row += 1;
  });

  row += 1;

  // ---- totals -------------------------------------------------------
  const totalsRows: [string, number][] = [
    [data.taxMode === 'inclusive' ? 'Taxable value' : 'Subtotal', data.subtotalPaise / 100],
  ];
  if (data.discountPaise > 0) totalsRows.push(['Discount', -data.discountPaise / 100]);
  for (const bucket of data.taxBreakup) {
    if (bucket.taxPaise === 0 && bucket.ratePct === 0) continue;
    totalsRows.push([`Tax @ ${bucket.ratePct}%`, bucket.taxPaise / 100]);
  }
  if (data.roundOffPaise !== 0) totalsRows.push(['Round off', data.roundOffPaise / 100]);
  totalsRows.push(['Total', data.totalPaise / 100]);
  if (typeof data.amountPaidPaise === 'number' && data.amountPaidPaise > 0) {
    totalsRows.push(['Amount paid', -data.amountPaidPaise / 100]);
    totalsRows.push(['Balance due', (data.balancePaise ?? 0) / 100]);
  }

  for (const [label, value] of totalsRows) {
    sheet.getCell(`F${row}`).value = label;
    sheet.getCell(`F${row}`).font = { bold: label === 'Total' || label === 'Balance due' };
    sheet.getCell(`G${row}`).value = value;
    sheet.getCell(`G${row}`).numFmt = currencyFmt;
    sheet.getCell(`G${row}`).font = { bold: label === 'Total' || label === 'Balance due' };
    row += 1;
  }

  sheet.columns = [
    { width: 4 },
    { width: 42 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 8 },
    { width: 16 },
  ];
  sheet.getRow(headerRowNumber).height = 20;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    filename: `${data.number.replace(/[^a-zA-Z0-9-]/g, '_')}.xlsx`,
  };
}

function currencySymbol(currency: string): string {
  switch (currency) {
    case 'INR':
      return '₹';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return `${currency} `;
  }
}
