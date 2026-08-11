import 'server-only';

// Must match lib/ai/schemas.ts — see the comment there.
import type { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { getAnthropic } from '@/lib/ai/client';
import { logAiUsage } from '@/lib/ai/logging';
import {
  AI_EFFORT,
  AI_FEATURE_SLUG,
  AI_MAX_INPUT_TOKENS,
  AI_MAX_TOKENS,
  AI_MODELS,
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

/**
 * THE pipeline. Every /api/ai/* route goes through here, in this order:
 *
 *   1. rate limit         → 429
 *   2. reserve a credit   → 402 with an upgrade CTA
 *   3. count tokens       → 413 before we pay for an absurd request
 *   4. call Anthropic     → prompt caching + structured output
 *   5. log usage          → always, success or failure
 *   6. release the credit → only when the call did not succeed
 *
 * Authentication happens one level up, in the route handler, because it must
 * run before anything here — including the rate limiter, which keys on user id.
 */
export async function runStructuredAi<TSchema extends z.ZodTypeAny>(
  caller: AiCaller,
  request: StructuredAiRequest<TSchema>,
): Promise<StructuredAiResult<z.infer<TSchema>>> {
  const model = AI_MODELS[request.feature];
  const featureSlug = AI_FEATURE_SLUG[request.feature];
  const maxTokens = AI_MAX_TOKENS[request.feature];
  const effort = AI_EFFORT[request.feature];

  // 1 — rate limit
  await enforceRateLimit('ai', caller.userId);

  // 2 — reserve a credit (atomic; two tabs cannot both slip past)
  await requireCredits(caller.businessId, 1);

  const anthropic = getAnthropic();
  const startedAt = Date.now();

  const systemBlocks = [
    {
      type: 'text' as const,
      text: request.system,
      // Stable, >512 tokens, sent first — so it is served from the prompt cache.
      cache_control: { type: 'ephemeral' as const },
    },
  ];
  const messages = [{ role: 'user' as const, content: request.userContent }];

  try {
    // 3 — size guard
    const counted = await anthropic.messages.countTokens({
      model,
      system: systemBlocks,
      messages,
    });

    if (counted.input_tokens > AI_MAX_INPUT_TOKENS) {
      await releaseAiCredit(caller.businessId, 1);
      await logAiUsage({
        businessId: caller.businessId,
        userId: caller.userId,
        feature: featureSlug,
        model,
        usage: { input_tokens: counted.input_tokens },
        latencyMs: Date.now() - startedAt,
        status: 'too_large',
        errorCode: 'input_too_large',
        creditCharged: false,
        meta: { ...request.meta, countedInputTokens: counted.input_tokens },
      });
      throw payloadTooLarge(
        `That request is too large (${counted.input_tokens.toLocaleString()} tokens). Trim the brief and try again.`,
      );
    }

    // 4 — the call. Structured output means the UI never parses free text.
    const response = await anthropic.messages.parse({
      model,
      max_tokens: maxTokens,
      system: systemBlocks,
      output_config: {
        format: zodOutputFormat(request.schema),
        effort,
      },
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
      await releaseAiCredit(caller.businessId, 1);
      await logAiUsage({
        businessId: caller.businessId,
        userId: caller.userId,
        feature: featureSlug,
        model,
        usage,
        latencyMs,
        status: 'refusal',
        stopReason: 'refusal',
        errorCode: (response as { stop_details?: { category?: string } }).stop_details?.category ?? null,
        creditCharged: false,
        meta: request.meta as never,
      });
      throw new ApiError(
        422,
        'ai_declined',
        'The assistant could not help with that request. Try rephrasing it around the commercial details of the work.',
      );
    }

    if (response.stop_reason === 'max_tokens') {
      await releaseAiCredit(caller.businessId, 1);
      await logAiUsage({
        businessId: caller.businessId,
        userId: caller.userId,
        feature: featureSlug,
        model,
        usage,
        latencyMs,
        status: 'error',
        stopReason: 'max_tokens',
        errorCode: 'truncated',
        creditCharged: false,
        meta: request.meta as never,
      });
      throw upstreamError('The response was cut short. Try a shorter brief.');
    }

    const parsed = response.parsed_output as z.infer<TSchema> | null | undefined;
    if (!parsed) {
      await releaseAiCredit(caller.businessId, 1);
      await logAiUsage({
        businessId: caller.businessId,
        userId: caller.userId,
        feature: featureSlug,
        model,
        usage,
        latencyMs,
        status: 'error',
        stopReason: response.stop_reason ?? null,
        errorCode: 'schema_mismatch',
        creditCharged: false,
        meta: request.meta as never,
      });
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
      creditCharged: true,
      meta: request.meta as never,
    });

    return {
      data: parsed,
      model: response.model ?? model,
      latencyMs,
      cacheHit: (usage.cache_read_input_tokens ?? 0) > 0,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // Anything from the provider: give the credit back, record the failure.
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'unknown provider error';
    await releaseAiCredit(caller.businessId, 1);
    await logAiUsage({
      businessId: caller.businessId,
      userId: caller.userId,
      feature: featureSlug,
      model,
      latencyMs,
      status: 'error',
      errorCode: message.slice(0, 200),
      creditCharged: false,
      meta: request.meta as never,
    });

    console.error('[invora:ai] provider call failed', error);
    throw upstreamError('The assistant is unavailable right now. Please try again in a moment.');
  }
}
