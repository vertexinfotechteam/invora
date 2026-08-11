import type { Metadata } from 'next';
import { requireBusiness } from '@/lib/guards/auth';
import { hasFeature } from '@/lib/guards/features';
import { PageHeader } from '@/components/app/page-header';
import { CsvImporter } from '@/components/app/csv-importer';
import { UpgradePrompt } from '@/components/app/upgrade-prompt';

export const metadata: Metadata = { title: 'Import customers' };
export const dynamic = 'force-dynamic';

export default async function ImportCustomersPage() {
  const { business } = await requireBusiness();
  const allowed = await hasFeature(business.id, 'csv_import');

  return (
    <>
      <PageHeader
        title="Import customers"
        description="Bring your existing customer list across from a spreadsheet."
        breadcrumbs={[{ href: '/customers', label: 'Customers' }, { label: 'Import' }]}
      />

      {allowed ? (
        <div className="max-w-4xl">
          <CsvImporter />
        </div>
      ) : (
        <UpgradePrompt
          title="CSV import is a Premium feature"
          description="Upload a spreadsheet, map the columns, preview what will be created, and import hundreds of customers in one go — with a per-row error report for anything that does not validate."
        />
      )}
    </>
  );
}
