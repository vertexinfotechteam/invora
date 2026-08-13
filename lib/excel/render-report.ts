import 'server-only';

import ExcelJS from 'exceljs';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/utils';

export interface ReportFilter {
  businessId: string;
  /** null = every customer. */
  customerId: string | null;
  /** Inclusive ISO dates (YYYY-MM-DD). */
  from: string;
  to: string;
}

/**
 * One row per quotation/invoice in the period (optionally narrowed to one
 * customer), plus a totals summary — the report the Reports page's own copy
 * has promised ("downloadable reports") without a way to actually get one.
 *
 * Scoped by `business_id` on every query below (never trusts an id the
 * caller passed without also checking it belongs to this business — see the
 * customer-ownership check in the route handler).
 */
export async function renderCustomerReportExcel(
  filter: ReportFilter,
): Promise<{ buffer: Buffer; filename: string }> {
  const admin = createSupabaseAdminClient();

  let quotationsQuery = admin
    .from('quotations')
    .select('number, issue_date, status, total_paise, currency, customers(name, company)')
    .eq('business_id', filter.businessId)
    .gte('issue_date', filter.from)
    .lte('issue_date', filter.to)
    .order('issue_date');
  if (filter.customerId) quotationsQuery = quotationsQuery.eq('customer_id', filter.customerId);

  let invoicesQuery = admin
    .from('invoices')
    .select('number, issue_date, status, total_paise, balance_paise, currency, customers(name, company)')
    .eq('business_id', filter.businessId)
    .gte('issue_date', filter.from)
    .lte('issue_date', filter.to)
    .order('issue_date');
  if (filter.customerId) invoicesQuery = invoicesQuery.eq('customer_id', filter.customerId);

  const [{ data: quotations }, { data: invoices }, { data: business }, customerName] = await Promise.all([
    quotationsQuery,
    invoicesQuery,
    admin.from('businesses').select('name, currency').eq('id', filter.businessId).single(),
    filter.customerId
      ? admin
          .from('customers')
          .select('name, company')
          .eq('id', filter.customerId)
          .eq('business_id', filter.businessId)
          .maybeSingle()
          .then((res) => res.data)
      : Promise.resolve(null),
  ]);

  const currency = business?.currency || 'INR';
  const workbook = new ExcelJS.Workbook();
  workbook.creator = business?.name || 'Invora';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 1 }] });
  const currencyFmt = `${currencySymbol(currency)}#,##0.00`;

  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = customerName
    ? `Report — ${customerName.company || customerName.name}`
    : 'Report — all customers';
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A2').value = `${formatDate(filter.from)} – ${formatDate(filter.to)}`;
  sheet.getCell('A2').font = { color: { argb: 'FF64748B' } };

  let row = 4;
  const headerRow = sheet.getRow(row);
  headerRow.values = ['Date', 'Type', 'Number', 'Customer', 'Status', 'Total', 'Balance due'];
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
  row += 1;

  type Row = { date: string; type: 'Quotation' | 'Invoice'; number: string; customer: string; status: string; totalPaise: number; balancePaise: number | null };
  const rows: Row[] = [
    ...(quotations ?? []).map((q) => ({
      date: q.issue_date as string,
      type: 'Quotation' as const,
      number: q.number as string,
      customer: partyLabel(q.customers as unknown as { name?: string; company?: string } | null),
      status: q.status as string,
      totalPaise: q.total_paise as number,
      balancePaise: null,
    })),
    ...(invoices ?? []).map((inv) => ({
      date: inv.issue_date as string,
      type: 'Invoice' as const,
      number: inv.number as string,
      customer: partyLabel(inv.customers as unknown as { name?: string; company?: string } | null),
      status: inv.status as string,
      totalPaise: inv.total_paise as number,
      balancePaise: inv.balance_paise as number,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  for (const entry of rows) {
    const excelRow = sheet.getRow(row);
    excelRow.values = [
      entry.date,
      entry.type,
      entry.number,
      entry.customer,
      entry.status,
      entry.totalPaise / 100,
      entry.balancePaise === null ? '—' : entry.balancePaise / 100,
    ];
    excelRow.getCell(6).numFmt = currencyFmt;
    if (entry.balancePaise !== null) excelRow.getCell(7).numFmt = currencyFmt;
    row += 1;
  }

  row += 1;
  const invoicedTotal = (invoices ?? []).reduce((sum, inv) => sum + (inv.total_paise as number), 0);
  const outstandingTotal = (invoices ?? []).reduce((sum, inv) => sum + (inv.balance_paise as number), 0);
  const quotedTotal = (quotations ?? []).reduce((sum, q) => sum + (q.total_paise as number), 0);

  for (const [label, value] of [
    ['Total quoted', quotedTotal],
    ['Total invoiced', invoicedTotal],
    ['Total outstanding', outstandingTotal],
  ] as const) {
    sheet.getCell(`E${row}`).value = label;
    sheet.getCell(`E${row}`).font = { bold: true };
    sheet.getCell(`F${row}`).value = value / 100;
    sheet.getCell(`F${row}`).numFmt = currencyFmt;
    sheet.getCell(`F${row}`).font = { bold: true };
    row += 1;
  }

  sheet.columns = [
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 28 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
  ];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const filenameScope = customerName
    ? (customerName.company || customerName.name || 'customer').replace(/[^a-zA-Z0-9-]/g, '_')
    : 'all-customers';
  return {
    buffer: Buffer.from(arrayBuffer),
    filename: `report_${filenameScope}_${filter.from}_${filter.to}.xlsx`,
  };
}

function partyLabel(customer: { name?: string; company?: string } | null): string {
  if (!customer) return '—';
  return customer.company || customer.name || '—';
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
