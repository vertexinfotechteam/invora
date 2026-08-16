import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/guards/auth';
import { badRequest, forbidden, withApiErrors } from '@/lib/guards/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAdminAction } from '@/lib/admin/audit';
import { clientIp } from '@/lib/guards/rate-limit';
import {
  adminAccountStatusSchema,
  adminAdjustLimitsSchema,
  adminDeleteAccountSchema,
  adminSubscriptionSchema,
} from '@/lib/validation/schemas';
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

  const rows = data ?? [];

  // businesses.owner_user_id and app_users.user_id both point at auth.users,
  // but nothing FKs businesses -> app_users directly, so PostgREST can't
  // embed this in one query — a second lookup, merged in below.
  const ownerIds = rows.map((row) => row.owner_user_id).filter(Boolean);
  const { data: owners } = ownerIds.length
    ? await admin.from('app_users').select('user_id, role, suspended_at').in('user_id', ownerIds)
    : { data: [] as { user_id: string; role: string; suspended_at: string | null }[] };
  const ownerById = new Map((owners ?? []).map((owner) => [owner.user_id, owner]));

  const businesses = rows.map((row) => ({
    ...row,
    account_role: ownerById.get(row.owner_user_id)?.role ?? 'user',
    account_suspended_at: ownerById.get(row.owner_user_id)?.suspended_at ?? null,
  }));

  return NextResponse.json({ businesses, total: count ?? 0, page, pageSize });
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

  if (kind === 'account') {
    const parsed = adminAccountStatusSchema.safeParse(body);
    if (!parsed.success) throw badRequest('Check the values.', fieldErrors(parsed.error));

    const owner = await loadOwnerForBusiness(admin, parsed.data.target_business_id);
    // Never lets this panel lock out another admin — an attacker who
    // compromises one admin session must not be able to disable the rest.
    if (owner.role === 'admin') throw forbidden('Admin accounts cannot be suspended from here.');

    const suspendedAt = parsed.data.action === 'suspend' ? new Date().toISOString() : null;

    await recordAdminAction({
      adminUserId: adminUser.id,
      action: `account_${parsed.data.action}`,
      targetType: 'business',
      targetId: parsed.data.target_business_id,
      reason: parsed.data.reason,
      before: { suspended_at: owner.suspendedAt },
      after: { suspended_at: suspendedAt },
      ip,
    });

    const { error } = await admin
      .from('app_users')
      .update({ suspended_at: suspendedAt })
      .eq('user_id', owner.userId);

    if (error) throw badRequest(error.message);
    return NextResponse.json({ updated: true });
  }

  throw badRequest('Unknown admin action.');
});

/**
 * DELETE /api/admin/businesses — permanently deletes a tenant's account.
 *
 * Deletes the Supabase auth user, which cascades (via `on delete cascade`)
 * through app_users, businesses, and every table hanging off business_id —
 * customers, catalog, quotations, invoices, payments, everything. There is
 * no undo, which is why this requires the account's own email typed back
 * exactly, on top of the reason every other admin mutation already requires.
 */
export const DELETE = withApiErrors(async (request: NextRequest) => {
  const adminUser = await requireAdmin();
  const body = await request.json();
  const ip = clientIp(request);
  const admin = createSupabaseAdminClient();

  const parsed = adminDeleteAccountSchema.safeParse(body);
  if (!parsed.success) throw badRequest('Check the values.', fieldErrors(parsed.error));

  const owner = await loadOwnerForBusiness(admin, parsed.data.target_business_id);
  if (owner.role === 'admin') throw forbidden('Admin accounts cannot be deleted from here.');
  if (adminUser.id === owner.userId) throw forbidden('You cannot delete your own account.');

  const typedEmail = parsed.data.confirm_email.trim().toLowerCase();
  const expectedEmail = (owner.businessEmail || owner.userEmail || '').trim().toLowerCase();
  if (!expectedEmail || typedEmail !== expectedEmail) {
    throw badRequest('Check the values.', { confirm_email: 'That does not match the account email.' });
  }

  await recordAdminAction({
    adminUserId: adminUser.id,
    action: 'delete_account',
    targetType: 'business',
    targetId: parsed.data.target_business_id,
    reason: parsed.data.reason,
    before: { business_id: parsed.data.target_business_id, owner_user_id: owner.userId, email: expectedEmail },
    after: null,
    ip,
  });

  const { error } = await admin.auth.admin.deleteUser(owner.userId);
  if (error) throw badRequest(error.message);

  return NextResponse.json({ deleted: true });
});

async function loadOwnerForBusiness(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  businessId: string,
): Promise<{ userId: string; role: string; suspendedAt: string | null; businessEmail: string | null; userEmail: string | null }> {
  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('owner_user_id, email')
    .eq('id', businessId)
    .single();
  if (businessError || !business) throw badRequest('No such business.');

  const { data: appUser, error: appUserError } = await admin
    .from('app_users')
    .select('role, suspended_at, email')
    .eq('user_id', business.owner_user_id)
    .single();
  if (appUserError || !appUser) throw badRequest('No account found for that business.');

  return {
    userId: business.owner_user_id,
    role: appUser.role,
    suspendedAt: appUser.suspended_at,
    businessEmail: business.email,
    userEmail: appUser.email,
  };
}
