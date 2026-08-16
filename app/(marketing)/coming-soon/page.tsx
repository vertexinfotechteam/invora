import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Coming soon',
  description: 'Premium billing is coming soon to Invora. Use the Free plan for now.',
  alternates: { canonical: '/coming-soon' },
  robots: { index: false, follow: true },
};

export default function ComingSoonPage() {
  return (
    <section className="hero-glow flex min-h-[60vh] items-center border-b border-border py-16">
      <div className="container mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Clock className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-balance font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          Premium billing is coming soon
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground">
          We&rsquo;re still finishing payments for this plan. In the meantime, the Free plan gives
          you real quotations and invoices — no card required — and you keep everything you create
          if you move to Premium later.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/signup">Start free</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">Back to pricing</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
