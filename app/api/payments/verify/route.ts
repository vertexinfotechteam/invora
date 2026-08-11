import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { badRequest, withApiErrors } from '@/lib/guards/errors';
import { clientIp, enforceRateLimit } from '@/lib/guards/rate-limit';
import { verifyCheckoutSignature } from '@/lib/razorpay/verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  razorpay_order_id: z.string().min(4).max(120),
  razorpay_payment_id: z.string().min(4).max(120),
  razorpay_signature: z.string().min(10).max(256),
});

/**
 * POST /api/payments/verify
 *
 * This endpoint deliberately changes NOTHING.
 *
 * It exists so the browser can show "payment received, updating your
 * invoice…" instead of a blank screen. The invoice is marked paid by
 * /api/webhooks/razorpay and by nothing else — a browser redirect is a hint,
 * not evidence. Phase 5's acceptance test disables this route entirely and
 * confirms payments still land.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  await enforceRateLimit('share', `verify:${clientIp(request)}`);

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Malformed payment callback.');

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) throw badRequest('Payments are not configured.');

  const valid = verifyCheckoutSignature({
    orderId: parsed.data.razorpay_order_id,
    paymentId: parsed.data.razorpay_payment_id,
    signature: parsed.data.razorpay_signature,
    keySecret,
  });

  if (!valid) {
    console.warn('[invora:payments] checkout signature mismatch', {
      orderId: parsed.data.razorpay_order_id,
      ip: clientIp(request),
    });
    return NextResponse.json(
      { verified: false, message: 'We could not verify that payment. Please contact support.' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    verified: true,
    state: 'processing',
    message:
      'Payment received. Your invoice updates as soon as the payment is confirmed by the gateway — usually within a few seconds.',
  });
});
