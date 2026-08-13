import { beforeEach, describe, expect, it, vi } from 'vitest';

const dns = vi.hoisted(() => ({ resolveMx: vi.fn() }));

vi.mock('node:dns/promises', () => ({ resolveMx: dns.resolveMx }));

import { checkEmailDeliverable, checkEmailsDeliverable } from '@/lib/validation/email-address';

/** node:dns rejects with an Error carrying a `code`, not a plain Error. */
function dnsError(code: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`queryMx ${code}`);
  error.code = code;
  return error;
}

const mx = [{ exchange: 'mx1.example-host.com', priority: 10 }];

/** A DNS-over-HTTPS answer in the shape dns.google returns. */
function dohResponse(body: { Status: number; Answer?: { type: number; data: string }[] }) {
  return { ok: true, json: async () => body } as Response;
}

/** The fallback is only reachable when the system resolver fails
 * non-definitively, so every DoH test pairs the two. */
const doh = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Unless a test says otherwise, DoH is unreachable too — that keeps the
  // system-resolver tests honest and stops any test touching the network.
  doh.mockRejectedValue(new Error('offline'));
  vi.stubGlobal('fetch', doh);
});

describe('checkEmailDeliverable', () => {

  it('accepts an address whose domain publishes MX records', async () => {
    dns.resolveMx.mockResolvedValue(mx);
    expect(await checkEmailDeliverable('asha@real-business-1.com')).toEqual({ ok: true });
  });

  it('rejects a domain that does not exist', async () => {
    dns.resolveMx.mockRejectedValue(dnsError('ENOTFOUND'));
    const result = await checkEmailDeliverable('asha@no-such-domain-2.com');
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringContaining('cannot receive email') });
  });

  it('rejects a domain with no MX records at all', async () => {
    dns.resolveMx.mockResolvedValue([]);
    expect((await checkEmailDeliverable('asha@no-mx-3.com')).ok).toBe(false);
  });

  it('rejects an RFC 7505 null MX ("this domain accepts no mail")', async () => {
    dns.resolveMx.mockResolvedValue([{ exchange: '.', priority: 0 }]);
    expect((await checkEmailDeliverable('asha@null-mx-4.com')).ok).toBe(false);
  });

  it('rejects a disposable inbox without spending a DNS lookup', async () => {
    const result = await checkEmailDeliverable('throwaway@mailinator.com');
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('permanent email address') });
    expect(dns.resolveMx).not.toHaveBeenCalled();
  });

  it('allows the address through when neither the resolver nor DoH can answer', async () => {
    // Failing closed here would turn a resolver outage into a signup outage.
    dns.resolveMx.mockRejectedValue(dnsError('ETIMEOUT'));
    expect(await checkEmailDeliverable('asha@unreachable-dns-5.com')).toEqual({ ok: true });
  });

  it('falls back to DoH when the system resolver is unusable, and trusts its verdict', async () => {
    // This is the machine-with-no-resolver case: the system lookup fails for
    // every domain, so without the fallback the check would pass everything.
    dns.resolveMx.mockRejectedValue(dnsError('ECONNREFUSED'));
    doh.mockResolvedValue(dohResponse({ Status: 3 })); // NXDOMAIN

    const result = await checkEmailDeliverable('asha@doh-says-no-10.com');
    expect(result.ok).toBe(false);
    expect(doh).toHaveBeenCalledOnce();
  });

  it('accepts via DoH when the domain does publish MX records', async () => {
    dns.resolveMx.mockRejectedValue(dnsError('ECONNREFUSED'));
    doh.mockResolvedValue(
      dohResponse({ Status: 0, Answer: [{ type: 15, data: '10 mx.real-host.com.' }] }),
    );

    expect(await checkEmailDeliverable('asha@doh-says-yes-11.com')).toEqual({ ok: true });
  });

  it('rejects via DoH when the domain resolves but publishes no MX', async () => {
    dns.resolveMx.mockRejectedValue(dnsError('ECONNREFUSED'));
    doh.mockResolvedValue(dohResponse({ Status: 0, Answer: [] }));

    expect((await checkEmailDeliverable('asha@doh-no-mx-12.com')).ok).toBe(false);
  });

  it('does not consult DoH when the resolver already said the domain does not exist', async () => {
    dns.resolveMx.mockRejectedValue(dnsError('ENOTFOUND'));
    await checkEmailDeliverable('asha@definitive-13.com');
    expect(doh).not.toHaveBeenCalled();
  });

  it('does not cache an unreachable-DNS result, so it recovers on the next call', async () => {
    dns.resolveMx.mockRejectedValueOnce(dnsError('ESERVFAIL')).mockResolvedValue(mx);
    await checkEmailDeliverable('asha@flaky-6.com');
    await checkEmailDeliverable('asha@flaky-6.com');
    expect(dns.resolveMx).toHaveBeenCalledTimes(2);
  });

  it('caches a domain verdict instead of re-resolving it', async () => {
    dns.resolveMx.mockResolvedValue(mx);
    await checkEmailDeliverable('one@cached-7.com');
    await checkEmailDeliverable('two@cached-7.com');
    expect(dns.resolveMx).toHaveBeenCalledOnce();
  });

  it('rejects an address with no domain part', async () => {
    expect((await checkEmailDeliverable('bare-string')).ok).toBe(false);
  });
});

describe('checkEmailsDeliverable', () => {
  it('reports only the failures, one lookup per distinct domain', async () => {
    dns.resolveMx.mockImplementation(async (domain: string) => {
      if (domain === 'broken-8.com') throw dnsError('ENOTFOUND');
      return mx;
    });

    const failures = await checkEmailsDeliverable([
      'a@good-8.com',
      'b@good-8.com',
      'c@broken-8.com',
    ]);

    expect([...failures.keys()]).toEqual(['c@broken-8.com']);
    expect(dns.resolveMx).toHaveBeenCalledTimes(2); // good-8 and broken-8, not three
  });

  it('returns nothing when every address is fine', async () => {
    dns.resolveMx.mockResolvedValue(mx);
    expect((await checkEmailsDeliverable(['a@fine-9.com', 'b@fine-9.com'])).size).toBe(0);
  });
});
