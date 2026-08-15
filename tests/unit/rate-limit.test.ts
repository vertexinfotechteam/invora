import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enforceRateLimit } from '@/lib/guards/rate-limit';

/**
 * No Upstash env vars are set under test, so these exercise the in-memory
 * fallback — the path that runs in production whenever Redis is unconfigured.
 *
 * The regression being locked down: that path used to throw 429 unconditionally
 * in production, so demo booking, availability, contact, support chat, PDF
 * download, document sending and every AI route failed on their first request.
 * It must meter, not refuse.
 */
let counter = 0;

/** A fresh identifier per test — the fallback's state is module-level. */
function nextId(): string {
  counter += 1;
  return `test-identifier-${counter}`;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('enforceRateLimit without Redis', () => {
  it('allows the first request instead of failing closed', async () => {
    await expect(enforceRateLimit('publicView', nextId())).resolves.toBeUndefined();
  });

  it('allows a full budget through, then refuses the one after it', async () => {
    const id = nextId();

    // `contact` is the tightest budget with a long window: 5 per 10 minutes.
    for (let i = 0; i < 5; i += 1) {
      await expect(enforceRateLimit('contact', id)).resolves.toBeUndefined();
    }

    await expect(enforceRateLimit('contact', id)).rejects.toMatchObject({ status: 429 });
  });

  it('meters each identifier separately', async () => {
    const spender = nextId();
    const bystander = nextId();

    for (let i = 0; i < 5; i += 1) await enforceRateLimit('contact', spender);
    await expect(enforceRateLimit('contact', spender)).rejects.toMatchObject({ status: 429 });

    await expect(enforceRateLimit('contact', bystander)).resolves.toBeUndefined();
  });

  it('keeps separate budgets per limiter for the same identifier', async () => {
    const id = nextId();

    for (let i = 0; i < 5; i += 1) await enforceRateLimit('contact', id);
    await expect(enforceRateLimit('contact', id)).rejects.toMatchObject({ status: 429 });

    // Same caller, different route: publicView has its own 120/min budget.
    await expect(enforceRateLimit('publicView', id)).resolves.toBeUndefined();
  });

  it('lets the caller back in once the window has slid past', async () => {
    const id = nextId();

    for (let i = 0; i < 5; i += 1) await enforceRateLimit('contact', id);
    await expect(enforceRateLimit('contact', id)).rejects.toMatchObject({ status: 429 });

    vi.advanceTimersByTime(10 * 60_000 + 1);

    await expect(enforceRateLimit('contact', id)).resolves.toBeUndefined();
  });

  it('reports a positive Retry-After so clients know when to come back', async () => {
    const id = nextId();
    for (let i = 0; i < 5; i += 1) await enforceRateLimit('contact', id);

    const rejection = await enforceRateLimit('contact', id).catch((error: unknown) => error);
    const details = (rejection as { details: { retryAfterSeconds: number } }).details;

    expect(details.retryAfterSeconds).toBeGreaterThan(0);
    // The whole 10-minute window at most: the oldest hit is the first to expire.
    expect(details.retryAfterSeconds).toBeLessThanOrEqual(600);
  });

  it('does not refuse a demo-availability caller browsing many dates', async () => {
    const id = nextId();

    // 120/min: a visitor clicking through a month of dates must never be cut off.
    for (let i = 0; i < 31; i += 1) {
      await expect(enforceRateLimit('publicView', id)).resolves.toBeUndefined();
    }
  });
});
