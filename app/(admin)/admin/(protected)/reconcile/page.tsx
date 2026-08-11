import type { Metadata } from 'next';
import { CheckCircle2, TriangleAlert } from 'lucide-react';

import { requireAdmin } from '@/lib/guards/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatPaise } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Reconciliation' };
export const dynamic = 'force-dynamic';

/**
 * Webhook ledger vs payment rows.
 *
 * Reads the same data as /api/admin/reconcile but renders server-side, so the
 * page is useful during an incident even if client JS is having a bad day.
 */
export default async function ReconcilePage() {
  await requireAdmin();

  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: events }, { data: payments }, { data: recentAudit }] = await Promise.all([
    admin
      .from('webhook_events')
      .select('event_id, event_type, status, error, received_at')
      .gte('received_at', since)
      .order('received_at', { ascending: false })
      .limit(200),
    admin
      .from('payments')
      .select('id, amount_paise, razorpay_payment_id, created_at, source')
      .eq('source', 'razorpay')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .from('admin_audit_log')
      .select('action, target_type, target_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const unprocessed = (events ?? []).filter(
    (event) => event.status === 'received' || event.status === 'failed',
  );
  const healthy = unprocessed.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reconciliation</h1>
        <p className="text-sm text-muted-foreground">
          Webhook events against booked payments, last 7 days.
        </p>
      </div>

      <div
        className={`card-surface flex items-start gap-3 p-5 ${
          healthy ? 'border-success/30 bg-success/[0.04]' : 'border-destructive/30 bg-destructive/5'
        }`}
      >
        {healthy ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        ) : (
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        )}
        <div>
          <p className="font-medium">
            {healthy ? 'Every webhook in this window was processed' : `${unprocessed.length} events need attention`}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {events?.length ?? 0} events received · {payments?.length ?? 0} online payments booked
          </p>
        </div>
      </div>

      <section className="card-surface overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Webhook events</h2>
        {events?.length ? (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Received</th>
                  <th className="px-5 py-2 font-medium">Type</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => (
                  <tr key={event.event_id}>
                    <td className="px-5 py-2 text-muted-foreground">
                      {formatDateTime(event.received_at)}
                    </td>
                    <td className="px-5 py-2">{event.event_type ?? '—'}</td>
                    <td className="px-5 py-2">
                      <Badge
                        variant={
                          event.status === 'processed'
                            ? 'success'
                            : event.status === 'failed'
                              ? 'danger'
                              : event.status === 'ignored'
                                ? 'neutral'
                                : 'warning'
                        }
                      >
                        {event.status}
                      </Badge>
                    </td>
                    <td className="max-w-[240px] truncate px-5 py-2 text-xs text-destructive">
                      {event.error ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No webhook events in this window.</p>
        )}
      </section>

      <section className="card-surface overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
          Online payments booked
        </h2>
        {payments?.length ? (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {payment.razorpay_payment_id}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(payment.created_at)}
                  </span>
                  <span className="font-medium tabular">{formatPaise(payment.amount_paise)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No online payments in this window.</p>
        )}
      </section>

      <section className="card-surface overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
          Recent admin actions
        </h2>
        {recentAudit?.length ? (
          <ul className="divide-y divide-border">
            {recentAudit.map((entry, index) => (
              <li key={`${entry.created_at}-${index}`} className="px-5 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {entry.target_type} {entry.target_id?.slice(0, 8)} · {entry.reason}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No admin actions recorded.</p>
        )}
      </section>
    </div>
  );
}
