import 'server-only';

/**
 * Single place that decides which AI provider powers a request.
 *
 * Whichever key is actually configured wins — Anthropic first when both are
 * present (native structured output, prompt caching), Gemini as a fully
 * supported fallback so the product still works end to end for an operator
 * who only has a Google AI Studio key. Every feature in lib/ai/pipeline.ts
 * and app/api/ai/support-chat routes through this instead of hardcoding a
 * provider, so adding either key is enough — no code change required.
 */
export type AiProvider = 'anthropic' | 'gemini';

export function resolveAiProvider(): AiProvider {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  throw new Error(
    'No AI provider is configured. Set ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY (Gemini) in your environment.',
  );
}
