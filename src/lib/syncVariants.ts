/**
 * প্রোডাক্টের সাইজ ও রঙ থেকে স্টকের ঘরগুলো মিলিয়ে দেওয়া।
 *
 * আলাদা ফাইলে রাখা হয়েছে কারণ এটাই একমাত্র জায়গা যেখানে স্টকের ঘর
 * *মুছে* যায় — তাই এটুকু আলাদা করে পরীক্ষা করা যায়।
 */
import { bn } from './money';
import { site } from '@/config/site';

/** সুপাবেস ক্লায়েন্টের যে টুকুটা এখানে লাগে (পরীক্ষায় নকল বসানো যায়) */
export interface VariantDb {
  from(table: 'product_variants'): {
    select(cols: string): { eq(col: string, val: string): PromiseLike<{ data: VariantRow[] | null }> };
    insert(rows: Record<string, unknown>[]): PromiseLike<unknown>;
    update(patch: Record<string, unknown>): { eq(col: string, val: string): PromiseLike<unknown> };
    delete(): { in(col: string, vals: string[]): PromiseLike<unknown> };
  };
}
interface VariantRow { id: string; opt_key: string; color_key: string | null }

export interface AxisIn { key?: string; label?: string; hex?: string }

const clean = (x: unknown) => String(x ?? '').trim();

/**
 * প্রোডাক্টের সাইজ ও রঙ থেকে স্টকের ঘরগুলো মিলিয়ে দেওয়া।
 *
 * অ্যাডমিন প্যানেল দুটো তালিকা পাঠায় — সাইজ আর রঙ। ডাটাবেসে বসে তাদের
 * সব জোড়া: ৩ সাইজ × ২ রঙ = ৬টি ঘর। জোড়াগুলো ক্লায়েন্ট বানায় না,
 * এখানেই গুণ করা হয় — নইলে ব্রাউজার থেকে ইচ্ছেমতো ঘর পাঠানো যেত।
 *
 * পুরনো ঘরগুলো চাবি দিয়ে চেনা হয়, তাই নাম বদলালেও স্টক জায়গামতো থাকে।
 * শুধু নামটাই আপডেট হয়। তালিকা থেকে বাদ পড়া ঘর মুছে যায় — সেটা
 * ইচ্ছাকৃত, নইলে "৪৬ সাইজ আর রাখব না" বলার কোনো উপায় থাকত না।
 *
 * পুরনো অর্ডারে এর কোনো প্রভাব নেই: order_items সাইজ-রঙ *নাম হিসেবে*
 * নিজের ভেতরেই রাখে, ভ্যারিয়েন্টের আইডি ধরে রাখে না।
 */
export async function syncVariants(db: VariantDb, productId: string, sizesIn: AxisIn[], colorsIn: AxisIn[]) {
  // সাইজ না দিলে একটাই অদৃশ্য ঘর — পণ্যের সাইজ নেই, শুধু স্টক রাখার জায়গা
  const sizes = (Array.isArray(sizesIn) ? sizesIn : [])
    .map((v) => ({ key: clean(v.key), label: clean(v.label) }))
    .filter((v) => v.key && v.label);
  const useSizes = sizes.length ? sizes : [{ key: 'one', label: site.options.singleLabel }];

  // রঙ না দিলে খালি চাবি — প্রোডাক্ট পেইজে রঙ বাছার ঘরটাই উঠবে না
  const colors = (Array.isArray(colorsIn) ? colorsIn : [])
    .map((c) => ({ key: clean(c.key), label: clean(c.label), hex: clean(c.hex) || null }))
    .filter((c) => c.key && c.label);
  const useColors = colors.length ? colors : [{ key: '', label: null as string | null, hex: null }];

  const want = useSizes.flatMap((s, si) =>
    useColors.map((c, ci) => ({
      product_id: productId,
      opt_key: s.key, opt_label: s.label,
      color_key: c.key, color_label: c.label, color_hex: c.hex,
      // সাইজ বাইরের ক্রম, রঙ ভেতরের — অ্যাডমিন প্যানেলে রঙ ধরে ধরে সাজাতে সুবিধা
      sort: si * 100 + ci,
    })),
  );

  const { data: have } = await db.from('product_variants')
    .select('id, opt_key, color_key').eq('product_id', productId);

  const idOf = (opt: string, col: string) => `${opt}\u0000${col}`;
  const existing = new Map((have || []).map((v) => [idOf(v.opt_key, v.color_key || ''), v.id]));

  const fresh = want.filter((w) => !existing.has(idOf(w.opt_key, w.color_key)));
  if (fresh.length) await db.from('product_variants').insert(fresh.map((w) => ({ ...w, stock: 0 })));

  // নাম বা ক্রম বদলালে সেটুকুই আপডেট — স্টকে হাত পড়ে না
  await Promise.all(want
    .filter((w) => existing.has(idOf(w.opt_key, w.color_key)))
    .map((w) => db.from('product_variants')
      .update({ opt_label: w.opt_label, color_label: w.color_label, color_hex: w.color_hex, sort: w.sort })
      .eq('id', existing.get(idOf(w.opt_key, w.color_key))!)));

  const keep = new Set(want.map((w) => idOf(w.opt_key, w.color_key)));
  const gone = (have || []).filter((v) => !keep.has(idOf(v.opt_key, v.color_key || ''))).map((v) => v.id);
  if (gone.length) await db.from('product_variants').delete().in('id', gone);

  const bits = [];
  if (fresh.length) bits.push(`${bn(fresh.length)}টি নতুন ঘর`);
  if (gone.length) bits.push(`${bn(gone.length)}টি বাদ`);
  return bits.join(', ');
}
