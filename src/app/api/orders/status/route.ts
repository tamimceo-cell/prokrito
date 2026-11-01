/** POST /api/orders/status — অর্ডারের অবস্থা বদলানো (অ্যাডমিন) */
import { NextResponse } from 'next/server';
import { getDb, sql } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OK = ['new', 'hold', 'confirmed', 'courier', 'delivered', 'returned', 'cancelled'];

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });

  const { id, status, note } = await req.json().catch(() => ({}));
  if (!id || !OK.includes(status)) {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  const db = getDb();
  const patch: Record<string, unknown> = { status };
  if (typeof note === 'string') patch.status_note = note;
  if (status === 'delivered') patch.delivered_at = new Date().toISOString();

  let { error } = await db.from('orders').update(patch).eq('id', id);
  /*
   * 'hold' পরে যোগ হয়েছে (নভেম্বর ২০২৬)। লাইভ ডাটাবেসের তালিকায় না থাকলে
   * MySQL "Data truncated" দেয় — তখন একবার তালিকাটা বাড়িয়ে আবার চেষ্টা।
   * শুধু যোগ করা হয়, আগের কোনো অবস্থা বা অর্ডার বদলায় না; দ্বিতীয়বার
   * আর দরকার পড়ে না। phpMyAdmin-এ হাতে চালানো লাগে না।
   */
  if (error && status === 'hold' && /truncated|incorrect|enum/i.test(error.message)) {
    await sql(`ALTER TABLE orders MODIFY status ENUM('new','hold','confirmed','courier','delivered','returned','cancelled') NOT NULL DEFAULT 'new'`);
    ({ error } = await db.from('orders').update(patch).eq('id', id));
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await db.from('audit_log').insert({
    actor: admin.id, action: 'order.status', entity: 'orders', entity_id: id, detail: { status },
  });
  return NextResponse.json({ ok: true });
}
