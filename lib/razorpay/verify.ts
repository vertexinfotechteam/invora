import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signature verification for Razorpay.
 *
 * Two distinct signatures exist and they are computed over different things —
 * mixing them up is the classic way to ship an unauthenticated payment
 * endpoint:
 *
 *   • Webhook:  HMAC-SHA256(RAZORPAY_WEBHOOK_SECRET, RAW_REQUEST_BODY)
 *               compared against the `x-razorpay-signature` header.
 *   • Checkout: HMAC-SHA256(RAZORPAY_KEY_SECRET, `${order_id}|${payment_id}`)
 *               returned by the browser. Useful for an optimistic UI only —
 *               it must never be what flips an invoice to paid.
 */

function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeCompare(expected, signature);
}

export function verifyCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = createHmac('sha256', params.keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');
  return safeCompare(expected, params.signature);
}

export function verifySubscriptionSignature(params: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  // Note the operand order: payment_id first for subscriptions, order_id first
  // for orders. Razorpay is not consistent about this.
  const expected = createHmac('sha256', params.keySecret)
    .update(`${params.paymentId}|${params.subscriptionId}`)
    .digest('hex');
  return safeCompare(expected, params.signature);
}
