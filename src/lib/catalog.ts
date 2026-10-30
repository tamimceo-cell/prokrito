import { getDb } from './db';
import type { Product, Combo } from './types';
import { unstable_cache } from 'next/cache';

/**
 * ক্যাটালগ ক্যাশড — পেইজ প্রতি DB হিট হয় না।
 * অ্যাডমিনে কিছু বদলালে revalidateTag('catalog') দিয়ে নতুন করে তৈরি হয়।
 */
export const getProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const { data } = await getDb()
      .from('products')
      .select('*, product_variants(id, product_id, opt_key, opt_label, color_key, color_label, color_hex, stock, sort)')
      .eq('active', true)
      .order('sort');
    return (data || []).map((p: any) => ({
      ...p,
      product_variants: (p.product_variants || []).sort((a: any, b: any) => a.sort - b.sort),
    })) as Product[];
  },
  ['products'],
  { tags: ['catalog'], revalidate: 300 },
);

export const getCombos = unstable_cache(
  async (): Promise<Combo[]> => {
    const { data } = await getDb().from('combos').select('*').eq('active', true).order('sort');
    return (data || []) as Combo[];
  },
  ['combos'],
  { tags: ['catalog'], revalidate: 300 },
);

export const getSettings = unstable_cache(
  async () => {
    const { data } = await getDb().from('settings').select('key, value');
    const map = Object.fromEntries((data || []).map((r: any) => [r.key, r.value]));
    return {
      shipping: (map.shipping || { inside: 70, outside: 120 }) as { inside: number; outside: number },
      contact: (map.contact || {}) as Record<string, string>,
    };
  },
  ['settings'],
  { tags: ['catalog'], revalidate: 300 },
);

export const getProductByCode = async (code: string) =>
  (await getProducts()).find((p) => p.code.toLowerCase() === code.toLowerCase()) || null;
