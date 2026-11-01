/** POST /api/pathao/send — বাছাই করা অর্ডার Pathao-তে পাঠানো (অ্যাডমিন) */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { createPathaoOrder, pathaoConfigured } from '@/lib/pathao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'Not allowed' }, { status: 401 });
  if (!pathaoConfigured()) {
    return NextResponse.json({ ok: false, error: 'Pathao API keys are not set in Hostinger.' }, { status: 400 });
  }

  const { ids } = await req.json().catch(() => ({ ids: [] }));
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ ok: false, error: 'No orders selected' }, { status: 400 });
  }

  const db = getDb();
  const { data: orders } = await db
    .from('orders')
    .select('id, order_no, name, phone, address, total, note, consignment_id, status, order_items(product_name, qty)')
    .in('id', ids);

  // বাতিল বা আগে পাঠানো অর্ডার আবার যাবে না
  const pending = (orders || []).filter((o) => !o.consignment_id && !['cancelled', 'delivered', 'returned', 'hold'].includes(o.status));
  if (!pending.length) {
    return NextResponse.json({ ok: false, error: 'The selected orders are already sent, on hold or cancelled' }, { status: 400 });
  }

  /*
   * একটা একটা করে পাঠাই, বাল্ক নয়। Pathao-র বাল্ক API সাথে সাথে
   * কনসাইনমেন্ট নম্বর দেয় না ("পরে তৈরি হবে") — তখন কোন অর্ডার কোন
   * পার্সেল, মেলানো যায় না, আর স্ট্যাটাস আপডেটও আসে না।
   */
  const failed: string[] = [];
  let sent = 0;
  for (const o of pending) {
    const items = (o.order_items || []) as { product_name: string; qty: number }[];
    try {
      const r = await createPathaoOrder({
        orderNo: o.order_no, name: o.name, phone: o.phone, address: o.address,
        amount: o.total,
        qty: 1, // এক অর্ডার = এক প্যাকেট
        description: items.map((i) => `${i.product_name} × ${i.qty}`).join(', '),
        note: o.note || undefined,
      });
      await db.from('orders').update({
        courier: 'pathao', consignment_id: r.consignmentId, tracking_code: r.consignmentId,
        courier_status: r.status, courier_fee: r.fee, courier_synced_at: new Date().toISOString(),
        status: 'courier',
      }).eq('id', o.id);
      sent++;
    } catch (e) {
      failed.push(`#${o.order_no}: ${(e as Error).message}`);
    }
  }

  await db.from('audit_log').insert({
    actor: admin.id, action: 'pathao.send', entity: 'orders', detail: { sent, failed, ids },
  });

  return NextResponse.json({ ok: sent > 0, sent, total: pending.length, failed, error: sent ? undefined : failed[0] });
}
