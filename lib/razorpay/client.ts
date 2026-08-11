import 'server-only';

import Razorpay from 'razorpay';

let cached: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (cached) return cached;

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured.');
  }

  cached = new Razorpay({ key_id, key_secret });
  return cached;
}

export const RAZORPAY_PLAN_IDS = {
  premium_monthly: process.env.RAZORPAY_PLAN_ID_PREMIUM_MONTHLY,
  premium_yearly: process.env.RAZORPAY_PLAN_ID_PREMIUM_YEARLY,
} as const;

export function planCodeForRazorpayPlan(razorpayPlanId: string): string | null {
  if (razorpayPlanId === RAZORPAY_PLAN_IDS.premium_monthly) return 'premium_monthly';
  if (razorpayPlanId === RAZORPAY_PLAN_IDS.premium_yearly) return 'premium_yearly';
  return null;
}
