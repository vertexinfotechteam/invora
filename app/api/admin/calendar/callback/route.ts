import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/guards/auth';
import { exchangeGoogleAuthCode, DEMO_CONNECTION_ID } from '@/lib/google/calendar';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withApiErrors } from '@/lib/guards/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'demo_calendar_oauth_state';

export const GET = withApiErrors(async (request: NextRequest) => {
  const user = await requireAdmin();

  const { searchParams, origin } = request.nextUrl;
  const redirectTo = (path: string) => NextResponse.redirect(`${origin}/admin/meetings${path}`);

  const error = searchParams.get('error');
  if (error) return redirectTo(`?calendar_error=${encodeURIComponent(error)}`);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo('?calendar_error=invalid_state');
  }

  try {
    const { refreshToken, email } = await exchangeGoogleAuthCode(code);
    const admin = createSupabaseAdminClient();

    await admin.from('demo_calendar_connection').upsert({
      id: DEMO_CONNECTION_ID,
      google_refresh_token: refreshToken,
      google_email: email,
      connected_by: user.id,
      connected_at: new Date().toISOString(),
    });

    const response = redirectTo('?calendar_connected=1');
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (err) {
    console.error('[invora:calendar] OAuth exchange failed', err);
    const response = redirectTo('?calendar_error=exchange_failed');
    response.cookies.delete(STATE_COOKIE);
    return response;
  }
});
