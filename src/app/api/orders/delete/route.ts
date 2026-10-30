/**
 * POST /api/orders/delete — অর্ডার স্থায়ীভাবে মুছে ফেলা (অ্যাডমিন)
 *
 * সাবধানে ব্যবহার করুন। সাধারণ ক্ষেত্রে "বাতিল" করাই ঠিক — তাতে হিসাব
 * থেকে যায়। মুছে ফেলা শুধু টেস্ট অর্ডার বা স্পষ্ট ভুয়া অর্ডারের জন্য।
 *
 * order_items ও capi_events ডাটাবেজেই cascade হয়ে মুছে যায়।
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'অনুমতি নেই' }, { status: 401 });

  const { id, restock } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: 'ভুল অনুরোধ' }, { status: 400 });

  const db = getDb();

  const { data: order, error: readErr } = await db
    .from('orders').select('id, order_no, name, phone, total, status').eq('id', id).single();
  if (readErr || !order) {
    return NextResponse.json({ ok: false, error: 'অর্ডার পাওয়া যায়নি' }, { status: 404 });
  }

  // চাইলে স্টক ফেরত — যা কমানো হয়েছিল, ঠিক ততটাই
  let restored = 0;
  if (restock) {
    const { data: items } = await db
      .from('order_items').select('product_id, opt_key, color_key, qty').eq('order_id', id);
    for (const it of items || []) {
      // order_items-এ ভ্যারিয়েন্ট আইডি রাখা হয় না — প্রোডাক্ট ও বয়স দিয়ে খুঁজি
      if (!it.product_id || !it.opt_key) continue;
      // সাইজ ও রঙ দুটোই মিলিয়ে — নইলে অন্য রঙের ঘরে স্টক ফিরে যেত
      const { data: v } = await db
        .from('product_variants').select('id')
        .eq('product_id', it.product_id)
        .eq('opt_key', it.opt_key)
        .eq('color_key', it.color_key || '')
        .maybeSingle();
      if (!v) continue;
      // release_stock — ডাটাবেজের ভেতরেই যোগ, একই দৌড়ের ঝুঁকি এড়াতে
      await db.rpc('release_stock', { p_variant_id: v.id, p_qty: it.qty || 0 });
      restored += it.qty || 0;
    }
  }

  const { error } = await db.from('orders').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // মুছে ফেলার আগে অর্ডারটা কেমন ছিল, তার একটা ছাপ রেখে যাই
  await db.from('audit_log').insert({
    actor: admin.id, action: 'order.delete', entity: 'orders', entity_id: id,
    detail: {
      order_no: order.order_no, name: order.name, phone: order.phone,
      total: order.total, status: order.status, restocked: restored,
    },
  });

  if (restored) revalidateTag('catalog');
  return NextResponse.json({ ok: true, orderNo: order.order_no, restored });
}
