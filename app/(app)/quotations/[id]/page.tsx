import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Copy, FileOutput, Share2, Trash2 } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listDocumentEvents } from '@/lib/events';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { StatusBadge } from '@/components/ui/badge';
import { DocumentEditor } from '@/components/documents/document-editor';
import { DocumentTimeline } from '@/components/documents/timeline';
import { DownloadMenu } from '@/components/documents/download-menu';
import { ShareDialog } from '@/components/documents/share-dialog';
import { SendDialog } from '@/components/documents/send-dialog';
import { loadEditorOptions, toEditorState } from '@/lib/documents/editor-data';
import { convertQuotationAction, deleteDraftAction, duplicateDocumentAction } from '@/app/(app)/actions';
import { formatPaise } from '@/lib/money';
import { buildChecks } from '@/components/app/profile-completeness';

export const metadata: Metadata = { title: 'Quotation' };
export const dynamic = 'force-dynamic';

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  const [{ data: quote }, { data: items }, { customers, products }] = await Promise.all([
    supabase.from('quotations').select('*, customers(name, company, email)').eq('id', id).maybeSingle(),
    supabase.from('quotation_items').select('*').eq('quotation_id', id).order('position'),
    loadEditorOptions(),
  ]);

  if (!quote) notFound();

  const missingLabels = buildChecks(business)
    .filter((check) => !check.done)
    .map((check) => check.label);

  const events = await listDocumentEvents('quotation', id);
  const customer = quote.customers as unknown as { name?: string; company?: string; email?: string } | null;

  // Accepted / declined / expired quotations are historical records — the
  // editor renders read-only rather than pretending they can still change.
  const readOnly = ['accepted', 'rejected', 'expired'].includes(quote.status);

  return (
    <>
      <PageHeader
        title={quote.number}
        description={`${customer?.company || customer?.name || 'No customer'} · ${formatPaise(quote.total_paise, quote.currency)}`}
        breadcrumbs={[{ href: '/quotations', label: 'Quotations' }, { label: quote.number }]}
        actions={
          <>
            <StatusBadge status={quote.status} kind="quotation" />

            <DownloadMenu docType="quotation" docId={id} missingLabels={missingLabels} />

            <ShareDialog docType="quotation" docId={id} />

            <SendDialog
              docType="quotation"
              docId={id}
              docNumber={quote.number}
              defaultTo={customer?.email ?? ''}
              businessName={business.name}
            />

            {quote.status === 'accepted' && !quote.converted_invoice_id ? (
              <form action={convertQuotationAction.bind(null, id)}>
                <SubmitButton size="sm">
                  <FileOutput className="h-4 w-4" />
                  Convert to invoice
                </SubmitButton>
              </form>
            ) : null}

            {quote.converted_invoice_id ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/invoices/${quote.converted_invoice_id}`}>View invoice</Link>
              </Button>
            ) : null}

            <form action={duplicateDocumentAction.bind(null, 'quotation', id)}>
              <SubmitButton variant="ghost" size="sm">
                <Copy className="h-4 w-4" />
                Duplicate
              </SubmitButton>
            </form>

            {quote.status === 'draft' ? (
              <form action={deleteDraftAction.bind(null, 'quotation', id)}>
                <SubmitButton variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      {readOnly ? (
        <div className="mb-5 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          This quotation has been {quote.status === 'expired' ? 'marked expired' : quote.status} and
          is now read-only. Duplicate it if you need to send a revised version.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <DocumentEditor
          docType="quotation"
          docId={id}
          initialState={toEditorState(quote, items ?? [], 'quotation', Number(business.default_tax_rate))}
          customers={customers}
          products={products}
          defaultTaxRate={Number(business.default_tax_rate)}
          readOnly={readOnly}
        />

        <aside className="space-y-4">
          {quote.accepted_by_name ? (
            <div className="card-surface border-success/30 bg-success/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-success">
                Acceptance record
              </p>
              <p className="mt-1.5 text-sm">
                Signed as <strong>{quote.accepted_by_name}</strong>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded with timestamp, IP address and browser for your audit trail.
              </p>
            </div>
          ) : null}

          <DocumentTimeline events={events} />
        </aside>
      </div>
    </>
  );
}
