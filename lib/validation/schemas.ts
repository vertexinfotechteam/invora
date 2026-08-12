import { z } from 'zod';
import {
  emailSchema,
  hexColorSchema,
  isoDateSchema,
  optionalEmail,
  optionalGstin,
  optionalIfsc,
  optionalPan,
  optionalPhone,
  optionalText,
  paiseSchema,
  percentSchema,
  qtySchema,
  requiredText,
  taxModeSchema,
  uuidSchema,
} from '@/lib/validation/common';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const signUpSchema = z
  .object({
    fullName: requiredText('Your name', 80),
    businessName: requiredText('Business name', 120),
    email: emailSchema,
    password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(128)
      .regex(/[a-z]/, 'Include a lowercase letter.')
      .regex(/[A-Z]/, 'Include an uppercase letter.')
      .regex(/\d/, 'Include a number.'),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Please accept the Terms and Privacy Policy.' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters.').max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

// ---------------------------------------------------------------------------
// Business profile
// ---------------------------------------------------------------------------
export const businessProfileSchema = z.object({
  name: requiredText('Business name', 120),
  legal_name: optionalText(160),
  email: optionalEmail,
  phone: optionalPhone,
  website: optionalText(200),
  address_line1: optionalText(160),
  address_line2: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  postal_code: optionalText(16),
  country: z.string().trim().length(2).default('IN'),
  gstin: optionalGstin,
  pan: optionalPan,
  logo_url: optionalText(500),
  signature_url: optionalText(500),
});

export const businessDefaultsSchema = z.object({
  currency: z.string().trim().length(3).default('INR'),
  quote_prefix: z.string().trim().max(12).default('QT-'),
  invoice_prefix: z.string().trim().max(12).default('INV-'),
  number_padding: z.coerce.number().int().min(1).max(8).default(4),
  default_tax_rate: percentSchema.default(18),
  default_tax_mode: taxModeSchema.default('exclusive'),
  default_payment_terms: optionalText(400),
  default_terms: optionalText(4000),
  default_notes: optionalText(2000),
  quote_validity_days: z.coerce.number().int().min(1).max(365).default(15),
  invoice_due_days: z.coerce.number().int().min(0).max(365).default(15),
});

export const businessBrandingSchema = z.object({
  brand_color: hexColorSchema.default('#4F46E5'),
  pdf_template: z.enum(['classic', 'modern', 'minimal']).default('classic'),
});

export const businessBankSchema = z.object({
  bank_account_name: optionalText(120),
  bank_account_no: optionalText(34),
  bank_ifsc: optionalIfsc,
  bank_name: optionalText(120),
  upi_id: optionalText(80),
});

// ---------------------------------------------------------------------------
// Customers & products
// ---------------------------------------------------------------------------
export const customerSchema = z.object({
  name: requiredText('Customer name', 120),
  company: optionalText(120),
  email: optionalEmail,
  phone: optionalPhone,
  gstin: optionalGstin,
  address_line1: optionalText(160),
  address_line2: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  postal_code: optionalText(16),
  country: z.string().trim().length(2).default('IN').optional(),
  notes: optionalText(2000),
});

export const productSchema = z.object({
  name: requiredText('Item name', 160),
  description: optionalText(2000),
  sku: optionalText(64),
  unit: z.string().trim().min(1).max(24).default('unit'),
  default_price_paise: paiseSchema.default(0),
  tax_rate: percentSchema.default(18),
  default_discount_pct: percentSchema.default(0),
  hsn_sac: optionalText(16),
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const lineItemSchema = z.object({
  id: uuidSchema.optional(),
  product_id: uuidSchema.nullable().optional(),
  position: z.number().int().min(0).default(0),
  name: requiredText('Item name', 200),
  description: optionalText(2000),
  unit: z.string().trim().min(1).max(24).default('unit'),
  qty: qtySchema.default(1),
  rate_paise: paiseSchema.default(0),
  discount_pct: percentSchema.default(0),
  tax_rate: percentSchema.default(0),
  hsn_sac: optionalText(16),
});

export type LineItemInput = z.infer<typeof lineItemSchema>;

const documentBase = {
  customer_id: uuidSchema.nullable().optional(),
  title: optionalText(160),
  issue_date: isoDateSchema,
  currency: z.string().trim().length(3).default('INR'),
  tax_mode: taxModeSchema.default('exclusive'),
  doc_discount_pct: percentSchema.default(0),
  notes: optionalText(4000),
  payment_terms: optionalText(2000),
  terms: optionalText(8000),
  items: z.array(lineItemSchema).max(200, 'A document can hold at most 200 line items.'),
};

export const quotationSchema = z
  .object({
    ...documentBase,
    valid_until: isoDateSchema.nullable().optional(),
    scope: optionalText(8000),
    deliverables: optionalText(8000),
    exclusions: optionalText(8000),
  })
  .refine(
    (data) => !data.valid_until || data.valid_until >= data.issue_date,
    { path: ['valid_until'], message: 'Valid-until cannot be before the issue date.' },
  );

export const invoiceSchema = z
  .object({
    ...documentBase,
    due_date: isoDateSchema.nullable().optional(),
    scope: optionalText(8000),
    quotation_id: uuidSchema.nullable().optional(),
  })
  .refine((data) => !data.due_date || data.due_date >= data.issue_date, {
    path: ['due_date'],
    message: 'Due date cannot be before the issue date.',
  });

export type QuotationInput = z.infer<typeof quotationSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export const manualPaymentSchema = z.object({
  invoice_id: uuidSchema,
  amount_paise: paiseSchema.refine((v) => v > 0, 'Enter an amount greater than zero.'),
  paid_at: z.string().datetime().or(isoDateSchema),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other']),
  reference: optionalText(120),
  notes: optionalText(500),
});

// ---------------------------------------------------------------------------
// Sharing & public actions
// ---------------------------------------------------------------------------
export const createShareLinkSchema = z.object({
  doc_type: z.enum(['quotation', 'invoice']),
  doc_id: uuidSchema,
  expires_in_days: z.coerce.number().int().min(1).max(365).default(30),
});

export const publicQuoteResponseSchema = z.object({
  token: z.string().min(20).max(200),
  decision: z.enum(['accept', 'reject']),
  signed_name: requiredText('Your name', 80),
  comment: optionalText(1000),
});

// ---------------------------------------------------------------------------
// Marketing site
// ---------------------------------------------------------------------------
export const contactSchema = z.object({
  name: requiredText('Your name', 100),
  email: emailSchema,
  message: z.string().trim().min(10, 'Tell us a little more — at least 10 characters.').max(4000),
  // Honeypot: real visitors never fill this in, so anything here means a bot.
  company_website: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
export const sendDocumentSchema = z.object({
  doc_type: z.enum(['quotation', 'invoice']),
  doc_id: uuidSchema,
  to: emailSchema,
  cc: z.array(emailSchema).max(5).optional(),
  subject: requiredText('Subject', 200),
  message: z.string().trim().min(1, 'Write a short message.').max(4000),
  attach_pdf: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// AI request payloads
// ---------------------------------------------------------------------------
export const aiQuotationRequestSchema = z.object({
  brief: z.string().trim().min(20, 'Describe the work in at least 20 characters.').max(6000),
  customer_id: uuidSchema.nullable().optional(),
  include_pricing: z.boolean().default(false),
  tone: z.enum(['professional', 'friendly', 'concise']).default('professional'),
  language: z.string().trim().max(30).default('English'),
});

export const aiInvoiceRequestSchema = z.object({
  instruction: z.string().trim().min(5).max(4000),
  invoice_id: uuidSchema.optional(),
  kind: z.enum(['line_items', 'summary_note', 'reminder', 'overdue_reminder', 'thank_you']),
});

export const aiRewriteRequestSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  action: z.enum(['professionalize', 'shorten', 'expand', 'fix_grammar', 'translate']),
  target_language: z.string().trim().max(30).optional(),
});

/**
 * Deliberately more lenient than lineItemSchema: this describes whatever is
 * currently on screen (including a fresh blank row with no name yet), not
 * something about to be persisted, so nothing here should be required.
 */
const commandLineSchema = z.object({
  name: z.string().max(200).default(''),
  description: z.string().max(2000).nullable().optional(),
  unit: z.string().max(24).default('unit'),
  qty: qtySchema.default(0),
  rate_paise: paiseSchema.default(0),
  discount_pct: percentSchema.default(0),
  tax_rate: percentSchema.default(0),
});

export const aiCommandRequestSchema = z.object({
  doc_type: z.enum(['quotation', 'invoice']),
  doc_id: uuidSchema,
  command: z.string().trim().min(2, 'Type a command.').max(500),
  // The command bar operates on what's on screen right now, not the last
  // autosaved snapshot — the server previously re-fetched the document's
  // lines/discount from the database, which meant unsaved edits made in the
  // ~2s before autosave could be silently discarded when a command applied.
  lines: z.array(commandLineSchema).max(200),
  doc_discount_pct: percentSchema,
  tax_mode: taxModeSchema,
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminActionSchema = z.object({
  target_business_id: uuidSchema,
  reason: z.string().trim().min(5, 'A reason of at least 5 characters is required.').max(500),
});

export const adminAdjustLimitsSchema = adminActionSchema.extend({
  bonus_doc_limit: z.coerce.number().int().min(0).max(100_000),
  bonus_ai_credits: z.coerce.number().int().min(0).max(100_000),
});

export const adminSubscriptionSchema = adminActionSchema.extend({
  action: z.enum(['activate', 'cancel', 'suspend', 'reactivate']),
  plan_code: z.string().trim().max(40).optional(),
});
