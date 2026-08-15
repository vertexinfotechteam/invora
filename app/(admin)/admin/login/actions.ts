'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit, limiters } from '@/lib/guards/rate-limit';
import { fieldErrors } from '@/lib/validation/common';
import { signInSchema } from '@/lib/validation/schemas';
import { setFlashToast } from '@/lib/flash';
import type { FormState } from '@/app/(auth)/actions';

/**
 * A separate credential check from the customer sign-in action.
 *
 * There is one account store (Supabase Auth) — a second, parallel password
 * database for admins would just be a second place secrets can leak from, and
 * a second thing to keep patched and audited. What makes this a distinct
 * portal is the gate that runs *after* authentication: any account that
 * signs in successfully here but isn't flagged `admin` in app_users is signed
 * back out immediately and told nothing more than "invalid credentials" — the
 * same generic failure a wrong password gets, so this page can't be used to
 * discover which email addresses are staff accounts.
 */
export async function adminSignInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }

  if (limiters.auth) {
    const forwarded = (await headers()).get('x-forwarded-for') ?? 'unknown';
    const ip = forwarded.split(',')[0]?.trim() ?? 'unknown';
    try {
      await enforceRateLimit('auth', `admin-signin:${ip}`);
    } catch {
      return { ok: false, message: 'Too many attempts. Please wait a minute and try again.' };
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  const genericFailure: FormState = { ok: false, message: 'Invalid administrator credentials.' };
  if (error || !data.user) return genericFailure;

  const admin = createSupabaseAdminClient();
  const { data: appUser } = await admin
    .from('app_users')
    .select('role, suspended_at')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (!appUser || appUser.role !== 'admin' || appUser.suspended_at) {
    await supabase.auth.signOut();
    return genericFailure;
  }

  await setFlashToast('success', 'Signed in to operations.');
  redirect('/admin');
}
