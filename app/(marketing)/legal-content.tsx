import type { ReactNode } from 'react';

/**
 * Shared shell for the three policy pages.
 *
 * These pages must be live and reachable before Razorpay will activate a
 * merchant account, so they ship with V1 rather than being deferred.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="container max-w-3xl py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Legal</p>
      <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      <p className="mt-6 text-pretty text-muted-foreground">{intro}</p>

      <div className="mt-10 space-y-8">{children}</div>

      <div className="mt-14 rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Questions about this policy?</p>
        <p className="mt-1">
          Write to{' '}
          <a className="text-primary underline-offset-4 hover:underline" href="mailto:legal@invora.app">
            legal@invora.app
          </a>{' '}
          and we will respond within five working days.
        </p>
      </div>
    </article>
  );
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
