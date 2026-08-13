import type { Metadata } from 'next';
import Link from 'next/link';
import { Wallet, Clock } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader, StatCard } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { RecordPaymentDialog } from '@/components/documents/record-payment-dialog';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};
const METHOD_ORDER = ['upi', 'bank_transfer', 'card', 'cash', 'cheque', 'other'];

export default async function PaymentsPage() {
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [{ data, error }, { data: pendingInvoices, error: pendingError }] = await Promise.all([
    supabase
      .from('payments')
      .select('id, amount_paise, paid_at, method, source, reference, invoices(id, number, customers(name, company))')
      .order('paid_at', { ascending: false })
      .limit(200),
    supabase
      .from('invoices')
      .select('id, number, balance_paise, currency, due_date, status, customers(name, company)')
      .in('status', ['sent', 'viewed', 'partially_paid', 'overdue'])
      .gt('balance_paise', 0)
      .order('due_date', { ascending: true })
      .limit(200),
  ]);

  const rows = data ?? [];
  const pending = pendingInvoices ?? [];

  const thisMonth = rows
    .filter((row) => new Date(row.paid_at) >= startOfMonth)
    .reduce((sum, row) => sum + row.amount_paise, 0);
  const total = rows.reduce((sum, row) => sum + row.amount_paise, 0);
  const online = rows.filter((row) => row.source === 'razorpay').length;
  const pendingTotal = pending.reduce((sum, row) => sum + row.balance_paise, 0);

  const byMethod = new Map<string, { count: number; totalPaise: number }>();
  for (const row of rows) {
    const bucket = byMethod.get(row.method) ?? { count: 0, totalPaise: 0 };
    bucket.count += 1;
    bucket.totalPaise += row.amount_paise;
    byMethod.set(row.method, bucket);
  }

  return (
    <>
      <PageHeader title="Payments" description="Every rupee received, online or by hand — and what's still owed." />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="This month" value={formatPaise(thisMonth, business.currency)} tone="success" />
        <StatCard label="Recent total" value={formatPaise(total, business.currency)} hint="Last 200 payments" />
        <StatCard label="Collected online" value={`${online} of ${rows.length}`} hint="via Razorpay" />
        <StatCard
          label="Pending"
          value={formatPaise(pendingTotal, business.currency)}
          hint={`${pending.length} unpaid invoice${pending.length === 1 ? '' : 's'}`}
          tone={pendingTotal > 0 ? 'warning' : undefined}
        />
      </div>

      {rows.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {METHOD_ORDER.filter((method) => byMethod.has(method)).map((method) => {
            const bucket = byMethod.get(method)!;
            return (
              <span
                key={method}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
              >
                <span className="font-medium">{METHOD_LABELS[method] ?? method}</span>
                <span className="text-muted-foreground">
                  {bucket.count} · {formatPaise(bucket.totalPaise, business.currency)}
                </span>
              </span>
            );
          })}
        </div>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-warning" />
          Pending payments
        </h2>
        {pendingError ? (
          <ErrorState description="We could not load pending payments." />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-6 w-6 text-accent-foreground" />}
            title="Nothing outstanding"
            description="Every sent invoice is either paid in full or hasn't been sent yet."
          />
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Balance due</th>
                  <th className="px-4 py-2.5" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pending.map((invoice) => {
                  const customer = invoice.customers as unknown as { name?: string; company?: string } | null;
                  return (
                    <tr key={invoice.id} className="transition-colors hover:bg-secondary/40">
                      <td className="px-4 py-3">{customer?.company || customer?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
                          {invoice.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {invoice.due_date ? formatDate(invoice.due_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={invoice.status === 'overdue' ? 'danger' : 'neutral'}>
                          {invoice.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular">
                        {formatPaise(invoice.balance_paise, invoice.currency || business.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RecordPaymentDialog
                          invoiceId={invoice.id}
                          balancePaise={invoice.balance_paise}
                          currency={invoice.currency || business.currency}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="divide-y divide-border md:hidden">
              {pending.map((invoice) => {
                const customer = invoice.customers as unknown as { name?: string; company?: string } | null;
                return (
                  <li key={invoice.id} className="space-y-2 px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{customer?.company || customer?.name || 'Invoice'}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.number}
                          {invoice.due_date ? ` · Due ${formatDate(invoice.due_date)}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium tabular">
                        {formatPaise(invoice.balance_paise, invoice.currency || business.currency)}
                      </span>
                    </div>
                    <RecordPaymentDialog
                      invoiceId={invoice.id}
                      balancePaise={invoice.balance_paise}
                      currency={invoice.currency || business.currency}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Received payments</h2>
        {error ? (
          <ErrorState description="We could not load your payments." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6 text-accent-foreground" />}
            title="No payments yet"
            description="Payments appear here the moment a customer pays online, or when you record one against an invoice by hand."
          />
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Method</th>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((payment) => {
                  const invoice = payment.invoices as unknown as {
                    id: string;
                    number: string;
                    customers?: { name?: string; company?: string } | null;
                  } | null;
                  return (
                    <tr key={payment.id} className="transition-colors hover:bg-secondary/40">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(payment.paid_at)}</td>
                      <td className="px-4 py-3">
                        {invoice?.customers?.company || invoice?.customers?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {invoice ? (
                          <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
                            {invoice.number}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span className="capitalize text-muted-foreground">
                            {METHOD_LABELS[payment.method] ?? payment.method.replace('_', ' ')}
                          </span>
                          {payment.source === 'razorpay' ? <Badge variant="default">Online</Badge> : null}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">
                        {payment.reference || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular text-success">
                        {formatPaise(payment.amount_paise, business.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((payment) => {
                const invoice = payment.invoices as unknown as {
                  id: string;
                  number: string;
                  customers?: { name?: string; company?: string } | null;
                } | null;
                return (
                  <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {invoice?.customers?.company || invoice?.customers?.name || 'Payment'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invoice?.number} · {formatDate(payment.paid_at)}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium tabular text-success">
                      {formatPaise(payment.amount_paise, business.currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
