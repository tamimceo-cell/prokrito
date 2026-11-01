import { getDb } from '@/lib/db';
import ProductManager from '@/components/ProductManager';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const db = getDb();
  const { data } = await db
    .from('products')
    .select('*, product_variants(id, opt_key, opt_label, color_key, color_label, color_hex, stock, sort)')
    .order('sort');

  const products = (data || []).map((p: any) => ({
    ...p,
    product_variants: (p.product_variants || []).sort((a: any, b: any) => a.sort - b.sort),
  })) as Product[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Products</h1>
        <p className="text-sm text-ink-3">
          Add products, change prices or stock — changes show on the site as soon as you save
        </p>
      </div>
      <ProductManager initial={products} />
    </div>
  );
}
