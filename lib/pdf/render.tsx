import 'server-only';

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPlanSnapshot } from '@/lib/guards/features';
import { amountInWordsIndian } from '@/lib/money';
import { notFound } from '@/lib/guards/errors';
import { ClassicTemplate } from '@/lib/pdf/templates/classic';
import { ModernTemplate } from '@/lib/pdf/templates/modern';
import { MinimalTemplate } from '@/lib/pdf/templates/minimal';
import type { PdfDocumentData, PdfParty, PdfTemplateName } from '@/lib/pdf/types';
import type { Business, Customer, DocumentType, TaxBucketRow } from '@/lib/types/database';

function addressLines(source: {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): string[] {
  const cityLine = [source.city, source.state, source.postal_code].filter(Boolean).join(', ');
  return [source.address_line1, source.address_line2, cityLine, source.country]
    .map((value) => (value ?? '').trim())
    .filter((value) => value.length > 0);
}

function businessParty(business: Business): PdfParty {
  return {
    name: business.name || 'Your business',
    company: business.legal_name || business.name,
    addressLines: addressLines(business),
    email: business.email,
    phone: business.phone,
    gstin: business.gstin,
  };
}

function customerParty(customer: Customer | null): PdfParty | null {
  if (!customer) return null;
  return {
    name: customer.name,
    company: customer.company,
    addressLines: addressLines(customer),
    email: customer.email,
    phone: customer.phone,
    gstin: customer.gstin,
  };
}

function formatDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Loads everything a template needs, in one place, so the three templates
 * cannot disagree about what a document contains.
 *
 * Uses the service-role client because the public /q/[token] and /i/[token]
 * routes have no session; the caller is responsible for having proved access
 * (either via requireBusiness or via a valid share token).
 */
export async function loadDocumentPdfData(
  docType: DocumentType,
  docId: string,
  options: { payUrl?: string | null } = {},
): Promise<{ data: PdfDocumentData; template: PdfTemplateName }> {
  const admin = createSupabaseAdminClient();

  const table = docType === 'quotation' ? 'quotations' : 'invoices';
  const itemsTable = docType === 'quotation' ? 'quotation_items' : 'invoice_items';
  const fk = docType === 'quotation' ? 'quotation_id' : 'invoice_id';

  const { data: doc } = await admin.from(table).select('*').eq('id', docId).maybeSingle();
  if (!doc) throw notFound('Document not found.');

  const [{ data: business }, { data: customer }, { data: items }] = await Promise.all([
    admin.from('businesses').select('*').eq('id', doc.business_id).single(),
    doc.customer_id
      ? admin.from('customers').select('*').eq('id', doc.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from(itemsTable).select('*').eq(fk, docId).order('position', { ascending: true }),
  ]);

  if (!business) throw notFound('Business profile not found.');

  const plan = await getPlanSnapshot(business.id);
  const requested = (business.pdf_template as PdfTemplateName) || 'classic';
  // Server-side downgrade: a free plan gets Classic regardless of what the
  // settings row says, so a lapsed subscription cannot keep printing Premium.
  const template: PdfTemplateName = plan.features.templates?.includes(requested)
    ? requested
    : 'classic';

  const isInvoice = docType === 'invoice';
  const locale = business.locale || 'en-IN';

  const data: PdfDocumentData = {
    docType,
    docLabel: isInvoice ? (business.gstin ? 'Tax Invoice' : 'Invoice') : 'Quotation',
    number: doc.number,
    title: doc.title,
    status: doc.status,
    issueDate: formatDate(doc.issue_date, locale) ?? doc.issue_date,
    secondaryDateLabel: isInvoice ? 'Due' : 'Valid until',
    secondaryDate: formatDate(
      isInvoice ? (doc as { due_date?: string | null }).due_date : (doc as { valid_until?: string | null }).valid_until,
      locale,
    ),
    currency: doc.currency || business.currency,
    locale,
    taxMode: doc.tax_mode,
    from: businessParty(business),
    to: customerParty((customer as Customer | null) ?? null),
    logoUrl: business.logo_url,
    signatureUrl: business.signature_url,
    lines: (items ?? []).map((item) => ({
      position: item.position,
      name: item.name,
      description: item.description,
      unit: item.unit,
      qty: Number(item.qty),
      ratePaise: item.rate_paise,
      discountPct: Number(item.discount_pct),
      taxRate: Number(item.tax_rate),
      hsnSac: item.hsn_sac,
      lineTotalPaise: item.line_total_paise,
    })),
    subtotalPaise: doc.subtotal_paise,
    discountPaise: doc.discount_paise,
    docDiscountPct: Number(doc.doc_discount_pct),
    taxPaise: doc.tax_paise,
    roundOffPaise: 0,
    totalPaise: doc.total_paise,
    taxBreakup: (doc.tax_breakup as TaxBucketRow[]) ?? [],
    amountPaidPaise: isInvoice ? (doc as { amount_paid_paise?: number }).amount_paid_paise : undefined,
    balancePaise: isInvoice ? (doc as { balance_paise?: number }).balance_paise : undefined,
    amountInWords: amountInWordsIndian(doc.total_paise, doc.currency || business.currency),
    notes: doc.notes,
    scope: (doc as { scope?: string | null }).scope,
    deliverables: (doc as { deliverables?: string | null }).deliverables,
    exclusions: (doc as { exclusions?: string | null }).exclusions,
    paymentTerms: doc.payment_terms,
    terms: doc.terms,
    bank: {
      accountName: business.bank_account_name,
      accountNo: business.bank_account_no,
      ifsc: business.bank_ifsc,
      bankName: business.bank_name,
      upiId: business.upi_id,
    },
    brandColor: business.brand_color || '#4F46E5',
    // The branding footer is a plan decision made on the server. It is not a
    // CSS class the browser can remove.
    showInvoraBranding: plan.features.remove_branding !== true,
    payUrl: options.payUrl ?? null,
  };

  return { data, template };
}

export function renderTemplate(data: PdfDocumentData, template: PdfTemplateName) {
  switch (template) {
    case 'modern':
      return <ModernTemplate data={data} />;
    case 'minimal':
      return <MinimalTemplate data={data} />;
    default:
      return <ClassicTemplate data={data} />;
  }
}

export async function renderDocumentPdf(
  docType: DocumentType,
  docId: string,
  options: { payUrl?: string | null } = {},
): Promise<{ buffer: Buffer; filename: string }> {
  const { data, template } = await loadDocumentPdfData(docType, docId, options);
  const buffer = await renderToBuffer(renderTemplate(data, template));
  const safeNumber = data.number.replace(/[^\w.-]+/g, '-');
  return { buffer, filename: `${data.docLabel.replace(/\s+/g, '-')}-${safeNumber}.pdf` };
}
