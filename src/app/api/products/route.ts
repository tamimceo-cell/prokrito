/** প্রোডাক্ট তৈরি / আপডেট / স্টক — অ্যাডমিন */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { site } from '@/config/site';
import { revalidateTag } from 'next/cache';
import { syncVariants, type VariantDb } from '@/lib/syncVariants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b?.action) return NextResponse.json({ ok: false, error: 'ভুল অনুরোধ' }, { status: 400 });

  const db = getDb();

  if (b.action === 'save') {
    const p = b.product;
    const row = {
      code: String(p.code || '').trim(),
      name: String(p.name || '').trim(),
      slug: String(p.slug || p.code || '').trim().toLowerCase(),
      category: p.category || site.categories[0]?.key || 'general',
      price: Number(p.price) || 0,
      compare_price: p.compare_price ? Number(p.compare_price) : null,
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      description: p.description || null,
      video_url: (p.video_url || '').trim() || null,
      active: p.active !== false,
      sort: Number(p.sort) || 0,
    };
    if (!row.code || !row.name || row.price <= 0) {
      return NextResponse.json({ ok: false, error: 'কোড, নাম ও দাম দিতে হবে।' }, { status: 400 });
    }

    const { data, error } = p.id
      ? await db.from('products').update(row).eq('id', p.id).select('id').single()
      : await db.from('products').insert(row).select('id').single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    // সুপাবেসের ক্লায়েন্টটা এখানে ছোট একটা ইন্টারফেস হিসেবে নেওয়া হয়,
    // যাতে syncVariants আলাদা করে নকল ডাটাবেস দিয়ে পরীক্ষা করা যায়
    const note = data
      ? await syncVariants(db as unknown as VariantDb, data.id, b.sizes, b.colors)
      : '';

    await db.from('audit_log').insert({
      actor: admin.id, action: p.id ? 'product.update' : 'product.create',
      entity: 'products', entity_id: data?.id, detail: { code: row.code, variants: note || null },
    });
    revalidateTag('catalog');
    return NextResponse.json({ ok: true, id: data?.id, note });
  }

  /** স্টক সরাসরি বসানো — "এখন কত আছে" জানা থাকলে */
  if (b.action === 'stock') {
    const { data, error } = await db.from('product_variants')
      .update({ stock: Math.max(0, Number(b.stock) || 0) })
      .eq('id', b.variantId).select('stock').single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    revalidateTag('catalog');
    return NextResponse.json({ ok: true, stock: data?.stock });
  }

  /**
   * স্টক যোগ/বিয়োগ — নতুন মাল এলে এটাই ব্যবহার করা উচিত।
   *
   * সরাসরি সংখ্যা বসানোর চেয়ে নিরাপদ: বসানোর সময় যদি একটা অর্ডার এসে
   * স্টক কমিয়ে দেয়, পুরনো সংখ্যাটা সেটাকে মুছে দিত — একটা বিক্রি হারিয়ে যেত।
   * যোগ করলে সেই ঝুঁকি নেই।
   */
  if (b.action === 'stockAdd') {
    const ids: string[] = Array.isArray(b.variantIds) ? b.variantIds : [b.variantId];
    const delta = Number(b.delta) || 0;
    if (!ids.length || !delta) {
      return NextResponse.json({ ok: false, error: `কোন ${site.words.optionAxis}ে কত যোগ হবে বলুন।` }, { status: 400 });
    }

    // ডাটাবেজের ভেতরেই যোগ-বিয়োগ (adjust_stock) — পড়া আর লেখা এক ধাপে।
    // আগে পড়ে-তারপর-লিখত; ঠিক সেই মুহূর্তে একটা অর্ডার এলে তার বিক্রিটা
    // মুছে যেত।
    const updated: Record<string, number> = {};
    const results = await Promise.all(ids.map(async (id) => {
      const { data, error } = await db.rpc('adjust_stock', { p_variant_id: id, p_delta: delta });
      return { id, data, error };
    }));

    for (const r of results) {
      if (r.error) return NextResponse.json({ ok: false, error: r.error.message }, { status: 400 });
      if (r.data !== null && r.data !== undefined) updated[r.id] = r.data as number;
    }

    await db.from('audit_log').insert({
      actor: admin.id, action: 'stock.add', entity: 'product_variants',
      detail: { delta, count: ids.length },
    });
    revalidateTag('catalog');
    return NextResponse.json({ ok: true, stocks: updated });
  }

  if (b.action === 'toggle') {
    const { error } = await db.from('products').update({ active: !!b.active }).eq('id', b.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    revalidateTag('catalog');
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'অজানা অনুরোধ' }, { status: 400 });
}
