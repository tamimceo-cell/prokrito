import Link from 'next/link';
import Image from 'next/image';
import { getProducts, getCombos } from '@/lib/catalog';
import ProductCard from '@/components/ProductCard';
import { bn, tk } from '@/lib/money';
import { site } from '@/config/site';

export const revalidate = 300;

export default async function Home() {
  const [products, combos] = await Promise.all([
    getProducts(),
    site.combos.enabled ? getCombos() : Promise.resolve([]),
  ]);

  // হিরোতে ছড়িয়ে ছিটিয়ে চারটে — প্রথম চারটে নিলে সব একই রকম দেখায়
  const step = Math.max(1, Math.floor(products.length / 4));
  const hero = [0, step, step * 2, step * 3].map((i) => products[i]).filter(Boolean).slice(0, 4);
  const featured = products.slice(0, 8);
  const from = products.length ? Math.min(...products.map((p) => p.price)) : 0;

  return (
    <>
      {/* ---------- হিরো ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-9 pt-6">
        <div className="grid items-center gap-7 rounded-3xl border border-line bg-[radial-gradient(118%_128%_at_86%_16%,rgba(199,154,46,.22),transparent_56%),radial-gradient(92%_120%_at_6%_94%,rgba(168,56,107,.16),transparent_58%),linear-gradient(135deg,#FFFDFA,#FBF3F6_56%,#F6ECF1)] p-7 sm:p-9 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-gold bg-white px-4 py-1.5 text-xs font-bold">
              {site.home.heroBadge}
            </span>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {site.home.heroTitle}
              <em className="not-italic text-brand">{site.home.heroAccent}</em>
              {site.home.heroTail}
            </h1>
            <p className="mt-3 max-w-[44ch] text-base text-ink-2">{site.home.heroSub}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {site.home.chips.map((c) => (
                <span key={c} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-2">✔️ {c}</span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-cta">কালেকশন দেখুন</Link>
              {site.combos.enabled && <Link href="/offer" className="btn-out">কম্বো অফার</Link>}
            </div>
          </div>

          <div className="relative grid grid-cols-2 gap-3.5">
            {hero.map((p, i) => (
              <figure key={p.code} className={`relative m-0 aspect-square overflow-hidden rounded-2xl border border-line bg-white shadow-lg ${i % 2 ? 'mt-6' : ''}`}>
                <Image src={p.images?.[0] || ''} alt={p.name} fill sizes="(max-width:980px) 45vw, 22vw"
                  priority={i === 0} className="object-contain" />
              </figure>
            ))}
            {from > 0 && (
              <span className="absolute -left-5 bottom-7 rounded-full bg-brand px-5 py-2.5 text-center font-display font-extrabold leading-tight text-white shadow-lg">
                {tk(from)}<small className="block text-[11px] font-semibold opacity-85">থেকে শুরু</small>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ---------- ট্রাস্ট ---------- */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {site.home.trust.map(([i, t, s]) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-lg">{i}</span>
              <span><b className="block font-display text-sm">{t}</b><span className="text-xs text-ink-3">{s}</span></span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- ক্যাটাগরি ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-11">
        <h2 className="sec-title">{site.home.categoryTitle}</h2><div className="rule" />
        <p className="mb-6 text-center text-sm text-ink-3">{site.home.categorySub}</p>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {site.categories.map((c) => {
            const pic = products.find((p) => p.category === c.key);
            const n = products.filter((p) => p.category === c.key).length;
            if (!pic) return null;
            return (
              <Link key={c.key} href={`/shop?cat=${c.key}`}
                className="relative block aspect-square overflow-hidden rounded-2xl border border-line bg-white">
                <Image src={pic.images?.[0] || ''} alt={c.label} fill sizes="(max-width:980px) 45vw, 22vw" className="object-contain" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent px-3.5 pb-3.5 pt-9 text-white">
                  <b className="block font-display">{c.label}</b>
                  <span className="text-xs opacity-85">{bn(n)}টি {site.words.item}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---------- জনপ্রিয় ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-11">
        <h2 className="sec-title">{site.home.featuredTitle}</h2><div className="rule" />
        <p className="mb-6 text-center text-sm text-ink-3">{site.home.featuredSub}</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.code} p={p} />)}
        </div>
        <p className="mt-7 text-center">
          <Link href="/shop" className="btn-out">সব {bn(products.length)}টি {site.words.item} দেখুন</Link>
        </p>
      </section>

      {/* ---------- কম্বো ---------- */}
      {site.combos.enabled && combos.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-11">
          <div className="rounded-3xl bg-ink p-7 text-cream sm:p-9">
            <h2 className="sec-title">কম্বো প্যাকেজ</h2><div className="rule" />
            <p className="mb-6 text-center text-sm opacity-75">
              একসাথে কয়েকটি নিন — নিয়মিত দামের চেয়ে অনেক কমে
            </p>
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {combos.map((c) => (
                <div key={c.qty}
                  className={`relative rounded-2xl border-2 p-5 text-center ${c.tag === site.combos.popularTag ? 'border-gold-bright bg-gold-bright/10' : 'border-cream/20 bg-white/5'}`}>
                  {c.tag && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold-bright px-3 py-0.5 text-[11px] font-bold text-ink">
                      {c.tag}
                    </span>
                  )}
                  <b className="block font-display text-lg">{site.combos.unitLabel.replace('{n}', bn(c.qty))}</b>
                  <p className="font-display text-3xl font-extrabold leading-tight text-gold-bright tabular-nums">{tk(c.price)}</p>
                  {c.compare_price && <p className="text-sm line-through opacity-60 tabular-nums">{tk(c.compare_price)}</p>}
                  <p className="mt-1 text-xs font-semibold text-gold-bright/80">প্রতিটি {tk(Math.round(c.price / c.qty))}</p>
                  <Link href="/offer" className="btn-cta mt-4 w-full">এই অফারটি নিন</Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
