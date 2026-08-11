import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

/**
 * SERVER ONLY.
 *
 * ANTHROPIC_API_KEY must never reach a client bundle. The ESLint
 * no-restricted-imports rule in .eslintrc.json blocks importing this module
 * from app/(app)/** and components/**; `npm run lint` is what enforces it.
 */
let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  cached = new Anthropic({
    // 4 minutes: a high-effort Opus 5 quotation can legitimately think for a while.
    timeout: 240_000,
    maxRetries: 2,
  });
  return cached;
}
