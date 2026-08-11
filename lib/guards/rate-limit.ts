import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { rateLimited } from '@/lib/guards/errors';

/**
 * Serverless-safe sliding-window limiters.
 *
 * If Upstash is not configured we fail *open* in development (so `npm run dev`
 * works with an empty .env.local) and *closed* in production, because an
 * unmetered AI endpoint is a billing incident waiting to happen.
 */
const hasRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const redis = hasRedis ? Redis.fromEnv() : null;

function build(tokens: number, window: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: `invora:${prefix}`,
  });
}

export const limiters = {
  ai: build(10, '60 s', 'ai'),
  auth: build(10, '60 s', 'auth'),
  pdf: build(30, '60 s', 'pdf'),
  share: build(60, '60 s', 'share'),
  publicView: build(120, '60 s', 'public'),
  webhook: build(300, '60 s', 'webhook'),
  email: build(20, '60 s', 'email'),
  contact: build(5, '10 m', 'contact'),
  write: build(60, '60 s', 'write'),
  // CSV import accepts up to 5,000 rows a call, so it gets its own tight budget.
  bulk: build(5, '60 s', 'bulk'),
  // Unauthenticated + costs real API spend per request — kept tight and,
  // unlike the in-app `ai` limiter, has no per-business credit backstop.
  publicChat: build(8, '5 m', 'public-chat'),
} as const;

export type LimiterName = keyof typeof limiters;

/**
 * Throws a 429 when the identifier has spent its window.
 * `identifier` should be a user id where we have one, otherwise the client IP.
 */
export async function enforceRateLimit(name: LimiterName, identifier: string): Promise<void> {
  const limiter = limiters[name];

  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      throw rateLimited(60);
    }
    return; // dev convenience only
  }

  const { success, reset } = await limiter.limit(identifier);
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
