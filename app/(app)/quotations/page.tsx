import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Sparkles } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { DocumentList, ListFilters, type DocumentListRow } from '@/components/documents/document-list';

export const metadata: Metadata = { title: 'Quotations' };
export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = 'all', q } = await searchParams;
  await requireBusiness();
  const supabase = await createSupabaseServerClient();

  let builder = supabase
    .from('quotations')
    .select('id, number, status, issue_date, valid_until, total_paise, currency, customers(name, company)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'all') builder = builder.eq('status', status);
  if (q) builder = builder.ilike('number', `%${q}%`);

  const { data, error } = await builder;

  const rows: DocumentListRow[] = (data ?? []).map((row) => {
    const customer = row.customers as unknown as { name?: string; company?: string } | null;
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      customerLabel: customer?.company || customer?.name || 'No customer',
      issueDate: row.issue_date,
      secondaryDate: row.valid_until,
      totalPaise: row.total_paise,
      currency: row.currency,
    };
  });

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Everything you have quoted, and where it stands."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/quotations/new">New quotation</Link>
            </Button>
            <Button asChild>
              <Link href="/quotations/new?ai=1">
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </Link>
            </Button>
          </>
        }
      />

      <ListFilters basePath="/quotations" statuses={STATUSES} active={status} query={q} />

      {error ? (
        <ErrorState description="We could not load your quotations. Refresh to try again." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6 text-accent-foreground" />}
          title={q || status !== 'all' ? 'Nothing matches those filters' : 'No quotations yet'}
          description={
            q || status !== 'all'
              ? 'Try a different status, or clear the search.'
              : 'Describe a job in one sentence and Invora drafts the line items, scope and terms for you to review.'
          }
          action={
            q || status !== 'all' ? (
              <Button asChild variant="outline">
                <Link href="/quotations">Clear filters</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/quotations/new?ai=1">
                  <Sparkles className="h-4 w-4" />
                  Generate your first quotation
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <DocumentList rows={rows} kind="quotation" secondaryLabel="Valid until" />
      )}
    </>
  );
}
