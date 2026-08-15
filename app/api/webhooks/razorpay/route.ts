import { NextResponse, type NextRequest } from 'next/server';

import { verifyWebhookSignature } from '@/lib/razorpay/verify';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getRazorpay, planCodeForRazorpayPlan } from '@/lib/razorpay/client';
import { recordDocumentEvent } from '@/lib/events';
import { sendEmail } from '@/lib/email/send';
import { receiptEmail } from '@/lib/email/templates';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import type { SubscriptionStatus } from '@/lib/types/database';
import { appUrl as siteUrl } from '@/lib/app-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/razorpay — THE source of truth for money and plan state.
 *
 * Contract with Razorpay:
 *   • Read the RAW body. Parsing first and re-serialising changes the bytes and
 *     breaks the HMAC.
 *   • Compare signatures with timingSafeEqual.
 *   • Insert into webhook_events; the UNIQUE (provider, event_id) index is the
 *     idempotency guarantee. A duplicate insert means "already handled" — 200
 *     immediately, do no work.
 *   • Return 200 for handled *and* ignored events. Return 5xx only on genuine
 *     processing failure, so Razorpay retries exactly those.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[invora:webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.warn('[invora:webhook] signature rejected');
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const eventId =
    request.headers.get('x-razorpay-event-id') ??
    `${event.event}:${event.created_at}:${event.payload?.payment?.entity?.id ?? event.payload?.subscription?.entity?.id ?? 'na'}`;

  // Idempotency ledger.
  const { error: insertError } = await admin.from('webhook_events').insert({
    provider: 'razorpay',
    event_id: eventId,
    event_type: event.event,
    payload: event as never,
  });

  if (insertError) {
    // 23505 = unique violation = we have seen this event already.
    if ((insertError as { code?: string }).code === '23505') {
      return NextResponse.json({ status: 'duplicate_ignored' }, { status: 200 });
    }
    console.error('[invora:webhook] could not record event', insertError);
    return NextResponse.json({ error: 'ledger_write_failed' }, { status: 500 });
  }

  try {
    switch (event.event) {
      case 'payment.captured':
      case 'order.paid':
        await handlePaymentCaptured(event);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event);
        break;

      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.resumed':
        await handleSubscriptionActive(event);
        break;

      case 'subscription.halted':
      case 'subscription.pending':
        await handleSubscriptionStatus(event, 'past_due');
        break;

      case 'subscription.cancelled':
        await handleSubscriptionStatus(event, 'cancelled');
        break;

      case 'subscription.completed':
        await handleSubscriptionStatus(event, 'expired');
        break;

      default:
        await mark(eventId, 'ignored');
        return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    await mark(eventId, 'processed');
    return NextResponse.json({ status: 'processed' }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[invora:webhook] processing failed', error);
    await mark(eventId, 'failed', message);
    // 5xx so Razorpay retries this specific event.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }

  async function mark(id: string, status: 'processed' | 'failed' | 'ignored', errorText?: string) {
    await admin
      .from('webhook_events')
      .update({ status, error: errorText ?? null, processed_at: new Date().toISOString() })
      .eq('provider', 'razorpay')
      .eq('event_id', id);
  }
}

// ---------------------------------------------------------------------------

interface RazorpayEntity {
  id: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  order_id?: string;
  error_description?: string;
  plan_id?: string;
  current_start?: number;
  current_end?: number;
  notes?: Record<string, string>;
}

interface RazorpayEvent {
  event: string;
  created_at: number;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
    subscription?: { entity?: RazorpayEntity };
  };
}

async function handlePaymentCaptured(event: RazorpayEvent) {
  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;
  if (!payment?.id) return;

  const invoiceId = await resolveOrderInvoiceId(payment, order);
  if (!invoiceId) return; // Subscription charges carry no invoice_id.

  const admin = createSupabaseAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, business_id, number, currency, balance_paise, customer_id, status')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) {
    console.warn('[invora:webhook] payment captured for unknown invoice', invoiceId);
    return;
  }

  const amountPaise = payment.amount ?? 0;
  if (amountPaise <= 0) return;

  if (payment.currency && payment.currency !== invoice.currency) {
    console.error('[invora:webhook] currency mismatch — refusing to credit', {
      invoiceId,
      invoiceCurrency: invoice.currency,
      paymentCurrency: payment.currency,
      paymentId: payment.id,
    });
    return;
  }

  // Same reasoning as the manual path: the recalc trigger will not move a
  // 'draft' invoice, so a gateway payment against one would leave it fully
  // paid and still invisible to every report. Issue it first.
  if (invoice.status === 'draft') {
    await admin
      .from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invoice.id);
  }

  // razorpay_payment_id is UNIQUE, so a replayed event that slipped past the
  // ledger still cannot create a second payment row.
  const { error } = await admin.from('payments').insert({
    business_id: invoice.business_id,
    invoice_id: invoice.id,
    amount_paise: amountPaise,
    paid_at: new Date((event.created_at ?? Date.now() / 1000) * 1000).toISOString(),
    method: mapMethod(payment.method),
    source: 'razorpay',
    reference: payment.id,
    razorpay_order_id: payment.order_id ?? order?.id ?? null,
    razorpay_payment_id: payment.id,
  });

  if (error && (error as { code?: string }).code !== '23505') throw error;
  if (error) return; // duplicate payment id — nothing further to do

  const { data: updated } = await admin
    .from('invoices')
    .select('status, balance_paise, amount_paid_paise')
    .eq('id', invoice.id)
    .single();

  await recordDocumentEvent({
    businessId: invoice.business_id,
    docType: 'invoice',
    docId: invoice.id,
    event: updated?.status === 'paid' ? 'paid' : 'payment_recorded',
    actor: 'razorpay',
    meta: { amount_paise: amountPaise, razorpay_payment_id: payment.id },
  });

  // Receipt to the customer.
  const [{ data: customer }, { data: business }] = await Promise.all([
    invoice.customer_id
      ? admin.from('customers').select('name, email').eq('id', invoice.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('businesses').select('name, brand_color').eq('id', invoice.business_id).maybeSingle(),
  ]);

  if (customer?.email) {
    const appUrl = siteUrl();
    const mail = receiptEmail({
      businessName: business?.name || 'Your supplier',
      brandColor: business?.brand_color || '#16a34a',
      customerName: customer.name,
      docNumber: invoice.number,
      amountFormatted: formatPaise(amountPaise, invoice.currency),
      balanceFormatted: formatPaise(updated?.balance_paise ?? 0, invoice.currency),
      paidOn: formatDate(new Date()),
      method: mapMethod(payment.method).replace('_', ' '),
      viewUrl: `${appUrl}/invoices/${invoice.id}`,
    });

    await sendEmail({
      to: customer.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      businessId: invoice.business_id,
      template: 'payment_receipt',
      docType: 'invoice',
      docId: invoice.id,
    });
  }
}

async function handlePaymentFailed(event: RazorpayEvent) {
  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;
  if (!payment) return;
  const invoiceId = await resolveOrderInvoiceId(payment, order);
  if (!invoiceId) return;

  const admin = createSupabaseAdminClient();
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, business_id')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) return;

  // No payment row — a failed attempt is not money. Timeline only, so the
  // owner can see the customer tried.
  await recordDocumentEvent({
    businessId: invoice.business_id,
    docType: 'invoice',
    docId: invoice.id,
    event: 'edited',
    actor: 'razorpay',
    meta: {
      kind: 'payment_failed',
      razorpay_payment_id: payment.id,
      reason: payment.error_description ?? null,
    },
  });
}

async function handleSubscriptionActive(event: RazorpayEvent) {
  const subscription = event.payload?.subscription?.entity;
  if (!subscription?.id) return;

  const admin = createSupabaseAdminClient();
  const planCode = subscription.plan_id ? planCodeForRazorpayPlan(subscription.plan_id) : null;

  const periodStart = subscription.current_start
    ? new Date(subscription.current_start * 1000).toISOString()
    : new Date().toISOString();
  const periodEnd = subscription.current_end
    ? new Date(subscription.current_end * 1000).toISOString()
    : new Date(Date.now() + 30 * 86_400_000).toISOString();

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id, business_id, current_period_start')
    .eq('razorpay_subscription_id', subscription.id)
    .maybeSingle();

  const businessId = existing?.business_id ?? subscription.notes?.business_id;
  if (!businessId) {
    console.warn('[invora:webhook] subscription event with no business_id', subscription.id);
    return;
  }

  await admin
    .from('subscriptions')
    .update({
      plan_code: planCode ?? undefined,
      status: 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      cancelled_at: null,
      razorpay_subscription_id: subscription.id,
    })
    .eq('business_id', businessId);

  // A renewal starts a fresh allowance period. The previous usage_counters row
  // is left untouched — periods are an audit trail, not a running total.
  await admin.from('usage_counters').upsert(
    {
      business_id: businessId,
      period_start: periodStart,
      period_end: periodEnd,
      docs_used: 0,
      ai_credits_used: 0,
    },
    { onConflict: 'business_id,period_start', ignoreDuplicates: true },
  );
}

async function handleSubscriptionStatus(event: RazorpayEvent, status: SubscriptionStatus) {
  const subscription = event.payload?.subscription?.entity;
  if (!subscription?.id) return;

  const admin = createSupabaseAdminClient();
  const update: Record<string, unknown> = { status };
  if (status === 'cancelled' || status === 'expired') {
    update.cancelled_at = new Date().toISOString();
    // Data is never destroyed on downgrade — over-limit documents simply become
    // read-only. Reverting to `free` is the whole downgrade.
    update.plan_code = 'free';
  }

  await admin.from('subscriptions').update(update).eq('razorpay_subscription_id', subscription.id);
}

/**
 * Resolves which invoice a payment belongs to — from the Order's notes ONLY.
 *
 * `payment.notes` must never be used for this: Razorpay Checkout.js accepts a
 * client-supplied `notes` option that gets attached to the resulting Payment
 * entity, independent of the Order it was created against. A visitor can open
 * the widget directly (bypassing our UI entirely) with a real order_id from
 * their own cheap invoice but `notes: { invoice_id: <someone else's invoice> }`
 * — if that ever got merged into attribution, their payment would credit a
 * stranger's invoice. `order.notes` is set server-side in
 * app/api/payments/order/route.ts and is never client-writable, so it is the
 * only trustworthy source. When the webhook payload doesn't embed the order
 * (Razorpay omits it on a plain `payment.captured`/`payment.failed` event),
 * this fetches the Order from Razorpay's API by its id instead.
 */
async function resolveOrderInvoiceId(
  payment: RazorpayEntity,
  order?: RazorpayEntity,
): Promise<string | null> {
  if (order?.notes?.invoice_id) return order.notes.invoice_id;

  if (!payment.order_id) return null;

  try {
    const fetched = await getRazorpay().orders.fetch(payment.order_id);
    const notes = fetched.notes as Record<string, string> | undefined;
    return notes?.invoice_id ?? null;
  } catch (error) {
    console.error('[invora:webhook] could not fetch order for attribution', {
      orderId: payment.order_id,
      error,
    });
    return null;
  }
}

function mapMethod(method?: string): 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'card' | 'other' {
  switch (method) {
    case 'upi':
      return 'upi';
    case 'card':
    case 'emi':
      return 'card';
    case 'netbanking':
      return 'bank_transfer';
    default:
      return 'other';
  }
}
