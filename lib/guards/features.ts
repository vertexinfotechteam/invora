import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { forbidden, paymentRequired } from '@/lib/guards/errors';
import type { PlanFeatures } from '@/lib/types/database';

export type FeatureKey = keyof Omit<PlanFeatures, 'templates'>;

const FEATURE_COPY: Record<FeatureKey, string> = {
  premium_templates: 'Branded PDF templates are a Premium feature.',
  remove_branding: 'Removing Invora branding is a Premium feature.',
  csv_import: 'CSV import is a Premium feature.',
  csv_export: 'CSV export is a Premium feature.',
  scheduled_reminders: 'Scheduled reminders are a Premium feature.',
  full_reports: 'Full reporting and custom date ranges are a Premium feature.',
  priority_support: 'Priority support is a Premium feature.',
};

export interface PlanSnapshot {
  planCode: string;
  features: PlanFeatures;
  docLimit: number;
  aiCreditLimit: number;
}

export async function getPlanSnapshot(businessId: string): Promise<PlanSnapshot> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('subscriptions')
    .select('plan_code, bonus_doc_limit, bonus_ai_credits, plans(code, features, doc_limit, ai_credit_limit)')
    .eq('business_id', businessId)
    .single();

  if (error || !data?.plans) {
    throw forbidden('Could not resolve the plan for this business.');
  }

  const plan = data.plans as unknown as {
    code: string;
    features: PlanFeatures;
    doc_limit: number;
    ai_credit_limit: number;
  };

  return {
    planCode: plan.code,
    features: plan.features,
    docLimit: plan.doc_limit + (data.bonus_doc_limit ?? 0),
    aiCreditLimit: plan.ai_credit_limit + (data.bonus_ai_credits ?? 0),
  };
}

export async function hasFeature(businessId: string, feature: FeatureKey): Promise<boolean> {
  const snapshot = await getPlanSnapshot(businessId);
  return snapshot.features[feature] === true;
}

/**
 * The gate. Call this inside every route handler and server action that
 * exposes a paid capability — the UI hiding a button is cosmetic, and the
 * browser is assumed hostile.
 */
export async function assertFeature(businessId: string, feature: FeatureKey): Promise<void> {
  if (!(await hasFeature(businessId, feature))) {
    throw paymentRequired(FEATURE_COPY[feature], { feature, upgradeUrl: '/settings/plan' });
  }
}

/** Templates are a list rather than a boolean, so they get their own gate. */
export async function assertTemplateAllowed(businessId: string, template: string): Promise<void> {
  const snapshot = await getPlanSnapshot(businessId);
  const allowed = snapshot.features.templates ?? ['classic'];
  if (!allowed.includes(template)) {
    throw paymentRequired(`The "${template}" template is available on Premium.`, {
      feature: 'premium_templates',
      upgradeUrl: '/settings/plan',
    });
  }
}
