import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/guards/auth';
import { withApiErrors } from '@/lib/guards/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats?days=30 — the numbers behind the operator dashboard.
 *
 * requireAdmin() runs on this request, not only in middleware: a raw fetch to
 * this URL from a normal account must 403.
 */
export const GET = withApiErrors(async (request: NextRequest) => {
  await requireAdmin();

  const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get('days') ?? 30)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const admin = createSupabaseAdminClient();

  const [
    totalUsers,
    newUsers,
    activeUsers,
    subscriptions,
    mrr,
    revenue,
    aiCost,
    aiFailures,
    webhookFailures,
    docCounts,
    signupRows,
    recentUsersRaw,
    recentActivityRaw,
  ] = await Promise.all([
    admin.from('app_users').select('user_id', { count: 'exact', head: true }),
    admin.from('app_users').select('user_id', { count: 'exact', head: true }).gte('created_at', since),
    admin
      .from('document_events')
      .select('business_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),
    admin.from('subscriptions').select('plan_code, status'),
    admin.from('v_mrr_by_plan').select('*'),
    admin.from('v_revenue_daily').select('*').gte('day', since.slice(0, 10)),
    admin.from('v_ai_cost_daily').select('*').gte('day', since.slice(0, 10)),
    admin
      .from('ai_usage_logs')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'ok')
      .gte('created_at', since),
    admin
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('received_at', since),
    admin.from('v_document_activity_daily').select('*').gte('day', since.slice(0, 10)),
    admin.from('app_users').select('created_at').gte('created_at', since),
    admin
      .from('app_users')
      .select('user_id, email, full_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('document_events')
      .select('business_id, doc_type, doc_id, event, actor, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Both lookups below join in application code rather than via a PostgREST
  // embed — keeps this route independent of exact foreign-key constraint
  // names, matching how the rest of the codebase does cross-table reads.
  const recentUserIds = (recentUsersRaw.data ?? []).map((u) => u.user_id);
  const activityBusinessIds = [
    ...new Set((recentActivityRaw.data ?? []).map((e) => e.business_id)),
  ];

  const [ownerBusinesses, activityBusinesses] = await Promise.all([
    recentUserIds.length
      ? admin.from('businesses').select('id, name, owner_user_id').in('owner_user_id', recentUserIds)
      : Promise.resolve({ data: [] as { id: string; name: string; owner_user_id: string }[] }),
    activityBusinessIds.length
      ? admin.from('businesses').select('id, name').in('id', activityBusinessIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const ownerBusinessIds = (ownerBusinesses.data ?? []).map((b) => b.id);
  const ownerSubs = ownerBusinessIds.length
    ? await admin.from('subscriptions').select('business_id, plan_code, status').in('business_id', ownerBusinessIds)
    : { data: [] as { business_id: string; plan_code: string; status: string }[] };

  const businessByOwner = new Map((ownerBusinesses.data ?? []).map((b) => [b.owner_user_id, b]));
  const subByBusiness = new Map((ownerSubs.data ?? []).map((s) => [s.business_id, s]));
  const businessById = new Map((activityBusinesses.data ?? []).map((b) => [b.id, b]));

  const recentUsers = (recentUsersRaw.data ?? []).map((user) => {
    const business = businessByOwner.get(user.user_id);
    const sub = business ? subByBusiness.get(business.id) : undefined;
    return {
      userId: user.user_id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      createdAt: user.created_at,
      businessName: business?.name ?? null,
      planCode: sub?.plan_code ?? 'free',
      subscriptionStatus: sub?.status ?? null,
    };
  });

  const recentActivity = (recentActivityRaw.data ?? []).map((event) => ({
    businessId: event.business_id,
    businessName: businessById.get(event.business_id)?.name ?? '(unknown business)',
    docType: event.doc_type,
    docId: event.doc_id,
    event: event.event,
    actor: event.actor,
    createdAt: event.created_at,
  }));

  const signupsByDay = aggregate(
    (signupRows.data ?? []).map((row) => ({ day: row.created_at.slice(0, 10), count: 1 })),
    'day',
    'count',
  );

  const subs = subscriptions.data ?? [];
  const premium = subs.filter((s) => s.plan_code !== 'free' && s.status === 'active').length;

  const revenueByDay = aggregate(revenue.data ?? [], 'day', 'amount_paise');
  const aiCostRows = aiCost.data ?? [];

  // p95 AI latency over the window — the number that tells us whether the
  // flagship flow still feels instant.
  const { data: latencies } = await admin
    .from('ai_usage_logs')
    .select('latency_ms')
    .eq('status', 'ok')
    .gte('created_at', since)
    .order('latency_ms', { ascending: true })
    .limit(5000);

  const sorted = (latencies ?? []).map((row) => row.latency_ms);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] ?? 0 : 0;

  return NextResponse.json({
    windowDays: days,
    kpis: {
      totalUsers: totalUsers.count ?? 0,
      newUsers: newUsers.count ?? 0,
      activeBusinesses7d: activeUsers.count ?? 0,
      premiumUsers: premium,
      freeUsers: subs.length - premium,
      conversionPct: subs.length ? Math.round((premium / subs.length) * 1000) / 10 : 0,
      mrrPaise: (mrr.data ?? []).reduce((sum, row) => sum + (row.mrr_paise ?? 0), 0),
      revenuePaise: (revenue.data ?? []).reduce((sum, row) => sum + (row.amount_paise ?? 0), 0),
      aiCostUsd:
        Math.round(aiCostRows.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0) * 10_000) /
        10_000,
      aiRequests: aiCostRows.reduce((sum, row) => sum + (row.requests ?? 0), 0),
      aiFailures: aiFailures.count ?? 0,
      webhookFailures: webhookFailures.count ?? 0,
      aiLatencyP95Ms: p95,
    },
    charts: {
      revenueByDay,
      aiCostByDay: aggregateNumeric(aiCostRows, 'day', 'cost_usd'),
      mrrByPlan: mrr.data ?? [],
      documentActivity: docCounts.data ?? [],
      documentActivityByDay: aggregate(docCounts.data ?? [], 'day', 'event_count'),
      signupsByDay,
    },
    recentUsers,
    recentActivity,
  });
});

function aggregate<T extends Record<string, unknown>>(
  rows: T[],
  keyField: keyof T,
  valueField: keyof T,
): { key: string; value: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(row[keyField]);
    map.set(key, (map.get(key) ?? 0) + Number(row[valueField] ?? 0));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, value }));
}

function aggregateNumeric<T extends Record<string, unknown>>(
  rows: T[],
  keyField: keyof T,
  valueField: keyof T,
): { key: string; value: number }[] {
  return aggregate(rows, keyField, valueField).map((entry) => ({
    key: entry.key,
    value: Math.round(entry.value * 10_000) / 10_000,
  }));
}
