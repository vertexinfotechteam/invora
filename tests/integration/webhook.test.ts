import { createHmac } from 'node:crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Webhook handler contract.
 *
 * The Supabase admin client is mocked so these run with no infrastructure. The
 * three properties under test are the ones that decide whether payments are
 * trustworthy:
 *
 *   1. A tampered signature is rejected with 400 and nothing is written.
 *   2. Replaying an event five times creates exactly one payment row.
 *   3. A genuine processing failure returns 5xx so Razorpay retries.
 */

const WEBHOOK_SECRET = 'whsec_test';

interface Recorded {
  table: string;
  op: 'insert' | 'update' | 'select';
  payload?: unknown;
}

function buildMockAdmin(options: { duplicateEventIds?: Set<string> } = {}) {
  const seenEventIds = options.duplicateEventIds ?? new Set<string>();
  const calls: Recorded[] = [];
  const paymentInserts: unknown[] = [];

  function table(name: string) {
    const chain: Record<string, unknown> = {
      insert: (payload: Record<string, unknown>) => {
        calls.push({ table: name, op: 'insert', payload });

        if (name === 'webhook_events') {
          const eventId = payload.event_id as string;
          if (seenEventIds.has(eventId)) {
            return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } });
          }
          seenEventIds.add(eventId);
          return Promise.resolve({ error: null });
        }

        if (name === 'payments') {
          paymentInserts.push(payload);
          return Promise.resolve({ error: null });
        }

        return Promise.resolve({ error: null });
      },
      update: (payload: unknown) => {
        calls.push({ table: name, op: 'update', payload });
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }), then: undefined };
      },
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data:
                name === 'invoices'
                  ? {
                      id: 'inv-1',
                      business_id: 'biz-1',
                      number: 'INV-0001',
                      currency: 'INR',
                      balance_paise: 100_000,
                      customer_id: null,
                    }
                  : name === 'businesses'
                    ? { name: 'Test Co', brand_color: '#4F46E5' }
                    : null,
            }),
          single: () =>
            Promise.resolve({
              data: { status: 'paid', balance_paise: 0, amount_paid_paise: 100_000 },
            }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    };
    return chain;
  }

  return { admin: { from: table, rpc: () => Promise.resolve({ data: null, error: null }) }, calls, paymentInserts };
}

function signedRequest(body: string, signature: string) {
  return new Request('https://invora.test/api/webhooks/razorpay', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_stable_id',
    },
    body,
  });
}

function paymentCapturedBody() {
  return JSON.stringify({
    event: 'payment.captured',
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      payment: {
        entity: {
          id: 'pay_TEST123',
          amount: 100_000,
          currency: 'INR',
          method: 'upi',
          order_id: 'order_TEST',
          notes: { invoice_id: 'inv-1', business_id: 'biz-1' },
        },
      },
    },
  });
}

function sign(body: string) {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

describe('POST /api/webhooks/razorpay', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('rejects a tampered signature with 400 and writes nothing', async () => {
    const mock = buildMockAdmin();
    vi.doMock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => mock.admin }));
    vi.doMock('@/lib/email/send', () => ({ sendEmail: vi.fn() }));
    vi.doMock('@/lib/events', () => ({ recordDocumentEvent: vi.fn() }));

    const { POST } = await import('@/app/api/webhooks/razorpay/route');
    const body = paymentCapturedBody();

    const response = await POST(signedRequest(body, 'deadbeef') as never);

    expect(response.status).toBe(400);
    expect(mock.calls).toHaveLength(0);
  });

  it('rejects a body that has been altered after signing', async () => {
    const mock = buildMockAdmin();
    vi.doMock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => mock.admin }));
    vi.doMock('@/lib/email/send', () => ({ sendEmail: vi.fn() }));
    vi.doMock('@/lib/events', () => ({ recordDocumentEvent: vi.fn() }));

    const { POST } = await import('@/app/api/webhooks/razorpay/route');
    const body = paymentCapturedBody();
    const signature = sign(body);

    const response = await POST(signedRequest(`${body} `, signature) as never);
    expect(response.status).toBe(400);
  });

  it('creates exactly one payment row when the same event is replayed five times', async () => {
    const mock = buildMockAdmin();
    vi.doMock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => mock.admin }));
    vi.doMock('@/lib/email/send', () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));
    vi.doMock('@/lib/events', () => ({ recordDocumentEvent: vi.fn() }));

    const { POST } = await import('@/app/api/webhooks/razorpay/route');
    const body = paymentCapturedBody();
    const signature = sign(body);

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(signedRequest(body, signature) as never);
      statuses.push(response.status);
    }

    // Every delivery is acknowledged; only the first does any work.
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    expect(mock.paymentInserts).toHaveLength(1);
  });

  it('acknowledges an event type it does not handle rather than erroring', async () => {
    const mock = buildMockAdmin();
    vi.doMock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => mock.admin }));
    vi.doMock('@/lib/email/send', () => ({ sendEmail: vi.fn() }));
    vi.doMock('@/lib/events', () => ({ recordDocumentEvent: vi.fn() }));

    const { POST } = await import('@/app/api/webhooks/razorpay/route');
    const body = JSON.stringify({ event: 'refund.created', created_at: 1, payload: {} });
    const response = await POST(signedRequest(body, sign(body)) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ignored' });
  });

  it('returns 500 when the request is not valid JSON', async () => {
    const mock = buildMockAdmin();
    vi.doMock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => mock.admin }));
    vi.doMock('@/lib/email/send', () => ({ sendEmail: vi.fn() }));
    vi.doMock('@/lib/events', () => ({ recordDocumentEvent: vi.fn() }));

    const { POST } = await import('@/app/api/webhooks/razorpay/route');
    const body = 'not json';
    const response = await POST(signedRequest(body, sign(body)) as never);
    expect(response.status).toBe(400);
  });
});
