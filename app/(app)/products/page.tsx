import type { Metadata } from 'next';
import Link from 'next/link';
import { Package } from 'lucide-react';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatPaise, formatPercent } from '@/lib/money';

export const metadata: Metadata = { title: 'Catalog' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  let builder = supabase
    .from('products')
    .select('id, name, description, unit, default_price_paise, tax_rate, default_discount_pct, sku')
    .is('archived_at', null)
    .order('name')
    .limit(200);

  if (q) builder = builder.ilike('name', `%${q}%`);
  const { data, error } = await builder;
  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Catalog"
        description="The products and services you sell, so a line item is two keystrokes instead of twenty."
        actions={
          <Button asChild>
            <Link href="/products/new">Add item</Link>
          </Button>
        }
      />

      <form action="/products" className="mb-4 sm:max-w-xs">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search the catalog…"
          aria-label="Search catalog"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {error ? (
        <ErrorState description="We could not load your catalog." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6 text-accent-foreground" />}
          title={q ? 'Nothing matches that search' : 'Your catalog is empty'}
          description={
            q
              ? 'Try a different name.'
              : 'Add the things you sell most often. They then appear as a one-click fill in the line-item editor, and the AI assistant reuses your names and units.'
          }
          action={
            <Button asChild>
              <Link href="/products/new">Add your first item</Link>
            </Button>
          }
        />
      ) : (
        <div className="card-surface overflow-hidden">
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 text-right font-medium">Default rate</th>
                <th className="px-4 py-2.5 text-right font-medium">Tax</th>
                <th className="px-4 py-2.5 text-right font-medium">Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                      {product.name}
                    </Link>
                    {product.description ? (
                      <p className="max-w-md truncate text-xs text-muted-foreground">
                        {product.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{product.unit}</td>
                  <td className="px-4 py-3 text-right tabular">
                    {formatPaise(product.default_price_paise, business.currency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular text-muted-foreground">
                    {formatPercent(Number(product.tax_rate))}
                  </td>
                  <td className="px-4 py-3 text-right tabular text-muted-foreground">
                    {formatPercent(Number(product.default_discount_pct))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="divide-y divide-border md:hidden">
            {rows.map((product) => (
              <li key={product.id}>
                <Link href={`/products/${product.id}`} className="flex justify-between gap-3 px-4 py-3.5">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{product.name}</span>
                    <span className="text-xs text-muted-foreground">per {product.unit}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular">
                    {formatPaise(product.default_price_paise, business.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
