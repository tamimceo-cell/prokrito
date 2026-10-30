import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getProducts, getCombos, getSettings } from '@/lib/catalog';
import ComboPicker from '@/components/ComboPicker';
import { bn } from '@/lib/money';
import { site } from '@/config/site';

export const revalidate = 300;
export const metadata = {
  title: 'কম্বো অফার',
  description: 'একসাথে কয়েকটি নিন — বড় ছাড়। ক্যাশ অন ডেলিভারি।',
};

export default async function Offer() {
  // কম্বো বন্ধ থাকা দোকানে এই পেইজটাই নেই
  if (!site.combos.enabled) notFound();

  const [products, combos, { shipping }] = await Promise.all([getProducts(), getCombos(), getSettings()]);

  // সবচেয়ে বড় ছাড়টা শিরোনামে — হাতে লেখা শতাংশ পুরনো হয়ে যায়
  const best = combos.reduce((m, c) =>
    c.compare_price ? Math.max(m, Math.round((1 - c.price / c.compare_price) * 100)) : m, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-7">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(140deg,var(--tw-gradient-from,#241726),#3A2340_62%,#57405C)] p-8 text-center text-cream sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-gold-bright bg-white/15 px-4 py-1.5 text-xs font-bold">
          🔥 সীমিত সময়ের অফার
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold sm:text-5xl">
          কম্বো প্যাকেজে{' '}
          <em className="not-italic text-gold-bright">
            {best > 0 ? `${bn(best)}% পর্যন্ত ছাড়` : 'বড় ছাড়'}
          </em>
        </h1>
        <p className="mx-auto mt-3 max-w-[56ch] opacity-85">{site.description}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {site.home.chips.map((t) => (
            <span key={t} className="rounded-full border border-cream/25 bg-cream/10 px-4 py-1.5 text-sm font-semibold">✔️ {t}</span>
          ))}
        </div>
      </section>

      <ComboPicker combos={combos} products={products} shipping={shipping} />

      <section className="py-11">
        <h2 className="sec-title">আমাদের কালেকশন</h2><div className="rule" />
        <p className="mb-6 text-center text-sm text-ink-3">অর্ডার ফর্মে পছন্দের কোড লিখে দিতে পারবেন</p>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {products.map((p) => (
            <figure key={p.code} title={`${p.name} · কোড ${p.code}`}
              className="relative m-0 aspect-square overflow-hidden rounded-lg border border-line bg-white">
              <Image src={p.images?.[0] || ''} alt={p.name} fill sizes="16vw" className="object-contain" />
            </figure>
          ))}
        </div>
      </section>

      <section className="pb-11">
        <h2 className="sec-title">কেন আমাদের কাছ থেকে</h2><div className="rule" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {site.home.trust.map(([i, t, s]) => (
            <div key={t} className="rounded-2xl border border-line bg-white p-5 text-center">
              <p className="text-2xl">{i}</p>
              <b className="mt-1.5 block font-display text-sm">{t}</b>
              <span className="text-xs text-ink-3">{s}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
