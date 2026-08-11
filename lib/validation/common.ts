import { z } from 'zod';

/** Shared primitives. Imported by both the client forms and the server routes. */

export const uuidSchema = z.string().uuid('Expected a valid id.');

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `Keep ${label} under ${max} characters.`);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.');

export const optionalEmail = emailSchema.optional().or(z.literal('').transform(() => undefined));

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{6,20}$/, 'Enter a valid phone number.');

export const optionalPhone = phoneSchema.optional().or(z.literal('').transform(() => undefined));

/** 15-character Indian GSTIN, checked structurally (not against the GST portal). */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/,
    'Enter a valid 15-character GSTIN.',
  );

export const optionalGstin = gstinSchema.optional().or(z.literal('').transform(() => undefined));

export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid 10-character PAN.');

export const optionalPan = panSchema.optional().or(z.literal('').transform(() => undefined));

export const ifscSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}0[A-Z\d]{6}$/, 'Enter a valid IFSC code.');

export const optionalIfsc = ifscSchema.optional().or(z.literal('').transform(() => undefined));

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([\da-fA-F]{6})$/, 'Use a 6-digit hex colour, e.g. #4F46E5.');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.');

export const paiseSchema = z
  .number()
  .int('Amounts are stored in whole paise.')
  .nonnegative('Amounts cannot be negative.')
  .max(Number.MAX_SAFE_INTEGER);

export const percentSchema = z
  .number()
  .min(0, 'Cannot be below 0%.')
  .max(100, 'Cannot exceed 100%.');

export const qtySchema = z
  .number()
  .nonnegative('Quantity cannot be negative.')
  .max(1_000_000, 'That quantity looks wrong.')
  .refine((value) => Number.isFinite(value), 'Quantity must be a number.');

export const taxModeSchema = z.enum(['exclusive', 'inclusive']);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(40).optional(),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Constrains a caller-supplied `next=` target to a same-site path.
 *
 * `startsWith('/')` alone is not enough: browsers resolve `//evil.com` and
 * `/\evil.com` as protocol-relative URLs, so both would leave the site. Any
 * post-authentication redirect must go through here.
 */
export function safeRedirectPath(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string') return fallback;
  const path = value.trim();
  if (!path.startsWith('/')) return fallback;
  if (path.startsWith('//') || path.startsWith('/\\')) return fallback;
  // Control characters (CR/LF especially) have no place in a redirect target.
  for (let i = 0; i < path.length; i += 1) {
    const code = path.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return fallback;
  }
  return path;
}

/** Turns a ZodError into the { field: message } shape our forms render. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
