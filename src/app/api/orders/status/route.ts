/** POST /api/orders/status — অর্ডারের অবস্থা বদলানো (অ্যাডমিন) */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OK = ['new', 'confirmed', 'courier', 'delivered', 'returned', 'cancelled'];

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });

  const { id, status, note } = await req.json().catch(() => ({}));
  if (!id || !OK.includes(status)) {
    return NextResponse.json({ ok: false, error: 'ভুল অনুরোধ' }, { status: 400 });
  }

  const db = getDb();
  const patch: Record<string, unknown> = { status };
  if (typeof note === 'string') patch.status_note = note;
  if (status === 'delivered') patch.delivered_at = new Date().toISOString();

  const { error } = await db.from('orders').update(patch).eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await db.from('audit_log').insert({
    actor: admin.id, action: 'order.status', entity: 'orders', entity_id: id, detail: { status },
  });
  return NextResponse.json({ ok: true });
}
