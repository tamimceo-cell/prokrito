/** POST /api/steadfast/send — বাছাই করা অর্ডার কুরিয়ারে পাঠানো (অ্যাডমিন) */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createBulk, type ConsignmentInput } from '@/lib/steadfast';
import { requireAdmin } from '@/lib/auth';
import { site } from '@/config/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'অনুমতি নেই' }, { status: 401 });

  const { ids } = await req.json().catch(() => ({ ids: [] }));
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ ok: false, error: 'কোনো অর্ডার বাছাই করা হয়নি' }, { status: 400 });
  }

  const db = getDb();
  const { data: orders } = await db
    .from('orders')
    .select('id, order_no, name, phone, address, total, consignment_id, status')
    .in('id', ids);

  const pending = (orders || []).filter((o) => !o.consignment_id);
  if (!pending.length) {
    return NextResponse.json({ ok: false, error: 'সবগুলো আগেই পাঠানো হয়েছে' }, { status: 400 });
  }

  const payload: ConsignmentInput[] = pending.map((o) => ({
    invoice: String(o.order_no),
    recipientName: o.name,
    recipientPhone: o.phone,
    recipientAddress: o.address,
    codAmount: o.total,
    note: site.name,
  }));

  const res = await createBulk(payload);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 502 });

  let done = 0;
  for (const row of res.rows) {
    const o = pending.find((x) => String(x.order_no) === String(row.invoice));
    if (!o) continue;
    if (row.status === 'success' || row.consignment_id) {
      await db.from('orders').update({
        courier: 'steadfast',
        consignment_id: String(row.consignment_id ?? ''),
        tracking_code: row.tracking_code ?? null,
        courier_status: row.status ?? 'in_review',
        courier_synced_at: new Date().toISOString(),
        status: 'courier',
      }).eq('id', o.id);
      done++;
    }
  }

  await db.from('audit_log').insert({
    actor: admin.id, action: 'steadfast.send', entity: 'orders',
    detail: { count: done, ids },
  });

  return NextResponse.json({ ok: true, sent: done, total: pending.length });
}
