import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { badRequest, conflict, notFound, withApiErrors } from '@/lib/guards/errors';
import { clientIp, enforceRateLimit } from '@/lib/guards/rate-limit';
import { getRazorpay } from '@/lib/razorpay/client';
import { hashToken, isWellFormedToken } from '@/lib/share/tokens';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOptionalUser } from '@/lib/guards/auth';
import { uuidSchema } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.union([
  z.object({ invoice_id: uuidSchema }),
  z.object({ token: z.string().min(20).max(200) }),
]);

/**
 * POST /api/payments/order — create a Razorpay Order for an invoice balance.
 *
 * Reachable both from inside the app and from the public invoice page, so the
 * amount is always read from the database. A client-supplied amount would let
 * anyone settle a ₹50,000 invoice for ₹1.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Provide either invoice_id or token.');

  const admin = createSupabaseAdminClient();
  let invoiceId: string;

  if ('token' in parsed.data) {
    await enforceRateLimit('publicView', `order:${clientIp(request)}`);
    const token = parsed.data.token;
    if (!isWellFormedToken(token)) throw notFound('This link is no longer available.');

    const { data: link } = await admin
      .from('share_links')
      .select('doc_type, doc_id, expires_at, revoked_at')
      .eq('token_hash', hashToken(token))
      .maybeSingle();

    const expired = link?.expires_at ? new Date(link.expires_at) < new Date() : false;
    if (!link || link.revoked_at || expired || link.doc_type !== 'invoice') {
      throw notFound('This link is no longer available.');
    }
    invoiceId = link.doc_id;
  } else {
    const user = await getOptionalUser();
    if (!user) throw notFound('Invoice not found.');
    await enforceRateLimit('share', user.id);

    const { data: business } = await admin
      .from('businesses')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle();

    const { data: invoice } = await admin
      .from('invoices')
      .select('id, business_id')
      .eq('id', parsed.data.invoice_id)
      .maybeSingle();

    if (!invoice || !business || invoice.business_id !== business.id) {
      throw notFound('Invoice not found.');
    }
    invoiceId = invoice.id;
  }

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, business_id, number, balance_paise, currency, status')
    .eq('id', invoiceId)
    .single();

  if (!invoice) throw notFound('Invoice not found.');
  if (invoice.status === 'paid') throw conflict('This invoice is already paid in full.');
  if (invoice.status === 'cancelled') throw conflict('This invoice has been cancelled.');
  if (invoice.balance_paise <= 0) throw conflict('There is nothing outstanding on this invoice.');

  const razorpay = getRazorpay();
  const order = await razorpay.orders.create({
    // Razorpay's smallest unit for INR is the paise — the same unit we store.
    amount: invoice.balance_paise,
    currency: invoice.currency || 'INR',
    receipt: `inv_${invoice.number}`.slice(0, 40),
    notes: {
      invoice_id: invoice.id,
      business_id: invoice.business_id,
      invoice_number: invoice.number,
    },
  });

  return NextResponse.json({
    orderId: order.id,
    amountPaise: invoice.balance_paise,
    currency: invoice.currency || 'INR',
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    invoiceNumber: invoice.number,
  });
});
