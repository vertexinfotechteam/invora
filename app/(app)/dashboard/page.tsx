import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, FileText, Receipt, Sparkles, Wallet } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader, StatCard } from '@/components/app/page-header';
import { ProfileCompleteness } from '@/components/app/profile-completeness';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [invoices, quotations, payments, recentQuotes, recentInvoices, overdue] = await Promise.all([
    supabase.from('invoices').select('status, total_paise, balance_paise'),
    supabase.from('quotations').select('status, total_paise'),
    supabase.from('payments').select('amount_paise').gte('paid_at', thirtyDaysAgo),
    supabase
      .from('quotations')
      .select('id, number, status, total_paise, currency, issue_date, customers(name, company)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('invoices')
      .select('id, number, status, total_paise, balance_paise, currency, due_date, customers(name, company)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('invoices')
      .select('id, number, balance_paise, currency, due_date, customers(name, company)')
      .eq('status', 'overdue')
      .order('due_date', { ascending: true })
      .limit(5),
  ]);

  const invoiceRows = invoices.data ?? [];
  const outstanding = invoiceRows
    .filter((row) => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(row.status))
    .reduce((sum, row) => sum + row.balance_paise, 0);
  const overdueTotal = invoiceRows
    .filter((row) => row.status === 'overdue')
    .reduce((sum, row) => sum + row.balance_paise, 0);
  const collected = (payments.data ?? []).reduce((sum, row) => sum + row.amount_paise, 0);

  const quoteRows = quotations.data ?? [];
  const openQuotes = quoteRows.filter((row) => ['sent', 'viewed'].includes(row.status));
  const acceptedQuotes = quoteRows.filter((row) => row.status === 'accepted').length;
  const respondedQuotes = quoteRows.filter((row) =>
    ['accepted', 'rejected'].includes(row.status),
  ).length;
  const winRate = respondedQuotes ? Math.round((acceptedQuotes / respondedQuotes) * 100) : null;

  const hasAnything = quoteRows.length > 0 || invoiceRows.length > 0;

  return (
    <>
      <PageHeader
        title={`Good to see you${business.name ? `, ${business.name}` : ''}`}
        description="Everything that needs your attention, in one place."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/invoices/new">
                <Receipt className="h-4 w-4" />
                New invoice
              </Link>
            </Button>
            <Button asChild>
              <Link href="/quotations/new?ai=1">
                <Sparkles className="h-4 w-4" />
                Generate quotation
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={formatPaise(outstanding, business.currency)}
          hint={`${invoiceRows.filter((r) => r.balance_paise > 0).length} unpaid invoices`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Overdue"
          value={formatPaise(overdueTotal, business.currency)}
          hint={overdueTotal > 0 ? 'Chase these first' : 'Nothing overdue'}
          tone={overdueTotal > 0 ? 'danger' : 'default'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Collected · 30 days"
          value={formatPaise(collected, business.currency)}
          hint={`${payments.data?.length ?? 0} payments received`}
          tone={collected > 0 ? 'success' : 'default'}
        />
        <StatCard
          label="Open quotations"
          value={String(openQuotes.length)}
          hint={
            winRate === null
              ? 'No responses yet'
              : `${winRate}% accepted of those answered`
          }
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {!hasAnything ? (
            <EmptyState
              icon={<Sparkles className="h-6 w-6 text-accent-foreground" />}
              title="Send your first quotation"
              description="Describe the job in one sentence and Invora drafts the line items, scope, deliverables and terms. You review, adjust and send."
              action={
                <Button asChild>
                  <Link href="/quotations/new?ai=1">
                    Generate with AI
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              }
            />
          ) : null}

          {overdue.data?.length ? (
            <section className="card-surface overflow-hidden border-destructive/25">
              <header className="flex items-center justify-between border-b border-border bg-destructive/[0.04] px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue invoices
                </h2>
                <Link href="/invoices?status=overdue" className="text-xs text-muted-foreground hover:text-foreground">
                  View all
                </Link>
              </header>
              <ul className="divide-y divide-border">
                {overdue.data.map((invoice) => {
                  const customer = invoice.customers as unknown as { name?: string; company?: string } | null;
                  return (
                    <li key={invoice.id}>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-secondary/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {customer?.company || customer?.name || 'No customer'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.number} · due {formatDate(invoice.due_date)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular text-destructive">
                          {formatPaise(invoice.balance_paise, invoice.currency)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <RecentList
            title="Recent quotations"
            href="/quotations"
            emptyLabel="No quotations yet."
            rows={(recentQuotes.data ?? []).map((row) => {
              const customer = row.customers as unknown as { name?: string; company?: string } | null;
              return {
                id: row.id,
                href: `/quotations/${row.id}`,
                primary: customer?.company || customer?.name || 'No customer',
                secondary: `${row.number} · ${formatDate(row.issue_date)}`,
                amount: formatPaise(row.total_paise, row.currency),
                badge: <StatusBadge status={row.status} kind="quotation" />,
              };
            })}
          />

          <RecentList
            title="Recent invoices"
            href="/invoices"
            emptyLabel="No invoices yet."
            rows={(recentInvoices.data ?? []).map((row) => {
              const customer = row.customers as unknown as { name?: string; company?: string } | null;
              return {
                id: row.id,
                href: `/invoices/${row.id}`,
                primary: customer?.company || customer?.name || 'No customer',
                secondary: `${row.number} · ${row.due_date ? `due ${formatDate(row.due_date)}` : 'no due date'}`,
                amount: formatPaise(row.total_paise, row.currency),
                badge: <StatusBadge status={row.status} kind="invoice" />,
              };
            })}
          />
        </div>

        <aside className="space-y-6">
          <ProfileCompleteness business={business} />

          <div className="card-surface p-5">
            <h2 className="text-sm font-semibold">Quick actions</h2>
            <div className="mt-3 grid gap-2">
              {[
                { href: '/quotations/new?ai=1', label: 'Generate a quotation with AI' },
                { href: '/customers/new', label: 'Add a customer' },
                { href: '/products/new', label: 'Add a catalog item' },
                { href: '/settings/branding', label: 'Set up branding' },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
                >
                  {action.label}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function RecentList({
  title,
  href,
  rows,
  emptyLabel,
}: {
  title: string;
  href: string;
  emptyLabel: string;
  rows: {
    id: string;
    href: string;
    primary: string;
    secondary: string;
    amount: string;
    badge: React.ReactNode;
  }[];
}) {
  return (
    <section className="card-surface overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
          View all
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.primary}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.secondary}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {row.badge}
                  <span className="text-sm font-medium tabular">{row.amount}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
