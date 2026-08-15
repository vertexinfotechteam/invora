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
  // Anonymous visitors were previously offered "Back to the dashboard", which
  // just bounces them to /login, and told their drafts were safe on pages that
  // have no drafts. Read after mount, never during render, so the server and
  // client first paint agree.
  const [isSignedIn, setIsSignedIn] = React.useState(false);

  React.useEffect(() => {
    Sentry.captureException(error);
    setIsSignedIn(/(?:^|;\s*)sb-[^=]+-auth-token/.test(document.cookie));
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Something broke on our side</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {isSignedIn
            ? 'The error has been reported. Nothing you were working on has been lost — drafts autosave every couple of seconds.'
            : 'The error has been reported. Try again in a moment, or get in touch if it keeps happening.'}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          {isSignedIn ? (
            <Link href="/dashboard">Back to the dashboard</Link>
          ) : (
            <Link href="/">Back to the home page</Link>
          )}
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
