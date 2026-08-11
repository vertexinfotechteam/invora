'use client';

import Link from 'next/link';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/misc';
import { cn, formatDate } from '@/lib/utils';

export interface UsageSnapshot {
  docsUsed: number;
  docLimit: number;
  aiCreditsUsed: number;
  aiCreditLimit: number;
  planCode: string;
  periodEnd: string | null;
}

function pct(used: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * The usage meter in the sidebar.
 *
 * Warns at 80% and again at 100%, because being told you are out of documents
 * at the moment you try to create one is a bad way to find out.
 */
export function UsageMeter({ usage }: { usage: UsageSnapshot }) {
  const docPct = pct(usage.docsUsed, usage.docLimit);
  const aiPct = pct(usage.aiCreditsUsed, usage.aiCreditLimit);
  const worst = Math.max(docPct, aiPct);
  const isFree = usage.planCode === 'free';

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          This period
        </p>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium capitalize">
          {isFree ? 'Starter' : 'Premium'}
        </span>
      </div>

      <Meter
        label="Documents"
        used={usage.docsUsed}
        limit={usage.docLimit}
        percent={docPct}
      />
      <Meter
        label="AI credits"
        used={usage.aiCreditsUsed}
        limit={usage.aiCreditLimit}
        percent={aiPct}
        icon={<Sparkles className="h-3 w-3" />}
      />

      {usage.periodEnd ? (
        <p className="text-[11px] text-muted-foreground">
          Resets {formatDate(usage.periodEnd)}
        </p>
      ) : null}

      {worst >= 100 ? (
        <Banner tone="danger">
          You have used your full allowance for this period.
          {isFree ? ' Upgrade to keep creating documents.' : ''}
        </Banner>
      ) : worst >= 80 ? (
        <Banner tone="warning">You are at {worst}% of your allowance.</Banner>
      ) : null}

      {isFree ? (
        <Link
          href="/settings/plan"
          className="block rounded-md bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Upgrade to Premium
        </Link>
      ) : null}
    </div>
  );
}

function Meter({
  label,
  used,
  limit,
  percent,
  icon,
}: {
  label: string;
  used: number;
  limit: number;
  percent: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="tabular font-medium">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <Progress
        value={percent}
        aria-label={`${label}: ${used} of ${limit} used`}
        indicatorClassName={cn(
          percent >= 100 ? 'bg-destructive' : percent >= 80 ? 'bg-warning' : 'bg-primary',
        )}
      />
    </div>
  );
}

function Banner({ tone, children }: { tone: 'warning' | 'danger'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 rounded-md p-2 text-[11px] leading-snug',
        tone === 'danger'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-warning/15 text-amber-700',
      )}
    >
      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
      {children}
    </p>
  );
}
