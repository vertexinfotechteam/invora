import { NextResponse, type NextRequest } from 'next/server';

import { requireBusiness } from '@/lib/guards/auth';
import { badRequest, conflict, withApiErrors } from '@/lib/guards/errors';
import { AI_DISABLED_MESSAGE, AI_ENABLED } from '@/lib/ai/enabled';
import { runStructuredAi } from '@/lib/ai/pipeline';
import { InvoiceLineItemsSchema, MessageDraftSchema } from '@/lib/ai/schemas';
import { INVOICE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { aiInvoiceRequestSchema } from '@/lib/validation/schemas';
import { fieldErrors } from '@/lib/validation/common';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/invoice — line-item descriptions, customer-facing summaries and
 * payment messages.
 *
 * Amounts and dates are injected from the database into the prompt as facts;
 * the model is instructed to restate them verbatim and never to compute.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const { user, business } = await requireBusiness();

  const parsed = aiInvoiceRequestSchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Check the form.', fieldErrors(parsed.error));
  const input = parsed.data;

  let context = '';
  if (input.invoice_id) {
    const supabase = await createSupabaseServerClient();
    const { data: invoice } = await supabase
      .from('invoices')
      .select('number, total_paise, balance_paise, due_date, currency, customers(name, company)')
      .eq('id', input.invoice_id)
      .maybeSingle();

    if (invoice) {
      const customer = invoice.customers as unknown as { name?: string; company?: string } | null;
      context = [
        '<invoice_facts>',
        'Use these values exactly as written. Do not recalculate or reformat them.',
        `Invoice number: ${invoice.number}`,
        `Total: ${formatPaise(invoice.total_paise, invoice.currency)}`,
        `Balance outstanding: ${formatPaise(invoice.balance_paise, invoice.currency)}`,
        invoice.due_date ? `Due date: ${formatDate(invoice.due_date)}` : 'Due date: not set',
        customer?.name ? `Customer contact name: ${customer.name}` : '',
        customer?.company ? `Customer company: ${customer.company}` : '',
        `Sender business name: ${business.name}`,
        '</invoice_facts>',
        '',
      ]
        .filter(Boolean)
        .join('\n');
    }
  }

  const kindInstruction: Record<typeof input.kind, string> = {
    line_items: 'Turn the instruction below into invoice line items describing work already delivered.',
    summary_note: 'Write a customer-facing summary note for this invoice.',
    reminder: 'Draft a polite payment reminder, sent before the due date.',
    overdue_reminder: 'Draft a firm but professional overdue payment reminder.',
    thank_you: 'Draft a short thank-you message for a payment that has been received.',
  };

  const userContent = `${context}<task>\n${kindInstruction[input.kind]}\n</task>\n\n<instruction>\n${input.instruction}\n</instruction>`;

  const wantsMessage = input.kind !== 'line_items' && input.kind !== 'summary_note';

  if (wantsMessage) {
    const result = await runStructuredAi(
      { businessId: business.id, userId: user.id },
      {
        feature: 'REMINDER_DRAFT',
        system: INVOICE_SYSTEM_PROMPT,
        userContent,
        schema: MessageDraftSchema,
        meta: { kind: input.kind },
      },
    );
    return NextResponse.json({ kind: input.kind, message: result.data, meta: metaOf(result) });
  }

  // Only the line-item generation is switched off — the payment-message
  // drafter above is a separate feature and keeps working.
  if (!AI_ENABLED) throw conflict(AI_DISABLED_MESSAGE);

  const result = await runStructuredAi(
    { businessId: business.id, userId: user.id },
    {
      feature: 'INVOICE_ASSIST',
      system: INVOICE_SYSTEM_PROMPT,
      userContent,
      schema: InvoiceLineItemsSchema,
      meta: { kind: input.kind },
    },
  );

  // Prices on an invoice are never a model's to guess.
  const draft = {
    ...result.data,
    lineItems: result.data.lineItems.map((item) => ({
      ...item,
      suggestedRatePaise: null,
      rateConfidence: 'none' as const,
    })),
  };

  return NextResponse.json({ kind: input.kind, draft, meta: metaOf(result) });
});

function metaOf(result: { model: string; latencyMs: number; cacheHit: boolean }) {
  return { model: result.model, latencyMs: result.latencyMs, cacheHit: result.cacheHit };
}
