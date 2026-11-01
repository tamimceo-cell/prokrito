/** POST /api/pathao/customer — একটা ফোন নম্বরের ডেলিভারি ইতিহাস (অ্যাডমিন) */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { refreshCustomerRate, localPhone } from '@/lib/pathao';
import { normalizeBdPhone } from '@/lib/capi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const intl = normalizeBdPhone(String(b.phone || ''));
  if (!intl) return NextResponse.json({ ok: false, error: 'Enter a valid 11-digit number' }, { status: 400 });

  const [pathao, own] = await Promise.all([
    refreshCustomerRate(intl, !!b.force),
    getDb().from('orders').select('status').eq('phone', intl),
  ]);
  const rows = own.data || [];
  const { data: cached } = await getDb().from('customer_courier_stats').select('error').eq('phone', localPhone(intl)).maybeSingle();
  return NextResponse.json({
    ok: true,
    pathao,
    pathaoError: pathao ? null : cached?.error || 'Not found',
    own: {
      orders: rows.length,
      delivered: rows.filter((r) => r.status === 'delivered').length,
      returned: rows.filter((r) => r.status === 'returned').length,
      cancelled: rows.filter((r) => r.status === 'cancelled').length,
    },
  });
}
