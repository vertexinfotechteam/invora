import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/guards/cron';
import { withApiErrors } from '@/lib/guards/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordDocumentEvent } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/expire-quotes — nightly.
 *
 * A quotation past its valid-until date becomes `expired`, which is what stops
 * the public page from accepting it months later at a stale price.
 * Accepted and rejected quotations are left alone.
 */
export const GET = withApiErrors(async (request: NextRequest) => {
  requireCronAuth(request);

  const admin = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: stale } = await admin
    .from('quotations')
    .select('id, business_id, number')
    .lt('valid_until', today)
    .in('status', ['sent', 'viewed']);

  const quotes = stale ?? [];
  if (quotes.length === 0) return NextResponse.json({ expired: 0 });

  const { error } = await admin
    .from('quotations')
    .update({ status: 'expired' })
    .in(
      'id',
      quotes.map((quote) => quote.id),
    );

  if (error) throw error;

  await Promise.all(
    quotes.map((quote) =>
      recordDocumentEvent({
        businessId: quote.business_id,
        docType: 'quotation',
        docId: quote.id,
        event: 'expired',
        actor: 'system',
      }),
    ),
  );

  return NextResponse.json({ expired: quotes.length });
});
