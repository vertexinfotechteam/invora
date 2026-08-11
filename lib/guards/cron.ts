import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { forbidden } from '@/lib/guards/errors';

/**
 * Guards /api/cron/*.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without this check
 * anyone could trigger the nightly jobs — including the reminder sender, which
 * would let a stranger email your customers.
 */
export function requireCronAuth(request: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw forbidden('Cron is not configured.');

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw forbidden('Invalid cron credentials.');
  }
}
