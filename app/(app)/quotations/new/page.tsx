import type { Metadata } from 'next';

import { requireBusiness } from '@/lib/guards/auth';
import { getUsageSnapshot } from '@/lib/guards/quota';
import { PageHeader } from '@/components/app/page-header';
import { DocumentEditor } from '@/components/documents/document-editor';
import { blankEditorState, loadEditorOptions } from '@/lib/documents/editor-data';
import { QuotaWarning } from '@/components/app/quota-warning';

export const metadata: Metadata = { title: 'New quotation' };
export const dynamic = 'force-dynamic';

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ ai?: string }>;
}) {
  const { ai } = await searchParams;
  const { business } = await requireBusiness();
  const [{ customers, products }, usage] = await Promise.all([
    loadEditorOptions(),
    getUsageSnapshot(business.id),
  ]);

  const outOfQuota = usage.docsUsed >= usage.docLimit;

  return (
    <>
      <PageHeader
        title="New quotation"
        description="Fill it in yourself, or let the assistant draft it from a one-line brief."
        breadcrumbs={[{ href: '/quotations', label: 'Quotations' }, { label: 'New' }]}
      />

      {outOfQuota ? <QuotaWarning usage={usage} kind="documents" /> : null}

      <DocumentEditor
        docType="quotation"
        docId={null}
        initialState={blankEditorState(business, 'quotation')}
        customers={customers}
        products={products}
        defaultTaxRate={Number(business.default_tax_rate)}
        openAiOnMount={ai === '1'}
      />
    </>
  );
}
