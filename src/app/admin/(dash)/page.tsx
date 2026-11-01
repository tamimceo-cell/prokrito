import Link from 'next/link';
import { getDb } from '@/lib/db';
import { num, money } from '@/lib/money';

export const dynamic = 'force-dynamic';

function Tile({ label, value, sub, tone = 'ink' }:
  { label: string; value: string; sub?: string; tone?: 'ink' | 'brand' | 'warn' | 'ok' }) {
  const colour = { ink: 'text-ink', brand: 'text-brand', warn: 'text-warn', ok: 'text-ok' }[tone];
  return (
    <div className="rounded-xl2 border border-line bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`mt-1.5 font-display text-3xl font-extrabold tabular-nums ${colour}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

export default async function Dashboard() {
  const db = getDb();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 864e5);

  const [todayRes, weekRes, newRes, holdRes, failRes, lowRes, campRes] = await Promise.all([
    db.from('orders').select('total, status').gte('created_at', today.toISOString()),
    db.from('orders').select('total, status').gte('created_at', weekAgo.toISOString()),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'hold'),
    db.from('capi_events').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    db.from('product_variants').select('id, stock, opt_label, color_label, products(code, name)').lte('stock', 3).order('stock'),
    db.from('campaign_stats').select('*').order('orders', { ascending: false }).limit(8),
  ]);

  const t = (todayRes.data || []) as Row[];
  const w = (weekRes.data || []) as Row[];
  type Row = { total: number; status: string };
  const valid = (r: Row[]) => r.filter((x) => x.status !== 'cancelled');
  const delivered = (r: Row[]) => r.filter((x) => x.status === 'delivered');
  const returned = (r: Row[]) => r.filter((x) => x.status === 'returned');

  const weekSettled = delivered(w).length + returned(w).length;
  const deliveryRate = weekSettled ? Math.round((delivered(w).length / weekSettled) * 100) : null;
  const confirmRate = w.length ? Math.round((valid(w).length / w.length) * 100) : null;
  const failed = failRes.count ?? 0;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Dashboard</h1>
        <p className="text-sm text-ink-3">Today, and the last 7 days</p>
      </div>

      {failed > 0 && (
        <div className="rounded-xl2 border border-warn/40 bg-warn/10 p-4 text-sm">
          <b className="text-warn">{num(failed)} pixel event(s) did not reach Meta.</b>{' '}
          Until they are resent, those orders won't show in ad reports.{' '}
          <Link href="/admin/events" className="font-semibold underline">View and resend</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Orders today" value={num(t.length)}
          sub={`${num(newRes.count ?? 0)} new to call${holdRes.count ? `, ${num(holdRes.count)} on hold` : ''}`} tone="brand" />
        <Tile label="Expected revenue today" value={money(valid(t).reduce((a, x) => a + x.total, 0))}
          sub="Excluding cancelled" />
        <Tile label="Confirm rate (7 days)"
          value={confirmRate === null ? '—' : confirmRate + '%'}
          sub="How many orders are genuine" tone={confirmRate !== null && confirmRate < 70 ? 'warn' : 'ok'} />
        <Tile label="Delivery rate (7 days)"
          value={deliveryRate === null ? '—' : deliveryRate + '%'}
          sub={weekSettled ? `${num(weekSettled)} settled` : 'Not enough data yet'}
          tone={deliveryRate !== null && deliveryRate < 60 ? 'warn' : 'ok'} />
      </div>

      <section className="rounded-xl2 border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold">By campaign</h2>
        <p className="mb-4 text-sm text-ink-3">
          Which ad sets bring orders that actually get delivered — the real profit picture
        </p>
        {!campRes.data?.length ? (
          <p className="py-6 text-center text-sm text-ink-3">No campaign data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="pb-2">Campaign</th><th className="pb-2">Ad set</th>
                  <th className="pb-2 text-right">Orders</th><th className="pb-2 text-right">Delivered</th>
                  <th className="pb-2 text-right">Returned</th><th className="pb-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {campRes.data.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className="py-2.5 font-medium">{c.campaign}</td>
                    <td className="py-2.5 text-ink-2">{c.adset}</td>
                    <td className="py-2.5 text-right tabular-nums">{num(c.orders)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ok">{num(c.delivered)}</td>
                    <td className="py-2.5 text-right tabular-nums text-warn">{num(c.returned)}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{money(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl2 border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold">Low stock</h2>
        <p className="mb-4 text-sm text-ink-3">Items with 3 pcs or fewer left</p>
        {!lowRes.data?.length ? (
          <p className="py-6 text-center text-sm text-ink-3">Stock is fine everywhere.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {lowRes.data.map((v: any) => (
              <li key={v.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <b>{v.products?.name}</b>{' '}
                  <span className="text-ink-3">
                    ({v.products?.code} · {v.opt_label}{v.color_label ? ` · ${v.color_label}` : ''})
                  </span>
                </span>
                <span className={`font-semibold tabular-nums ${v.stock === 0 ? 'text-pinkc' : 'text-warn'}`}>
                  {v.stock === 0 ? 'Out of stock' : num(v.stock) + ' pcs'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
