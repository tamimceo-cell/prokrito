'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { bn, tk } from '@/lib/money';
import { useCart } from './CartContext';
import { track } from './Pixel';
import { pixelId } from '@/lib/types';
import type { Product } from '@/lib/types';

export default function ProductCard({ p }: { p: Product }) {
  const { add } = useCart();
  const router = useRouter();
  const off = p.compare_price ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const stock = (p.product_variants || []).reduce((a, v) => a + v.stock, 0);
  const low = stock > 0 && stock <= 6;
  const variants = p.product_variants || [];
  const def = variants.find((v) => v.stock > 0) || variants[0];
  // রঙ থাকলে কোনটা সে চায় আমরা জানি না
  const needsChoice = variants.some((v) => v.color_key);

  function addOne(go: boolean) {
    if (!def) return;
    /*
      রঙওয়ালা পণ্যে কার্ড থেকে সরাসরি কার্টে দেওয়া হয় না।

      কারণ অনুমানটা এখানে সস্তা নয় — ক্যাশ অন ডেলিভারিতে ভুল রঙ মানে
      পণ্য ফেরত, কুরিয়ার খরচ দুবার, আর কাস্টমারের বিরক্তি। তাই তাকে
      প্রোডাক্ট পেইজে পাঠিয়ে নিজে বেছে নিতে দেওয়াই সস্তা।
    */
    if (needsChoice) { router.push(`/product/${p.code}`); return; }
    add({ code: p.code, cid: pixelId(p), name: p.name, image: p.images?.[0] || '', optKey: def.opt_key, optLabel: def.opt_label, qty: 1, price: p.price });
    track('AddToCart', { content_ids: [pixelId(p)], content_type: 'product', value: p.price, currency: 'BDT' });
    if (go) router.push('/checkout');
  }

  return (
    <article className="card">
      <Link href={`/product/${p.code}`} className="relative block aspect-square overflow-hidden bg-white">
        {off > 0 && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-pinkc px-2.5 py-1 text-xs font-bold text-white shadow">
            -{bn(off)}%
          </span>
        )}
        <span className="absolute bottom-2.5 left-2.5 z-10 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white">
          {bn(p.code)}
        </span>
        {low && (
          <span className="absolute bottom-2.5 right-2.5 z-10 rounded-full bg-warn px-2.5 py-1 text-[11px] font-bold text-white shadow">
            মাত্র {bn(stock)} পিস
          </span>
        )}
        {stock === 0 && (
          <span className="absolute inset-0 z-10 grid place-items-center bg-white/75 font-display text-lg font-bold text-ink-3">
            স্টক শেষ
          </span>
        )}
        {p.images?.[0] && (
          <Image src={p.images[0]} alt={p.name} fill sizes="(max-width:620px) 50vw, 25vw" className="object-contain" />
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={`/product/${p.code}`}
          className="line-clamp-2 min-h-[2.84em] text-sm font-semibold leading-snug hover:text-brand">
          {p.name}
        </Link>
        <p className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold leading-none text-brand tabular-nums">{tk(p.price)}</span>
          {p.compare_price && <span className="text-sm text-ink-3 line-through tabular-nums">{tk(p.compare_price)}</span>}
        </p>
        {/*
          কার্ডের বাটন ছোট জায়গায় বসে — মোবাইলে দুই কলামে কার্ডের চওড়া
          ~১৭৬px, প্যাডিং বাদ দিলে দুই বাটনের জন্য থাকে ~১৫২px। তাই
          গোল পিল নয় (rounded-lg), লেখা ভাঙতে দেওয়া নয় (whitespace-nowrap),
          আর লেখাও ছোট — "অর্ডার করুন" নয়, শুধু "অর্ডার"।
        */}
        <div className="mt-auto grid grid-cols-2 gap-2">
          <button onClick={() => addOne(false)} disabled={!stock}
            className="btn-out whitespace-nowrap rounded-lg px-2 py-2 text-xs disabled:opacity-40">কার্টে</button>
          <button onClick={() => addOne(true)} disabled={!stock}
            className="btn-cta whitespace-nowrap rounded-lg px-2 py-2 text-xs disabled:opacity-40">অর্ডার</button>
        </div>
      </div>
    </article>
  );
}
