/** POST /api/orders/status — অর্ডারের অবস্থা বদলানো (অ্যাডমিন) */
import { NextResponse } from 'next/server';
import { getDb, sql } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * 'hold' পরে যোগ হয়েছে (নভেম্বর ২০২৬)। লাইভ ডাটাবেসের ENUM-এ না থাকলে
 * Hostinger-এর MySQL ভুল দেয় না, চুপচাপ ফাঁকা ('') বসিয়ে দেয় — প্রথম
 * হোল্ডে ঠিক তাই হয়েছিল (#19826)। তাই অবস্থা বদলানোর আগে একবার দেখে
 * নিই তালিকায় 'hold' আছে কিনা; না থাকলে যোগ করি। শুধু যোগ, আগের কিছু
 * বদলায় না। ফাঁকা অবস্থার অর্ডার (ওই ঘটনার) 'new'-এ ফেরত।
 * প্রতি সার্ভার-চালুতে একবারই চলে।
 */
let holdReady = false;
async function ensureHoldStatus() {
  if (holdReady) return;
  const [col] = await sql<{ t: string }>(
    `SELECT COLUMN_TYPE t FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'status'`);
  if (!String(col?.t || '').includes("'hold'")) {
    await sql(`ALTER TABLE orders MODIFY status ENUM('new','hold','confirmed','courier','delivered','returned','cancelled') NOT NULL DEFAULT 'new'`);
  }
  await sql(`UPDATE orders SET status = 'new' WHERE status = ''`);
  holdReady = true;
}

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

  await ensureHoldStatus();
  const { error } = await db.from('orders').update(patch).eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await db.from('audit_log').insert({
    actor: admin.id, action: 'order.status', entity: 'orders', entity_id: id, detail: { status },
  });
  return NextResponse.json({ ok: true });
}
