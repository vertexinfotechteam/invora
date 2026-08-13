import type { Metadata } from 'next';
import { BookDemoFlow } from './book-demo-flow';

export const metadata: Metadata = {
  title: 'Book a demo',
  alternates: { canonical: '/book-demo' },
};

export default function BookDemoPage() {
  return (
    <section className="hero-glow relative overflow-hidden border-b border-border py-16 md:py-20">
      <div className="container max-w-2xl">
        <div className="mb-10 text-center">
          <p className="animate-reveal-up text-xs font-semibold uppercase tracking-wider text-primary [animation-delay:0ms]">
            Book a demo
          </p>
          <h1 className="animate-reveal-up mt-2 text-balance font-serif text-3xl font-medium tracking-tight [animation-delay:80ms] sm:text-4xl">
            See Invora live, on Google Meet
          </h1>
          <p className="animate-reveal-up mt-3 text-pretty text-muted-foreground [animation-delay:160ms]">
            Pick a 30-minute slot that works for you. We&apos;ll walk through generating a quotation,
            converting it to an invoice, and getting paid — using your own kind of job, not a
            canned demo.
          </p>
        </div>

        {/* BookDemoFlow wraps its own root in <Reveal>, which fires its
            IntersectionObserver-driven entrance immediately since this card
            is already in the initial viewport — no separate wrapper needed
            here, or it would double up with that same animation. */}
        <BookDemoFlow />
      </div>
    </section>
  );
}
