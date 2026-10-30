/** ব্যর্থ CAPI ইভেন্ট আবার পাঠানো */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { sendWithRetry } from '@/lib/capi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });

  const { ids } = await req.json().catch(() => ({ ids: [] }));
  const db = getDb();

  let q = db.from('capi_events').select('id, payload, attempts').eq('status', 'failed').limit(50);
  if (Array.isArray(ids) && ids.length) q = db.from('capi_events').select('id, payload, attempts').in('id', ids);

  const { data: rows } = await q;
  let sent = 0;

  for (const r of rows || []) {
    const res = await sendWithRetry([r.payload], 2);
    await db.from('capi_events').update({
      status: res.ok ? 'sent' : 'failed',
      attempts: (r.attempts || 0) + 1,
      response: (res.body ?? null) as any,
      error: res.error ?? null,
      sent_at: new Date().toISOString(),
    }).eq('id', r.id);
    if (res.ok) sent++;
  }

  return NextResponse.json({ ok: true, sent, tried: rows?.length ?? 0 });
}
