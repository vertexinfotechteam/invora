import * as yup from 'yup';

/**
 * Client-side mirrors of the Zod schemas in lib/validation/schemas.ts.
 *
 * These exist for instant UX feedback only — see the note in
 * hooks/use-client-validation.ts. Field names, and as much of the wording as
 * Yup's API allows, are kept identical to the server schemas on purpose: a
 * rule that reads differently on the client than on the server is confusing
 * ("why did it accept that and then reject it?"), and keeping the two in
 * sync by inspection is the whole reason both live in lib/validation/.
 *
 * Regexes are copied verbatim from lib/validation/common.ts rather than
 * imported from it — that file has no 'use client' boundary of its own, but
 * some of what it exports (fieldErrors, a ZodError formatter) has no
 * business in a client bundle. Copying six regexes is cheaper than splitting
 * that file, and they're marked below so the two stay easy to compare.
 */

// Mirrors lib/validation/common.ts — keep these two in sync if either changes.
const PHONE_RE = /^[+()\d\s-]{6,20}$/;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z\d]{6}$/;
const HEX_COLOR_RE = /^#([\da-fA-F]{6})$/;

const requiredText = (label: string, max: number) =>
  yup
    .string()
    .trim()
    .required(`${label} is required.`)
    .max(max, `Keep ${label.toLowerCase()} under ${max} characters.`);

const optionalText = (max: number) => yup.string().trim().max(max, `Keep this under ${max} characters.`);

const emailField = yup.string().trim().lowercase().email('Enter a valid email address.');
const requiredEmail = emailField.required('Email is required.');
const optionalEmail = emailField.optional().transform((value) => (value === '' ? undefined : value));

const optionalPhone = yup
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .matches(PHONE_RE, { message: 'Enter a valid phone number.', excludeEmptyString: true });

const optionalGstin = yup
  .string()
  .trim()
  .uppercase()
  .transform((value) => (value === '' ? undefined : value))
  .matches(GSTIN_RE, { message: 'Enter a valid 15-character GSTIN.', excludeEmptyString: true });

const optionalPan = yup
  .string()
  .trim()
  .uppercase()
  .transform((value) => (value === '' ? undefined : value))
  .matches(PAN_RE, { message: 'Enter a valid 10-character PAN.', excludeEmptyString: true });

const optionalIfsc = yup
  .string()
  .trim()
  .uppercase()
  .transform((value) => (value === '' ? undefined : value))
  .matches(IFSC_RE, { message: 'Enter a valid IFSC code.', excludeEmptyString: true });

const passwordField = yup
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128)
  .matches(/[a-z]/, 'Include a lowercase letter.')
  .matches(/[A-Z]/, 'Include an uppercase letter.')
  .matches(/\d/, 'Include a number.');

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const loginSchema = yup.object({
  email: requiredEmail,
  password: yup.string().required('Enter your password.'),
});

export const signupSchema = yup.object({
  fullName: requiredText('Your name', 80),
  businessName: requiredText('Business name', 120),
  email: requiredEmail,
  password: passwordField.required('Password is required.'),
  confirmPassword: yup
    .string()
    .required('Confirm your password.')
    .oneOf([yup.ref('password')], 'Passwords do not match.'),
  // Native checkboxes submit 'on' when checked and are absent otherwise —
  // this form's FormData never carries acceptTerms:'off'.
  acceptTerms: yup
    .string()
    .oneOf(['on'], 'Please accept the Terms and Privacy Policy.')
    .required('Please accept the Terms and Privacy Policy.'),
});

export const forgotPasswordSchema = yup.object({
  email: requiredEmail,
});

export const resetPasswordSchema = yup.object({
  password: yup.string().required('Password is required.').min(10, 'Use at least 10 characters.').max(128),
  confirmPassword: yup
    .string()
    .required('Confirm your password.')
    .oneOf([yup.ref('password')], 'Passwords do not match.'),
});

// ---------------------------------------------------------------------------
// Marketing site
// ---------------------------------------------------------------------------
export const contactSchema = yup.object({
  name: requiredText('Your name', 100),
  email: requiredEmail,
  message: yup
    .string()
    .trim()
    .required('Tell us a little more.')
    .min(10, 'Tell us a little more — at least 10 characters.')
    .max(4000),
});

export const bookDemoSchema = yup.object({
  name: requiredText('Your name', 100),
  email: requiredEmail,
  company: optionalText(160),
  notes: optionalText(2000),
});

// ---------------------------------------------------------------------------
// Customers & catalog
// ---------------------------------------------------------------------------
export const customerSchema = yup.object({
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
  notes: optionalText(2000),
});

export const productSchema = yup.object({
  name: requiredText('Item name', 160),
  description: optionalText(2000),
  sku: optionalText(64),
  unit: requiredText('Unit', 24),
  // The visible field is rupees (see components/app/product-form.tsx); this
  // validates the hidden default_price_paise field, which is what the server
  // actually receives and what "positive amount" has to mean here.
  default_price_paise: yup
    .number()
    .typeError('Enter a valid rate.')
    .integer('Amounts are stored in whole paise.')
    .min(0, 'Amounts cannot be negative.'),
  tax_rate: yup.number().typeError('Enter a number.').min(0, 'Cannot be below 0%.').max(100, 'Cannot exceed 100%.'),
  default_discount_pct: yup
    .number()
    .typeError('Enter a number.')
    .min(0, 'Cannot be below 0%.')
    .max(100, 'Cannot exceed 100%.'),
  hsn_sac: optionalText(16),
});

// ---------------------------------------------------------------------------
// Business settings
// ---------------------------------------------------------------------------
export const businessProfileSchema = yup.object({
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
  gstin: optionalGstin,
  pan: optionalPan,
});

export const businessDefaultsSchema = yup.object({
  quote_prefix: optionalText(12),
  invoice_prefix: optionalText(12),
  number_padding: yup
    .number()
    .typeError('Enter a whole number.')
    .integer('Enter a whole number.')
    .min(1, 'Must be at least 1.')
    .max(8, 'Must be at most 8.'),
  default_tax_rate: yup
    .number()
    .typeError('Enter a number.')
    .min(0, 'Cannot be below 0%.')
    .max(100, 'Cannot exceed 100%.'),
  quote_validity_days: yup
    .number()
    .typeError('Enter a whole number.')
    .integer()
    .min(1, 'Must be at least 1 day.')
    .max(365, 'Must be at most 365 days.'),
  invoice_due_days: yup
    .number()
    .typeError('Enter a whole number.')
    .integer()
    .min(0, 'Cannot be negative.')
    .max(365, 'Must be at most 365 days.'),
});

export const businessBankSchema = yup.object({
  bank_account_name: optionalText(120),
  bank_account_no: optionalText(34),
  bank_ifsc: optionalIfsc,
  bank_name: optionalText(120),
  upi_id: optionalText(80),
});

export const businessBrandingSchema = yup.object({
  brand_color: yup
    .string()
    .trim()
    .matches(HEX_COLOR_RE, 'Use a 6-digit hex colour, e.g. #4F46E5.'),
});

// ---------------------------------------------------------------------------
// Documents (invoice / quotation editor — top-level fields only; line items
// are validated separately, see lib/validation/yup-schemas.ts's
// documentLineItemsAreValid below, since they're an array the editor manages
// as component state rather than FormData).
// ---------------------------------------------------------------------------
export const documentTopLevelSchema = yup.object({
  title: optionalText(160),
  issue_date: yup
    .string()
    .required('Issue date is required.')
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.'),
});

/**
 * Line items aren't FormData fields — the editor holds them as an array in
 * component state — so they're checked directly rather than through the
 * FormData-shaped hook above. Mirrors lib/validation/schemas.ts's
 * lineItemSchema: a name, a non-negative rate, a positive quantity.
 */
export function validateDocumentLines(
  lines: { name: string; qty: number; rate_paise: number }[],
): string | null {
  if (lines.length === 0) {
    return 'Add at least one line item before saving.';
  }
  for (const [index, line] of lines.entries()) {
    if (!line.name.trim()) {
      return `Line ${index + 1} needs a name.`;
    }
    if (!Number.isFinite(line.qty) || line.qty <= 0) {
      return `Line ${index + 1}: quantity must be greater than zero.`;
    }
    if (!Number.isFinite(line.rate_paise) || line.rate_paise < 0) {
      return `Line ${index + 1}: rate cannot be negative.`;
    }
  }
  return null;
}
