/**
 * Anthropic price table, USD per 1M tokens.
 *
 * LAST VERIFIED: 2026-08-09 against platform.claude.com/docs/en/pricing.
 * Re-verify whenever the admin AI-cost chart drifts from the Anthropic console
 * by more than a few percent, and update the date above when you do.
 *
 * Cache accounting: a cache *write* costs 1.25× the input rate; a cache *read*
 * costs 0.1×. Ignoring that made our first cost estimates ~20% high.
 */
export interface ModelRate {
  inputPerMTok: number;
  outputPerMTok: number;
  /** Multiplier applied to the input rate for tokens written into the cache. */
  cacheWriteMultiplier: number;
  /** Multiplier applied to the input rate for tokens served from the cache. */
  cacheReadMultiplier: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  'claude-opus-5': {
    inputPerMTok: 5.0,
    outputPerMTok: 25.0,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  'claude-sonnet-5': {
    // Introductory pricing ($2 / $10) applies through 2026-08-31; the table
    // carries list price so estimates never under-report after that date.
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  'claude-haiku-4-5': {
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  // Support-chat only (lib/ai/gemini-client.ts), currently on Google AI
  // Studio's free tier — genuinely $0. Update this if that key ever moves to
  // a paid Gemini tier, or the admin AI-spend chart will under-report.
  'gemini-flash-latest': {
    inputPerMTok: 0,
    outputPerMTok: 0,
    cacheWriteMultiplier: 1,
    cacheReadMultiplier: 1,
  },
};

const FALLBACK_RATE: ModelRate = {
  inputPerMTok: 5.0,
  outputPerMTok: 25.0,
  cacheWriteMultiplier: 1.25,
  cacheReadMultiplier: 0.1,
};

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Estimated USD cost of a single request. Logged on every call, success or not. */
export function estimateCost(model: string, usage: TokenUsage): number {
  const rate = MODEL_RATES[model] ?? FALLBACK_RATE;
  const perToken = rate.inputPerMTok / 1_000_000;
  const perOutputToken = rate.outputPerMTok / 1_000_000;

  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;

  const cost =
    input * perToken +
    output * perOutputToken +
    cacheWrite * perToken * rate.cacheWriteMultiplier +
    cacheRead * perToken * rate.cacheReadMultiplier;

  // 6 dp matches the numeric(12,6) column in ai_usage_logs.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}
