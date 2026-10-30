'use client';
import { useRouter } from 'next/navigation';
import { bn, tk } from '@/lib/money';
import { site } from '@/config/site';
import { useCart } from './CartContext';
import { track } from './Pixel';
import { pixelId } from '@/lib/types';
import type { Combo, Product } from '@/lib/types';

export default function ComboPicker({
  combos, products, shipping,
}: { combos: Combo[]; products: Product[]; shipping: { inside: number; outside: number } }) {
  const { setCombo } = useCart();
  const router = useRouter();

  function pick(c: Combo) {
    const unit = Math.round(c.price / c.qty);
    const lines = [];
    for (let i = 0; i < c.qty; i++) {
      const p = products[i % products.length];
      const vs = p.product_variants || [];
      const v = vs.find((x) => x.stock > 0) || vs[0];
      lines.push({
        code: p.code, cid: pixelId(p), name: p.name, image: p.images?.[0] || '',
        optKey: v?.opt_key || '', optLabel: v?.opt_label || '',
        colorKey: v?.color_key || '', colorLabel: v?.color_label || null,
        qty: 1, price: unit, comboQty: c.qty,
      });
    }
    setCombo(lines);
    track('AddToCart', {
      value: c.price, currency: 'BDT', num_items: c.qty,
      content_ids: lines.map((l) => l.cid || l.code), content_type: 'product',
    });
    router.push('/checkout');
  }

  return (
    <section className="py-11">
      <h2 className="sec-title">আপনার কম্বো বেছে নিন</h2><div className="rule" />
      <p className="mb-6 text-center text-sm text-ink-3">
        প্যাকেজ নিলে কার্টে পণ্য বসে যাবে — চেকআউটে পছন্দমতো বদলাতে পারবেন
      </p>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {combos.map((c) => {
          const save = (c.compare_price || 0) - c.price;
          const best = c.tag === 'সবচেয়ে জনপ্রিয়';
          return (
            <div key={c.qty}
              className={`relative rounded-2xl border-2 bg-white p-6 text-center ${best ? 'border-gold-bright' : 'border-line'}`}>
              {c.tag && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold-bright px-3 py-0.5 text-[11px] font-bold text-ink">
                  {c.tag}
                </span>
              )}
              <b className="block font-display text-lg">{site.combos.unitLabel.replace('{n}', bn(c.qty))}</b>
              <p className="font-display text-3xl font-extrabold leading-tight text-brand tabular-nums">{tk(c.price)}</p>
              {c.compare_price && <p className="text-sm text-ink-3 line-through tabular-nums">{tk(c.compare_price)}</p>}
              {save > 0 && <p className="mt-1 text-xs font-semibold text-ok">{tk(save)} সাশ্রয়</p>}
              <button onClick={() => pick(c)} className="btn-cta mt-4 w-full">এই প্যাকেজটি নিন</button>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-center text-xs text-ink-3">
        ডেলিভারি চার্জ আলাদা — ঢাকার ভিতরে {tk(shipping.inside)}, বাইরে {tk(shipping.outside)}
      </p>
    </section>
  );
}
