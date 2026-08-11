'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Users } from 'lucide-react';

import { StatCard } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { CardsSkeleton, ErrorState } from '@/components/ui/states';
import { formatPaise } from '@/lib/money';
import { formatUsd } from '@/lib/ai/pricing';
import { relativeTime } from '@/lib/utils';

interface Stats {
  windowDays: number;
  kpis: {
    totalUsers: number;
    newUsers: number;
    activeBusinesses7d: number;
    premiumUsers: number;
    freeUsers: number;
    conversionPct: number;
    mrrPaise: number;
    revenuePaise: number;
    aiCostUsd: number;
    aiRequests: number;
    aiFailures: number;
    webhookFailures: number;
    aiLatencyP95Ms: number;
  };
  charts: {
    revenueByDay: { key: string; value: number }[];
    aiCostByDay: { key: string; value: number }[];
    mrrByPlan: { plan_code: string; subscribers: number; mrr_paise: number }[];
    documentActivityByDay: { key: string; value: number }[];
    signupsByDay: { key: string; value: number }[];
  };
  recentUsers: {
    userId: string;
    email: string;
    fullName: string | null;
    role: string;
    createdAt: string;
    businessName: string | null;
    planCode: string;
    subscriptionStatus: string | null;
  }[];
  recentActivity: {
    businessId: string;
    businessName: string;
    docType: string;
    docId: string;
    event: string;
    actor: string;
    createdAt: string;
  }[];
}

const EVENT_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  created: 'neutral',
  edited: 'neutral',
  sent: 'default',
  viewed: 'default',
  accepted: 'success',
  paid: 'success',
  payment_recorded: 'success',
  converted: 'default',
  reminder_sent: 'default',
  rejected: 'danger',
  cancelled: 'danger',
  expired: 'warning',
};

function eventLabel(event: string): string {
  return event.replace(/_/g, ' ');
}

const RANGES = [7, 30, 90];

/**
 * The operator dashboard.
 *
 * Everything here is fetched from /api/admin/stats, which re-checks the admin
 * role on the request — so opening devtools and calling it from a normal
 * account 403s rather than leaking cross-tenant numbers.
 */
export function AdminOverview() {
  const [days, setDays] = React.useState(30);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/admin/stats?days=${days}`);
      if (!response.ok) {
        setError(true);
        return;
      }
      setStats(await response.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [days]);

  React.useEffect(() => {
    void load();
    // Refresh every 30s so the operator view is live enough to be useful
    // during an incident without hammering the database.
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <ErrorState description="Could not load operational stats." onRetry={load} />;
  if (loading && !stats) return <CardsSkeleton count={8} />;
  if (!stats) return null;

  const { kpis, charts } = stats;
  const health =
    kpis.webhookFailures === 0 && kpis.aiFailures < Math.max(5, kpis.aiRequests * 0.05);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Last {stats.windowDays} days · refreshes automatically
          </p>
        </div>

        <div className="flex gap-1">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDays(range)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                days === range
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {!health ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-destructive">System health needs attention</p>
            <p className="mt-0.5 text-muted-foreground">
              {kpis.webhookFailures} failed webhooks and {kpis.aiFailures} failed AI requests in this
              window. Check the reconciliation tab before assuming payment data is complete.
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={kpis.totalUsers.toLocaleString()}
          hint={`${kpis.newUsers} new in window`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Active businesses"
          value={kpis.activeBusinesses7d.toLocaleString()}
          hint="Any document activity, 7 days"
        />
        <StatCard
          label="Premium"
          value={kpis.premiumUsers.toLocaleString()}
          hint={`${kpis.conversionPct}% of all accounts`}
          tone="success"
        />
        <StatCard label="MRR" value={formatPaise(kpis.mrrPaise)} hint="Active paid subscriptions" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Payments collected" value={formatPaise(kpis.revenuePaise)} tone="success" />
        <StatCard
          label="AI spend (est.)"
          value={formatUsd(kpis.aiCostUsd)}
          hint={`${kpis.aiRequests.toLocaleString()} requests`}
        />
        <StatCard
          label="AI failures"
          value={kpis.aiFailures.toLocaleString()}
          tone={kpis.aiFailures > 0 ? 'warning' : 'default'}
          hint="Refunded automatically"
        />
        <StatCard
          label="AI latency p95"
          value={`${(kpis.aiLatencyP95Ms / 1000).toFixed(1)}s`}
          tone={kpis.aiLatencyP95Ms > 30_000 ? 'warning' : 'default'}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Payments collected" description="Per day, across all tenants.">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={charts.revenueByDay} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="adminRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => formatPaise(value, 'INR', 'en-IN', { compact: true })}
              />
              <Tooltip formatter={(value: number) => formatPaise(value)} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                fill="url(#adminRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="AI cost" description="Estimated USD spend per day.">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.aiCostByDay} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: number) => formatUsd(value)} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Signups" description="New accounts per day.">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.signupsByDay} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Document activity" description="Documents created, sent, viewed or paid per day.">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={charts.documentActivityByDay} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="adminActivity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#adminActivity)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="card-surface overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">MRR by plan</h2>
        {charts.mrrByPlan.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No paid subscriptions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2 font-medium">Plan</th>
                <th className="px-5 py-2 text-right font-medium">Subscribers</th>
                <th className="px-5 py-2 text-right font-medium">MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {charts.mrrByPlan.map((row) => (
                <tr key={row.plan_code}>
                  <td className="px-5 py-2.5">{row.plan_code}</td>
                  <td className="px-5 py-2.5 text-right tabular">{row.subscribers}</td>
                  <td className="px-5 py-2.5 text-right tabular">{formatPaise(row.mrr_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-surface overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Recent signups</h2>
          {stats.recentUsers.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No signups in this window.</p>
          ) : (
            <ul className="divide-y divide-border">
              {stats.recentUsers.map((user) => (
                <li key={user.userId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.fullName || user.email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.businessName || 'No business'} · {relativeTime(user.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={user.planCode === 'free' ? 'neutral' : 'default'}>{user.planCode}</Badge>
                    {user.role !== 'user' ? <Badge variant="warning">{user.role}</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-surface overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Recent activity</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No document activity in this window.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {stats.recentActivity.map((event, index) => (
                <li
                  key={`${event.businessId}-${event.docId}-${index}`}
                  className="flex items-center justify-between gap-3 px-5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="font-medium">{event.businessName}</span>{' '}
                      <span className="text-muted-foreground">
                        {eventLabel(event.event)} a {event.docType}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{relativeTime(event.createdAt)}</p>
                  </div>
                  <Badge variant={EVENT_TONE[event.event] ?? 'neutral'} className="shrink-0">
                    {eventLabel(event.event)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        AI spend is our own estimate from logged token counts. Reconcile it against the Anthropic
        console monthly — a gap wider than about 5% means the price table in{' '}
        <code className="rounded bg-muted px-1">lib/ai/pricing.ts</code> is stale.
      </p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}
