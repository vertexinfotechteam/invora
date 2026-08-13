import 'server-only';

import { resolveMx } from 'node:dns/promises';

/**
 * Is this address one that can actually receive mail?
 *
 * Zod's `.email()` only checks the shape — `you@gmial.com` and
 * `someone@totally-made-up-domain.com` both pass it happily. Everything this
 * app does with an address afterwards (create an account, email an invoice,
 * send a calendar invite) is wasted or worse if nothing is listening at the
 * other end, so the domain is checked for real before we act on it.
 *
 * Two checks, in cost order:
 *
 *  1. A disposable-inbox blocklist. These domains *do* accept mail, so DNS
 *     cannot catch them — but an account behind a 10-minute inbox is not a
 *     contactable customer.
 *  2. An MX lookup. No MX record means no mail server, which catches
 *     nonexistent domains, typos like `gmial.com`, and RFC 7505 "null MX"
 *     domains (`example.com`) that explicitly refuse mail.
 *
 * What this deliberately does NOT do is probe the mailbox itself over SMTP.
 * That means `definitely-not-a-real-person@gmail.com` still passes: the domain
 * is real, and only Google knows whether the local part exists. Proving *that*
 * is what the confirmation link in the signup email is for — see the note in
 * docs/ENV.md about keeping "Confirm email" enabled on the Supabase project.
 */

/** Disposable/throwaway inbox providers. Not exhaustive — no such list can be
 * — but it covers the services that show up in practice. */
const DISPOSABLE_DOMAINS = new Set([
  '0-mail.com', '10minutemail.com', '20minutemail.com', '33mail.com',
  'anonbox.net', 'byom.de', 'dispostable.com', 'disposemail.com',
  'emailondeck.com', 'fakeinbox.com', 'fakemail.net', 'fakemailgenerator.com',
  'getairmail.com', 'getnada.com', 'guerrillamail.com', 'guerrillamail.net',
  'guerrillamail.org', 'harakirimail.com', 'inboxbear.com', 'incognitomail.com',
  'jetable.org', 'mail-temporaire.fr', 'mail7.io', 'mailcatch.com',
  'maildrop.cc', 'mailasail.com', 'mailinator.com', 'mailinator.net',
  'mailnesia.com', 'mailsac.com', 'mailtemp.info', 'meltmail.com',
  'minuteinbox.com', 'moakt.com', 'mohmal.com', 'mytemp.email',
  'nowmymail.com', 'sharklasers.com', 'spam4.me', 'spambog.com',
  'spamgourmet.com', 'tempinbox.com', 'temp-mail.io', 'temp-mail.org',
  'tempmail.net', 'tempmailaddress.com', 'tempmailo.com', 'tempr.email',
  'throwawaymail.com', 'trashmail.com', 'trashmail.de', 'trbvm.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
]);

export type EmailCheck = { ok: true } | { ok: false; reason: string };

/** Domain -> verdict, so a form that is submitted twice (or a CSV import with
 * 300 addresses at the same company) costs one DNS round trip, not 300.
 * Negative answers expire sooner: a domain that just added MX records should
 * start working within the hour, while a domain that has them is not going to
 * stop having them. */
interface CacheEntry {
  deliverable: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_MAX = 5_000;
const TTL_OK_MS = 24 * 60 * 60 * 1000;
const TTL_BAD_MS = 60 * 60 * 1000;

function cacheGet(domain: string): boolean | null {
  const hit = cache.get(domain);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(domain);
    return null;
  }
  return hit.deliverable;
}

function cacheSet(domain: string, deliverable: boolean): void {
  // Crude bound — this is a per-instance warm cache, not a store worth
  // evicting cleverly.
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(domain, {
    deliverable,
    expiresAt: Date.now() + (deliverable ? TTL_OK_MS : TTL_BAD_MS),
  });
}

/** DNS said, definitively, that this domain has no mail server. */
const NO_MAIL_SERVER_CODES = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);

/** Lookups already in the air, so a CSV with 400 addresses at one company
 * asks DNS once rather than 400 times in parallel — the cache alone cannot do
 * this, since none of those calls has written to it yet when the next starts. */
const inFlight = new Map<string, Promise<boolean>>();

function domainAcceptsMail(domain: string): Promise<boolean> {
  const cached = cacheGet(domain);
  if (cached !== null) return Promise.resolve(cached);

  const pending = inFlight.get(domain);
  if (pending) return pending;

  const lookup = resolveDomain(domain).finally(() => inFlight.delete(domain));
  inFlight.set(domain, lookup);
  return lookup;
}

/** RFC 7505: a single MX with an empty or "." exchange is a domain stating it
 * accepts no mail at all. example.com publishes exactly this. */
function hasRealExchange(exchanges: string[]): boolean {
  return exchanges.some((exchange) => exchange && exchange !== '.');
}

/**
 * Same question over HTTPS, for when the system resolver cannot answer.
 *
 * Some environments have no usable resolver at all — a dev machine pointed at
 * a 127.0.0.1 stub that isn't running, or a sandbox that blocks port 53. There
 * the system lookup fails for *every* domain, which would quietly turn this
 * whole check off. DoH goes out over the same HTTPS path the rest of the app
 * already depends on, so the check keeps working.
 *
 * Returns null when DoH itself could not answer, which is different from "this
 * domain has no mail server".
 */
async function mxViaDoh(domain: string): Promise<boolean | null> {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      Status?: number;
      Answer?: { type: number; data: string }[];
    };

    if (payload.Status === 3) return false; // NXDOMAIN — no such domain
    if (payload.Status !== 0) return null; // SERVFAIL and friends: no answer, not a verdict

    // Each MX answer is "<priority> <exchange>".
    const exchanges = (payload.Answer ?? [])
      .filter((answer) => answer.type === 15)
      .map((answer) => answer.data.split(' ').pop() ?? '');

    return hasRealExchange(exchanges);
  } catch {
    return null;
  }
}

async function resolveDomain(domain: string): Promise<boolean> {
  let deliverable: boolean | null = null;

  try {
    const records = await resolveMx(domain);
    deliverable = hasRealExchange(records.map((record) => record.exchange));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    // A definitive "no such domain" needs no second opinion.
    deliverable = NO_MAIL_SERVER_CODES.has(code) ? false : await mxViaDoh(domain);

    if (deliverable === null) {
      // Neither resolver could answer. That is our problem, not the visitor's:
      // failing closed would turn a DNS outage into a signup outage, so an
      // unverifiable domain is allowed through and not cached either way.
      console.warn(`[invora:email] could not resolve MX for "${domain}" (${code || 'unknown'}) — allowing`);
      return true;
    }
  }

  cacheSet(domain, deliverable);
  return deliverable;
}

/**
 * Server-side gate for any address the app is about to act on. Returns a
 * reason string rather than throwing, so each caller can surface it in
 * whatever shape its own form expects.
 */
export async function checkEmailDeliverable(email: string): Promise<EmailCheck> {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain) return { ok: false, reason: 'Enter a valid email address.' };

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: 'Use a permanent email address — temporary inboxes are not accepted.' };
  }

  if (!(await domainAcceptsMail(domain))) {
    return { ok: false, reason: `"${domain}" cannot receive email. Check the spelling.` };
  }

  return { ok: true };
}

/**
 * Same check across many addresses, one lookup per distinct domain.
 * Returns the set of addresses that failed, keyed by address.
 */
export async function checkEmailsDeliverable(emails: string[]): Promise<Map<string, string>> {
  const failures = new Map<string, string>();
  const unique = [...new Set(emails.map((email) => email.trim().toLowerCase()))];

  const results = await Promise.all(
    unique.map(async (email) => [email, await checkEmailDeliverable(email)] as const),
  );

  for (const [email, result] of results) {
    if (!result.ok) failures.set(email, result.reason);
  }

  return failures;
}
