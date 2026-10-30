'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { bn, tk } from '@/lib/money';
import { useCart } from './CartContext';
import { track } from './Pixel';
import { pixelId } from '@/lib/types';
import type { Product } from '@/lib/types';
import { site } from '@/config/site';
import { variantAxes, findVariant, stockOfColor, colorKeyOf, firstSizeInStock } from '@/lib/variants';
import ProductVideo from './ProductVideo';

/**
 * হালকা রঙের গোল বোতামে সাদা টিক দেখা যায় না (সাদা, বেইজ, হলুদ)।
 * তাই রংটা উজ্জ্বল হলে টিকটা গাঢ় করে দিই।
 *
 * হিসাবটা চোখের আলো-সংবেদনশীলতা মেনে — সবুজ আমরা লালের চেয়ে অনেক
 * বেশি উজ্জ্বল দেখি, নীল সবচেয়ে কম। তাই তিনটেকে সমান ধরলে ভুল হতো।
 */
function needsDarkTick(hex?: string | null): boolean {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
}

/** "স্টক শেষ" — কোনটা শেষ সেটা যেন কাস্টমার বোঝে */
function outOfStockText(hasSizes: boolean, hasColors: boolean): string {
  if (hasSizes && hasColors) return `এই ${site.words.colorAxis} ও ${site.words.optionAxis}ে স্টক শেষ`;
  if (hasColors) return `এই ${site.words.colorAxis}ে স্টক শেষ`;
  if (hasSizes) return `এই ${site.words.optionAxis}ে স্টক শেষ`;
  return 'স্টক শেষ';
}

export default function ProductDetail({
  p, shipping,
}: { p: Product; shipping: { inside: number; outside: number } }) {
  const { add } = useCart();
  const router = useRouter();
  const variants = p.product_variants || [];

  // সাইজ আর রঙের তালিকা সারিগুলো থেকেই বের করা — আলাদা করে কোথাও রাখা নেই
  const { sizes, colors } = variantAxes(variants);
  const hasOptions = sizes.length > 1;   // একটাই সাইজ = পণ্যের সাইজ নেই
  const hasColors = colors.length > 0;   // রঙের ঘর ফাঁকা = পণ্যের রঙ নেই

  // শুরুতে এমন জোড়া দেখাই যেটা সত্যিই কেনা যায় — সব শেষ হয়ে থাকলে প্রথমটা
  const opening = variants.find((v) => v.stock > 0) || variants[0];

  const [colorKey, setColorKey] = useState(opening ? colorKeyOf(opening) : '');
  const [optKey, setOptKey] = useState(opening?.opt_key || '');
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);

  const variant = findVariant(variants, optKey, colorKey);
  const off = p.compare_price ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const stock = variant?.stock ?? 0;
  const images = p.images?.length ? p.images : [''];

  /**
   * রঙ বদলালে সাইজটাও মিলিয়ে নিই।
   *
   * কাস্টমার "লাল ৩৬" দেখছিল, এখন কালো বাছল — কিন্তু কালোয় ৩৬ নেই।
   * তাকে "স্টক শেষ" দেখিয়ে আটকে রাখলে সে ভাববে কালো পাওয়াই যায় না,
   * অথচ কালোর ৩৮ হয়তো পড়েই আছে। তাই কালোর প্রথম চালু সাইজে নিয়ে যাই।
   */
  function pickColor(key: string) {
    setColorKey(key);
    setOptKey((cur) => {
      const same = findVariant(variants, cur, key);
      return same && same.stock > 0 ? cur : firstSizeInStock(variants, key, cur);
    });
    setQty(1);
  }

  // ViewContent — ৩ সেকেন্ড পরে, যাতে শুধু দেখে চলে যাওয়া না গোনা হয়
  useEffect(() => {
    const t = setTimeout(() => {
      track('ViewContent', {
        content_ids: [pixelId(p)], content_type: 'product',
        content_name: p.name, value: p.price, currency: 'BDT',
      });
    }, 3000);
    return () => clearTimeout(t);
  }, [p.code, p.name, p.price]);

  function addToCart(go: boolean) {
    if (!variant || stock < 1) return;
    add({
      code: p.code, cid: pixelId(p), name: p.name, image: images[0],
      optKey: variant.opt_key, optLabel: variant.opt_label,
      colorKey: colorKeyOf(variant), colorLabel: variant.color_label,
      qty, price: p.price,
    });
    track('AddToCart', {
      content_ids: [pixelId(p)], content_type: 'product',
      value: p.price * qty, currency: 'BDT', num_items: qty,
    });
    if (go) router.push('/checkout');
  }

  return (
    <div className="grid gap-8 py-7 lg:grid-cols-2">
      <div>
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-white">
          <Image src={images[imgIdx]} alt={p.name} fill priority sizes="(max-width:980px) 100vw, 45vw" className="object-contain" />
        </div>
        {images.length > 1 && (
          <div className="mt-2.5 grid grid-cols-4 gap-2">
            {images.map((src, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-white ${i === imgIdx ? 'border-brand' : 'border-line'}`}>
                <Image src={src} alt={`ছবি ${bn(i + 1)}`} fill sizes="22vw" className="object-contain" />
              </button>
            ))}
          </div>
        )}

        <ProductVideo url={p.video_url} title={p.name} />
      </div>

      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{p.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-3">
          <span className="rounded-full bg-sunk px-3 py-0.5 font-semibold text-ink-2">কোড {bn(p.code)}</span>
        </p>

        <div className="my-4 flex items-baseline gap-3 border-y border-line py-3.5">
          <span className="font-display text-4xl font-extrabold leading-none text-brand tabular-nums">{tk(p.price)}</span>
          {p.compare_price && <span className="text-lg text-ink-3 line-through tabular-nums">{tk(p.compare_price)}</span>}
          {off > 0 && <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">{bn(off)}% ছাড়</span>}
        </div>

        <p className={`flex items-center gap-2 text-xs font-semibold ${stock === 0 ? 'text-pinkc' : stock <= 6 ? 'text-warn' : 'text-ok'}`}>
          <i className="h-1.5 w-1.5 rounded-full bg-current" />
          {stock === 0 ? outOfStockText(hasOptions, hasColors)
            : stock <= 6 ? `দ্রুত শেষ হয়ে যাচ্ছে — মাত্র ${bn(stock)} পিস বাকি`
            : `স্টকে আছে — ${bn(stock)} পিস`}
        </p>

        {/*
          রঙ আগে, সাইজ পরে।

          ক্রমটা ইচ্ছাকৃত: রঙ বাছলে কোন সাইজগুলো আদৌ পাওয়া যাবে সেটা বদলে
          যায়, উল্টোটা নয়। তাই যেটা অন্যটাকে বদলায় সেটাই উপরে — কাস্টমার
          সাইজ বেছে ফেলার পর সেটা বদলে গেলে বিরক্তিকর হতো।
        */}
        {hasColors && (
          <div className="mt-5">
            <p className="mb-2 font-display text-sm font-bold">
              {site.words.colorAxis} বেছে নিন <span className="text-brand">*</span>
            </p>
            <div className="flex flex-wrap gap-2.5">
              {colors.map((c) => {
                const left = stockOfColor(variants, c.key);
                const on = colorKey === c.key;
                return (
                  <button key={c.key} onClick={() => pickColor(c.key)} disabled={left === 0}
                    title={left === 0 ? `${c.label} — স্টক শেষ` : c.label}
                    className="flex flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40">
                    <span
                      style={c.hex ? { background: c.hex } : undefined}
                      // সাদা বা হালকা রঙের গোল বোতামটা ক্রিম ব্যাকগ্রাউন্ডে
                      // মিশে যেত, তাই বর্ডারটা line-এর চেয়ে গাঢ়
                      className={`grid h-9 w-9 place-items-center rounded-full border-2 ${
                        c.hex ? '' : 'bg-sunk'} ${on ? 'border-brand ring-2 ring-brand/30' : 'border-ink-3/45'}`}>
                      {/* বাছাই করা রঙে টিক — রঙ দুটো কাছাকাছি হলে শুধু বর্ডার দেখে বোঝা যায় না */}
                      {on && (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                          stroke={needsDarkTick(c.hex) ? site.colors.ink : '#fff'} strokeWidth="3.5"
                          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-[11px] font-semibold ${on ? 'text-brand' : 'text-ink-3'} ${
                      left === 0 ? 'line-through' : ''}`}>
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* এক সাইজের পণ্যে (যেমন গহনা) বাছার ঘরটা দেখানোর মানে নেই */}
        {hasOptions && (
          <div className="mt-5">
            <p className="mb-2 font-display text-sm font-bold">
              {site.words.optionAxis} বেছে নিন <span className="text-brand">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((sz) => {
                // এই সাইজটা *বাছাই করা রঙে* আছে কিনা — তাই রঙ বদলালে
                // কোন সাইজগুলো কাটা দেখাবে সেটাও বদলে যায়
                const v = findVariant(variants, sz.key, colorKey);
                const out = !v || v.stock === 0;
                return (
                  <button key={sz.key} onClick={() => { setOptKey(sz.key); setQty(1); }} disabled={out}
                    title={out && hasColors ? `এই ${site.words.colorAxis}ে ${sz.label} নেই` : sz.label}
                    className={`rounded-full border-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                      optKey === sz.key ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`}>
                    {sz.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(hasOptions || hasColors) && (
          <p className="mt-2 text-xs text-ink-3">{site.returnPolicy}</p>
        )}

        <div className="mt-5">
          <p className="mb-2 font-display text-sm font-bold">পরিমাণ</p>
          <div className="inline-flex items-center overflow-hidden rounded-full border-2 border-line">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="কমান"
              className="grid h-10 w-10 place-items-center text-xl font-bold hover:bg-sunk">−</button>
            <span className="min-w-12 text-center font-display text-lg font-bold tabular-nums">{bn(qty)}</span>
            <button onClick={() => setQty((q) => Math.min(Math.max(1, stock), q + 1))} aria-label="বাড়ান"
              className="grid h-10 w-10 place-items-center text-xl font-bold hover:bg-sunk">+</button>
          </div>
        </div>

        {/*
          মোবাইলে দুটো বাটন পাশাপাশি রাখলে জায়গা হয় না — ৩৬০px পর্দায়
          প্রতিটা পায় ~১৫৮px, অথচ ভেতরের প্যাডিং (৪৮px) বাদ দিলে লেখার
          জন্য থাকে ১১০px। "কার্টে যোগ করুন" তাতে আঁটে না, চেপে যায়।
          তাই ছোট পর্দায় উপর-নিচে, আর ৬৪০px থেকে পাশাপাশি।
          মোবাইলে মূল বাটনটা (অর্ডার) উপরে — আঙুলের নাগালেই আগে পড়ে।
        */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button onClick={() => addToCart(true)} disabled={stock < 1}
            className="btn-cta order-first w-full py-3.5 disabled:opacity-40 sm:order-last sm:w-auto sm:flex-1">
            এখনই অর্ডার করুন
          </button>
          <button onClick={() => addToCart(false)} disabled={stock < 1}
            className="btn-out w-full py-3.5 disabled:opacity-40 sm:w-auto sm:flex-1">
            কার্টে যোগ করুন
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-brand/25 bg-brand-soft p-4 text-sm text-ink-2">
          <b className="font-display text-brand">পণ্যের বিবরণ</b>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            {p.description
              ? p.description.split('\n').filter(Boolean).map((l, i) => <li key={i}>{l}</li>)
              : <li>{site.description}</li>}
            <li>ডেলিভারি: ঢাকার ভিতরে {tk(shipping.inside)}, বাইরে {tk(shipping.outside)}</li>
            <li>পণ্য হাতে পেয়ে মূল্য পরিশোধ করবেন</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
