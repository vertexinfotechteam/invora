import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Copy, Download, Trash2 } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listDocumentEvents } from '@/lib/events';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { StatusBadge } from '@/components/ui/badge';
import { DocumentEditor } from '@/components/documents/document-editor';
import { DocumentTimeline } from '@/components/documents/timeline';
import { ShareDialog } from '@/components/documents/share-dialog';
import { SendDialog } from '@/components/documents/send-dialog';
import { RecordPaymentDialog } from '@/components/documents/record-payment-dialog';
import { loadEditorOptions, toEditorState } from '@/lib/documents/editor-data';
import { deleteDraftAction, duplicateDocumentAction } from '@/app/(app)/actions';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Invoice' };
export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  const [{ data: invoice }, { data: items }, { data: payments }, { customers, products }] =
    await Promise.all([
      supabase.from('invoices').select('*, customers(name, company, email)').eq('id', id).maybeSingle(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position'),
      supabase.from('payments').select('*').eq('invoice_id', id).order('paid_at', { ascending: false }),
      loadEditorOptions(),
    ]);

  if (!invoice) notFound();

  const events = await listDocumentEvents('invoice', id);
  const customer = invoice.customers as unknown as { name?: string; company?: string; email?: string } | null;

  // Once money has been received against an invoice, the amounts are locked.
  // Correcting a paid invoice is a credit note, not an edit.
  const locked = invoice.amount_paid_paise > 0 || invoice.status === 'cancelled';

  return (
    <>
      <PageHeader
        title={invoice.number}
        description={`${customer?.company || customer?.name || 'No customer'} · ${formatPaise(invoice.total_paise, invoice.currency)}${
          invoice.due_date ? ` · due ${formatDate(invoice.due_date)}` : ''
        }`}
        breadcrumbs={[{ href: '/invoices', label: 'Invoices' }, { label: invoice.number }]}
        actions={
          <>
            <StatusBadge status={invoice.status} kind="invoice" />

            <Button asChild variant="outline" size="sm">
              <Link href={`/api/pdf/invoice/${id}?download=1`}>
                <Download className="h-4 w-4" />
                PDF
              </Link>
            </Button>

            <ShareDialog docType="invoice" docId={id} />

            <SendDialog
              docType="invoice"
              docId={id}
              docNumber={invoice.number}
              defaultTo={customer?.email ?? ''}
              businessName={business.name}
            />

            {invoice.balance_paise > 0 && invoice.status !== 'cancelled' ? (
              <RecordPaymentDialog
                invoiceId={id}
                balancePaise={invoice.balance_paise}
                currency={invoice.currency}
              />
            ) : null}

            <form action={duplicateDocumentAction.bind(null, 'invoice', id)}>
              <SubmitButton variant="ghost" size="sm">
                <Copy className="h-4 w-4" />
                Duplicate
              </SubmitButton>
            </form>

            {invoice.status === 'draft' ? (
              <form action={deleteDraftAction.bind(null, 'invoice', id)}>
                <SubmitButton variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      {locked ? (
        <div className="mb-5 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          {invoice.status === 'cancelled'
            ? 'This invoice has been cancelled and is read-only.'
            : 'A payment has been recorded against this invoice, so its amounts are locked. Duplicate it if you need to issue a corrected version.'}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <DocumentEditor
          docType="invoice"
          docId={id}
          initialState={toEditorState(invoice, items ?? [], 'invoice', Number(business.default_tax_rate))}
          customers={customers}
          products={products}
          defaultTaxRate={Number(business.default_tax_rate)}
          readOnly={locked}
        />

        <aside className="space-y-4">
          <section className="card-surface p-4">
            <h2 className="text-sm font-semibold">Payment</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Invoice total</dt>
                <dd className="tabular">{formatPaise(invoice.total_paise, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Received</dt>
                <dd className="tabular text-success">
                  {formatPaise(invoice.amount_paid_paise, invoice.currency)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <dt>Balance due</dt>
                <dd className="tabular">{formatPaise(invoice.balance_paise, invoice.currency)}</dd>
              </div>
            </dl>

            {payments?.length ? (
              <ul className="mt-4 space-y-2 border-t border-border pt-3">
                {payments.map((payment) => (
                  <li key={payment.id} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium tabular">
                        {formatPaise(payment.amount_paise, invoice.currency)}
                      </span>
                      <span className="text-muted-foreground">{formatDate(payment.paid_at)}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {payment.method.replace('_', ' ')}
                      {payment.source === 'razorpay' ? ' · Razorpay' : ''}
                      {payment.reference ? ` · ${payment.reference}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                No payments recorded yet.
              </p>
            )}
          </section>

          <DocumentTimeline events={events} />
        </aside>
      </div>
    </>
  );
}
