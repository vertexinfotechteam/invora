-- =============================================================================
-- Invora 0009 — reprice Premium plans
--
-- Monthly and yearly Premium are marked "coming soon" in the app (see
-- lib/plans.ts) until Razorpay checkout is wired up for the new prices — this
-- only updates the catalog so /settings/plan and /pricing show the right
-- numbers ahead of that. It does not change any existing subscription's
-- current billing amount.
-- =============================================================================

update public.plans set price_paise = 29900  where code = 'premium_monthly';
update public.plans set price_paise = 99900  where code = 'premium_yearly';
