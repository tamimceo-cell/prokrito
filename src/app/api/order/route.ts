/**
 * POST /api/order — অর্ডার তৈরি
 *
 * ধাপ:
 *  ১. রেট লিমিট + হানিপট + টাইমিং চেক (ফেক অর্ডার ঠেকানো)
 *  ২. দাম সার্ভারে নতুন করে হিসাব — ক্লায়েন্টের পাঠানো টাকার অঙ্কে বিশ্বাস নয়
 *  ৩. স্টক কমানো ও অর্ডার সেভ
 *  ৪. Purchase ইভেন্ট CAPI দিয়ে Meta-তে (ব্রাউজারের জন্য event_id ফেরত)
 *
 * Purchase সার্ভার থেকে যাওয়াই প্রাইমারি। ব্রাউজারেরটা শুধু dedup-এর
 * জোড়া — ad-blocker বা iOS-এ সেটা হারালেও অর্ডার ট্র্যাক-মিস হবে না।
 */

import { NextResponse, after } from 'next/server';
import { getDb } from '@/lib/db';
import { cleanTiers, cleanExtraFields } from '@/lib/landing';
import { site } from '@/config/site';
import { pathaoConfigured, refreshCustomerRate } from '@/lib/pathao';
import {
  buildEvent, sendWithRetry, newEventId, clientIpFrom,
  fbCookiesFrom, normalizeBdPhone,
} from '@/lib/capi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------- রেট লিমিট (ইন-মেমরি, প্রতি ইনস্ট্যান্সে) ----------- */
/* গুরুতর সুরক্ষা Cloudflare-এর রেট লিমিট রুল থেকে আসবে; এটা দ্বিতীয় স্তর। */
const hits = new Map<string, number[]>();
function rateLimited(ip: string, max = 5, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();       // মেমরি বাড়তে দেব না
  return arr.length > max;
}

interface Line { code: string; optKey?: string; colorKey?: string; qty: number; comboQty?: number }

export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers) || 'unknown';
  const ua = req.headers.get('user-agent') || undefined;

  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'অনেকবার চেষ্টা হয়েছে। এক মিনিট পরে আবার করুন।' },
      { status: 429 },
    );
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'অনুরোধটি পড়া যায়নি।' }, { status: 400 }); }

  /* ---------- ১. বট চেক ---------- */
  // হানিপট: মানুষ এই ফিল্ডটা দেখতেই পায় না, বট ভরে ফেলে
  if (body.website) return NextResponse.json({ ok: true, orderNo: 0 });
  // ফর্ম খোলার ৩ সেকেন্ডের মধ্যে সাবমিট = বট
  if (typeof body.elapsed === 'number' && body.elapsed < 3000) {
    return NextResponse.json({ ok: false, error: 'একটু ধীরে চেষ্টা করুন।' }, { status: 400 });
  }

  /* ---------- ২. ইনপুট যাচাই ---------- */
  const name = String(body.name || '').trim();
  const address = String(body.address || '').trim();
  const cityType = body.cityType === 'outside' ? 'outside' : 'inside';
  const phone = normalizeBdPhone(body.phone);
  const lines: Line[] = Array.isArray(body.items) ? body.items : [];

  if (name.length < 2) return NextResponse.json({ ok: false, error: 'নাম লিখুন।' }, { status: 400 });
  if (!phone)          return NextResponse.json({ ok: false, error: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।' }, { status: 400 });
  if (address.length < 10) return NextResponse.json({ ok: false, error: 'সম্পূর্ণ ঠিকানা লিখুন।' }, { status: 400 });
  if (!lines.length)   return NextResponse.json({ ok: false, error: 'কার্ট খালি।' }, { status: 400 });

  const db = getDb();

  /* ---------- ৩. দাম সার্ভারেই হিসাব ---------- */
  const codes = [...new Set(lines.map((l) => l.code))];
  const { data: products, error: pErr } = await db
    .from('products')
    .select('id, code, content_id, name, price, images, product_variants(id, opt_key, opt_label, color_key, color_label, stock)')
    .in('code', codes)
    .eq('active', true);

  if (pErr || !products?.length) {
    return NextResponse.json({ ok: false, error: 'পণ্য পাওয়া যায়নি।' }, { status: 400 });
  }

  const { data: combos } = await db.from('combos').select('qty, price').eq('active', true);
  const comboPrice = new Map((combos || []).map((c) => [c.qty, c.price]));

  const { data: shipRow } = await db.from('settings').select('value').eq('key', 'shipping').single();
  const ship = (shipRow?.value as { inside: number; outside: number }) || { inside: 70, outside: 120 };

  /**
   * ল্যান্ডিং পেইজের অর্ডার — দাম আসে ওই পেইজের নিজস্ব অফার থেকে
   * (২ পিস ৳৯৫০ ধরনের), দোকানের কম্বো বা এক পিসের দাম থেকে নয়।
   * কাস্টমার কোন অফার বেছেছে সেটা শুধু সংখ্যা দিয়ে আসে; দাম সার্ভার
   * নিজে পেইজ থেকে পড়ে নেয়, তাই ব্রাউজারে দাম বদলে কম টাকায় অর্ডার
   * দেওয়া যায় না।
   */
  const landingSlug = typeof body.landing === 'string' ? body.landing.trim().toLowerCase() : '';
  let tierPrice: number | null = null;
  // ফর্মের বাড়তি ঘরের উত্তর ("কালার: পিংক") — অর্ডারের নোটে যায়
  const extraLines: string[] = [];
  if (landingSlug) {
    const { data: lp } = await db.from('landing_pages')
      .select('slug, tiers, product_id, note_label, note_required, extra_fields')
      .eq('slug', landingSlug).eq('active', true).maybeSingle();
    const p = lp && products.find((x) => x.id === lp.product_id);
    const l = lines[0];
    const tier = lp && cleanTiers(lp.tiers).find((t) => t.qty === Number(l?.qty));
    if (!lp || !p || lines.length !== 1 || l.code !== p.code || !tier) {
      return NextResponse.json({ ok: false, error: 'অফারটি আর চালু নেই। পাতাটি রিফ্রেশ করে আবার চেষ্টা করুন।' }, { status: 400 });
    }
    if (lp.note_required && !String(body.note || '').trim()) {
      return NextResponse.json({ ok: false, error: `${lp.note_label || 'তথ্য'} লিখুন।` }, { status: 400 });
    }
    const given: Array<{ name?: string; value?: string }> = Array.isArray(body.extra) ? body.extra : [];
    for (const f of cleanExtraFields(lp.extra_fields)) {
      const v = String(given.find((g) => g?.name === f.name)?.value || '').trim().slice(0, 300);
      if (f.required && !v) {
        return NextResponse.json({ ok: false, error: `${f.label} — ঘরটি পূরণ করুন।` }, { status: 400 });
      }
      if (v) extraLines.push(`${f.name}: ${v}`);
    }
    tierPrice = tier.price;
  }

  let subtotal = 0;
  const items: any[] = [];
  const contents: Array<{ id: string; quantity: number; item_price: number }> = [];

  for (const l of lines) {
    const p = products.find((x) => x.code === l.code);
    if (!p) continue;
    const qty = Math.max(1, Math.min(50, Number(l.qty) || 1));

    // কম্বো থেকে এলে প্রতি পিসের দাম কম্বোর দাম ÷ পিস সংখ্যা
    const unit = tierPrice !== null
      ? Math.round(tierPrice / qty)
      : l.comboQty && comboPrice.has(l.comboQty)
        ? Math.round(comboPrice.get(l.comboQty)! / l.comboQty)
        : p.price;
    // অফারের মোট দাম ভাগে না মিললেও (১৩৯০ ÷ ৩) হিসাব পুরো টাকায় থাকে
    const lineTotal = tierPrice !== null ? tierPrice : unit * qty;

    const variant = pickVariant(p.product_variants, l);

    subtotal += lineTotal;
    items.push({
      product_id: p.id, product_code: p.code, product_name: p.name,
      opt_key: variant?.opt_key ?? null, opt_label: variant?.opt_label ?? null,
      // রঙটা নাম হিসেবেই লিখে রাখি — পরে ওই রঙ তুলে দিলেও অর্ডারে থেকে যাবে
      color_key: variant?.color_key || null, color_label: variant?.color_label || null,
      qty, unit_price: unit, line_total: lineTotal, combo_qty: l.comboQty ?? null,
    });
    // Meta-র content_id — পুরনো সাইটের প্রোডাক্ট আইডি থাকলে সেটাই
    contents.push({ id: p.content_id || p.code, quantity: qty, item_price: unit });
  }

  if (!items.length) return NextResponse.json({ ok: false, error: 'পণ্য পাওয়া যায়নি।' }, { status: 400 });

  const shipping = cityType === 'outside' ? ship.outside : ship.inside;
  const total = subtotal + shipping;

  /* ---------- ৪. ডুপ্লিকেট/ফ্রড ফ্ল্যাগ ---------- */
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: recent } = await db
    .from('orders').select('id', { count: 'exact', head: true })
    .eq('phone', phone).gte('created_at', since);
  const flagged = (recent ?? 0) >= 3;

  /* ---------- ৪.৫ স্টক ধরে রাখা ---------- */
  /**
   * অর্ডার সেভ করার আগেই স্টক ধরে রাখি, আর সেটা ডাটাবেজের ভেতরে
   * এক ধাপে — reserve_stock() ফাংশনে UPDATE ও শর্ত একসাথে।
   *
   * আগে কোড করত: স্টক পড়ো → বিয়োগ করো → লিখে দাও। দুজন ক্রেতা একই
   * সাইজে একই মুহূর্তে অর্ডার করলে দুজনেই পুরনো সংখ্যা পড়ত, দুজনেই একই
   * নতুন সংখ্যা লিখত — ২ পিস বিক্রি হয়ে স্টক কমত ১। কম ট্রাফিকে ধরা
   * পড়ত না, কিন্তু ভাইরাল বিজ্ঞাপনে একটা সাইজ শেষ হওয়ার সময় ঠিক
   * এটাই ঘটে, আর হাতে নেই এমন পণ্যের অর্ডার নেওয়া হয়ে যেত।
   *
   * কোনো একটা লাইনে স্টক না কুলালে আগে ধরে রাখাগুলো ফেরত দিয়ে
   * পুরো অর্ডারটাই বাতিল — অর্ধেক অর্ডার সেভ হওয়ার চেয়ে ভালো।
   */
  const reserved: Array<{ id: string; qty: number }> = [];

  async function releaseAll() {
    await Promise.all(reserved.map((r) =>
      db.rpc('release_stock', { p_variant_id: r.id, p_qty: r.qty })));
  }

  for (const l of lines) {
    const p = products.find((x) => x.code === l.code);
    const v = pickVariant(p?.product_variants, l);
    if (!v) continue;
    const qty = Math.max(1, Math.min(50, Number(l.qty) || 1));

    const { data: left, error: rErr } = await db
      .rpc('reserve_stock', { p_variant_id: v.id, p_qty: qty });

    if (rErr || left === null) {
      await releaseAll();
      return NextResponse.json({
        ok: false,
        error: `দুঃখিত, "${p!.name}" — ${[v.opt_label, v.color_label].filter(Boolean).join(' · ')} আর স্টকে নেই। অন্যটি বেছে নিন।`,
      }, { status: 409 });
    }
    reserved.push({ id: v.id, qty });
  }

  /* ---------- ৫. অর্ডার সেভ ---------- */
  const { fbp: cFbp, fbc: cFbc } = fbCookiesFrom(req.headers.get('cookie'));
  const fbp = body.fbp || cFbp || null;
  const fbc = body.fbc || cFbc || null;
  const landingUrl = String(body.landingUrl || process.env.NEXT_PUBLIC_SITE_URL || '');

  const { data: order, error: oErr } = await db.from('orders').insert({
    name, phone, phone_raw: String(body.phone || ''), address,
    city_type: cityType,
    note: [...extraLines, String(body.note || '').trim()].filter(Boolean).join('\n') || null,
    subtotal, shipping, total,
    fbp, fbc, fbclid: body.fbclid || null,
    client_ip: ip, user_agent: ua,
    utm_source: body.utm?.source || null,
    utm_medium: body.utm?.medium || null,
    utm_campaign: body.utm?.campaign || null,
    utm_content: body.utm?.content || null,
    utm_term: body.utm?.term || null,
    landing_url: landingUrl, referrer: body.referrer || null,
    landing_slug: landingSlug || null,
    is_flagged: flagged,
    flag_reason: flagged ? 'একই নম্বর থেকে ২৪ ঘণ্টায় ৩+ অর্ডার' : null,
  }).select('id, order_no').single();

  if (oErr || !order) {
    await releaseAll();   // স্টক ধরে রেখে অর্ডার ফেল — ফেরত দিতেই হবে
    return NextResponse.json({ ok: false, error: 'অর্ডার সেভ করা যায়নি। একটু পরে চেষ্টা করুন।' }, { status: 500 });
  }

  await db.from('order_items').insert(items.map((i) => ({ ...i, order_id: order.id })));

  /* ---------- ৬. Purchase → Meta ---------- */
  const eventId = newEventId();
  const purchaseValue = site.purchaseValueIncludesShipping ? total : subtotal;
  const event = buildEvent({
    eventName: 'Purchase',
    eventId,
    eventSourceUrl: landingUrl,
    user: {
      name, phone, city: cityType === 'inside' ? 'dhaka' : (body.city || null),
      // external_id স্থির হতে হয় — একই মানুষের প্রতিটি অর্ডারে একই মান।
      // আগে অর্ডার নম্বর যাচ্ছিল, যেটা প্রতিবার আলাদা; ফলে রিপিট কাস্টমারকে
      // Meta আলাদা মানুষ ভাবত। বাংলাদেশে COD ব্যবসায় স্থির পরিচয় একটাই —
      // মোবাইল নম্বর। অর্ডার নম্বর custom_data.order_id-তে আছেই।
      externalId: normalizeBdPhone(phone) || String(order.order_no),
      fbp, fbc, fbclid: body.fbclid,
      ip, userAgent: ua,
    },
    custom: {
      // ডেলিভারি চার্জ বাদে দেওয়াই ROAS-এর সঠিক ভিত্তি; কিন্তু যে সাইট আগে
      // চার্জসহ পাঠাত (PixelYourSite), সেখানে হঠাৎ বদলালে এডের হিসাব লাফ দেয়
      value: purchaseValue,
      currency: 'BDT',
      content_type: 'product',
      content_ids: contents.map((c) => c.id),
      contents,
      num_items: contents.reduce((a, c) => a + c.quantity, 0),
      order_id: String(order.order_no),
    },
  });

  /**
   * Meta-তে পাঠানো হয় উত্তর দেওয়ার পরে, after() দিয়ে।
   *
   * আগে কাস্টমারকে অপেক্ষা করানো হতো: sendWithRetry ৩ বার চেষ্টা করে,
   * প্রতিবার ৮ সেকেন্ড পর্যন্ত, মাঝে backoff — Meta ঝুলে থাকলে ২৫ সেকেন্ড।
   * লাইভ টেস্টে পুরো অর্ডারে ৫৮ সেকেন্ড লেগেছিল, আর "পাঠানো হচ্ছে…"
   * লেখা বাটনের দিকে তাকিয়ে থাকা কাস্টমার ততক্ষণে চলে যেত।
   *
   * এখন অর্ডার সেভ হওয়ার সাথে সাথেই উত্তর যায়; ইভেন্টটা পেছনে যায়।
   * event_id আগেই তৈরি, তাই ব্রাউজারের Purchase-এর সাথে জোড়া ঠিকই লাগবে।
   */
  after(async () => {
    const { data: logRow } = await db.from('capi_events').insert({
      order_id: order.id, event_name: 'Purchase', event_id: eventId,
      event_time: (event as any).event_time, payload: event as any, status: 'pending',
    }).select('id').single();

    const res = await sendWithRetry([event]);

    if (logRow) {
      await db.from('capi_events').update({
        status: res.ok ? 'sent' : 'failed',
        attempts: 1,
        response: (res.body ?? null) as any,
        error: res.error ?? null,
        sent_at: new Date().toISOString(),
      }).eq('id', logRow.id);
    }
  });

  // কাস্টমারের Pathao ইতিহাস আগেভাগে এনে রাখি — অ্যাডমিন অর্ডার খুললেই
  // সাকসেস রেট দেখা যাবে। কাস্টমারকে অপেক্ষা করাই না, ভাঙলেও অর্ডার ঠিক থাকে।
  if (pathaoConfigured()) after(() => refreshCustomerRate(phone).then(() => {}, () => {}));

  // CAPI ফেল করলেও অর্ডার সফল — কাস্টমারকে আটকানোর কোনো কারণ নেই
  return NextResponse.json({
    ok: true,
    orderNo: order.order_no,
    eventId,                    // ব্রাউজার এই id দিয়েই fbq('track','Purchase') করবে
    value: purchaseValue,
    total,
  });
}

/**
 * কার্টের একটা সারি কোন স্টকের ঘরে পড়ে।
 *
 * সাইজ আর রঙ — দুটোই মিলতে হবে। শুধু সাইজ মিলিয়ে নিলে "লাল ৩৬"-এর
 * অর্ডারে "কালো ৩৬"-এর স্টক কমে যেত।
 *
 * রঙ ছাড়া পুরনো পণ্যের ঘরে color_key খালি, আর পুরনো কার্টে colorKey
 * নেই — দুটোই '' ধরে নিলে সেগুলো আগের মতোই মেলে।
 */
function pickVariant(variants: any[] | null | undefined, l: { optKey?: string; colorKey?: string }) {
  const want = l.colorKey || '';
  return (variants || []).find(
    (v: any) => v.opt_key === l.optKey && (v.color_key || '') === want,
  );
}
