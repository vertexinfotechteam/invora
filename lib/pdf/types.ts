import type { TaxBucketRow } from '@/lib/types/database';

/** The flattened, presentation-ready shape every PDF template consumes. */
export interface PdfParty {
  name: string;
  company?: string | null;
  addressLines: string[];
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
}

export interface PdfLine {
  position: number;
  name: string;
  description?: string | null;
  unit: string;
  qty: number;
  ratePaise: number;
  discountPct: number;
  taxRate: number;
  hsnSac?: string | null;
  lineTotalPaise: number;
}

export interface PdfBankDetails {
  accountName?: string | null;
  accountNo?: string | null;
  ifsc?: string | null;
  bankName?: string | null;
  upiId?: string | null;
}

export interface PdfDocumentData {
  docType: 'quotation' | 'invoice';
  /** "Quotation" / "Tax Invoice" — what actually prints at the top. */
  docLabel: string;
  number: string;
  title?: string | null;
  status: string;

  issueDate: string;
  /** valid-until for a quotation, due date for an invoice. */
  secondaryDateLabel: string;
  secondaryDate?: string | null;

  currency: string;
  locale: string;
  /** Determines whether "Subtotal" (below) can honestly claim to be the sum
   * of the printed line amounts — see the comment on that field. */
  taxMode: 'exclusive' | 'inclusive';

  from: PdfParty;
  to: PdfParty | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;

  lines: PdfLine[];

  /** Tax-exclusive value. In `taxMode: 'inclusive'` this is *not* the sum of
   * the printed per-line amounts (those are tax-inclusive) — TotalsBlock
   * labels it accordingly so the two don't read as a math error. */
  subtotalPaise: number;
  discountPaise: number;
  docDiscountPct: number;
  taxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  taxBreakup: TaxBucketRow[];
  amountPaidPaise?: number;
  balancePaise?: number;
  amountInWords: string;

  notes?: string | null;
  scope?: string | null;
  deliverables?: string | null;
  exclusions?: string | null;
  paymentTerms?: string | null;
  terms?: string | null;

  bank: PdfBankDetails;
  brandColor: string;
  /** Free plan prints "Made with Invora". Decided server-side, never by CSS. */
  showInvoraBranding: boolean;
  payUrl?: string | null;
}

export type PdfTemplateName = 'classic' | 'modern' | 'minimal';
