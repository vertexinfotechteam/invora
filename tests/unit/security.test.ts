import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import { verifyCheckoutSignature, verifyWebhookSignature } from '@/lib/razorpay/verify';
import { estimateCost } from '@/lib/ai/pricing';
import { safeRedirectPath } from '@/lib/validation/common';

beforeAll(() => {
  process.env.SHARE_LINK_SECRET = 'a'.repeat(64);
});

describe('Razorpay webhook signatures', () => {
  const secret = 'whsec_test_secret';
  const body = JSON.stringify({ event: 'payment.captured', payload: {} });
  // Precomputed HMAC-SHA256 of `body` under `secret`.
  const validSignature = createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a correct signature', () => {
    expect(verifyWebhookSignature(body, validSignature, secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyWebhookSignature(`${body} `, validSignature, secret)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    expect(verifyWebhookSignature(body, `${validSignature.slice(0, -1)}0`, secret)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    expect(verifyWebhookSignature(body, 'short', secret)).toBe(false);
  });

  it('rejects when no secret is configured', () => {
    expect(verifyWebhookSignature(body, validSignature, '')).toBe(false);
  });
});

describe('Razorpay checkout signatures', () => {
  const keySecret = 'rzp_secret';
  const orderId = 'order_ABC';
  const paymentId = 'pay_XYZ';
  const signature = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');

  it('accepts the documented order_id|payment_id form', () => {
    expect(verifyCheckoutSignature({ orderId, paymentId, signature, keySecret })).toBe(true);
  });

  it('rejects a swapped operand order', () => {
    const swapped = createHmac('sha256', keySecret).update(`${paymentId}|${orderId}`).digest('hex');
    expect(verifyCheckoutSignature({ orderId, paymentId, signature: swapped, keySecret })).toBe(false);
  });
});

describe('share tokens', () => {
  it('mints a token whose hash matches, and rejects tampering', async () => {
    const { generateShareToken, hashToken, isWellFormedToken } = await import('@/lib/share/tokens');

    const { token, tokenHash } = generateShareToken();
    expect(hashToken(token)).toBe(tokenHash);
    expect(isWellFormedToken(token)).toBe(true);

    // Flipping any character breaks the HMAC, so the DB is never queried.
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect(isWellFormedToken(tampered)).toBe(false);
  });

  it('rejects malformed tokens', async () => {
    const { isWellFormedToken } = await import('@/lib/share/tokens');
    expect(isWellFormedToken('')).toBe(false);
    expect(isWellFormedToken('nodot')).toBe(false);
    expect(isWellFormedToken('a.b')).toBe(false);
    expect(isWellFormedToken('too.many.dots')).toBe(false);
  });

  it('never produces the same token twice', async () => {
    const { generateShareToken } = await import('@/lib/share/tokens');
    const tokens = new Set(Array.from({ length: 500 }, () => generateShareToken().token));
    expect(tokens.size).toBe(500);
  });
});

describe('AI cost estimation', () => {
  it('prices Opus 5 input and output at the documented rates', () => {
    const cost = estimateCost('claude-opus-5', { input_tokens: 1_000_000, output_tokens: 0 });
    expect(cost).toBeCloseTo(5, 6);

    const output = estimateCost('claude-opus-5', { input_tokens: 0, output_tokens: 1_000_000 });
    expect(output).toBeCloseTo(25, 6);
  });

  it('prices cache reads at a tenth and cache writes at 1.25x', () => {
    const read = estimateCost('claude-opus-5', { cache_read_input_tokens: 1_000_000 });
    expect(read).toBeCloseTo(0.5, 6);

    const write = estimateCost('claude-opus-5', { cache_creation_input_tokens: 1_000_000 });
    expect(write).toBeCloseTo(6.25, 6);
  });

  it('prices Haiku well below Opus, which is the point of routing to it', () => {
    const usage = { input_tokens: 10_000, output_tokens: 2_000 };
    expect(estimateCost('claude-haiku-4-5', usage)).toBeLessThan(estimateCost('claude-opus-5', usage));
  });

  it('falls back to Opus rates for an unknown model rather than reporting zero', () => {
    expect(estimateCost('some-future-model', { input_tokens: 1_000_000 })).toBeCloseTo(5, 6);
  });

  it('treats missing usage fields as zero', () => {
    expect(estimateCost('claude-opus-5', {})).toBe(0);
  });
});

describe('safeRedirectPath', () => {
  it('keeps an ordinary same-site path', () => {
    expect(safeRedirectPath('/invoices/123')).toBe('/invoices/123');
    expect(safeRedirectPath('/forgot-password')).toBe('/forgot-password');
    expect(safeRedirectPath('/reports?range=30d')).toBe('/reports?range=30d');
  });

  it('rejects protocol-relative targets that leave the site', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/dashboard');
    expect(safeRedirectPath('//evil.com/fake-login')).toBe('/dashboard');
    expect(safeRedirectPath('/\\evil.com')).toBe('/dashboard');
  });

  it('rejects absolute URLs', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/dashboard');
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/dashboard');
  });

  it('rejects control characters used for header injection', () => {
    expect(safeRedirectPath('/dashboard\r\nSet-Cookie: a=b')).toBe('/dashboard');
  });

  it('falls back for non-string input', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard');
    expect(safeRedirectPath(undefined)).toBe('/dashboard');
    expect(safeRedirectPath('')).toBe('/dashboard');
  });
});
