import { NextResponse, type NextRequest } from 'next/server';

import { requireBusiness } from '@/lib/guards/auth';
import { enforceRateLimit } from '@/lib/guards/rate-limit';
import { badRequest, conflict, notFound, withApiErrors } from '@/lib/guards/errors';
import { manualPaymentSchema } from '@/lib/validation/schemas';
import { fieldErrors } from '@/lib/validation/common';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { recordDocumentEvent } from '@/lib/events';
import { formatPaise } from '@/lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/manual — record a payment received outside the gateway
 * (cash, UPI, bank transfer, cheque).
 *
 * Partial payments are allowed. The invoice's amount_paid, balance and status
 * are recomputed by the payments_recalc_invoice trigger, so this handler never
 * writes a total itself.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const { user, business } = await requireBusiness();
  await enforceRateLimit('write', `payment-manual:${user.id}`);

  const parsed = manualPaymentSchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Check the payment details.', fieldErrors(parsed.error));
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, number, status, balance_paise, currency')
    .eq('id', input.invoice_id)
    .maybeSingle();

  if (!invoice) throw notFound('Invoice not found.');
  if (invoice.status === 'cancelled') throw conflict('This invoice has been cancelled.');
  if (input.amount_paise > invoice.balance_paise) {
    throw badRequest(
      `That is more than the outstanding balance of ${formatPaise(invoice.balance_paise, invoice.currency)}.`,
    );
  }

  const paidAt = input.paid_at.includes('T')
    ? input.paid_at
    : new Date(`${input.paid_at}T12:00:00Z`).toISOString();

  const { error } = await supabase.from('payments').insert({
    business_id: business.id,
    invoice_id: invoice.id,
    amount_paise: input.amount_paise,
    paid_at: paidAt,
    method: input.method,
    source: 'manual',
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    recorded_by: user.id,
  });

  if (error) throw badRequest(`Could not record the payment: ${error.message}`);

  const { data: updated } = await supabase
    .from('invoices')
    .select('status, amount_paid_paise, balance_paise')
    .eq('id', invoice.id)
    .single();

  await recordDocumentEvent({
    businessId: business.id,
    docType: 'invoice',
    docId: invoice.id,
    event: updated?.status === 'paid' ? 'paid' : 'payment_recorded',
    actor: 'user',
    actorId: user.id,
    meta: {
      amount_paise: input.amount_paise,
      method: input.method,
      reference: input.reference ?? null,
    },
  });

  return NextResponse.json({
    recorded: true,
    status: updated?.status,
    amountPaidPaise: updated?.amount_paid_paise ?? 0,
    balancePaise: updated?.balance_paise ?? 0,
  });
});
