import { getDb } from '@/lib/db';
import LandingManager from '@/components/LandingManager';

export const dynamic = 'force-dynamic';

export default async function LandingAdmin() {
  const db = getDb();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ data: pages }, { data: products }, { data: recent }] = await Promise.all([
    db.from('landing_pages').select('*').order('sort'),
    db.from('products').select('id, code, name, price').order('sort'),
    db.from('orders').select('landing_slug').gte('created_at', since).not('landing_slug', 'is', null),
  ]);

  // কোন পেইজে গত ৩০ দিনে কত অর্ডার — কোনটায় এড চলছে বোঝার সহজ উপায়
  const counts: Record<string, number> = {};
  for (const r of recent || []) counts[r.landing_slug!] = (counts[r.landing_slug!] || 0) + 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Landing pages</h1>
        <p className="text-sm text-ink-3">
          Don't change the link an ad is running on. Price or offer changes show on the site within seconds of saving.
        </p>
      </div>
      <LandingManager initial={(pages || []) as any[]} products={(products || []) as any[]} counts={counts} />
    </div>
  );
}
