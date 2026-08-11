import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileText,
  Languages,
  Lock,
  Send,
  Sparkles,
  Timer,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { alternates: { canonical: '/' } };

/** Renders a JSON-LD block. `<` is escaped defensively — nothing here is user input today, but nothing here should ever be able to break out of the script tag either. */
function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export default function LandingPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Invora',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description:
            'AI-assisted quotation and invoicing software for growing businesses — GST-ready documents, Razorpay payments, and automated reminders.',
          offers: [
            { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'INR' },
            { '@type': 'Offer', name: 'Premium — Monthly', price: '299', priceCurrency: 'INR', availability: 'https://schema.org/PreOrder' },
            { '@type': 'Offer', name: 'Premium — Yearly', price: '999', priceCurrency: 'INR', availability: 'https://schema.org/PreOrder' },
          ],
          brand: { '@type': 'Organization', name: 'Vertex Infotech' },
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        }}
      />
      <Hero />
      <TrustBar />
      <Pillars />
      <AiSection />
      <MoneySafety />
      <Workflow />
      <PricingPreview />
      <Faq />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="hero-glow relative overflow-hidden border-b border-border">
      <div className="container relative py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-5 gap-1.5 bg-background/70 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by Claude · built by Vertex Infotech
          </Badge>

          <h1 className="text-balance font-serif text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl">
            From a one-line brief to a{' '}
            <span className="text-primary">paid invoice</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            Invora writes the quotation, keeps every rupee of the arithmetic in your hands, converts
            it to a GST-ready invoice in one click, and chases the payment while you get on with
            the work.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/signup">
                Start free — no card
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            10 documents and 15 AI credits every month on the free plan. Upgrade only when it earns
            its keep.
          </p>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

/** A static, honest mock of the editor. No fabricated logos, no invented metrics. */
function HeroPreview() {
  const rows = [
    { name: 'Discovery & requirements workshop', qty: '2 days', amount: '₹40,000.00' },
    { name: 'UI design — 8 screens', qty: '8 screens', amount: '₹96,000.00' },
    { name: 'Frontend build & integration', qty: '18 days', amount: '₹2,16,000.00' },
  ];

  return (
    <div className="mx-auto mt-14 max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/40" />
          <span className="ml-3 text-xs text-muted-foreground">Quotation QT-0042 · draft</span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_260px]">
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/25 bg-accent px-3 py-2 text-sm">
              <Wand2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-accent-foreground">
                “Website redesign for a Pune manufacturer, 6 weeks, design + build”
              </span>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.name}>
                    <td className="py-2.5 pr-3">{row.name}</td>
                    <td className="py-2.5 text-right text-muted-foreground tabular">{row.qty}</td>
                    <td className="py-2.5 text-right tabular">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="border-t border-border bg-muted/30 p-5 md:border-l md:border-t-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Totals
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular">₹3,52,000.00</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">GST @ 18%</dt>
                <dd className="tabular">₹63,360.00</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular">₹4,15,360.00</dd>
              </div>
            </dl>
            <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Calculator className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Every figure computed by Invora, not by the model.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function TrustBar() {
  const items = [
    { icon: Lock, label: 'Row-level tenant isolation' },
    { icon: BadgeCheck, label: 'GST tax breakup on every PDF' },
    { icon: CreditCard, label: 'Razorpay payments & webhooks' },
    { icon: Timer, label: 'Reminders that run themselves' },
  ];

  return (
    <section className="border-b border-border bg-muted/20">
      <div className="container grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <item.icon className="h-4 w-4 shrink-0 text-primary" />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}

function Pillars() {
  const pillars = [
    {
      icon: FileText,
      title: 'Quotations that win the work',
      body: 'Keyboard-first line-item editor, live totals, scope, deliverables and exclusions. Autosaves as you type, so a closed tab costs you nothing.',
      points: ['Reusable product catalog', 'Duplicate any quote', 'Accept online, no login'],
    },
    {
      icon: Send,
      title: 'Invoices that get paid',
      body: 'One click converts an accepted quotation into an invoice, to the paise. Partial payments, running balance and a status that is always derived, never typed.',
      points: ['GST tax breakup', 'Amount in words', 'Pay-now link on every invoice'],
    },
    {
      icon: CreditCard,
      title: 'Money you can reconcile',
      body: 'Razorpay checkout on the public invoice page, with a signature-verified webhook as the only thing that can mark an invoice paid.',
      points: ['Idempotent webhooks', 'Manual payments too', 'Receipt email automatically'],
    },
  ];

  return (
    <section id="product" className="border-b border-border py-20">
      <div className="container">
        <SectionHeading
          eyebrow="The product"
          title="Three screens that run your billing"
          description="Not an accounting suite. The narrow slice that decides whether you get paid — done properly."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="card-surface flex flex-col gap-3 p-6">
              <div className="w-fit rounded-lg bg-accent p-2.5">
                <pillar.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{pillar.title}</h3>
              <p className="text-sm text-muted-foreground">{pillar.body}</p>
              <ul className="mt-1 space-y-1.5">
                {pillar.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiSection() {
  const capabilities = [
    {
      icon: Wand2,
      title: 'Generate from a brief',
      body: 'Describe the job in a sentence. Get line items, scope, deliverables, exclusions, assumptions and payment terms — structured, not a wall of text.',
    },
    {
      icon: Sparkles,
      title: 'Rewrite in place',
      body: 'Professionalize, shorten, expand or fix any passage. Every number, date and document reference is checked to survive the rewrite unchanged.',
    },
    {
      icon: Languages,
      title: 'Translate without drift',
      body: 'Send a quotation in Hindi or Marathi. Digits, ₹ symbols, dates and the quotation number come through byte-for-byte identical.',
    },
    {
      icon: Calculator,
      title: 'Command bar with a preview',
      body: '“Give 5% discount.” Invora classifies the instruction, recomputes the totals itself, and shows you a before-and-after diff to approve.',
    },
  ];

  return (
    <section id="ai" className="border-b border-border bg-navy-900 py-20 text-white">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 border-white/20 bg-white/5 text-white">
            The differentiator
          </Badge>
          <h2 className="text-balance font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            An assistant that drafts the words and never touches the numbers
          </h2>
          <p className="mt-4 text-pretty text-navy-300">
            Most AI billing tools let a language model produce a total. Invora does not. Prices,
            tax and discounts are computed by one tested module; the model only ever suggests
            wording — or a rate you have to click to accept.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {capabilities.map((capability) => (
            <article
              key={capability.title}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur"
            >
              <capability.icon className="h-5 w-5 text-emerald-400" />
              <h3 className="mt-3 text-base font-semibold">{capability.title}</h3>
              <p className="mt-1.5 text-sm text-navy-300">{capability.body}</p>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            What happens when you type “give 5% discount”
          </p>
          <ol className="mt-3 grid gap-3 text-sm text-navy-200 sm:grid-cols-3">
            <li className="rounded-lg bg-white/5 p-3">
              <span className="font-medium text-white">1. The model classifies.</span> It returns an
              intent and a percentage. No amounts.
            </li>
            <li className="rounded-lg bg-white/5 p-3">
              <span className="font-medium text-white">2. Invora computes.</span> The tested totals
              engine re-runs from your line items.
            </li>
            <li className="rounded-lg bg-white/5 p-3">
              <span className="font-medium text-white">3. You approve.</span> A diff shows the exact
              change to the total before anything is saved.
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function MoneySafety() {
  const guarantees = [
    {
      title: 'Integer paise, everywhere',
      body: 'No floating point anywhere near a total. Amounts are whole paise from the database to the PDF, so ₹0.01 never goes missing.',
    },
    {
      title: 'One calculation engine',
      body: 'The editor, the PDF and the payment page all read the same tested module. They cannot disagree about what you are owed.',
    },
    {
      title: 'Numbers drawn in the database',
      body: 'Quotation and invoice numbers come from a locking Postgres function, so two documents created at the same instant can never collide.',
    },
    {
      title: 'Paid means paid',
      body: 'Only a signature-verified Razorpay webhook can settle an invoice. A browser redirect shows a spinner and changes nothing.',
    },
  ];

  return (
    <section className="border-b border-border py-20">
      <div className="container">
        <SectionHeading
          eyebrow="Why you can trust the totals"
          title="The boring engineering that matters at month end"
          description="Billing software earns trust in the details nobody demos. Here are ours."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {guarantees.map((guarantee) => (
            <div key={guarantee.title} className="card-surface p-6">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Lock className="h-4 w-4 text-primary" />
                {guarantee.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{guarantee.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    { step: '01', title: 'Describe the job', body: 'One sentence, or start from your catalog.' },
    { step: '02', title: 'Review and send', body: 'Edit anything, then email it with the PDF attached.' },
    { step: '03', title: 'Client accepts online', body: 'No login. They type their name; you get an email.' },
    { step: '04', title: 'Convert and get paid', body: 'One click to invoice. Razorpay settles it.' },
  ];

  return (
    <section className="border-b border-border bg-muted/25 py-20">
      <div className="container">
        <SectionHeading
          eyebrow="How it works"
          title="Four steps, most of them one click"
          description="The whole loop, from brief to bank account."
        />

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <li key={item.step} className="card-surface relative p-6">
              <span className="text-xs font-bold tracking-widest text-primary">{item.step}</span>
              <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PricingPreview() {
  return (
    <section className="border-b border-border py-20">
      <div className="container">
        <SectionHeading
          eyebrow="Pricing"
          title="Free until it pays for itself"
          description="No credit card to start. No per-user pricing. No surprise metering."
        />

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-3">
          <div className="card-surface p-6">
            <h3 className="text-base font-semibold">Free</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your first 30 days, no card needed.</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight">₹0</p>
            <ul className="mt-5 space-y-2 text-sm">
              {['10 documents a month', '15 AI credits a month', 'Classic PDF template', 'Manual reminders'].map(
                (item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    {item}
                  </li>
                ),
              )}
            </ul>
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link href="/signup">Start free</Link>
            </Button>
          </div>

          <div className="card-surface relative border-primary/40 p-6">
            <Badge variant="neutral" className="absolute -top-2.5 right-5">Coming soon</Badge>
            <h3 className="text-base font-semibold">Premium — Monthly</h3>
            <p className="mt-1 text-sm text-muted-foreground">For a business that bills every week.</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight">
              ₹299<span className="text-base font-normal text-muted-foreground">/month</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                '500 documents a month',
                '500 AI credits a month',
                'Three branded templates',
                'Invora branding removed',
                'Scheduled reminders',
                'CSV import & export',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 w-full" variant="outline">
              <Link href="/pricing">See full comparison</Link>
            </Button>
          </div>

          <div className="card-surface relative p-6">
            <Badge variant="neutral" className="absolute -top-2.5 right-5">Coming soon</Badge>
            <h3 className="text-base font-semibold">Premium — Yearly</h3>
            <p className="mt-1 text-sm text-muted-foreground">Same Premium, billed once a year.</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight">
              ₹999<span className="text-base font-normal text-muted-foreground">/year</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                '500 documents a month',
                '500 AI credits a month',
                'Three branded templates',
                'Invora branding removed',
                'Scheduled reminders',
                'CSV import & export',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 w-full" variant="outline">
              <Link href="/pricing">See full comparison</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: 'Can the AI change my prices?',
    a: 'No. The model can suggest a rate only when you explicitly ask for pricing, and the suggestion appears as a chip you must click to accept. Every total, tax figure and discount is computed by Invora’s own tested calculation module — the model never writes into a money field.',
  },
  {
    q: 'Are the invoices GST-compliant?',
    a: 'Invora produces GST-ready tax invoices: your GSTIN and the customer’s, HSN/SAC per line, a tax breakup by rate that sums to the header total, and the amount in words. It is not a GST filing engine — your accountant still files the returns.',
  },
  {
    q: 'What happens to my documents if I downgrade?',
    a: 'Nothing is deleted, ever. If you drop back to the free plan, documents beyond the free allowance become read-only rather than disappearing, and you keep full access to your history.',
  },
  {
    q: 'How does the customer accept a quotation?',
    a: 'You send a private link. They open it in a browser with no account, review the quotation, and accept or decline by typing their name. Invora records the name, timestamp, IP and browser as an audit trail, and emails you immediately.',
  },
  {
    q: 'Which payment methods work?',
    a: 'Razorpay checkout on the public invoice page covers UPI, cards, net banking and wallets. You can also record cash, cheque or bank transfers by hand, including partial payments, and the balance updates automatically.',
  },
  {
    q: 'Who is behind Invora?',
    a: 'Invora is built and operated by Vertex Infotech. Payments are processed by Razorpay and the AI features run on Anthropic’s Claude models via our servers — your documents are never sent to a model from your browser.',
  },
];

function Faq() {
  return (
    <section id="faq" className="border-b border-border py-20">
      <div className="container">
        <SectionHeading eyebrow="FAQ" title="The questions people actually ask" />
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-border">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
                {faq.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="py-20">
      <div className="container">
        <div className="hero-glow relative overflow-hidden rounded-2xl border border-border px-6 py-14 text-center">
          <h2 className="text-balance font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            Send your first quotation in the next five minutes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Sign up, fill in your business details once, and describe a job. Invora does the rest.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/signup">
              Create your free account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-balance font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-3 text-pretty text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
