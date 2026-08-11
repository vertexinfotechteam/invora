'use client';

import * as React from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Root error boundary.
 *
 * Reports to Sentry, then shows the user something honest and actionable —
 * never a stack trace, and never a bare "Something went wrong" with no way out.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Something broke on our side</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          The error has been reported automatically. Nothing you were working on has been lost —
          drafts autosave every couple of seconds.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to the dashboard</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Quote this reference to support: <code className="rounded bg-muted px-1">{error.digest}</code>
        </p>
      ) : null}
    </main>
  );
}
