import type { Metadata } from 'next';
import Link from 'next/link';
import { Calculator, Languages, PauseCircle, Shield, Sparkles, Wand2 } from 'lucide-react';

import { AI_ENABLED } from '@/lib/ai/enabled';

import { requireBusiness } from '@/lib/guards/auth';
import { getUsageSnapshot } from '@/lib/guards/quota';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PageHeader, StatCard } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageDrafter } from '@/components/app/message-drafter';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'AI Assistant' };
export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const { business } = await requireBusiness();
  const admin = createSupabaseAdminClient();

  // The rewrite, translate and command-bar tools live *inside* a document, so
  // the cards below need a real document to open. Pointing them at the list
  // pages meant "Open a document →" landed you on a list — or, with nothing
  // saved yet, on an empty state — which reads as the feature being broken.
  const [usage, { data: logs }, { data: latestQuotation }, { data: latestInvoice }] =
    await Promise.all([
      getUsageSnapshot(business.id),
      admin
        .from('ai_usage_logs')
        .select('feature, model, status, latency_ms, created_at, credit_charged')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(15),
      admin
        .from('quotations')
        .select('id')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('invoices')
        .select('id')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const quotationHref = latestQuotation ? `/quotations/${latestQuotation.id}` : '/quotations/new';
  const quotationCta = latestQuotation ? 'Open your latest quotation' : 'Create a quotation first';
  const invoiceHref = latestInvoice ? `/invoices/${latestInvoice.id}` : '/invoices/new';
  const invoiceCta = latestInvoice ? 'Open your latest invoice' : 'Create an invoice first';

  const remaining = Math.max(0, usage.aiCreditLimit - usage.aiCreditsUsed);

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Drafting help for the words. The numbers stay with Invora."
        actions={
          AI_ENABLED ? (
            <Button asChild>
              <Link href="/quotations/new?ai=1">
                <Sparkles className="h-4 w-4" />
                Generate a quotation
              </Link>
            </Button>
          ) : null
        }
      />

      {!AI_ENABLED ? (
        <div className="card-surface mb-6 flex items-start gap-3 border-warning/30 bg-warning/[0.06] p-4 text-sm">
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <strong className="font-medium">AI features are paused.</strong> Quotation generation,
            rewrite, translate and the command bar are switched off for now — every other part of
            Invora works as usual, and no AI credits are being spent.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Credits remaining"
          value={remaining.toLocaleString()}
          hint={`of ${usage.aiCreditLimit.toLocaleString()} this period`}
          tone={remaining === 0 ? 'danger' : remaining < usage.aiCreditLimit * 0.2 ? 'warning' : 'default'}
        />
        <StatCard
          label="Used this period"
          value={usage.aiCreditsUsed.toLocaleString()}
          hint="Failures are refunded automatically"
        />
        <StatCard label="Plan" value={usage.planCode === 'free' ? 'Starter' : 'Premium'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card-surface p-5">
            <h2 className="text-sm font-semibold">What the assistant does</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Sparkles,
                  title: 'Generate a quotation',
                  body: 'A one-line brief becomes line items, scope, deliverables, exclusions, assumptions and terms.',
                  href: '/quotations/new?ai=1',
                  cta: 'Open the editor',
                },
                {
                  icon: Wand2,
                  title: 'Rewrite any passage',
                  body: 'Professionalize, shorten, expand or fix grammar — with a before-and-after diff. Use the Rewrite button beside any long field.',
                  href: quotationHref,
                  cta: quotationCta,
                },
                {
                  icon: Languages,
                  title: 'Translate a document',
                  body: 'Send in Hindi, Marathi or Gujarati. Numbers, dates and references stay identical. Pick Translate from the same Rewrite button.',
                  href: quotationHref,
                  cta: quotationCta,
                },
                {
                  icon: Calculator,
                  title: 'Command bar edits',
                  body: '“Give 5% discount.” Invora recomputes the totals and shows a diff before applying. The command bar sits above the line items.',
                  href: invoiceHref,
                  cta: invoiceCta,
                },
              ].map((item) => (
                <article
                  key={item.title}
                  className={`rounded-lg border border-border p-4${AI_ENABLED ? '' : ' opacity-60'}`}
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  <h3 className="mt-2 text-sm font-medium">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                  {/* Paused: the description stays so people know what is
                      coming back, but the link goes — it would lead to a
                      control that is no longer rendered. */}
                  {AI_ENABLED ? (
                    <Link
                      href={item.href}
                      className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {item.cta} →
                    </Link>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      Paused for now
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <MessageDrafter />
        </div>

        <aside className="space-y-4">
          <section className="card-surface border-primary/25 bg-accent/40 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
              <Shield className="h-4 w-4" />
              What it will not do
            </h2>
            <ul className="mt-3 space-y-2 text-xs text-accent-foreground/90">
              <li>
                <strong>It never sets a price.</strong> Rates are suggested only when you ask, and
                appear as a chip you click to accept.
              </li>
              <li>
                <strong>It never computes a total.</strong> Subtotals, tax and discounts come from
                Invora&apos;s own tested engine.
              </li>
              <li>
                <strong>It never changes a document silently.</strong> Anything touching money shows
                a before-and-after diff first.
              </li>
              <li>
                <strong>It never talks to your browser.</strong> Every request runs on our servers,
                so the API key is never shipped to a client.
              </li>
            </ul>
          </section>

          <section className="card-surface overflow-hidden">
            <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Recent requests</h2>
            {logs?.length ? (
              <ul className="divide-y divide-border">
                {logs.map((log, index) => (
                  <li key={`${log.created_at}-${index}`} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm capitalize">
                        {log.feature.replace(/_/g, ' ')}
                      </span>
                      <Badge variant={log.status === 'ok' ? 'success' : 'neutral'}>
                        {log.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(log.created_at)} · {log.latency_ms} ms
                      {log.credit_charged ? '' : ' · refunded'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Nothing yet. Every request — including failures — is logged here.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
