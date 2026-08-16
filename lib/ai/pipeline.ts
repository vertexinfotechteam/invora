import 'server-only';

// Must match lib/ai/schemas.ts — see the comment there.
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { getAnthropic } from '@/lib/ai/client';
import { callGeminiJson, GEMINI_MODEL, toGeminiSchema } from '@/lib/ai/gemini-client';
import { resolveAiProvider } from '@/lib/ai/provider';
import { logAiUsage } from '@/lib/ai/logging';
import {
  AI_EFFORT,
  AI_FEATURE_SLUG,
  AI_MAX_INPUT_TOKENS,
  AI_MAX_TOKENS,
  AI_MODELS,
  CREDIT_METERED_FEATURES,
  type AiFeature,
} from '@/lib/ai/models';
import { releaseAiCredit, requireCredits } from '@/lib/guards/quota';
import { enforceRateLimit } from '@/lib/guards/rate-limit';
import { ApiError, payloadTooLarge, upstreamError } from '@/lib/guards/errors';

export interface AiCaller {
  businessId: string;
  userId: string;
}

export interface StructuredAiRequest<TSchema extends z.ZodTypeAny> {
  feature: AiFeature;
  system: string;
  userContent: string;
  schema: TSchema;
  /** Extra context attached to the ai_usage_logs row. */
  meta?: Record<string, string | number | boolean>;
}

export interface StructuredAiResult<T> {
  data: T;
  model: string;
  latencyMs: number;
  cacheHit: boolean;
}

/** Gemini has no token counter in the REST API — a conservative characters-per-token
 * ratio stands in for it so oversized requests still get rejected before we pay for them. */
const CHARS_PER_TOKEN_ESTIMATE = 3;

/**
 * THE pipeline. Every /api/ai/* route goes through here, in this order:
 *
 *   1. rate limit          → 429
 *   2. reserve a credit    → 402 with an upgrade CTA (metered features only —
 *                            see CREDIT_METERED_FEATURES; editing an existing
 *                            draft is free, only generating one spends a credit)
 *   3. size guard          → 413 before we pay for an absurd request
 *   4. call the provider   → whichever of ANTHROPIC_API_KEY / GEMINI_API_KEY
 *                            is configured (see lib/ai/provider.ts)
 *   5. log usage           → always, success or failure
 *   6. release the credit  → only when the call did not succeed, and only if
 *                            one was reserved in step 2
 *
 * Claude gets native structured output (zodOutputFormat) plus prompt caching.
 * Gemini has neither, so its branch asks for JSON mode and includes the
 * schema as a JSON Schema (auto-derived from the same Zod schema via
 * z.toJSONSchema — never hand-duplicated) in the prompt; either way, the
 * response is validated against `request.schema` before it can reach the
 * caller. That validation, not the provider's own guarantees, is what
 * upholds the money-safety guarantee: a malformed response fails closed
 * exactly the same way regardless of which model produced it.
 *
 * Authentication happens one level up, in the route handler, because it must
 * run before anything here — including the rate limiter, which keys on user id.
 */
export async function runStructuredAi<TSchema extends z.ZodTypeAny>(
  caller: AiCaller,
  request: StructuredAiRequest<TSchema>,
): Promise<StructuredAiResult<z.infer<TSchema>>> {
  const featureSlug = AI_FEATURE_SLUG[request.feature];
  const provider = resolveAiProvider();
  const metered = CREDIT_METERED_FEATURES.has(request.feature);

  // 1 — rate limit
  await enforceRateLimit('ai', caller.userId);

  // 2 — reserve a credit (atomic; two tabs cannot both slip past) — skipped
  // entirely for unmetered features, so there is nothing to release on
  // failure either (releasing a credit that was never reserved would just
  // refund someone else's unrelated usage).
  if (metered) {
    await requireCredits(caller.businessId, 1);
  }

  const startedAt = Date.now();

  const fail = async (
    model: string,
    status: 'too_large' | 'refusal' | 'error',
    extra: {
      usage?: { input_tokens?: number; output_tokens?: number };
      stopReason?: string | null;
      errorCode?: string | null;
      meta?: Record<string, string | number | boolean>;
    } = {},
  ) => {
    if (metered) await releaseAiCredit(caller.businessId, 1);
    await logAiUsage({
      businessId: caller.businessId,
      userId: caller.userId,
      feature: featureSlug,
      model,
      usage: extra.usage,
      latencyMs: Date.now() - startedAt,
      status,
      stopReason: extra.stopReason ?? null,
      errorCode: extra.errorCode ?? null,
      creditCharged: false,
      meta: { ...request.meta, ...extra.meta, provider },
    });
  };

  try {
    return provider === 'anthropic'
      ? await runAnthropic(caller, request, featureSlug, startedAt, fail, metered)
      : await runGemini(caller, request, featureSlug, startedAt, fail, metered);
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const message = error instanceof Error ? error.message : 'unknown provider error';
    await fail(provider === 'anthropic' ? AI_MODELS[request.feature] : GEMINI_MODEL, 'error', {
      errorCode: message.slice(0, 200),
    });

    console.error('[invora:ai] provider call failed', error);
    throw upstreamError('The assistant is unavailable right now. Please try again in a moment.');
  }
}

type FailFn = (
  model: string,
  status: 'too_large' | 'refusal' | 'error',
  extra?: {
    usage?: { input_tokens?: number; output_tokens?: number };
    stopReason?: string | null;
    errorCode?: string | null;
    meta?: Record<string, string | number | boolean>;
  },
) => Promise<void>;

async function runAnthropic<TSchema extends z.ZodTypeAny>(
  caller: AiCaller,
  request: StructuredAiRequest<TSchema>,
  featureSlug: string,
  startedAt: number,
  fail: FailFn,
  metered: boolean,
): Promise<StructuredAiResult<z.infer<TSchema>>> {
  const model = AI_MODELS[request.feature];
  const maxTokens = AI_MAX_TOKENS[request.feature];
  const effort = AI_EFFORT[request.feature];
  const anthropic = getAnthropic();

  const systemBlocks = [
    {
      type: 'text' as const,
      text: request.system,
      // Stable, >512 tokens, sent first — so it is served from the prompt cache.
      cache_control: { type: 'ephemeral' as const },
    },
  ];
  const messages = [{ role: 'user' as const, content: request.userContent }];

  // 3 — size guard
  const counted = await anthropic.messages.countTokens({ model, system: systemBlocks, messages });

  if (counted.input_tokens > AI_MAX_INPUT_TOKENS) {
    await fail(model, 'too_large', {
      usage: { input_tokens: counted.input_tokens, output_tokens: 0 },
      errorCode: 'input_too_large',
      meta: { countedInputTokens: counted.input_tokens },
    });
    throw payloadTooLarge(
      `That request is too large (${counted.input_tokens.toLocaleString()} tokens). Trim the brief and try again.`,
    );
  }

  // 4 — the call. Structured output means the UI never parses free text.
  //
  // `effort` only exists for Anthropic's extended-thinking (Opus-tier)
  // models — sending it to Haiku is a hard 400 ("This model does not
  // support the effort parameter"), not a warning, so it's included only
  // when the model can actually use it.
  const outputConfig = model.startsWith('claude-opus')
    ? { format: zodOutputFormat(request.schema), effort }
    : { format: zodOutputFormat(request.schema) };

  const response = await anthropic.messages.parse({
    model,
    max_tokens: maxTokens,
    system: systemBlocks,
    output_config: outputConfig,
    messages,
  });

  const latencyMs = Date.now() - startedAt;
  const usage = response.usage as unknown as {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };

  // Safety classifiers can decline with a normal 200 and stop_reason
  // "refusal". Check it before touching content.
  if (response.stop_reason === 'refusal') {
    await fail(model, 'refusal', {
      usage,
      stopReason: 'refusal',
      errorCode: (response as { stop_details?: { category?: string } }).stop_details?.category ?? null,
    });
    throw new ApiError(
      422,
      'ai_declined',
      'The assistant could not help with that request. Try rephrasing it around the commercial details of the work.',
    );
  }

  if (response.stop_reason === 'max_tokens') {
    await fail(model, 'error', { usage, stopReason: 'max_tokens', errorCode: 'truncated' });
    throw upstreamError('The response was cut short. Try a shorter brief.');
  }

  const parsed = response.parsed_output as z.infer<TSchema> | null | undefined;
  if (!parsed) {
    await fail(model, 'error', { usage, stopReason: response.stop_reason ?? null, errorCode: 'schema_mismatch' });
    throw upstreamError('The assistant returned something we could not read. Please try again.');
  }

  // 5 + 6 — success: log it and keep the reserved credit spent.
  await logAiUsage({
    businessId: caller.businessId,
    userId: caller.userId,
    feature: featureSlug,
    model: response.model ?? model,
    usage,
    latencyMs,
    status: 'ok',
    stopReason: response.stop_reason ?? null,
    creditCharged: metered,
    meta: { ...request.meta, provider: 'anthropic' } as never,
  });

  return {
    data: parsed,
    model: response.model ?? model,
    latencyMs,
    cacheHit: (usage.cache_read_input_tokens ?? 0) > 0,
  };
}

async function runGemini<TSchema extends z.ZodTypeAny>(
  caller: AiCaller,
  request: StructuredAiRequest<TSchema>,
  featureSlug: string,
  startedAt: number,
  fail: FailFn,
  metered: boolean,
): Promise<StructuredAiResult<z.infer<TSchema>>> {
  const maxTokens = AI_MAX_TOKENS[request.feature];

  // No native structured output on Gemini's REST API — JSON mode only
  // guarantees syntactically valid JSON, so the schema is spelled out as a
  // JSON Schema (derived straight from `request.schema`, never hand-written)
  // and the model is told to match it exactly. schema.safeParse below is
  // still the real gate.
  const jsonSchema = z.toJSONSchema(request.schema);
  const system = `${request.system}\n\nRespond with a single JSON object and nothing else — no markdown fences, no prose before or after it. It must validate against this JSON Schema:\n\n${JSON.stringify(jsonSchema)}`;

  // 3 — size guard (approximate: Gemini's REST API exposes no token counter).
  // Measured against the final `system` string (schema included) — the guard
  // must reflect what is actually about to be sent, not just the caller's
  // prose, or a request just under the limit can slip through several hundred
  // tokens over once the schema text is appended.
  const estimatedInputTokens = Math.ceil((system.length + request.userContent.length) / CHARS_PER_TOKEN_ESTIMATE);
  if (estimatedInputTokens > AI_MAX_INPUT_TOKENS) {
    await fail(GEMINI_MODEL, 'too_large', {
      errorCode: 'input_too_large',
      meta: { estimatedInputTokens },
    });
    throw payloadTooLarge('That request is too large. Trim the brief and try again.');
  }

  // The same Zod schema the response is validated against is handed to Gemini
  // up front, so it constrains generation instead of only judging it after.
  const response = await callGeminiJson(
    system,
    request.userContent,
    maxTokens,
    toGeminiSchema(request.schema),
  );
  const latencyMs = Date.now() - startedAt;

  if (response.finishReason === 'SAFETY' || response.finishReason === 'PROHIBITED_CONTENT') {
    await fail(response.model, 'refusal', { usage: response.usage, stopReason: response.finishReason });
    throw new ApiError(
      422,
      'ai_declined',
      'The assistant could not help with that request. Try rephrasing it around the commercial details of the work.',
    );
  }

  if (response.finishReason === 'MAX_TOKENS') {
    await fail(response.model, 'error', {
      usage: response.usage,
      stopReason: response.finishReason,
      errorCode: 'truncated',
    });
    throw upstreamError('The response was cut short. Try a shorter brief.');
  }

  let raw: unknown = null;
  try {
    raw = JSON.parse(response.text);
  } catch {
    raw = null;
  }

  const parsed = raw === null ? null : request.schema.safeParse(raw);
  if (!parsed || !parsed.success) {
    await fail(response.model, 'error', {
      usage: response.usage,
      stopReason: response.finishReason,
      errorCode: 'schema_mismatch',
    });
    throw upstreamError('The assistant returned something we could not read. Please try again.');
  }

  await logAiUsage({
    businessId: caller.businessId,
    userId: caller.userId,
    feature: featureSlug,
    model: response.model,
    usage: response.usage,
    latencyMs,
    status: 'ok',
    stopReason: response.finishReason,
    creditCharged: metered,
    meta: { ...request.meta, provider: 'gemini' } as never,
  });

  return { data: parsed.data, model: response.model, latencyMs, cacheHit: false };
}
