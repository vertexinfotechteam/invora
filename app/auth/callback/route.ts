import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/validation/common';

export const dynamic = 'force-dynamic';

/**
 * Exchanges the one-time code from a verification or password-reset email for
 * a session cookie, then forwards to `next`.
 *
 * `next` is validated to be a same-site path — an open redirect here would let
 * an attacker land a freshly-authenticated user on a page they control.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeRedirectPath(searchParams.get('next'));

  // A provider that refused or was cancelled comes back with `error`, never a
  // code. Forwarding its own reason keeps "you clicked Cancel on Google's
  // consent screen" from being reported as a broken link.
  const providerError = searchParams.get('error');
  if (providerError) {
    const params = new URLSearchParams({ error: providerError });
    const description = searchParams.get('error_description');
    if (description) params.set('error_description', description);
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
