// The Anthropic SDK's structured-output helper (zodOutputFormat) requires Zod 4
// schemas specifically — the rest of the app uses the regular 'zod' (v3 API)
// import for form validation, which is a structurally different class shape.
import { z } from 'zod/v4';

/**
 * Structured output contracts.
 *
 * The model returns schema-validated objects, so the editor renders them with
 * zero parsing and a malformed response is a validation error rather than a
 * corrupted document.
 *
 * Note what is NOT in these schemas: totals, tax amounts, discounts in
 * currency. The model never produces a money figure that lands in a money
 * field. `suggestedRatePaise` is the single exception and it renders as a chip
 * the user must click to accept.
 */

export const AiLineItemSchema = z.object({
  name: z.string().describe('Short line-item name, 2–8 words.'),
  description: z.string().describe('One or two sentences of scope for this line.'),
  unit: z.string().describe('Unit of measure, e.g. hour, day, page, unit, licence.'),
  qty: z.number().describe('Quantity. Use 1 when unsure.'),
  suggestedRatePaise: z
    .number()
    .nullable()
    .describe(
      'Suggested unit rate in INTEGER PAISE, or null. MUST be null unless the user explicitly asked for pricing.',
    ),
  rateConfidence: z
    .enum(['none', 'low', 'medium', 'high'])
    .describe('How confident the suggested rate is. Use "none" when suggestedRatePaise is null.'),
});

export const QuotationDraftSchema = z.object({
  title: z.string().describe('A concise project title for this quotation.'),
  lineItems: z.array(AiLineItemSchema).min(1).max(40),
  scope: z.string().describe('What the engagement covers, in prose.'),
  deliverables: z.array(z.string()).describe('Concrete artefacts the client receives.'),
  exclusions: z.array(z.string()).describe('Explicitly out of scope, to prevent scope creep.'),
  assumptions: z.array(z.string()).describe('What the estimate assumes to be true.'),
  paymentTerms: z.string().describe('Milestones and payment schedule, in prose.'),
  notes: z.string().describe('Anything else worth telling the client.'),
  termsAndConditions: z.string().describe('Standard T&C appropriate to this work.'),
});

export type QuotationDraft = z.infer<typeof QuotationDraftSchema>;
export type AiLineItem = z.infer<typeof AiLineItemSchema>;

export const InvoiceLineItemsSchema = z.object({
  lineItems: z.array(AiLineItemSchema).min(1).max(40),
  summaryNote: z.string().describe('A customer-facing sentence summarising what the invoice covers.'),
});

export type InvoiceLineItemsDraft = z.infer<typeof InvoiceLineItemsSchema>;

export const MessageDraftSchema = z.object({
  subject: z.string().describe('Email subject line, under 80 characters.'),
  body: z.string().describe('Plain-text email body. No markdown, no placeholders in square brackets.'),
  tone: z.enum(['polite', 'firm', 'friendly']),
});

export type MessageDraft = z.infer<typeof MessageDraftSchema>;

export const RewriteResultSchema = z.object({
  text: z.string().describe('The rewritten text, and nothing else.'),
  changeSummary: z.string().describe('One short sentence describing what changed.'),
});

export type RewriteResult = z.infer<typeof RewriteResultSchema>;

/**
 * Command-bar classification.
 *
 * The model decides *what the user meant* and parameterises it. Our code then
 * performs the mutation and re-runs computeTotals. The model is never the thing
 * that changes a number.
 */
export const CommandPlanSchema = z.object({
  intent: z.enum([
    'set_document_discount',
    'set_line_discount',
    'set_tax_rate',
    'edit_text',
    'translate',
    'add_line_item',
    'remove_line_item',
    'unsupported',
  ]),
  reasoningSummary: z.string().describe('One sentence explaining the interpretation, for the diff panel.'),
  scope: z
    .enum(['document', 'line', 'all_lines'])
    .describe('Whether the change applies to the whole document, one line, or every line.'),
  lineIndex: z.number().nullable().describe('Zero-based line index when scope is "line", else null.'),
  percent: z.number().nullable().describe('Percentage value for discount/tax intents, else null.'),
  field: z
    .enum(['scope', 'deliverables', 'exclusions', 'notes', 'terms', 'payment_terms', 'title', 'none'])
    .describe('Which long-form field an edit_text intent targets.'),
  instruction: z.string().describe('The rewriting instruction to apply, for text intents.'),
  targetLanguage: z.string().nullable().describe('Target language for a translate intent, else null.'),
  itemName: z.string().nullable().describe('Name for an add_line_item intent, else null.'),
  itemQty: z.number().nullable().describe('Quantity for an add_line_item intent, else null.'),
  touchesMoney: z
    .boolean()
    .describe('True when applying this would change any monetary figure. Drives the confirm gate.'),
});

export type CommandPlan = z.infer<typeof CommandPlanSchema>;
