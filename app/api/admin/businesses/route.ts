import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/guards/auth';
import { badRequest, withApiErrors } from '@/lib/guards/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAdminAction } from '@/lib/admin/audit';
import { clientIp } from '@/lib/guards/rate-limit';
import { adminAdjustLimitsSchema, adminSubscriptionSchema } from '@/lib/validation/schemas';
import { fieldErrors } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/businesses?q=…&page=1 — operator search across all tenants. */
export const GET = withApiErrors(async (request: NextRequest) => {
  await requireAdmin();

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') ?? 1));
  const pageSize = 25;

  const admin = createSupabaseAdminClient();
  let builder = admin
    .from('businesses')
    .select('id, name, email, created_at, owner_user_id, subscriptions(plan_code, status, current_period_end)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (query) {
    builder = builder.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
  }

  const { data, count, error } = await builder;
  if (error) throw badRequest(error.message);

  return NextResponse.json({ businesses: data ?? [], total: count ?? 0, page, pageSize });
});

/**
 * PATCH /api/admin/businesses — mutate a tenant's plan or limits.
 *
 * Every branch writes admin_audit_log BEFORE the mutation, with a mandatory
 * reason and a before/after snapshot. If the audit write fails, nothing changes.
 */
export const PATCH = withApiErrors(async (request: NextRequest) => {
  const adminUser = await requireAdmin();
  const body = await request.json();
  const ip = clientIp(request);
  const admin = createSupabaseAdminClient();

  const kind = body?.kind as string | undefined;

  if (kind === 'limits') {
    const parsed = adminAdjustLimitsSchema.safeParse(body);
    if (!parsed.success) throw badRequest('Check the values.', fieldErrors(parsed.error));

    const { data: before } = await admin
      .from('subscriptions')
      .select('bonus_doc_limit, bonus_ai_credits')
      .eq('business_id', parsed.data.target_business_id)
      .single();

    await recordAdminAction({
      adminUserId: adminUser.id,
      action: 'adjust_limits',
      targetType: 'business',
      targetId: parsed.data.target_business_id,
      reason: parsed.data.reason,
      before: before ?? null,
      after: {
        bonus_doc_limit: parsed.data.bonus_doc_limit,
        bonus_ai_credits: parsed.data.bonus_ai_credits,
      },
      ip,
    });

    const { error } = await admin
      .from('subscriptions')
      .update({
        bonus_doc_limit: parsed.data.bonus_doc_limit,
        bonus_ai_credits: parsed.data.bonus_ai_credits,
      })
      .eq('business_id', parsed.data.target_business_id);

    if (error) throw badRequest(error.message);
    return NextResponse.json({ updated: true });
  }

  if (kind === 'subscription') {
    const parsed = adminSubscriptionSchema.safeParse(body);
    if (!parsed.success) throw badRequest('Check the values.', fieldErrors(parsed.error));

    const { data: before } = await admin
      .from('subscriptions')
      .select('plan_code, status, cancel_at_period_end')
      .eq('business_id', parsed.data.target_business_id)
      .single();

    const next: Record<string, unknown> = {};
    switch (parsed.data.action) {
      case 'activate':
        next.status = 'active';
        next.plan_code = parsed.data.plan_code ?? 'premium_monthly';
        next.cancelled_at = null;
        next.cancel_at_period_end = false;
        break;
      case 'cancel':
        next.cancel_at_period_end = true;
        break;
      case 'suspend':
        next.status = 'halted';
        break;
      case 'reactivate':
        next.status = 'active';
        next.cancel_at_period_end = false;
        break;
    }

    await recordAdminAction({
      adminUserId: adminUser.id,
      action: `subscription_${parsed.data.action}`,
      targetType: 'business',
      targetId: parsed.data.target_business_id,
      reason: parsed.data.reason,
      before: before ?? null,
      after: next as never,
      ip,
    });

    const { error } = await admin
      .from('subscriptions')
      .update(next)
      .eq('business_id', parsed.data.target_business_id);

    if (error) throw badRequest(error.message);
    return NextResponse.json({ updated: true });
  }

  throw badRequest('Unknown admin action.');
});
