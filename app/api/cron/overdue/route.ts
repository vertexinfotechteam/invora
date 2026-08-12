import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/guards/cron';
import { withApiErrors } from '@/lib/guards/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordDocumentEvent } from '@/lib/events';
import { todayIso } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/overdue — nightly.
 *
 * Flips sent/viewed/partially_paid invoices to `overdue` once the due date has
 * passed and a balance remains. Status is derived here rather than computed at
 * read time so that lists, filters and reminder queries all agree.
 */
export const GET = withApiErrors(async (request: NextRequest) => {
  requireCronAuth(request);

  const admin = createSupabaseAdminClient();
  const today = todayIso();

  const { data: due } = await admin
    .from('invoices')
    .select('id, business_id, number')
    .lt('due_date', today)
    .gt('balance_paise', 0)
    .in('status', ['sent', 'viewed', 'partially_paid']);

  const invoices = due ?? [];
  if (invoices.length === 0) {
    return NextResponse.json({ marked: 0 });
  }

  const { error } = await admin
    .from('invoices')
    .update({ status: 'overdue' })
    .in(
      'id',
      invoices.map((invoice) => invoice.id),
    );

  if (error) throw error;

  await Promise.all(
    invoices.map((invoice) =>
      recordDocumentEvent({
        businessId: invoice.business_id,
        docType: 'invoice',
        docId: invoice.id,
        event: 'edited',
        actor: 'system',
        meta: { kind: 'marked_overdue' },
      }),
    ),
  );

  return NextResponse.json({ marked: invoices.length });
});
