import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { getUsageSnapshot } from '@/lib/guards/quota';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Progress } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { UpgradeButton } from '@/components/app/upgrade-button';
import { formatPaise } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Plan & usage' };
export const dynamic = 'force-dynamic';

export default async function PlanSettingsPage() {
  const { business } = await requireBusiness();
  const admin = createSupabaseAdminClient();

  const [usage, { data: subscription }, { data: plans }, { data: history }, { data: aiLogs }] =
    await Promise.all([
      getUsageSnapshot(business.id),
      admin
        .from('subscriptions')
        .select('*, plans(name, price_paise, interval)')
        .eq('business_id', business.id)
        .single(),
      admin.from('plans').select('*').eq('is_public', true).order('sort_order'),
      admin
        .from('usage_counters')
        .select('period_start, period_end, docs_used, ai_credits_used')
        .eq('business_id', business.id)
        .order('period_start', { ascending: false })
        .limit(12),
      admin
        .from('ai_usage_logs')
        .select('feature, status, created_at, model')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

  const plan = subscription?.plans as unknown as {
    name: string;
    price_paise: number;
    interval: string;
  } | null;
  const isFree = usage.planCode === 'free';

  return (
    <div className="space-y-6">
      <section className="card-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Current plan
              <Badge variant={isFree ? 'neutral' : 'default'}>{plan?.name ?? 'Starter'}</Badge>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFree
                ? 'Free forever, with 10 documents and 15 AI credits a month.'
                : `${formatPaise(plan?.price_paise ?? 0)} per ${plan?.interval ?? 'month'}.`}
            </p>
            {subscription?.current_period_end ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Current period ends {formatDate(subscription.current_period_end)}
                {subscription.cancel_at_period_end ? ' — cancels then.' : ''}
              </p>
            ) : null}
          </div>

          <UpgradeButton isFree={isFree} cancelAtPeriodEnd={subscription?.cancel_at_period_end ?? false} />
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Meter
            label="Documents this period"
            used={usage.docsUsed}
            limit={usage.docLimit}
          />
          <Meter
            label="AI credits this period"
            used={usage.aiCreditsUsed}
            limit={usage.aiCreditLimit}
          />
        </div>
      </section>

      {isFree ? (
        <section className="card-surface p-5">
          <h2 className="text-sm font-semibold">What Premium adds</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              '500 documents a month',
              '500 AI credits a month',
              'Modern and Minimal PDF templates',
              'Invora branding removed from PDFs',
              'Scheduled payment reminders',
              'CSV import and export',
              'Full reporting history',
              'Priority support',
            ].map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs text-muted-foreground">
            Monthly and Yearly Premium are coming soon — pricing below is what they&rsquo;ll cost
            when billing opens.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(plans ?? [])
              .filter((candidate) => candidate.code !== 'free')
              .map((candidate) => (
                <div key={candidate.code} className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium">{candidate.name}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {formatPaise(candidate.price_paise)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{candidate.interval}
                    </span>
                  </p>
                  <UpgradeButton
                    isFree
                    planCode={candidate.code as 'premium_monthly' | 'premium_yearly'}
                    label={`Choose ${candidate.name}`}
                    className="mt-3 w-full"
                  />
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <section className="card-surface overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Usage history</h2>
        {history?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2 font-medium">Period</th>
                <th className="px-5 py-2 text-right font-medium">Documents</th>
                <th className="px-5 py-2 text-right font-medium">AI credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((period) => (
                <tr key={period.period_start}>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    {formatDate(period.period_start)} – {formatDate(period.period_end)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular">{period.docs_used}</td>
                  <td className="px-5 py-2.5 text-right tabular">{period.ai_credits_used}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No completed periods yet.</p>
        )}
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Past periods are kept as-is and never overwritten, so your usage history stays auditable.
        </p>
      </section>

      <section className="card-surface overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Recent AI activity</h2>
        {aiLogs?.length ? (
          <ul className="divide-y divide-border">
            {aiLogs.map((log, index) => (
              <li key={`${log.created_at}-${index}`} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="capitalize">{log.feature.replace(/_/g, ' ')}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{log.model}</span>
                  <Badge variant={log.status === 'ok' ? 'success' : 'neutral'}>{log.status}</Badge>
                  <span>{formatDateTime(log.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No AI requests yet.{' '}
            <Link href="/quotations/new?ai=1" className="text-primary underline-offset-4 hover:underline">
              Try generating a quotation
            </Link>
            .
          </p>
        )}
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Failed and refused requests are refunded automatically and never cost you a credit.
        </p>
      </section>
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm tabular text-muted-foreground">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </p>
      </div>
      <Progress
        value={percent}
        className="mt-2"
        indicatorClassName={percent >= 100 ? 'bg-destructive' : percent >= 80 ? 'bg-warning' : 'bg-primary'}
      />
    </div>
  );
}
