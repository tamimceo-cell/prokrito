import Link from 'next/link';
import { getProducts } from '@/lib/catalog';
import ProductCard from '@/components/ProductCard';
import { bn } from '@/lib/money';
import { site, catLabel } from '@/config/site';

export const revalidate = 300;
export const metadata = { title: site.words.allItems };

export default async function Shop({
  searchParams,
}: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const sp = await searchParams;
  const all = await getProducts();

  let list = all;
  if (sp.cat) list = list.filter((p) => p.category === sp.cat);
  if (sp.q) {
    const q = sp.q.trim().toLowerCase();
    list = list.filter((p) => p.code.toLowerCase().includes(q) || p.name.includes(sp.q!.trim()));
  }

  const title = sp.q ? `"${sp.q}" — ${bn(list.length)}টি ফল`
    : sp.cat ? catLabel(sp.cat)
    : site.words.allItems;

  // যে ক্যাটাগরিতে অন্তত একটা পণ্য আছে শুধু সেগুলোই চিপে দেখাই
  const live = site.categories.filter((c) => all.some((p) => p.category === c.key));

  return (
    <section className="mx-auto max-w-6xl px-4 py-9">
      <h1 className="sec-title">{title}</h1><div className="rule" />
      <p className="mb-6 text-center text-sm text-ink-3">
        {bn(list.length)}টি {site.words.item}
      </p>

      {live.length > 1 && (
        <div className="mb-7 flex flex-wrap justify-center gap-2">
          <Link href="/shop" className={chip(!sp.cat)}>সব</Link>
          {live.map((c) => (
            <Link key={c.key} href={`/shop?cat=${c.key}`} className={chip(sp.cat === c.key)}>{c.label}</Link>
          ))}
        </div>
      )}

      {list.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => <ProductCard key={p.code} p={p} />)}
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-white p-12 text-center text-ink-3">
          কিছু পাওয়া যায়নি। <Link href="/shop" className="font-semibold text-brand">{site.words.allItems} দেখুন</Link>
        </p>
      )}
    </section>
  );
}

const chip = (on: boolean) =>
  `rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2'}`;
