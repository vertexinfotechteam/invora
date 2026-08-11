/**
 * Plans that exist and are priced, but are not purchasable yet.
 *
 * Enforced both here and server-side in /api/subscription/checkout — hiding
 * the button in the UI is cosmetic, this is the actual gate, same principle
 * as the feature flags in `features`.
 */
export const COMING_SOON_PLAN_CODES = new Set(['premium_monthly', 'premium_yearly']);

export function isPlanComingSoon(planCode: string): boolean {
  return COMING_SOON_PLAN_CODES.has(planCode);
}
