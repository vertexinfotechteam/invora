import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/guards/auth';
import { withApiErrors } from '@/lib/guards/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RazorpayPaymentEntity {
  id?: string;
  amount?: number;
  notes?: Record<string, string>;
}

/**
 * GET /api/admin/reconcile — webhook ledger vs payment rows.
 *
 * Three failure modes this catches:
 *   • an event we received but never processed (handler bug or outage)
 *   • a captured payment with no matching payments row (money we did not book)
 *   • an invoice whose amount_paid disagrees with the sum of its payments
 *     (should be impossible — the trigger owns it — so a hit here means the
 *     trigger was bypassed and is worth an incident)
 */
export const GET = withApiErrors(async (request: NextRequest) => {
  await requireAdmin();

  const days = Math.min(90, Math.max(1, Number(request.nextUrl.searchParams.get('days') ?? 7)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const admin = createSupabaseAdminClient();

  const [{ data: events }, { data: payments }] = await Promise.all([
    admin
      .from('webhook_events')
      .select('event_id, event_type, status, error, received_at, payload')
      .gte('received_at', since)
      .order('received_at', { ascending: false })
      .limit(1000),
    admin
      .from('payments')
      .select('razorpay_payment_id, amount_paise, invoice_id')
      .eq('source', 'razorpay')
      .gte('created_at', since),
  ]);

  const bookedIds = new Set(
    (payments ?? []).map((payment) => payment.razorpay_payment_id).filter(Boolean) as string[],
  );

  const unprocessed = (events ?? []).filter(
    (event) => event.status === 'received' || event.status === 'failed',
  );

  const missingPayments = (events ?? [])
    .filter((event) => event.event_type === 'payment.captured')
    .map((event) => {
      const payload = event.payload as unknown as {
        payload?: { payment?: { entity?: RazorpayPaymentEntity } };
      };
      const entity = payload?.payload?.payment?.entity;
      return {
        eventId: event.event_id,
        paymentId: entity?.id ?? null,
        amountPaise: entity?.amount ?? 0,
        invoiceId: entity?.notes?.invoice_id ?? null,
        receivedAt: event.received_at,
      };
    })
    .filter((row) => row.paymentId && !bookedIds.has(row.paymentId));

  // Trigger-integrity check.
  const { data: invoiceRows } = await admin
    .from('invoices')
    .select('id, number, amount_paid_paise, payments(amount_paise)')
    .gt('amount_paid_paise', 0)
    .limit(1000);

  const mismatchedInvoices = (invoiceRows ?? [])
    .map((invoice) => {
      const sum = ((invoice.payments as unknown as { amount_paise: number }[]) ?? []).reduce(
        (total, payment) => total + payment.amount_paise,
        0,
      );
      return { id: invoice.id, number: invoice.number, recorded: invoice.amount_paid_paise, sum };
    })
    .filter((row) => row.recorded !== row.sum);

  return NextResponse.json({
    windowDays: days,
    eventsSeen: events?.length ?? 0,
    unprocessed,
    missingPayments,
    mismatchedInvoices,
    healthy:
      unprocessed.length === 0 && missingPayments.length === 0 && mismatchedInvoices.length === 0,
  });
});
