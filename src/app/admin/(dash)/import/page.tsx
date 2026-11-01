import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import { num } from '@/lib/money';
import ImportButtons from '@/components/ImportButtons';

export const dynamic = 'force-dynamic';

/** পুরনো WordPress থেকে প্রোডাক্ট, ল্যান্ডিং পেইজ ও অর্ডার আনা */
export default async function ImportPage() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'owner') redirect('/admin');
  const [[o], [p], [l]] = await Promise.all([
    sql<{ n: number; mx: number | null }>('SELECT COUNT(*) n, MAX(order_no) mx FROM orders'),
    sql<{ n: number }>('SELECT COUNT(*) n FROM products'),
    sql<{ n: number }>('SELECT COUNT(*) n FROM landing_pages'),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-2xl font-extrabold">Import from the old site</h1>
      <p className="text-sm text-ink-2">
        Currently: {num(p.n)} products, {num(l.n)} landing pages, {num(o.n)} orders
        {o.mx ? <> (last order #{Number(o.mx)})</> : null}
      </p>
      <ImportButtons />
      <p className="text-xs text-ink-3">
        Safe to run twice — orders that already exist are skipped.
      </p>
    </div>
  );
}
