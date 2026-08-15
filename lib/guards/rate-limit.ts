import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { rateLimited } from '@/lib/guards/errors';

/**
 * Serverless-safe sliding-window limiters.
 *
 * Upstash is the real limiter: shared across instances, so a budget means the
 * same thing no matter which lambda answers. When it is not configured we fall
 * back to an in-process sliding window (see `memoryLimit`) rather than failing
 * open or closed.
 *
 * Failing *closed* is what this used to do in production, on the reasoning that
 * an unmetered AI endpoint is a billing incident waiting to happen. That is
 * true, but the cost was far worse than the risk: with no Redis configured,
 * every limited route — demo booking, availability, contact, support chat,
 * PDF/Excel download, sending documents, quote accept/decline, share links,
 * payments, CSV import, all in-app AI — returned 429 on its first request, so
 * essentially the whole product was down. The in-memory fallback still meters
 * (per instance, so the effective ceiling is the budget times the number of
 * warm lambdas) and AI additionally has the per-business credit backstop, which
 * is the limit that actually bounds spend.
 */
const hasRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

// Redis.fromEnv() parses UPSTASH_REDIS_REST_URL as a URL and throws if it's
// malformed — a stray trailing slash, quotes, or whitespace from a pasted
// value is enough. This runs at module scope, so nearly every API route
// imports it, and an unhandled throw here doesn't just disable rate limiting
// — it fails the entire production build. The whole point of `hasRedis` above
// is to degrade gracefully when Redis is absent (see the comment below); a
// bad value must degrade the same way, not crash harder than no value at all.
let redis: Redis | null = null;
if (hasRedis) {
  try {
    redis = Redis.fromEnv();
  } catch (error) {
    console.error(
      '[invora:rate-limit] UPSTASH_REDIS_REST_URL/TOKEN are set but invalid — falling back to the in-memory limiter. Check for extra whitespace or quotes in the Vercel env var values.',
      error,
    );
  }
}

const MINUTE = 60_000;

/** One budget per limiter: `tokens` requests per `windowMs`, keyed under `prefix`. */
const budgets = {
  ai: { tokens: 10, windowMs: MINUTE, prefix: 'ai' },
  auth: { tokens: 10, windowMs: MINUTE, prefix: 'auth' },
  pdf: { tokens: 30, windowMs: MINUTE, prefix: 'pdf' },
  share: { tokens: 60, windowMs: MINUTE, prefix: 'share' },
  publicView: { tokens: 120, windowMs: MINUTE, prefix: 'public' },
  webhook: { tokens: 300, windowMs: MINUTE, prefix: 'webhook' },
  email: { tokens: 20, windowMs: MINUTE, prefix: 'email' },
  contact: { tokens: 5, windowMs: 10 * MINUTE, prefix: 'contact' },
  write: { tokens: 60, windowMs: MINUTE, prefix: 'write' },
  // CSV import accepts up to 5,000 rows a call, so it gets its own tight budget.
  bulk: { tokens: 5, windowMs: MINUTE, prefix: 'bulk' },
  // Unauthenticated + costs real API spend per request — kept tight and,
  // unlike the in-app `ai` limiter, has no per-business credit backstop.
  publicChat: { tokens: 8, windowMs: 5 * MINUTE, prefix: 'public-chat' },
} as const;

export type LimiterName = keyof typeof budgets;

function build(name: LimiterName) {
  if (!redis) return null;
  const { tokens, windowMs, prefix } = budgets[name];
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, `${windowMs} ms`),
    analytics: true,
    prefix: `invora:${prefix}`,
  });
}

export const limiters = Object.fromEntries(
  (Object.keys(budgets) as LimiterName[]).map((name) => [name, build(name)]),
) as Record<LimiterName, Ratelimit | null>;

/**
 * Hit timestamps per key, newest last. Only consulted when Redis is absent.
 *
 * A lambda that stays warm accumulates keys, so each check prunes its own key
 * and the map is cleared wholesale once it grows past `MAX_KEYS` — a blunt
 * eviction, but this is a fallback whose worst case is briefly forgetting some
 * counts, and it is bounded memory rather than a leak.
 */
const MAX_KEYS = 10_000;
const hits = new Map<string, number[]>();

function memoryLimit(name: LimiterName, key: string): { success: boolean; reset: number } {
  const { tokens, windowMs } = budgets[name];
  const now = Date.now();
  const cutoff = now - windowMs;

  if (hits.size > MAX_KEYS) hits.clear();

  const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);

  if (recent.length >= tokens) {
    hits.set(key, recent);
    // Oldest hit in the window is the one whose expiry frees a slot.
    return { success: false, reset: (recent[0] ?? now) + windowMs };
  }

  recent.push(now);
  hits.set(key, recent);
  return { success: true, reset: now + windowMs };
}

/**
 * Throws a 429 when the identifier has spent its window.
 * `identifier` should be a user id where we have one, otherwise the client IP.
 */
export async function enforceRateLimit(name: LimiterName, identifier: string): Promise<void> {
  const limiter = limiters[name];
  const key = `${budgets[name].prefix}:${identifier}`;

  const { success, reset } = limiter
    ? await limiter.limit(identifier)
    : memoryLimit(name, key);

  if (!success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    throw rateLimited(retryAfterSeconds);
  }
}

/** Best-effort client IP, for limiting requests that have no session. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}
