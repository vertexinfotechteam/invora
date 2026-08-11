import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { estimateCost, type TokenUsage } from '@/lib/ai/pricing';
import type { AiCallStatus, Json } from '@/lib/types/database';

export interface AiLogInput {
  businessId: string | null;
  userId: string | null;
  feature: string;
  model: string;
  usage?: TokenUsage | null;
  latencyMs: number;
  status: AiCallStatus;
  errorCode?: string | null;
  stopReason?: string | null;
  creditCharged: boolean;
  meta?: Record<string, Json>;
}

/**
 * Writes one row per AI request — success, failure, refusal or rejection.
 *
 * This is deliberately best-effort: a logging outage must not turn a working
 * AI response into a 500 for the user. It is also deliberately unconditional:
 * "every AI request appears in ai_usage_logs, including failures" is an
 * acceptance criterion, not a nice-to-have.
 */
export async function logAiUsage(input: AiLogInput): Promise<void> {
  const usage = input.usage ?? {};
  const cost = estimateCost(input.model, usage);

  try {
    const admin = createSupabaseAdminClient();
    await admin.from('ai_usage_logs').insert({
      business_id: input.businessId,
      user_id: input.userId,
      feature: input.feature,
      model: input.model,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
      estimated_cost_usd: cost,
      latency_ms: input.latencyMs,
      status: input.status,
      error_code: input.errorCode ?? null,
      stop_reason: input.stopReason ?? null,
      credit_charged: input.creditCharged,
      meta: input.meta ?? {},
    });
  } catch (error) {
    console.error('[invora:ai] failed to write ai_usage_logs row', error);
  }
}
