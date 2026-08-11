import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { ProductForm } from '@/components/app/product-form';

export const metadata: Metadata = { title: 'Catalog item' };
export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireBusiness();

  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).maybeSingle();

  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.name}
        breadcrumbs={[{ href: '/products', label: 'Catalog' }, { label: product.name }]}
      />
      <div className="max-w-2xl">
        <ProductForm product={product} />
      </div>
    </>
  );
}
