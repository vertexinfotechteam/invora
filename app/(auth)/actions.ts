'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/guards/rate-limit';
import { appUrl } from '@/lib/app-url';
import { fieldErrors, safeRedirectPath } from '@/lib/validation/common';
import { checkEmailDeliverable } from '@/lib/validation/email-address';
import { sendEmail } from '@/lib/email/send';
import { welcomeEmail } from '@/lib/email/templates';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validation/schemas';

export interface FormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

/**
 * Base URL for links we email out (verification, password reset).
 *
 * See lib/app-url.ts for the resolution order. It never consults the `Host`
 * header, which is caller-controlled and would otherwise let an attacker
 * trigger a reset for someone else's address and have the link point at a host
 * they own. It also no longer throws when nothing is configured: doing so
 * aborted the server action before `supabase.auth.signUp` ever ran, so an
 * unset `NEXT_PUBLIC_APP_URL` turned both password and OAuth sign-up into
 * "Something broke on our side" rather than into a wrong link.
 */
function originUrl(): string {
  return appUrl();
}

/** Auth endpoints are limited by IP — there is no user id to key on yet. */
async function limitByIp(prefix: string): Promise<void> {
  const forwarded = (await headers()).get('x-forwarded-for') ?? 'unknown';
  const ip = forwarded.split(',')[0]?.trim() ?? 'unknown';
  await enforceRateLimit('auth', `${prefix}:${ip}`);
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'),
    businessName: formData.get('businessName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    acceptTerms: formData.get('acceptTerms') === 'on',
  });

  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }

  try {
    await limitByIp('signup');
  } catch {
    return { ok: false, message: 'Too many attempts. Please wait a minute and try again.' };
  }

  // Checked before the account exists, not after — an address that cannot
  // receive mail can never confirm, reset a password, or be reached about an
  // invoice, so there is nothing worth creating a row for.
  const deliverable = await checkEmailDeliverable(parsed.data.email);
  if (!deliverable.ok) {
    return { ok: false, errors: { email: deliverable.reason } };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${originUrl()}/auth/callback?next=/settings/profile`,
      // Read by the handle_new_user trigger to seed the business row.
      data: {
        full_name: parsed.data.fullName,
        business_name: parsed.data.businessName,
      },
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  // Greeting mail, sent once at sign-up. Deliberately not awaited into the
  // failure path: a mail provider having a bad minute must never turn a
  // successful sign-up into an error the visitor sees. sendEmail already
  // swallows and logs its own failures.
  const mail = welcomeEmail({
    name: parsed.data.fullName,
    businessName: parsed.data.businessName,
    appUrl: originUrl(),
  });
  await sendEmail({
    to: parsed.data.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    template: 'welcome',
  });

  // If email confirmation is off for this project, Supabase signs the user in
  // immediately and hands back a live session — go straight to the app. If
  // confirmation is required, there is no session yet and we fall through to
  // the "check your email" message below.
  if (data.session) {
    redirect('/dashboard');
  }

  return {
    ok: true,
    message: `Check ${parsed.data.email} for a verification link. It expires in an hour.`,
  };
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }

  try {
    await limitByIp('signin');
  } catch {
    return { ok: false, message: 'Too many sign-in attempts. Please wait a minute.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague: distinguishing "no such user" from "wrong password"
    // turns the login form into an account-enumeration oracle.
    return { ok: false, message: 'That email and password combination did not work.' };
  }

  redirect(safeRedirectPath(formData.get('next')));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  try {
    await limitByIp('forgot');
  } catch {
    return { ok: false, message: 'Too many requests. Please wait a minute.' };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${originUrl()}/auth/callback?next=/reset-password`,
  });

  // Always the same answer, whether or not the address exists.
  return {
    ok: true,
    message: 'If an account exists for that address, a reset link is on its way.',
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'That reset link has expired. Request a new one.' };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: error.message };

  redirect('/dashboard');
}
