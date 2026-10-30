'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { bn, tk } from '@/lib/money';
import { useCart } from './CartContext';
import { track, trackPurchaseBrowser, getFbp, getFbc, getFbclid } from './Pixel';

export default function CheckoutForm({
  shipping,
}: { shipping: { inside: number; outside: number } }) {
  const { lines, subtotal, count, remove, clear } = useCart();
  const [city, setCity] = useState<'inside' | 'outside'>('inside');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ orderNo: number; total: number } | null>(null);
  const openedAt = useRef(Date.now());
  const icFired = useRef(false);

  const ship = lines.length ? shipping[city] : 0;
  const total = subtotal + ship;

  // InitiateCheckout — ফোন ফিল্ডে ফোকাস করলে, একবারই
  function onPhoneFocus() {
    if (icFired.current || !lines.length) return;
    icFired.current = true;
    track('InitiateCheckout', {
      value: subtotal, currency: 'BDT', num_items: count,
      content_ids: lines.map((l) => l.cid || l.code), content_type: 'product',
    });
  }

  useEffect(() => { openedAt.current = Date.now(); }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lines.length) return;
    setErr(''); setBusy(true);

    const f = new FormData(e.currentTarget);
    const utm = new URLSearchParams(window.location.search);

    // try/catch ছাড়া ছিল — নেটওয়ার্ক কেটে গেলে বা সার্ভার টাইম আউট করলে
    // fetch থ্রো করত, setBusy(false) আর চলত না, আর বাটনটা চিরকাল
    // "পাঠানো হচ্ছে…" দেখিয়ে যেত। কাস্টমার ভাবত অর্ডার যাচ্ছে, আসলে কিছুই না।
    let res: Response;
    try {
      res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: f.get('name'), phone: f.get('phone'), address: f.get('address'),
        cityType: city, note: f.get('note') || null,
        website: f.get('website'),                    // হানিপট
        elapsed: Date.now() - openedAt.current,       // টাইমিং চেক
        items: lines.map((l) => ({ code: l.code, optKey: l.optKey, colorKey: l.colorKey || '', qty: l.qty, comboQty: l.comboQty })),
        fbp: getFbp(), fbc: getFbc(), fbclid: getFbclid(),
        landingUrl: window.location.href,
        referrer: document.referrer || null,
        utm: {
          source: utm.get('utm_source'), medium: utm.get('utm_medium'),
          campaign: utm.get('utm_campaign'), content: utm.get('utm_content'),
          term: utm.get('utm_term'),
        },
      }),
      });
    } catch {
      setBusy(false);
      setErr('ইন্টারনেট সংযোগে সমস্যা হচ্ছে। আবার চেষ্টা করুন।');
      return;
    }

    const j = await res.json().catch(() => null);
    setBusy(false);

    if (!res.ok || !j?.ok) { setErr(j?.error || 'অর্ডার নেওয়া যায়নি। আবার চেষ্টা করুন।'); return; }

    // সার্ভার ইতিমধ্যে Purchase পাঠিয়েছে। ব্রাউজারেরটা একই event_id দিয়ে —
    // Meta দুটো মিলিয়ে একটাই গুনবে।
    trackPurchaseBrowser(j.eventId, {
      value: j.value, currency: 'BDT', num_items: count,
      content_ids: lines.map((l) => l.cid || l.code), content_type: 'product',
    });

    setDone({ orderNo: j.orderNo, total: j.total });
    clear();
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-white p-10 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="mt-3 font-display text-2xl font-extrabold">অর্ডার সফল হয়েছে</h1>
        <p className="mt-2 text-ink-2">
          আপনার অর্ডার নম্বর <b className="tabular-nums">#{bn(done.orderNo)}</b>
        </p>
        <p className="mt-1 text-ink-2">
          মোট <b className="tabular-nums">{tk(done.total)}</b> — পণ্য হাতে পেয়ে পরিশোধ করবেন।
        </p>
        <p className="mt-4 text-sm text-ink-3">
          আমরা শীঘ্রই কল করে অর্ডারটি নিশ্চিত করবো। ফোন খোলা রাখবেন।
        </p>
        <Link href="/shop" className="btn-cta mt-6">আরও দেখুন</Link>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-white p-12 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-3 font-display text-xl font-extrabold">কার্ট এখনো খালি</h1>
        <p className="mt-1 text-sm text-ink-3">পছন্দের পণ্য যোগ করে অর্ডার সম্পন্ন করুন।</p>
        <Link href="/shop" className="btn-cta mt-5">কালেকশন দেখুন</Link>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_.75fr]">
      <form onSubmit={submit} className="rounded-3xl border border-line bg-white p-6">
        <h1 className="font-display text-xl font-extrabold">অর্ডার ফর্ম</h1>
        <p className="mb-5 text-sm text-ink-3">সঠিক তথ্য দিন, আমরা কল করে নিশ্চিত করবো</p>

        <label className="mb-1.5 block text-sm font-semibold" htmlFor="name">আপনার নাম <span className="text-brand">*</span></label>
        <input id="name" name="name" required autoComplete="name" placeholder="যেমন: রাবেয়া আক্তার" className="field mb-4" />

        <label className="mb-1.5 block text-sm font-semibold" htmlFor="phone">মোবাইল নম্বর <span className="text-brand">*</span></label>
        <input id="phone" name="phone" required type="tel" inputMode="numeric" autoComplete="tel"
          placeholder="০১৭XXXXXXXX" onFocus={onPhoneFocus} className="field" />
        <p className="mb-4 mt-1.5 text-xs text-ink-3">যে নম্বরে কল করে অর্ডার নিশ্চিত করা যাবে</p>

        <label className="mb-1.5 block text-sm font-semibold" htmlFor="address">সম্পূর্ণ ঠিকানা <span className="text-brand">*</span></label>
        <textarea id="address" name="address" required autoComplete="street-address" rows={3}
          placeholder="বাসা/রোড, এলাকা, থানা, জেলা" className="field mb-4" />

        <p className="mb-1.5 text-sm font-semibold">ডেলিভারি এলাকা <span className="text-brand">*</span></p>
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
          {([['inside', 'ঢাকা সিটি', `ডেলিভারি ${tk(shipping.inside)} · ২৪-৪৮ ঘণ্টা`],
             ['outside', 'ঢাকার বাইরে', `ডেলিভারি ${tk(shipping.outside)} · ৩-৪ দিন`]] as const).map(([v, t, s]) => (
            <label key={v} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border-2 p-3.5 ${
              city === v ? 'border-brand bg-brand-soft' : 'border-line'}`}>
              <input type="radio" name="city" value={v} checked={city === v}
                onChange={() => setCity(v)} className="accent-brand" />
              <span><b className="block font-display text-sm">{t}</b><span className="text-xs text-ink-3">{s}</span></span>
            </label>
          ))}
        </div>

        <label className="mb-1.5 block text-sm font-semibold" htmlFor="note">বিশেষ নির্দেশনা (ঐচ্ছিক)</label>
        <input id="note" name="note" placeholder="যেমন: বিকেলে ডেলিভারি দিন" className="field mb-5" />

        {/* হানিপট — মানুষ দেখতে পায় না */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
          className="absolute h-px w-px -left-[9999px]" />

        {err && <p className="mb-4 rounded-lg bg-pinkc-soft px-4 py-3 text-sm font-semibold text-pinkc">{err}</p>}

        <button disabled={busy} className="btn-cta w-full py-4 text-lg disabled:opacity-60">
          {busy ? 'পাঠানো হচ্ছে…' : `অর্ডার কনফার্ম করুন · ${tk(total)}`}
        </button>
        <p className="mt-3 text-center text-xs text-ink-3">
          আপনার তথ্য শুধু ডেলিভারির কাজে ব্যবহৃত হবে।
        </p>
      </form>

      <aside className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-display text-lg font-bold">অর্ডার সারসংক্ষেপ</h2>
        <p className="mb-4 text-sm text-ink-3">ক্যাশ অন ডেলিভারি</p>

        <ul className="mb-4 divide-y divide-line/60">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-3 py-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
                {l.image && <Image src={l.image} alt="" fill sizes="56px" className="object-contain" />}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm font-semibold">{l.name}</b>
                <span className="text-xs text-ink-3">
                  {[l.optLabel, l.colorLabel].filter(Boolean).join(' · ')} · {bn(l.qty)} পিস × {tk(l.price)}
                </span>
              </div>
              <div className="text-right">
                <b className="block text-sm tabular-nums">{tk(l.qty * l.price)}</b>
                <button onClick={() => remove(i)} className="text-xs text-ink-3 hover:text-pinkc">সরান</button>
              </div>
            </li>
          ))}
        </ul>

        <dl className="text-sm">
          <div className="flex justify-between border-b border-dashed border-line py-2">
            <dt>সাবটোটাল ({bn(count)} পিস)</dt><dd className="font-semibold tabular-nums">{tk(subtotal)}</dd>
          </div>
          <div className="flex justify-between border-b border-dashed border-line py-2">
            <dt>ডেলিভারি চার্জ</dt><dd className="font-semibold tabular-nums">{tk(ship)}</dd>
          </div>
          <div className="flex justify-between pt-3 font-display text-xl font-extrabold">
            <dt>সর্বমোট</dt><dd className="tabular-nums text-brand">{tk(total)}</dd>
          </div>
        </dl>

        <p className="mt-4 flex gap-2.5 rounded-lg bg-brand-soft p-3.5 text-xs text-ink-2">
          <span>💵</span>
          <span><b className="text-brand">ক্যাশ অন ডেলিভারি</b> — কুরিয়ার থেকে পণ্য বুঝে নিয়ে তারপর টাকা দেবেন।</span>
        </p>
      </aside>
    </div>
  );
}
