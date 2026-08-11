'use client';

import * as React from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Loading / empty / error, as shared components.
 *
 * Definition of Done says every list page ships all four states. Making them
 * components rather than ad-hoc JSX is what makes that cheap enough to
 * actually happen on every page.
 */

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="card-surface overflow-hidden" aria-busy aria-live="polite">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <div className="skeleton h-4 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <div
                key={columnIndex}
                className="skeleton h-4"
                style={{ width: columnIndex === 0 ? '28%' : `${Math.max(10, 60 / columns)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card-surface space-y-3 p-5">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-7 w-32" />
          <div className="skeleton h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon = <Inbox className="h-6 w-6 text-accent-foreground" />,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'card-surface flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-accent p-3">{icon}</div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="card-surface flex flex-col items-center justify-center gap-3 border-destructive/30 bg-destructive/[0.03] px-6 py-12 text-center"
    >
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description ?? 'We could not load this. It is usually temporary.'}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="skeleton h-9 w-32" />
    </div>
  );
}

/** A record's detail view: header, then two stacked card-shaped blocks. */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <div className="card-surface space-y-4 p-6">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
      </div>
      <div className="card-surface space-y-4 p-6">
        <div className="skeleton h-4 w-1/4" />
        <div className="skeleton h-24 w-full" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** A single-column form page: label + input pairs. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <div className="card-surface space-y-5 p-6">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="skeleton h-3.5 w-28" />
            <div className="skeleton h-9 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function InlineSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
      {label}
    </span>
  );
}
