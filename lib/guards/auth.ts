import 'server-only';
import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { forbidden, unauthorized } from '@/lib/guards/errors';
import { ensureUsagePeriod } from '@/lib/guards/quota';
import type { Business, Plan, Subscription, UsageCounter } from '@/lib/types/database';

export interface AuthedUser {
  id: string;
  email: string;
}

export interface BusinessContext {
  user: AuthedUser;
  business: Business;
}

export interface BillingContext extends BusinessContext {
  subscription: Subscription;
  plan: Plan;
  usage: UsageCounter;
}

interface AppUserRecord {
  role: string;
  suspended_at: string | null;
  full_name: string | null;
}

/**
 * Reads the platform-level role row. Service role: app_users is not RLS-readable.
 *
 * Wrapped in React's `cache()` so the same request never hits this table twice —
 * `requireUser`, `requireAdmin` and `requireStaff` all need it, and a layout plus
 * its page both call into these guards on every navigation. Selects `full_name`
 * too so the app layout's profile display can read it from here instead of
 * running its own separate query against the same row.
 */
const loadAppUser = cache(async (userId: string): Promise<AppUserRecord | null> => {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('app_users')
    .select('role, suspended_at, full_name')
    .eq('user_id', userId)
    .single();

  return (data as AppUserRecord | null) ?? null;
});

/** Non-throwing variant for layouts/UI that render a degraded state instead of erroring. */
export async function getOptionalAppUser(userId: string): Promise<AppUserRecord | null> {
  return loadAppUser(userId);
}

/**
 * The verified Supabase session user, or null if there isn't one.
 *
 * Always `getUser()`, never `getSession()`: getSession reads the cookie without
 * asking the auth server whether the JWT is still valid.
 *
 * Cached per request: a layout and the page it wraps both resolve the current
 * user, and without memoization that's a repeat network round trip to Supabase
 * Auth for every single one of them.
 */
const loadSessionUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { id: user.id, email: user.email ?? '' };
});

/**
 * 401s unless there is a verified session, and 403s if the account is suspended.
 *
 * The suspension check lives here rather than in each route because a suspended
 * account keeps a valid JWT until it expires — without this, revoking access
 * would not take effect until the token rolled over.
 */
export async function requireUser(): Promise<AuthedUser> {
  const user = await loadSessionUser();
  if (!user) throw unauthorized();

  const appUser = await loadAppUser(user.id);
  if (appUser?.suspended_at) {
    throw forbidden('This account has been suspended. Contact support.');
  }

  return user;
}

/** The signed-in user's business row, cached per request. */
const loadBusinessForUser = cache(async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  return supabase.from('businesses').select('*').eq('owner_user_id', userId).single();
});

/** The signed-in user plus their business row. */
export async function requireBusiness(): Promise<BusinessContext> {
  const user = await requireUser();
  const { data: business, error } = await loadBusinessForUser(user.id);

  if (error || !business) {
    throw forbidden('No business profile is attached to this account.');
  }
  return { user, business };
}

/** Non-throwing variant for layouts that want to render an onboarding redirect instead. */
export async function getOptionalBusiness(userId: string): Promise<Business | null> {
  const { data: business } = await loadBusinessForUser(userId);
  return (business as Business | null) ?? null;
}

/** Business context plus the live plan + usage period, for anything metered. */
export async function requireBilling(): Promise<BillingContext> {
  const { user, business } = await requireBusiness();
  const admin = createSupabaseAdminClient();

  const { data: usage, error: usageError } = await ensureUsagePeriod(business.id);
  if (usageError) throw forbidden('Could not resolve your current billing period.');

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('*')
    .eq('business_id', business.id)
    .single();

  if (!subscription) throw forbidden('No subscription found for this business.');

  const { data: plan } = await admin
    .from('plans')
    .select('*')
    .eq('code', subscription.plan_code)
    .single();

  if (!plan) throw forbidden('Subscription references an unknown plan.');

  return {
    user,
    business,
    subscription,
    plan,
    usage: usage as unknown as UsageCounter,
  };
}

/**
 * 403s unless app_users.role = 'admin'. Checked server-side on every admin
 * request — middleware alone is not a security boundary.
 */
export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  const appUser = await loadAppUser(user.id);

  if (!appUser || appUser.role !== 'admin' || appUser.suspended_at) {
    throw forbidden('Administrator access required.');
  }
  return user;
}

export async function requireStaff(): Promise<AuthedUser> {
  const user = await requireUser();
  const appUser = await loadAppUser(user.id);

  if (!appUser || !['admin', 'support'].includes(appUser.role) || appUser.suspended_at) {
    throw forbidden('Staff access required.');
  }
  return user;
}

/** Non-throwing variant for layouts that want to render a signed-out state. */
export async function getOptionalUser(): Promise<AuthedUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}
