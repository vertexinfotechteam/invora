import type { Metadata } from 'next';
import Link from 'next/link';

import { requireBusiness } from '@/lib/guards/auth';
import { hasFeature } from '@/lib/guards/features';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader, StatCard } from '@/components/app/page-header';
import { RevenueChart } from '@/components/app/revenue-chart';
import { formatPaise } from '@/lib/money';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days = '30' } = await searchParams;
  const { business } = await requireBusiness();
  const fullReports = await hasFeature(business.id, 'full_reports');

  // Free plan is capped at 30 days — enforced here, not just hidden in the UI.
  const windowDays = fullReports ? Math.min(365, Math.max(1, Number(days) || 30)) : 30;
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const supabase = await createSupabaseServerClient();

  const [{ data: payments }, { data: invoices }, { data: quotations }, { data: customers }] =
    await Promise.all([
      supabase
        .from('payments')
        .select('amount_paise, paid_at')
        .gte('paid_at', since.toISOString())
        .order('paid_at'),
      supabase.from('invoices').select('status, total_paise, balance_paise, issue_date'),
      supabase.from('quotations').select('status, total_paise, issue_date'),
      supabase
        .from('customers')
        .select('id, name, company')
        .is('archived_at', null)
        .order('name'),
    ]);

  const collected = (payments ?? []).reduce((sum, row) => sum + row.amount_paise, 0);
  const billed = (invoices ?? [])
    .filter((row) => new Date(row.issue_date) >= since && row.status !== 'draft')
    .reduce((sum, row) => sum + row.total_paise, 0);
  const outstanding = (invoices ?? [])
    .filter((row) => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(row.status))
    .reduce((sum, row) => sum + row.balance_paise, 0);

  const quotesInWindow = (quotations ?? []).filter((row) => new Date(row.issue_date) >= since);
  const accepted = quotesInWindow.filter((row) => row.status === 'accepted');
  const answered = quotesInWindow.filter((row) => ['accepted', 'rejected'].includes(row.status));
  const winRate = answered.length ? Math.round((accepted.length / answered.length) * 100) : null;

  const series = buildDailySeries(payments ?? [], windowDays);

  return (
    <>
      <PageHeader
        title="Reports"
        description="How much you quoted, billed and actually collected."
        actions={
          <div className="flex gap-1">
            {RANGES.map((range) => {
              const locked = !fullReports && range.value !== '30';
              return (
                <Link
                  key={range.value}
                  href={locked ? '/settings/plan' : `/reports?days=${range.value}`}
                  aria-disabled={locked}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    String(windowDays) === range.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : locked
                        ? 'border-dashed border-border text-muted-foreground/60'
                        : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range.label}
                  {locked ? ' · Premium' : ''}
                </Link>
              );
            })}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={formatPaise(collected, business.currency)}
          hint={`${payments?.length ?? 0} payments`}
          tone="success"
        />
        <StatCard label="Billed" value={formatPaise(billed, business.currency)} hint="Invoices issued" />
        <StatCard
          label="Outstanding"
          value={formatPaise(outstanding, business.currency)}
          hint="All unpaid invoices"
        />
        <StatCard
          label="Quotation win rate"
          value={winRate === null ? '—' : `${winRate}%`}
          hint={
            answered.length
              ? `${accepted.length} accepted of ${answered.length} answered`
              : 'No responses in this window'
          }
        />
      </div>

      <section className="card-surface mt-6 p-5">
        <h2 className="text-sm font-semibold">Collections</h2>
        <p className="text-xs text-muted-foreground">Payments received per day, in this window.</p>
        <div className="mt-4">
          <RevenueChart data={series} currency={business.currency} />
        </div>
      </section>

      <section className="card-surface mt-6 p-5">
        <h2 className="text-sm font-semibold">Download report</h2>
        <p className="text-xs text-muted-foreground">
          An Excel file of quotations and invoices for a customer (or everyone) over a date range.
        </p>

        {fullReports ? (
          <form
            action="/api/reports/export"
            method="get"
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
          >
            <label className="text-xs text-muted-foreground">
              Customer
              <select
                name="customer_id"
                defaultValue=""
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">All customers</option>
                {(customers ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company ? `${customer.company} — ${customer.name}` : customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              From
              <input
                type="date"
                name="from"
                defaultValue={since.toISOString().slice(0, 10)}
                required
                className="mt-1 h-9 rounded-lg border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              To
              <input
                type="date"
                name="to"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
                className="mt-1 h-9 rounded-lg border border-input bg-background px-3 text-sm"
              />
            </label>
            <button
              type="submit"
              className="mt-1 h-9 self-end rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:mt-0"
            >
              Download .xlsx
            </button>
          </form>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Downloadable reports are a{' '}
            <Link href="/settings/plan" className="font-medium text-primary underline-offset-4 hover:underline">
              Premium
            </Link>{' '}
            feature.
          </p>
        )}
      </section>

      {!fullReports ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          The free plan reports on the last 30 days.{' '}
          <Link href="/settings/plan" className="font-medium text-primary underline-offset-4 hover:underline">
            Upgrade
          </Link>{' '}
          for full history and downloadable reports.
        </p>
      ) : null}
    </>
  );
}

function buildDailySeries(
  payments: { amount_paise: number; paid_at: string }[],
  windowDays: number,
): { day: string; amountPaise: number }[] {
  const buckets = new Map<string, number>();

  for (let index = windowDays - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10);
    buckets.set(date, 0);
  }

  for (const payment of payments) {
    const day = payment.paid_at.slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + payment.amount_paise);
  }

  return [...buckets.entries()].map(([day, amountPaise]) => ({ day, amountPaise }));
}
