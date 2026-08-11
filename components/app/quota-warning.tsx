import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { UsageSnapshot } from '@/components/app/usage-meter';

/**
 * Shown when an allowance is exhausted.
 *
 * The server enforces the limit regardless; this exists so the user finds out
 * before they have typed a whole document.
 */
export function QuotaWarning({
  usage,
  kind,
}: {
  usage: UsageSnapshot;
  kind: 'documents' | 'ai';
}) {
  const isDocuments = kind === 'documents';
  const used = isDocuments ? usage.docsUsed : usage.aiCreditsUsed;
  const limit = isDocuments ? usage.docLimit : usage.aiCreditLimit;
  const noun = isDocuments ? 'documents' : 'AI credits';

  return (
    <div
      role="alert"
      className="mb-5 flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-900">
            You have used all {limit} {noun} in this billing period.
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            {used} of {limit} used. Everything you have already created stays fully accessible —
            you just cannot create new {noun} until the period resets or you upgrade.
          </p>
        </div>
      </div>

      <Link
        href="/settings/plan"
        className="shrink-0 rounded-lg bg-navy-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-navy-800"
      >
        Upgrade
      </Link>
    </div>
  );
}
