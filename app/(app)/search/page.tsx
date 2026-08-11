import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchIcon } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';

/**
 * Global search across customers, quotations and invoices.
 *
 * Backed by the pg_trgm indexes created in migration 0002/0003, so a partial
 * or slightly-misspelled name still finds the row.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await requireBusiness();

  const query = (q ?? '').trim();
  if (!query) {
    return (
      <>
        <PageHeader title="Search" />
        <EmptyState
          icon={<SearchIcon className="h-6 w-6 text-accent-foreground" />}
          title="Search everything"
          description="Type a customer name, a quotation number or an invoice number into the bar at the top. Press / anywhere to jump there."
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const pattern = `%${query}%`;

  const [{ data: customers }, { data: quotations }, { data: invoices }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, company, email')
      .or(`name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern}`)
      .is('archived_at', null)
      .limit(10),
    supabase
      .from('quotations')
      .select('id, number, status, total_paise, currency, issue_date, customers(name, company)')
      .ilike('number', pattern)
      .limit(10),
    supabase
      .from('invoices')
      .select('id, number, status, total_paise, currency, issue_date, customers(name, company)')
      .ilike('number', pattern)
      .limit(10),
  ]);

  const total = (customers?.length ?? 0) + (quotations?.length ?? 0) + (invoices?.length ?? 0);

  return (
    <>
      <PageHeader
        title={`Results for “${query}”`}
        description={`${total} ${total === 1 ? 'match' : 'matches'}`}
      />

      {total === 0 ? (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6 text-accent-foreground" />}
          title="Nothing found"
          description="Try part of a customer name, or a document number like QT-0042."
        />
      ) : (
        <div className="space-y-6">
          {customers?.length ? (
            <Section title="Customers">
              {customers.map((customer) => (
                <Row
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  primary={customer.company || customer.name}
                  secondary={[customer.company ? customer.name : null, customer.email]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </Section>
          ) : null}

          {quotations?.length ? (
            <Section title="Quotations">
              {quotations.map((row) => {
                const customer = row.customers as unknown as { name?: string; company?: string } | null;
                return (
                  <Row
                    key={row.id}
                    href={`/quotations/${row.id}`}
                    primary={row.number}
                    secondary={`${customer?.company || customer?.name || 'No customer'} · ${formatDate(row.issue_date)}`}
                    trailing={
                      <span className="flex items-center gap-3">
                        <StatusBadge status={row.status} kind="quotation" />
                        <span className="tabular">{formatPaise(row.total_paise, row.currency)}</span>
                      </span>
                    }
                  />
                );
              })}
            </Section>
          ) : null}

          {invoices?.length ? (
            <Section title="Invoices">
              {invoices.map((row) => {
                const customer = row.customers as unknown as { name?: string; company?: string } | null;
                return (
                  <Row
                    key={row.id}
                    href={`/invoices/${row.id}`}
                    primary={row.number}
                    secondary={`${customer?.company || customer?.name || 'No customer'} · ${formatDate(row.issue_date)}`}
                    trailing={
                      <span className="flex items-center gap-3">
                        <StatusBadge status={row.status} kind="invoice" />
                        <span className="tabular">{formatPaise(row.total_paise, row.currency)}</span>
                      </span>
                    }
                  />
                );
              })}
            </Section>
          ) : null}
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-surface overflow-hidden">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">{title}</h2>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

function Row({
  href,
  primary,
  secondary,
  trailing,
}: {
  href: string;
  primary: string;
  secondary: string;
  trailing?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-secondary/40"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{primary}</span>
          <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
        </span>
        {trailing ? <span className="shrink-0 text-sm">{trailing}</span> : null}
      </Link>
    </li>
  );
}
