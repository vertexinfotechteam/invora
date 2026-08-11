import Link from 'next/link';
import { Download, ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import type { InvoiceStatus, QuotationStatus } from '@/lib/types/database';

export interface DocumentListRow {
  id: string;
  number: string;
  status: QuotationStatus | InvoiceStatus;
  customerLabel: string;
  issueDate: string;
  secondaryDate: string | null;
  totalPaise: number;
  balancePaise?: number;
  currency: string;
}

/**
 * The shared list table.
 *
 * Desktop gets a table; below `md` each row becomes a card, because a
 * seven-column financial table at 375px is not a table, it is a puzzle.
 */
export function DocumentList({
  rows,
  kind,
  secondaryLabel,
}: {
  rows: DocumentListRow[];
  kind: 'quotation' | 'invoice';
  secondaryLabel: string;
}) {
  const basePath = kind === 'quotation' ? '/quotations' : '/invoices';

  return (
    <div className="card-surface overflow-hidden">
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Number</th>
            <th className="px-4 py-2.5 font-medium">Customer</th>
            <th className="px-4 py-2.5 font-medium">Issued</th>
            <th className="px-4 py-2.5 font-medium">{secondaryLabel}</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">
              {kind === 'invoice' ? 'Balance' : 'Total'}
            </th>
            <th className="w-24 px-4 py-2.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-secondary/40">
              <td className="px-4 py-3">
                <Link href={`${basePath}/${row.id}`} className="font-medium hover:underline">
                  {row.number}
                </Link>
              </td>
              <td className="max-w-[220px] truncate px-4 py-3">{row.customerLabel}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(row.issueDate)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {row.secondaryDate ? formatDate(row.secondaryDate) : '—'}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} kind={kind} />
              </td>
              <td className="px-4 py-3 text-right font-medium tabular">
                {formatPaise(
                  kind === 'invoice' ? (row.balancePaise ?? row.totalPaise) : row.totalPaise,
                  row.currency,
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Link
                    href={`/api/pdf/${kind}/${row.id}?download=1`}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={`Download ${row.number} as PDF`}
                  >
                    <Download className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`${basePath}/${row.id}`}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={`Open ${row.number}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`${basePath}/${row.id}`} className="block px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.customerLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.number} · {formatDate(row.issueDate)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium tabular">
                    {formatPaise(
                      kind === 'invoice' ? (row.balancePaise ?? row.totalPaise) : row.totalPaise,
                      row.currency,
                    )}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={row.status} kind={kind} />
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ListFilters({
  basePath,
  statuses,
  active,
  query,
}: {
  basePath: string;
  statuses: { value: string; label: string }[];
  active: string;
  query?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form action={basePath} className="flex-1 sm:max-w-xs">
        <input type="hidden" name="status" value={active} />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search number or customer…"
          aria-label="Search"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      <div className="flex flex-wrap gap-1">
        {statuses.map((status) => {
          const href = `${basePath}?status=${status.value}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
          const isActive = active === status.value;
          return (
            <Link
              key={status.value}
              href={href}
              aria-current={isActive ? 'true' : undefined}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {status.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
