import { NextResponse, type NextRequest } from 'next/server';

import { badRequest, withApiErrors } from '@/lib/guards/errors';
import { clientIp, enforceRateLimit } from '@/lib/guards/rate-limit';
import { computeAvailableSlots } from '@/lib/meetings/availability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/meetings/availability?date=YYYY-MM-DD — public, unauthenticated.
 * Returns the open 30-minute slots for that IST calendar date.
 */
export const GET = withApiErrors(async (request: NextRequest) => {
  await enforceRateLimit('publicView', `meetings-availability:${clientIp(request)}`);

  const date = request.nextUrl.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest('Provide a date in YYYY-MM-DD format.');
  }

  const slots = await computeAvailableSlots(date);
  return NextResponse.json({ slots });
});
