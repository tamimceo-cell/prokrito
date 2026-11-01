import { getDb } from '@/lib/db';
import OrdersTable from '@/components/OrdersTable';
import { STATUS_LABEL } from '@/lib/money';
import Link from 'next/link';
import CustomerCheck from '@/components/CustomerCheck';
import { site } from '@/config/site';

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const db = getDb();

  let query = db
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (sp.status && sp.status !== 'all') query = query.eq('status', sp.status);
  if (sp.q) query = query.or(`name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%`);

  const { data: orders } = await query;

  /*
   * প্রতিটা অর্ডারের পাশে কাস্টমারের ইতিহাস — দুই জায়গা থেকে:
   *  ১. Pathao: সব মার্চেন্ট মিলিয়ে এই নম্বরে কত পার্সেল, কতটা ডেলিভার্ড
   *  ২. আমাদের নিজের দোকান: এই নম্বরের আগের অর্ডারগুলোর কী হয়েছিল
   */
  const phones = [...new Set((orders || []).map((o: any) => o.phone as string))];
  const local = phones.map((p) => '0' + p.slice(3));
  const [{ data: stats }, { data: history }] = await Promise.all([
    phones.length ? db.from('customer_courier_stats').select('phone, total, success, rating, error').in('phone', local) : Promise.resolve({ data: [] as any[] }),
    phones.length ? db.from('orders').select('phone, status').in('phone', phones) : Promise.resolve({ data: [] as any[] }),
  ]);
  const courierStats = Object.fromEntries((stats || []).map((r: any) => ['880' + r.phone.slice(1), r]));
  const own: Record<string, { orders: number; delivered: number; returned: number }> = {};
  for (const h of history || []) {
    const x = (own[h.phone] ||= { orders: 0, delivered: 0, returned: 0 });
    x.orders++; if (h.status === 'delivered') x.delivered++; if (h.status === 'returned') x.returned++;
  }
  const tabs = ['all', 'new', 'hold', 'confirmed', 'courier', 'delivered', 'returned', 'cancelled'];
  const active = sp.status || 'all';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Orders</h1>
          <p className="text-sm text-ink-3">Latest 200 orders</p>
        </div>
        <form className="flex gap-2">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={sp.q || ''} placeholder="Name or phone…"
            className="rounded-full border-2 border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand" />
          <button className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white">Search</button>
        </form>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link key={t} href={`/admin/orders${t === 'all' ? '' : `?status=${t}`}`}
            className={`whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${
              active === t ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2'}`}>
            {t === 'all' ? 'All' : STATUS_LABEL[t]}
          </Link>
        ))}
      </div>

      <CustomerCheck />

      <OrdersTable orders={(orders || []) as any} courier={site.courier} courierStats={courierStats} own={own} />
    </div>
  );
}
