import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { InvoraMark } from '@/components/marketing/nav';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <InvoraMark className="h-10 w-10" />

      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">We could not find that page</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          The link may be out of date, or the document may have been moved or deleted.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/dashboard">Go to your dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to the homepage</Link>
        </Button>
      </div>
    </main>
  );
}
