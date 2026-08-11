import Link from 'next/link';
import { LinkIcon } from 'lucide-react';

/**
 * One page for every failure mode — bad token, revoked link, expired link,
 * wrong document type. A visitor cannot tell which, which is the point: an
 * "expired" message confirms the document existed.
 */
export function LinkUnavailable() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-6">
      <div className="card-surface max-w-md p-8 text-center">
        <div className="mx-auto w-fit rounded-full bg-secondary p-3">
          <LinkIcon className="h-6 w-6 text-muted-foreground" />
        </div>

        <h1 className="mt-4 text-lg font-semibold">This link is no longer available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have expired, been replaced with a newer version, or been withdrawn by the sender.
          Ask them to send you a fresh link — it takes them one click.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          What is Invora?
        </Link>
      </div>
    </main>
  );
}
