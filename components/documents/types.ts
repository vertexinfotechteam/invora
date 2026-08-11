import type { TaxMode } from '@/lib/calc/totals';

export interface EditorLine {
  /** Stable key for React; not persisted. */
  key: string;
  product_id: string | null;
  name: string;
  description: string;
  unit: string;
  qty: number;
  rate_paise: number;
  discount_pct: number;
  tax_rate: number;
  hsn_sac: string;
}

export interface EditorState {
  customer_id: string | null;
  title: string;
  issue_date: string;
  /** valid-until for a quotation, due date for an invoice. */
  secondary_date: string;
  currency: string;
  tax_mode: TaxMode;
  doc_discount_pct: number;
  notes: string;
  scope: string;
  deliverables: string;
  exclusions: string;
  payment_terms: string;
  terms: string;
  items: EditorLine[];
}

export interface CustomerOption {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  default_price_paise: number;
  tax_rate: number;
  default_discount_pct: number;
  hsn_sac: string | null;
}

export function emptyLine(taxRate: number): EditorLine {
  return {
    key: `line-${Math.random().toString(36).slice(2, 10)}`,
    product_id: null,
    name: '',
    description: '',
    unit: 'unit',
    qty: 1,
    rate_paise: 0,
    discount_pct: 0,
    tax_rate: taxRate,
    hsn_sac: '',
  };
}

/** Editor state -> the payload the server action validates. */
export function toPayload(state: EditorState, docType: 'quotation' | 'invoice') {
  const base = {
    customer_id: state.customer_id,
    title: state.title || undefined,
    issue_date: state.issue_date,
    currency: state.currency,
    tax_mode: state.tax_mode,
    doc_discount_pct: state.doc_discount_pct,
    notes: state.notes || undefined,
    payment_terms: state.payment_terms || undefined,
    terms: state.terms || undefined,
    scope: state.scope || undefined,
    items: state.items
      .filter((line) => line.name.trim().length > 0)
      .map((line, index) => ({
        product_id: line.product_id,
        position: index,
        name: line.name.trim(),
        description: line.description || undefined,
        unit: line.unit || 'unit',
        qty: line.qty,
        rate_paise: line.rate_paise,
        discount_pct: line.discount_pct,
        tax_rate: line.tax_rate,
        hsn_sac: line.hsn_sac || undefined,
      })),
  };

  return docType === 'quotation'
    ? {
        ...base,
        valid_until: state.secondary_date || null,
        deliverables: state.deliverables || undefined,
        exclusions: state.exclusions || undefined,
      }
    : { ...base, due_date: state.secondary_date || null };
}
