import type { Metadata } from 'next';
import { requireBusiness } from '@/lib/guards/auth';
import { PageHeader } from '@/components/app/page-header';
import { CustomerForm } from '@/components/app/customer-form';

export const metadata: Metadata = { title: 'Add customer' };

export default async function NewCustomerPage() {
  await requireBusiness();

  return (
    <>
      <PageHeader
        title="Add customer"
        breadcrumbs={[{ href: '/customers', label: 'Customers' }, { label: 'New' }]}
      />
      <div className="max-w-3xl">
        <CustomerForm />
      </div>
    </>
  );
}
