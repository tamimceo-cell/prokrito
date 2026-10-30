import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import { bn } from '@/lib/money';
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
      <h1 className="font-display text-2xl font-extrabold">পুরনো সাইট থেকে আনা</h1>
      <p className="text-sm text-ink-2">
        এখন আছে: {bn(Number(p.n))}টি প্রোডাক্ট · {bn(Number(l.n))}টি ল্যান্ডিং পেইজ · {bn(Number(o.n))}টি অর্ডার
        {o.mx ? <> (শেষ অর্ডার #{bn(Number(o.mx))})</> : null}
      </p>
      <ImportButtons />
      <p className="text-xs text-ink-3">
        দুবার চাপলেও সমস্যা নেই — যে অর্ডার আগেই আছে সেটা আবার আসে না। ডোমেইন বদলের রাতে
        WordPress থেকে নতুন করে ফাইল বানিয়ে আরেকবার "অর্ডার আনুন" চাপলে মাঝের অর্ডারগুলোও চলে আসবে।
      </p>
    </div>
  );
}
