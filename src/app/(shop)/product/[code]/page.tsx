import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts, getProductByCode, getSettings } from '@/lib/catalog';
import ProductDetail from '@/components/ProductDetail';
import ProductCard from '@/components/ProductCard';
import { site } from '@/config/site';

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ code: p.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const p = await getProductByCode(code);
  return p ? { title: p.name, description: `${p.name} — ৳${p.price}। ক্যাশ অন ডেলিভারি।` } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [p, all, settings] = await Promise.all([getProductByCode(code), getProducts(), getSettings()]);
  if (!p) notFound();

  const others = all.filter((x) => x.code !== p.code).slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <p className="text-xs text-ink-3">
        <Link href="/">হোম</Link> › <Link href="/shop">{site.words.allItems}</Link> › {p.name}
      </p>
      <ProductDetail p={p} shipping={settings.shipping} />

      <section className="pt-6">
        <h2 className="sec-title">এগুলোও দেখতে পারেন</h2><div className="rule" />
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {others.map((o) => <ProductCard key={o.code} p={o} />)}
        </div>
      </section>
    </div>
  );
}
