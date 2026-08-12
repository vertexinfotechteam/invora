import Link from 'next/link';
import { formatPaise, formatPercent, formatQty, amountInWordsIndian } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import type { PublicDocument } from '@/lib/share/public-document';
import type { TaxBucketRow } from '@/lib/types/database';

/**
 * The read-only document a customer sees. No app chrome, no navigation, no
 * account — just the document, its totals, and whatever action is available.
 */
export function PublicDocumentView({
  data,
  token,
  children,
}: {
  data: PublicDocument;
  token: string;
  children?: React.ReactNode;
}) {
  const { doc, items, business, customer, docType } = data;
  const isQuote = docType === 'quotation';
  const accent = business.brand_color || '#4F46E5';
  const secondaryDate = (isQuote ? doc.valid_until : doc.due_date) as string | null;
  const taxBreakup = (doc.tax_breakup as TaxBucketRow[]) ?? [];

  return (
    <div className="min-h-dvh bg-muted/40 pb-16">
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

      <div className="container max-w-3xl py-8">
        <article className="card-surface overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
            <div className="min-w-0">
              {business.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="mb-3 h-9 max-w-[180px] object-contain"
                />
              ) : null}
              <p className="text-base font-semibold">{business.legal_name || business.name}</p>
              <p className="text-xs text-muted-foreground">
                {[business.city, business.state].filter(Boolean).join(', ')}
              </p>
              {business.gstin ? (
                <p className="text-xs text-muted-foreground">GSTIN: {business.gstin}</p>
              ) : null}
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {isQuote ? 'Quotation' : business.gstin ? 'Tax Invoice' : 'Invoice'}
              </p>
              <p className="text-xl font-semibold" style={{ color: accent }}>
                {doc.number}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Issued {formatDate(doc.issue_date as string)}
              </p>
              {secondaryDate ? (
                <p className="text-xs text-muted-foreground">
                  {isQuote ? 'Valid until' : 'Due'} {formatDate(secondaryDate)}
                </p>
              ) : null}
            </div>
          </header>

          <div className="grid gap-4 border-b border-border p-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Prepared for
              </p>
              <p className="mt-1 font-medium">
                {customer?.company || customer?.name || 'Customer'}
              </p>
              {customer?.company && customer.name !== customer.company ? (
                <p className="text-sm text-muted-foreground">{customer.name}</p>
              ) : null}
            </div>

            {doc.title ? (
              <div className="sm:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Project
                </p>
                <p className="mt-1 font-medium">{String(doc.title)}</p>
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-2.5 font-medium">Description</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tax</th>
                  <th className="px-6 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, index) => (
                  <tr key={`${item.name}-${index}`}>
                    <td className="px-6 py-3">
                      <p className="font-medium">{item.name}</p>
                      {item.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular text-muted-foreground">
                      {formatQty(item.qty)} {item.unit}
                    </td>
                    <td className="px-3 py-3 text-right tabular">
                      {formatPaise(item.rate_paise, doc.currency)}
                    </td>
                    <td className="px-3 py-3 text-right tabular text-muted-foreground">
                      {formatPercent(item.tax_rate)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium tabular">
                      {formatPaise(item.line_total_paise, doc.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border p-6">
            <dl className="ml-auto max-w-xs space-y-2 text-sm">
              <Row
                // Inclusive mode: subtotal_paise is tax-exclusive, so it will
                // never equal the sum of the (tax-inclusive) per-line amounts
                // shown in the table above — labelled accordingly so it
                // doesn't read as a math error to the customer.
                label={doc.tax_mode === 'inclusive' ? 'Taxable value' : 'Subtotal'}
                value={formatPaise(doc.subtotal_paise as number, doc.currency)}
              />
              {(doc.discount_paise as number) > 0 ? (
                <Row
                  label="Discount"
                  value={`− ${formatPaise(doc.discount_paise as number, doc.currency)}`}
                />
              ) : null}
              {taxBreakup
                .filter((bucket) => bucket.taxPaise > 0)
                .map((bucket) => (
                  <Row
                    key={bucket.ratePct}
                    label={`Tax @ ${formatPercent(bucket.ratePct)}`}
                    value={formatPaise(bucket.taxPaise, doc.currency)}
                  />
                ))}

              <div
                className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-white"
                style={{ backgroundColor: accent }}
              >
                <dt className="font-semibold">Total</dt>
                <dd className="font-semibold tabular">
                  {formatPaise(doc.total_paise, doc.currency)}
                </dd>
              </div>

              {!isQuote && (doc.amount_paid_paise as number) > 0 ? (
                <>
                  <Row
                    label="Paid"
                    value={`− ${formatPaise(doc.amount_paid_paise as number, doc.currency)}`}
                  />
                  <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
                    <dt>Balance due</dt>
                    <dd className="tabular">
                      {formatPaise(doc.balance_paise as number, doc.currency)}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>

            <p className="mt-4 text-right text-xs text-muted-foreground">
              {amountInWordsIndian(doc.total_paise, doc.currency)}
            </p>
          </div>

          {[
            ['Scope of work', doc.scope],
            ['Deliverables', doc.deliverables],
            ['Exclusions', doc.exclusions],
            ['Payment terms', doc.payment_terms],
            ['Notes', doc.notes],
            ['Terms & conditions', doc.terms],
          ]
            .filter(([, body]) => typeof body === 'string' && body.trim().length > 0)
            .map(([label, body]) => (
              <section key={String(label)} className="border-t border-border p-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {String(label)}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm">{String(body)}</p>
              </section>
            ))}
        </article>

        {children}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>
            Questions? Reply to {business.email ?? 'the sender'}
            {business.phone ? ` or call ${business.phone}` : ''}.
          </p>
          <Link
            href={`/api/pdf/${docType}/${doc.id}?token=${encodeURIComponent(token)}&download=1`}
            className="rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Download PDF
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Sent with <span className="font-medium">Invora</span> by Vertex Infotech
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
