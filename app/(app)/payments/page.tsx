import type { Metadata } from 'next';
import Link from 'next/link';
import { Wallet } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader, StatCard } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('payments')
    .select('id, amount_paise, paid_at, method, source, reference, invoices(id, number, customers(name, company))')
    .order('paid_at', { ascending: false })
    .limit(200);

  const rows = data ?? [];
  const thisMonth = rows
    .filter((row) => new Date(row.paid_at) >= startOfMonth)
    .reduce((sum, row) => sum + row.amount_paise, 0);
  const total = rows.reduce((sum, row) => sum + row.amount_paise, 0);
  const online = rows.filter((row) => row.source === 'razorpay').length;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every rupee received, online or by hand."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="This month" value={formatPaise(thisMonth, business.currency)} tone="success" />
        <StatCard label="Recent total" value={formatPaise(total, business.currency)} hint="Last 200 payments" />
        <StatCard
          label="Collected online"
          value={`${online} of ${rows.length}`}
          hint="via Razorpay"
        />
      </div>

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
                          {payment.method.replace('_', ' ')}
                        </span>
                        {payment.source === 'razorpay' ? (
                          <Badge variant="default">Online</Badge>
                        ) : null}
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
    </>
  );
}
