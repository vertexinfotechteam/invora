import type { Metadata } from 'next';
import { Mail, MessageSquare } from 'lucide-react';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Have a question about Invora? Send us a message and we will get back to you within a business day.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const isDemo = topic === 'demo';

  return (
    <section className="hero-glow border-b border-border py-16 md:py-20">
      <div className="container">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-balance font-serif text-4xl font-medium tracking-tight sm:text-5xl">
            {isDemo ? 'Book a live demo' : 'Get in touch'}
          </h1>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            {isDemo
              ? "Tell us a bit about your business and when works for a 15-minute walkthrough — we'll reply within a business day to set up a time."
              : "Question about a feature, pricing, or something not working the way it should? Tell us what's going on."}
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-lg">
          <ContactForm
            defaultMessage={
              isDemo
                ? "I'd like to book a live demo of Invora. A few times that work for me: "
                : undefined
            }
          />

          <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              Prefer email? Write to{' '}
              <a href="mailto:support@invora.app" className="text-primary underline-offset-4 hover:underline">
                support@invora.app
              </a>
            </p>
            <p className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              We typically reply within one business day.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
