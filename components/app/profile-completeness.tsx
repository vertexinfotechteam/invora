import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/misc';
import type { Business } from '@/lib/types/database';

interface Check {
  label: string;
  done: boolean;
  href: string;
  /** Weighted, because a logo matters less than a bank account. */
  weight: number;
}

/**
 * Profile completeness.
 *
 * The point is not gamification — an invoice missing a GSTIN or bank details is
 * an invoice that does not get paid, so this widget names the specific thing
 * that is missing and links straight to the field.
 */
export function buildChecks(business: Business): Check[] {
  return [
    { label: 'Business name', done: Boolean(business.name?.trim()), href: '/settings/profile', weight: 2 },
    {
      label: 'Address',
      done: Boolean(business.address_line1 && business.city),
      href: '/settings/profile',
      weight: 2,
    },
    { label: 'Contact email', done: Boolean(business.email), href: '/settings/profile', weight: 2 },
    { label: 'Phone number', done: Boolean(business.phone), href: '/settings/profile', weight: 1 },
    { label: 'Logo', done: Boolean(business.logo_url), href: '/settings/branding', weight: 1 },
    { label: 'GSTIN', done: Boolean(business.gstin), href: '/settings/profile', weight: 2 },
    {
      label: 'Bank or UPI details',
      done: Boolean(business.bank_account_no || business.upi_id),
      href: '/settings/profile',
      weight: 3,
    },
    {
      label: 'Default payment terms',
      done: Boolean(business.default_payment_terms?.trim()),
      href: '/settings/defaults',
      weight: 1,
    },
    {
      label: 'Terms & conditions',
      done: Boolean(business.default_terms?.trim()),
      href: '/settings/defaults',
      weight: 1,
    },
    { label: 'Signature image', done: Boolean(business.signature_url), href: '/settings/branding', weight: 1 },
  ];
}

export function completenessPercent(checks: Check[]): number {
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const done = checks.reduce((sum, check) => sum + (check.done ? check.weight : 0), 0);
  return Math.round((done / total) * 100);
}

export function ProfileCompleteness({ business }: { business: Business }) {
  const checks = buildChecks(business);
  const percent = completenessPercent(checks);
  const missing = checks.filter((check) => !check.done);

  if (percent === 100) {
    return (
      <div className="card-surface flex items-center gap-3 border-success/30 bg-success/[0.04] p-5">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-medium">Your business profile is complete</p>
          <p className="text-xs text-muted-foreground">
            Every document you send carries your full details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Finish your profile</h2>
        <span className="text-sm font-semibold tabular text-primary">{percent}%</span>
      </div>
      <Progress value={percent} className="mt-3" aria-label={`Profile ${percent}% complete`} />
      <p className="mt-3 text-xs text-muted-foreground">
        These appear on every quotation and invoice you send.
      </p>

      <ul className="mt-3 space-y-1.5">
        {missing.slice(0, 5).map((check) => (
          <li key={check.label}>
            <Link
              href={check.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Circle className="h-3.5 w-3.5 shrink-0" />
              {check.label}
            </Link>
          </li>
        ))}
      </ul>

      {missing.length > 5 ? (
        <p className="mt-2 px-2 text-xs text-muted-foreground">
          and {missing.length - 5} more
        </p>
      ) : null}
    </div>
  );
}
