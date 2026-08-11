import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireBusiness } from '@/lib/guards/auth';
import { badRequest, withApiErrors } from '@/lib/guards/errors';
import { enforceRateLimit } from '@/lib/guards/rate-limit';
import { RAZORPAY_PLAN_IDS, getRazorpay } from '@/lib/razorpay/client';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isPlanComingSoon } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  plan_code: z.enum(['premium_monthly', 'premium_yearly']),
});

/**
 * POST /api/subscription/checkout — start a Razorpay subscription.
 *
 * This creates the subscription in a *pending* state and hands the browser a
 * subscription id for checkout.js. The plan does not become active here.
 * Activation happens only when `subscription.activated` / `subscription.charged`
 * arrives at the webhook — which is why disabling the browser redirect entirely
 * still results in a working upgrade.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const { user, business } = await requireBusiness();
  await enforceRateLimit('share', `checkout:${user.id}`);

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Choose a plan.');

  if (isPlanComingSoon(parsed.data.plan_code)) {
    throw badRequest('This plan is coming soon. The Free plan is available today.');
  }

  const planId = RAZORPAY_PLAN_IDS[parsed.data.plan_code];
  if (!planId) throw badRequest('That plan is not available yet. Please contact support.');

  const razorpay = getRazorpay();
  const totalCount = parsed.data.plan_code === 'premium_yearly' ? 10 : 120;

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    total_count: totalCount,
    notes: {
      business_id: business.id,
      user_id: user.id,
      plan_code: parsed.data.plan_code,
    },
  });

  // Record the pending link so the webhook can find this business by
  // razorpay_subscription_id even if the notes are stripped.
  const admin = createSupabaseAdminClient();
  await admin
    .from('subscriptions')
    .update({
      razorpay_subscription_id: subscription.id,
      status: 'pending',
    })
    .eq('business_id', business.id);

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    planCode: parsed.data.plan_code,
    email: business.email ?? user.email,
    businessName: business.name,
  });
});

/** POST-less cancel path: DELETE /api/subscription/checkout cancels at period end. */
export const DELETE = withApiErrors(async () => {
  const { business } = await requireBusiness();
  const admin = createSupabaseAdminClient();

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('razorpay_subscription_id, plan_code')
    .eq('business_id', business.id)
    .single();

  if (!subscription?.razorpay_subscription_id) {
    throw badRequest('There is no active paid subscription to cancel.');
  }

  const razorpay = getRazorpay();
  // `true` = cancel at the end of the paid period, not immediately. The user
  // keeps what they paid for; the webhook downgrades them when it lapses.
  await razorpay.subscriptions.cancel(subscription.razorpay_subscription_id, true);

  await admin
    .from('subscriptions')
    .update({ cancel_at_period_end: true })
    .eq('business_id', business.id);

  return NextResponse.json({ cancelAtPeriodEnd: true });
});
