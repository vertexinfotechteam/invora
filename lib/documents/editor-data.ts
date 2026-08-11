import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { addDaysIso, todayIso } from '@/lib/utils';
import { emptyLine, type CustomerOption, type EditorState, type ProductOption } from '@/components/documents/types';
import type { Business, DocumentType, TaxModeDb } from '@/lib/types/database';

/** Customers + catalog for the pickers, in one round trip each. */
export async function loadEditorOptions(): Promise<{
  customers: CustomerOption[];
  products: ProductOption[];
}> {
  const supabase = await createSupabaseServerClient();

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, company, email')
      .is('archived_at', null)
      .order('name', { ascending: true })
      .limit(500),
    supabase
      .from('products')
      .select('id, name, description, unit, default_price_paise, tax_rate, default_discount_pct, hsn_sac')
      .is('archived_at', null)
      .order('name', { ascending: true })
      .limit(500),
  ]);

  return {
    customers: (customers ?? []) as CustomerOption[],
    products: (products ?? []).map((product) => ({
      ...product,
      tax_rate: Number(product.tax_rate),
      default_discount_pct: Number(product.default_discount_pct),
    })) as ProductOption[],
  };
}

/** A blank document, pre-filled from the business defaults. */
export function blankEditorState(business: Business, docType: DocumentType): EditorState {
  const issue = todayIso();
  const days = docType === 'quotation' ? business.quote_validity_days : business.invoice_due_days;

  return {
    customer_id: null,
    title: '',
    issue_date: issue,
    secondary_date: addDaysIso(issue, days ?? 15),
    currency: business.currency,
    tax_mode: business.default_tax_mode,
    doc_discount_pct: 0,
    notes: business.default_notes ?? '',
    scope: '',
    deliverables: '',
    exclusions: '',
    payment_terms: business.default_payment_terms ?? '',
    terms: business.default_terms ?? '',
    items: [emptyLine(Number(business.default_tax_rate))],
  };
}

export interface LoadedDocumentRow {
  customer_id: string | null;
  title: string | null;
  issue_date: string;
  valid_until?: string | null;
  due_date?: string | null;
  currency: string;
  tax_mode: TaxModeDb;
  doc_discount_pct: number;
  notes: string | null;
  scope?: string | null;
  deliverables?: string | null;
  exclusions?: string | null;
  payment_terms: string | null;
  terms: string | null;
}

export interface LoadedItemRow {
  product_id: string | null;
  name: string;
  description: string | null;
  unit: string;
  qty: number;
  rate_paise: number;
  discount_pct: number;
  tax_rate: number;
  hsn_sac: string | null;
}

export function toEditorState(
  doc: LoadedDocumentRow,
  items: LoadedItemRow[],
  docType: DocumentType,
  defaultTaxRate: number,
): EditorState {
  return {
    customer_id: doc.customer_id,
    title: doc.title ?? '',
    issue_date: doc.issue_date,
    secondary_date: (docType === 'quotation' ? doc.valid_until : doc.due_date) ?? '',
    currency: doc.currency,
    tax_mode: doc.tax_mode,
    doc_discount_pct: Number(doc.doc_discount_pct),
    notes: doc.notes ?? '',
    scope: doc.scope ?? '',
    deliverables: doc.deliverables ?? '',
    exclusions: doc.exclusions ?? '',
    payment_terms: doc.payment_terms ?? '',
    terms: doc.terms ?? '',
    items:
      items.length > 0
        ? items.map((item, index) => ({
            key: `line-${index}-${item.name.slice(0, 6)}`,
            product_id: item.product_id,
            name: item.name,
            description: item.description ?? '',
            unit: item.unit,
            qty: Number(item.qty),
            rate_paise: item.rate_paise,
            discount_pct: Number(item.discount_pct),
            tax_rate: Number(item.tax_rate),
            hsn_sac: item.hsn_sac ?? '',
          }))
        : [emptyLine(defaultTaxRate)],
  };
}
