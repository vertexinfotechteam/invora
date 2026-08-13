import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';

import { requireAdmin } from '@/lib/guards/auth';
import { buildGoogleAuthUrl } from '@/lib/google/calendar';
import { withApiErrors } from '@/lib/guards/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'demo_calendar_oauth_state';

/**
 * GET /api/admin/calendar/connect — starts the OAuth handshake that connects
 * Google Calendar to the "book a demo" feature. The nonce round-trips
 * through Google as `state` and back through this same browser's cookie —
 * standard double-submit CSRF protection for an OAuth callback.
 */
export const GET = withApiErrors(async (_request: NextRequest) => {
  await requireAdmin();

  const nonce = randomBytes(24).toString('base64url');
  const response = NextResponse.redirect(buildGoogleAuthUrl(nonce));
  response.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
});
