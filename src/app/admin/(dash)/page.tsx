import Link from 'next/link';
import { getDb } from '@/lib/db';
import { bn, tk } from '@/lib/money';

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

  const [todayRes, weekRes, newRes, failRes, lowRes, campRes] = await Promise.all([
    db.from('orders').select('total, status').gte('created_at', today.toISOString()),
    db.from('orders').select('total, status').gte('created_at', weekAgo.toISOString()),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'new'),
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
        <h1 className="font-display text-2xl font-extrabold">ড্যাশবোর্ড</h1>
        <p className="text-sm text-ink-3">আজকের অবস্থা ও গত ৭ দিনের হিসাব</p>
      </div>

      {failed > 0 && (
        <div className="rounded-xl2 border border-warn/40 bg-warn/10 p-4 text-sm">
          <b className="text-warn">{bn(failed)}টি পিক্সেল ইভেন্ট Meta-তে পৌঁছায়নি।</b>{' '}
          এগুলো না পাঠালে ওই অর্ডারগুলো অ্যাড রিপোর্টে দেখা যাবে না।{' '}
          <Link href="/admin/events" className="font-semibold underline">দেখুন ও আবার পাঠান</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="আজকের অর্ডার" value={bn(t.length)}
          sub={`নতুন ${bn(newRes.count ?? 0)}টি কল করা বাকি`} tone="brand" />
        <Tile label="আজকের সম্ভাব্য টাকা" value={tk(valid(t).reduce((a, x) => a + x.total, 0))}
          sub="বাতিল বাদে" />
        <Tile label="কনফার্ম রেট (৭ দিন)"
          value={confirmRate === null ? '—' : bn(confirmRate) + '%'}
          sub="ফেক অর্ডার কতটা আসছে" tone={confirmRate !== null && confirmRate < 70 ? 'warn' : 'ok'} />
        <Tile label="ডেলিভারি রেট (৭ দিন)"
          value={deliveryRate === null ? '—' : bn(deliveryRate) + '%'}
          sub={weekSettled ? `${bn(weekSettled)}টি নিষ্পত্তি হয়েছে` : 'এখনো হিসাব করার মতো ডাটা নেই'}
          tone={deliveryRate !== null && deliveryRate < 60 ? 'warn' : 'ok'} />
      </div>

      <section className="rounded-xl2 border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold">ক্যাম্পেইন অনুযায়ী</h2>
        <p className="mb-4 text-sm text-ink-3">
          কোন অ্যাডসেট থেকে অর্ডার এসে সত্যিই ডেলিভার হচ্ছে — এটাই আসল লাভের হিসাব
        </p>
        {!campRes.data?.length ? (
          <p className="py-6 text-center text-sm text-ink-3">এখনো কোনো ক্যাম্পেইন ডাটা নেই।</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="pb-2">ক্যাম্পেইন</th><th className="pb-2">অ্যাডসেট</th>
                  <th className="pb-2 text-right">অর্ডার</th><th className="pb-2 text-right">ডেলিভার্ড</th>
                  <th className="pb-2 text-right">রিটার্ন</th><th className="pb-2 text-right">আয়</th>
                </tr>
              </thead>
              <tbody>
                {campRes.data.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className="py-2.5 font-medium">{c.campaign}</td>
                    <td className="py-2.5 text-ink-2">{c.adset}</td>
                    <td className="py-2.5 text-right tabular-nums">{bn(c.orders)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ok">{bn(c.delivered)}</td>
                    <td className="py-2.5 text-right tabular-nums text-warn">{bn(c.returned)}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{tk(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl2 border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold">স্টক শেষের পথে</h2>
        <p className="mb-4 text-sm text-ink-3">৩ পিস বা তার কম বাকি আছে যেগুলোর</p>
        {!lowRes.data?.length ? (
          <p className="py-6 text-center text-sm text-ink-3">সব জায়গায় যথেষ্ট স্টক আছে।</p>
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
                  {v.stock === 0 ? 'শেষ' : bn(v.stock) + ' পিস'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
