import { getDb } from '@/lib/db';
import ProductManager from '@/components/ProductManager';
import type { Product } from '@/lib/types';
import { site } from '@/config/site';

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
        <h1 className="font-display text-2xl font-extrabold">প্রোডাক্ট</h1>
        <p className="text-sm text-ink-3">
          নতুন {site.words.item} যোগ করুন, দাম বা স্টক বদলান — সেভ করলেই সাইটে দেখা যাবে
        </p>
      </div>
      <ProductManager initial={products} />
    </div>
  );
}
