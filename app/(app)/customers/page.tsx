import type { Metadata } from 'next';
import Link from 'next/link';
import { Upload, Users } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const { q, archived } = await searchParams;
  await requireBusiness();
  const supabase = await createSupabaseServerClient();

  let builder = supabase
    .from('customers')
    .select('id, name, company, email, phone, city, created_at, archived_at')
    .order('name', { ascending: true })
    .limit(200);

  builder = archived === '1' ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null);
  if (q) builder = builder.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, error } = await builder;
  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone you bill, and how to reach them."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/customers/import">
                <Upload className="h-4 w-4" />
                Import CSV
              </Link>
            </Button>
            <Button asChild>
              <Link href="/customers/new">Add customer</Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form action="/customers" className="flex-1 sm:max-w-xs">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, company or email…"
            aria-label="Search customers"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </form>
        <Link
          href={archived === '1' ? '/customers' : '/customers?archived=1'}
          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {archived === '1' ? 'Show active' : 'Show archived'}
        </Link>
      </div>

      {error ? (
        <ErrorState description="We could not load your customers." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6 text-accent-foreground" />}
          title={q ? 'No customers match that search' : 'No customers yet'}
          description={
            q
              ? 'Try a different name, company or email.'
              : 'Add your first customer, or import your existing list from a CSV file.'
          }
          action={
            <Button asChild>
              <Link href="/customers/new">Add your first customer</Link>
            </Button>
          }
        />
      ) : (
        <div className="card-surface overflow-hidden">
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((customer) => (
                <tr key={customer.id} className="transition-colors hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${customer.id}`} className="font-medium hover:underline">
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.company || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.email || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(customer.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="divide-y divide-border md:hidden">
            {rows.map((customer) => (
              <li key={customer.id}>
                <Link href={`/customers/${customer.id}`} className="block px-4 py-3.5">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[customer.company, customer.email].filter(Boolean).join(' · ') || 'No contact details'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
