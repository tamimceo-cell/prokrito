/**
 * POST /api/pathao/sync — কুরিয়ারে থাকা অর্ডারের স্ট্যাটাস Pathao থেকে টেনে আনা
 *
 * ওয়েবহুক কোনো কারণে না এলে (Pathao-র দিকে বন্ধ, সাইট ডাউন ছিল) এটা
 * ভরসা। অ্যাডমিনের বোতাম থেকে চলে; Hostinger-এর ক্রন থেকেও ডাকা যায়:
 *   POST /api/pathao/sync   হেডার  x-cron-secret: <REVALIDATE_SECRET>
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { pathaoConfigured } from '@/lib/pathao';
import { ORDER_FOR_EVENT } from '@/lib/delivered';
import { syncOne } from '@/lib/pathao-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const cron = req.headers.get('x-cron-secret');
  const okCron = !!process.env.REVALIDATE_SECRET && cron === process.env.REVALIDATE_SECRET;
  if (!okCron && !(await requireAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  if (!pathaoConfigured()) return NextResponse.json({ ok: false, error: 'Pathao-র কি বসানো নেই' }, { status: 400 });

  const db = getDb();
  const { data: orders } = await db.from('orders')
    .select(`${ORDER_FOR_EVENT}, consignment_id`)
    .eq('courier', 'pathao').eq('status', 'courier').not('consignment_id', 'is', null)
    .order('courier_synced_at', { ascending: true, nullsFirst: true }).limit(100);

  let changed = 0; const errors: string[] = [];
  for (const o of orders || []) {
    try {
      const r = await syncOne(o as any);
      if (r) changed++;
    } catch (e) { errors.push(`#${o.order_no}: ${(e as Error).message}`); }
  }
  return NextResponse.json({ ok: true, checked: orders?.length || 0, changed, errors: errors.slice(0, 5) });
}
