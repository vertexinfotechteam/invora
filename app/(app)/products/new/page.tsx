import type { Metadata } from 'next';
import { requireBusiness } from '@/lib/guards/auth';
import { PageHeader } from '@/components/app/page-header';
import { ProductForm } from '@/components/app/product-form';

export const metadata: Metadata = { title: 'Add catalog item' };

export default async function NewProductPage() {
  await requireBusiness();

  return (
    <>
      <PageHeader
        title="Add catalog item"
        breadcrumbs={[{ href: '/products', label: 'Catalog' }, { label: 'New' }]}
      />
      <div className="max-w-2xl">
        <ProductForm />
      </div>
    </>
  );
}
