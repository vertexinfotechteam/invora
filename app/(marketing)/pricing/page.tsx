import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Clock, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Invora pricing — free for your first 30 days, then Premium from ₹299/month or ₹999/year (coming soon).',
  alternates: { canonical: '/pricing' },
};

interface Row {
  label: string;
  free: string | boolean;
  premium: string | boolean;
  note?: string;
}

const ROWS: Row[] = [
  { label: 'Documents per month', free: '10', premium: '500' },
  // 7, matching the plan cards below, the homepage, the support-chat prompt and
  // the `free` row in 0007_seed_plans.sql. The comparison table said 15.
  { label: 'AI credits per month', free: '7', premium: '500', note: '1 credit = 1 successful AI request' },
  { label: 'Customers & catalog items', free: 'Unlimited', premium: 'Unlimited' },
  { label: 'PDF templates', free: 'Classic', premium: 'Classic, Modern, Minimal' },
  { label: 'Invora branding on PDF', free: 'Shown', premium: 'Removed' },
  { label: 'Public accept / decline links', free: true, premium: true },
  { label: 'Razorpay online payments', free: true, premium: true },
  { label: 'Manual payments & partial payments', free: true, premium: true },
  { label: 'GST tax breakup & amount in words', free: true, premium: true },
  { label: 'Payment reminders', free: 'Manual', premium: 'Scheduled automatically' },
  { label: 'CSV import & export', free: false, premium: true },
  { label: 'Reports & custom date ranges', free: 'Last 30 days', premium: 'Full history' },
  { label: 'Support', free: 'Standard email', premium: 'Priority channel' },
];

export default function PricingPage() {
  return (
    <>
      <section className="hero-glow border-b border-border py-16 md:py-20">
        <div className="container mx-auto max-w-2xl text-center">
          <h1 className="text-balance font-serif text-4xl font-medium tracking-tight sm:text-5xl">
            Pricing that waits until you are earning
          </h1>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Start free with real invoices — not a crippled trial. Move to Premium when the volume
            justifies it. Cancel any time and keep every document.
          </p>
        </div>
      </section>

      <section className="border-b border-border py-16">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
            <PlanCard
              name="Free"
              price="₹0"
              cadence="for your first 30 days"
              summary="Everything you need to send your first professional documents. No card required."
              cta={{ label: 'Start free', href: '/signup', variant: 'outline' as const }}
              highlights={[
                '10 documents a month',
                '7 AI credits a month',
                'Classic PDF template',
                'Online payments via Razorpay',
                'Public accept & decline links',
              ]}
              footnote="Auto-billing to Premium after your trial is coming soon — nothing is charged today."
            />
            <PlanCard
              name="Premium — Monthly"
              price="₹299"
              cadence="per month"
              summary="For a business sending quotations and invoices every week."
              featured
              comingSoon
              highlights={[
                '500 documents a month',
                '500 AI credits a month',
                'Three branded templates',
                'Invora branding removed',
                'Scheduled payment reminders',
                'CSV import & export',
                'Full reporting history',
                'Priority support',
              ]}
            />
            <PlanCard
              name="Premium — Yearly"
              price="₹999"
              cadence="per year"
              summary="The Monthly plan's features, billed once a year."
              comingSoon
              highlights={[
                '500 documents a month',
                '500 AI credits a month',
                'Three branded templates',
                'Invora branding removed',
                'Scheduled payment reminders',
                'CSV import & export',
                'Full reporting history',
                'Priority support',
              ]}
              footnote="Works out to less than ₹84/month."
            />
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
            Monthly and Yearly Premium are coming soon. Use the Free plan for now — you keep every
            document if you move to Premium later.
          </p>
        </div>
      </section>

      <section className="border-b border-border py-16">
        <div className="container">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Full comparison</h2>

          <div className="mx-auto mt-8 max-w-3xl overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="w-40 py-3 text-center font-medium">Free</th>
                  <th className="w-52 py-3 text-center font-medium">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="py-3 pr-4">
                      {row.label}
                      {row.note ? (
                        <span className="block text-xs text-muted-foreground">{row.note}</span>
                      ) : null}
                    </td>
                    <td className="py-3 text-center">
                      <Cell value={row.free} />
                    </td>
                    <td className="py-3 text-center">
                      <Cell value={row.premium} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
            Limits reset at the start of each billing period. Unused documents and credits do not
            roll over. If you exceed a limit, existing documents stay fully accessible — you are
            only blocked from creating new ones until the period resets or you upgrade.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto max-w-3xl space-y-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Billing questions</h2>
          {[
            {
              q: 'What counts as a document?',
              a: 'Creating a quotation or an invoice consumes one document from your monthly allowance. Editing, sending, duplicating a draft you already created, or converting an accepted quotation to an invoice each behave as you would expect: only the newly created invoice consumes an allowance.',
            },
            {
              q: 'What counts as an AI credit?',
              a: 'One successful AI request — generating a quotation, rewriting a passage, drafting a reminder, or interpreting a command. Failed requests, refusals and requests rejected for being too large are refunded automatically and never cost you a credit.',
            },
            {
              q: 'How do I cancel?',
              a: 'From Settings → Plan, at any time. Cancellation takes effect at the end of the period you have already paid for; you keep Premium until then, and afterwards your account reverts to the Free plan with all your data intact.',
            },
            {
              q: 'Do you offer refunds?',
              a: 'See our refunds and cancellation policy for the full terms.',
            },
          ].map((faq) => (
            <div key={faq.q} className="card-surface p-5">
              <h3 className="font-medium">{faq.q}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-success" aria-label="Included" />;
  if (value === false)
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="Not included" />;
  return <span className="text-muted-foreground">{value}</span>;
}

function PlanCard({
  name,
  price,
  cadence,
  summary,
  highlights,
  cta,
  featured,
  comingSoon,
  footnote,
}: {
  name: string;
  price: string;
  cadence: string;
  summary: string;
  highlights: string[];
  cta?: { label: string; href: string; variant: 'default' | 'outline' };
  featured?: boolean;
  comingSoon?: boolean;
  footnote?: string;
}) {
  return (
    <div
      className={`card-surface relative p-7 ${featured ? 'border-primary/40' : ''} ${comingSoon ? 'opacity-90' : ''}`}
    >
      {comingSoon ? (
        <Badge variant="neutral" className="absolute -top-2.5 right-6 gap-1">
          <Clock className="h-3 w-3" />
          Coming soon
        </Badge>
      ) : featured ? (
        <Badge className="absolute -top-2.5 right-6">Most popular</Badge>
      ) : null}
      <h2 className="text-lg font-semibold">{name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      <p className="mt-5 text-4xl font-semibold tracking-tight">{price}</p>
      <p className="text-sm text-muted-foreground">{cadence}</p>

      <ul className="mt-6 space-y-2.5 text-sm">
        {highlights.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            {item}
          </li>
        ))}
      </ul>

      {comingSoon ? (
        <Button disabled className="mt-7 w-full" variant="outline">
          Coming soon
        </Button>
      ) : cta ? (
        <Button asChild variant={cta.variant} className="mt-7 w-full">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      ) : null}
      {footnote ? <p className="mt-3 text-center text-xs text-muted-foreground">{footnote}</p> : null}
    </div>
  );
}
