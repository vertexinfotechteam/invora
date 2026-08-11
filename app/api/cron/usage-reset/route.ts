import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/guards/cron';
import { withApiErrors } from '@/lib/guards/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/usage-reset — hourly.
 *
 * Rolls free-plan businesses onto a new billing period once the current one
 * ends. Paid plans are rolled by the `subscription.charged` webhook instead,
 * so their period always matches what Razorpay actually billed.
 *
 * Old usage_counters rows are never overwritten or deleted — a new period is a
 * new row, which is what makes the usage history auditable.
 */
export const GET = withApiErrors(async (request: NextRequest) => {
  requireCronAuth(request);

  const admin = createSupabaseAdminClient();
  const now = new Date();

  const { data: expired } = await admin
    .from('subscriptions')
    .select('business_id, plan_code, current_period_end')
    .lt('current_period_end', now.toISOString())
    .eq('status', 'active')
    .eq('plan_code', 'free')
    .limit(500);

  const rows = expired ?? [];
  let rolled = 0;

  for (const row of rows) {
    const start = new Date(row.current_period_end);
    // If a business was dormant for months, walk forward to the current period
    // rather than creating a backlog of empty ones.
    while (start.getTime() + 30 * 86_400_000 < now.getTime()) {
      start.setUTCMonth(start.getUTCMonth() + 1);
    }
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    await admin
      .from('subscriptions')
      .update({
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
      })
      .eq('business_id', row.business_id);

    await admin.from('usage_counters').upsert(
      {
        business_id: row.business_id,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        docs_used: 0,
        ai_credits_used: 0,
      },
      { onConflict: 'business_id,period_start', ignoreDuplicates: true },
    );

    rolled += 1;
  }

  return NextResponse.json({ rolled });
});
