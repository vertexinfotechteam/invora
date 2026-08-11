import type { Metadata } from 'next';

import { requireBusiness } from '@/lib/guards/auth';
import { getUsageSnapshot } from '@/lib/guards/quota';
import { PageHeader } from '@/components/app/page-header';
import { DocumentEditor } from '@/components/documents/document-editor';
import { QuotaWarning } from '@/components/app/quota-warning';
import { blankEditorState, loadEditorOptions } from '@/lib/documents/editor-data';

export const metadata: Metadata = { title: 'New invoice' };
export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const { business } = await requireBusiness();
  const [{ customers, products }, usage] = await Promise.all([
    loadEditorOptions(),
    getUsageSnapshot(business.id),
  ]);

  return (
    <>
      <PageHeader
        title="New invoice"
        description="Bill for work already delivered. Totals are computed as you type."
        breadcrumbs={[{ href: '/invoices', label: 'Invoices' }, { label: 'New' }]}
      />

      {usage.docsUsed >= usage.docLimit ? <QuotaWarning usage={usage} kind="documents" /> : null}

      <DocumentEditor
        docType="invoice"
        docId={null}
        initialState={blankEditorState(business, 'invoice')}
        customers={customers}
        products={products}
        defaultTaxRate={Number(business.default_tax_rate)}
      />
    </>
  );
}
