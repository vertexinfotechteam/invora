import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Archive, FileText, Receipt } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader, StatCard } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { StatusBadge } from '@/components/ui/badge';
import { CustomerForm } from '@/components/app/customer-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { archiveCustomerAction } from '@/app/(app)/actions';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Customer' };
export const dynamic = 'force-dynamic';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  const [{ data: customer }, { data: quotations }, { data: invoices }, { data: payments }] =
    await Promise.all([
      supabase.from('customers').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('quotations')
        .select('id, number, status, issue_date, total_paise, currency')
        .eq('customer_id', id)
        .order('issue_date', { ascending: false })
        .limit(50),
      supabase
        .from('invoices')
        .select('id, number, status, issue_date, due_date, total_paise, balance_paise, currency')
        .eq('customer_id', id)
        .order('issue_date', { ascending: false })
        .limit(50),
      supabase
        .from('payments')
        .select('id, amount_paise, paid_at, method, invoice_id')
        .order('paid_at', { ascending: false })
        .limit(50),
    ]);

  if (!customer) notFound();

  const invoiceIds = new Set((invoices ?? []).map((invoice) => invoice.id));
  const customerPayments = (payments ?? []).filter((payment) => invoiceIds.has(payment.invoice_id));

  const outstanding = (invoices ?? [])
    .filter((invoice) => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(invoice.status))
    .reduce((sum, invoice) => sum + invoice.balance_paise, 0);
  const overdue = (invoices ?? [])
    .filter((invoice) => invoice.status === 'overdue')
    .reduce((sum, invoice) => sum + invoice.balance_paise, 0);
  const lifetime = customerPayments.reduce((sum, payment) => sum + payment.amount_paise, 0);

  return (
    <>
      <PageHeader
        title={customer.company || customer.name}
        description={[customer.company ? customer.name : null, customer.email, customer.phone]
          .filter(Boolean)
          .join(' · ')}
        breadcrumbs={[{ href: '/customers', label: 'Customers' }, { label: customer.name }]}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/quotations/new?customer=${customer.id}`}>
                <FileText className="h-4 w-4" />
                New quotation
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/invoices/new?customer=${customer.id}`}>
                <Receipt className="h-4 w-4" />
                New invoice
              </Link>
            </Button>
            {!customer.archived_at ? (
              <form action={archiveCustomerAction.bind(null, customer.id)}>
                <SubmitButton variant="ghost" size="sm">
                  <Archive className="h-4 w-4" />
                  Archive
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding" value={formatPaise(outstanding, business.currency)} />
        <StatCard
          label="Overdue"
          value={formatPaise(overdue, business.currency)}
          tone={overdue > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Paid to date"
          value={formatPaise(lifetime, business.currency)}
          tone={lifetime > 0 ? 'success' : 'default'}
        />
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-6">
          <DocumentTable
            title="Quotations"
            emptyLabel="No quotations for this customer yet."
            basePath="/quotations"
            kind="quotation"
            rows={(quotations ?? []).map((row) => ({
              id: row.id,
              number: row.number,
              status: row.status,
              date: row.issue_date,
              amount: formatPaise(row.total_paise, row.currency),
            }))}
          />

          <DocumentTable
            title="Invoices"
            emptyLabel="No invoices for this customer yet."
            basePath="/invoices"
            kind="invoice"
            rows={(invoices ?? []).map((row) => ({
              id: row.id,
              number: row.number,
              status: row.status,
              date: row.issue_date,
              amount: formatPaise(row.balance_paise, row.currency),
            }))}
          />

          <section className="card-surface overflow-hidden">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Payments</h2>
            {customerPayments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {customerPayments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-muted-foreground">
                      {formatDate(payment.paid_at)} · {payment.method.replace('_', ' ')}
                    </span>
                    <span className="font-medium tabular text-success">
                      {formatPaise(payment.amount_paise, business.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="details">
          <div className="max-w-3xl">
            <CustomerForm customer={customer} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function DocumentTable({
  title,
  emptyLabel,
  basePath,
  kind,
  rows,
}: {
  title: string;
  emptyLabel: string;
  basePath: string;
  kind: 'quotation' | 'invoice';
  rows: { id: string; number: string; status: string; date: string; amount: string }[];
}) {
  return (
    <section className="card-surface overflow-hidden">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`${basePath}/${row.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-secondary/40"
              >
                <span className="font-medium">{row.number}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{formatDate(row.date)}</span>
                  <StatusBadge status={row.status as never} kind={kind} />
                  <span className="w-28 text-right font-medium tabular">{row.amount}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
