import type { Metadata } from 'next';
import Link from 'next/link';
import { Receipt } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader, StatCard } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { DocumentList, ListFilters, type DocumentListRow } from '@/components/documents/document-list';
import { formatPaise } from '@/lib/money';

export const metadata: Metadata = { title: 'Invoices' };
export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Part paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = 'all', q } = await searchParams;
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  let builder = supabase
    .from('invoices')
    .select(
      'id, number, status, issue_date, due_date, total_paise, balance_paise, currency, customers(name, company)',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'all') builder = builder.eq('status', status);
  if (q) builder = builder.ilike('number', `%${q}%`);

  const [{ data, error }, { data: totals }] = await Promise.all([
    builder,
    supabase.from('invoices').select('status, balance_paise, total_paise'),
  ]);

  const all = totals ?? [];
  const outstanding = all
    .filter((row) => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(row.status))
    .reduce((sum, row) => sum + row.balance_paise, 0);
  const overdue = all
    .filter((row) => row.status === 'overdue')
    .reduce((sum, row) => sum + row.balance_paise, 0);
  const paid = all
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + row.total_paise, 0);

  const rows: DocumentListRow[] = (data ?? []).map((row) => {
    const customer = row.customers as unknown as { name?: string; company?: string } | null;
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      customerLabel: customer?.company || customer?.name || 'No customer',
      issueDate: row.issue_date,
      secondaryDate: row.due_date,
      totalPaise: row.total_paise,
      balancePaise: row.balance_paise,
      currency: row.currency,
    };
  });

  return (
    <>
      <PageHeader
        title="Invoices"
        description="What you have billed, and what is still owed."
        actions={
          <Button asChild>
            <Link href="/invoices/new">New invoice</Link>
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding" value={formatPaise(outstanding, business.currency)} />
        <StatCard
          label="Overdue"
          value={formatPaise(overdue, business.currency)}
          tone={overdue > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Paid to date"
          value={formatPaise(paid, business.currency)}
          tone={paid > 0 ? 'success' : 'default'}
        />
      </div>

      <ListFilters basePath="/invoices" statuses={STATUSES} active={status} query={q} />

      {error ? (
        <ErrorState description="We could not load your invoices. Refresh to try again." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6 text-accent-foreground" />}
          title={q || status !== 'all' ? 'Nothing matches those filters' : 'No invoices yet'}
          description={
            q || status !== 'all'
              ? 'Try a different status, or clear the search.'
              : 'Create one directly, or convert an accepted quotation in a single click.'
          }
          action={
            <Button asChild>
              <Link href="/invoices/new">Create an invoice</Link>
            </Button>
          }
        />
      ) : (
        <DocumentList rows={rows} kind="invoice" secondaryLabel="Due" />
      )}
    </>
  );
}
