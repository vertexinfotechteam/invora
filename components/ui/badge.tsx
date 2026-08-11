import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { InvoiceStatus, QuotationStatus } from '@/lib/types/database';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary',
        neutral: 'border-border bg-muted text-muted-foreground',
        success: 'border-transparent bg-success/12 text-success',
        warning: 'border-transparent bg-warning/15 text-amber-700',
        danger: 'border-transparent bg-destructive/10 text-destructive',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/**
 * Status colour is a single decision made here, so a "paid" invoice looks the
 * same on the list, the detail page and the dashboard. Green means money
 * received and nothing else.
 */
const QUOTE_STYLES: Record<QuotationStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  sent: { label: 'Sent', variant: 'default' },
  viewed: { label: 'Viewed', variant: 'default' },
  accepted: { label: 'Accepted', variant: 'success' },
  rejected: { label: 'Declined', variant: 'danger' },
  expired: { label: 'Expired', variant: 'warning' },
};

const INVOICE_STYLES: Record<InvoiceStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  sent: { label: 'Sent', variant: 'default' },
  viewed: { label: 'Viewed', variant: 'default' },
  partially_paid: { label: 'Part paid', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  overdue: { label: 'Overdue', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

export function StatusBadge({
  status,
  kind,
}: {
  status: QuotationStatus | InvoiceStatus;
  kind: 'quotation' | 'invoice';
}) {
  const config =
    kind === 'quotation'
      ? QUOTE_STYLES[status as QuotationStatus]
      : INVOICE_STYLES[status as InvoiceStatus];

  if (!config) return <Badge variant="neutral">{status}</Badge>;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
