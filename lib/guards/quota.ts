import 'server-only';
import { cache } from 'react';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { paymentRequired } from '@/lib/guards/errors';

/**
 * `ensure_usage_period` creates the current billing period on first touch, so
 * it isn't safe to call twice for the same business within a request — the
 * app layout and `requireBilling()` both need the result, so this is shared
 * rather than re-hit over the network by each caller.
 */
export const ensureUsagePeriod = cache(async (businessId: string) => {
  const admin = createSupabaseAdminClient();
  return admin.rpc('ensure_usage_period', { p_business_id: businessId });
});

export interface QuotaResult {
  allowed: boolean;
  used: number;
  allowance: number;
}

/**
 * Reserve one AI credit.
 *
 * The check-and-increment is a single UPDATE with the limit in its WHERE clause
 * (see consume_ai_credits in 0005), so two tabs racing cannot both pass. The
 * credit is *reserved* here and released by `releaseAiCredit` if the provider
 * call fails — net effect: only successful requests cost the user a credit.
 */
export async function requireCredits(businessId: string, amount = 1): Promise<QuotaResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('consume_ai_credits', {
    p_business_id: businessId,
    p_amount: amount,
  });

  if (error) throw paymentRequired('Could not verify your AI credit balance.');

  const result = (data as unknown as QuotaResult[])[0];
  if (!result?.allowed) {
    throw paymentRequired(
      `You have used all ${result?.allowance ?? 0} AI credits for this billing period.`,
      {
        feature: 'ai_credits',
        used: result?.used ?? 0,
        allowance: result?.allowance ?? 0,
        upgradeUrl: '/settings/plan',
      },
    );
  }
  return result;
}

export async function releaseAiCredit(businessId: string, amount = 1): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.rpc('release_ai_credits', { p_business_id: businessId, p_amount: amount });
}

/** Same shape, for the documents-per-month allowance. */
export async function requireDocumentQuota(businessId: string, amount = 1): Promise<QuotaResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('consume_document_quota', {
    p_business_id: businessId,
    p_amount: amount,
  });

  if (error) throw paymentRequired('Could not verify your document allowance.');

  const result = (data as unknown as QuotaResult[])[0];
  if (!result?.allowed) {
    throw paymentRequired(
      `You have created all ${result?.allowance ?? 0} documents included in this billing period.`,
      {
        feature: 'documents',
        used: result?.used ?? 0,
        allowance: result?.allowance ?? 0,
        upgradeUrl: '/settings/plan',
      },
    );
  }
  return result;
}

export async function getUsageSnapshot(businessId: string) {
  const admin = createSupabaseAdminClient();

  const [{ data: usage }, { data: limits }] = await Promise.all([
    ensureUsagePeriod(businessId),
    admin.rpc('effective_limits', { p_business_id: businessId }),
  ]);

  const limit = (limits as unknown as { doc_limit: number; ai_credit_limit: number; plan_code: string }[])?.[0];
  const counter = usage as unknown as { docs_used: number; ai_credits_used: number; period_end: string } | null;

  return {
    docsUsed: counter?.docs_used ?? 0,
    docLimit: limit?.doc_limit ?? 0,
    aiCreditsUsed: counter?.ai_credits_used ?? 0,
    aiCreditLimit: limit?.ai_credit_limit ?? 0,
    planCode: limit?.plan_code ?? 'free',
    periodEnd: counter?.period_end ?? null,
  };
}
