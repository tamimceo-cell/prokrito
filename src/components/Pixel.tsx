'use client';

/**
 * ব্রাউজার পিক্সেল।
 *
 * দুটো কাজ করে:
 *  ১. fbevents.js দেরিতে লোড করে — প্রথম scroll/touch, অথবা ৩ সেকেন্ড পরে।
 *     স্ক্রিপ্টটা ~১০৮ KB এবং ল্যান্ডিং পেইজের LCP নষ্ট করার এক নম্বর কারণ।
 *     ডাটা হারায় না, কারণ একই ইভেন্ট সমান্তরালে সার্ভার থেকেও যাচ্ছে।
 *  ২. প্রতিটি ইভেন্টে একটা event_id বানিয়ে ব্রাউজার ও সার্ভার — দুই দিকেই
 *     সেটাই পাঠায়, যাতে Meta ডুপ্লিকেট বাদ দিতে পারে।
 */

import { useEffect } from 'react';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
    __mfPixelLoaded?: boolean;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

/* ---------------- কুকি ও fbclid ---------------- */

function getCookie(name: string) {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

function setCookie(name: string, value: string, days = 90) {
  const d = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d};path=/;SameSite=Lax`;
}

/**
 * ?fbclid= নিয়ে এল কিন্তু _fbc কুকি নেই — নিজে বানিয়ে রাখি।
 * পিক্সেল লোড হতে দেরি হলে বা ব্লকড থাকলে এটাই attribution বাঁচায়।
 */
export function ensureFbc() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get('fbclid');
  if (fbclid && !getCookie('_fbc')) {
    setCookie('_fbc', `fb.1.${Date.now()}.${fbclid}`);
  }
}

export const getFbp = () => getCookie('_fbp');
export const getFbc = () => getCookie('_fbc');
export const getFbclid = () => {
  if (typeof window === 'undefined') return undefined;
  return new URLSearchParams(window.location.search).get('fbclid') || undefined;
};

export function newEventId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'e-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

/* ---------------- স্ক্রিপ্ট লোডিং ---------------- */

function bootFbq() {
  if (typeof window === 'undefined' || window.__mfPixelLoaded || !PIXEL_ID) return;
  window.__mfPixelLoaded = true;

  /* eslint-disable */
  (function (f: any, b: any, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    const t = b.createElement(e); t.async = true; t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  // autoConfig বন্ধ করে দেখা হয়েছিল — SPA PageView তাতে থামে না, শুধু
  // Events Manager-এর সেটিংগুলোই অকেজো হয়ে যায়। তাই ছোঁয়া হয়নি।
  window.fbq?.('init', PIXEL_ID);
  // বাফারে জমা থাকা ইভেন্টগুলো এখন ছাড়ি
  flushQueue();
}

type Queued = { name: string; params: Record<string, unknown>; eventId: string };
const queue: Queued[] = [];

function flushQueue() {
  while (queue.length) {
    const q = queue.shift()!;
    window.fbq?.('track', q.name, q.params, { eventID: q.eventId });
  }
}

/* ---------------- পাবলিক API ---------------- */

/**
 * একটা ইভেন্ট ব্রাউজার + সার্ভার দুই দিকে পাঠায়, একই event_id নিয়ে।
 * সার্ভার কল fire-and-forget — UI কখনো এর জন্য অপেক্ষা করবে না।
 */
export function track(
  name: 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout',
  params: Record<string, unknown> = {},
) {
  const eventId = newEventId();

  // ১) ব্রাউজার
  if (window.__mfPixelLoaded && window.fbq) {
    window.fbq('track', name, params, { eventID: eventId });
  } else {
    queue.push({ name, params, eventId });  // পিক্সেল এখনো আসেনি — জমিয়ে রাখি
  }

  // ২) সার্ভার (CAPI)
  const body = JSON.stringify({
    event_name: name,
    event_id: eventId,
    event_source_url: window.location.href,
    custom_data: params,
    fbp: getFbp(), fbc: getFbc(), fbclid: getFbclid(),
  });

  // পেইজ ছেড়ে চলে গেলেও যেন ইভেন্টটা যায়
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body, keepalive: true,
    }).catch(() => {});
  }

  return eventId;
}

/** Purchase আলাদা — সেটা /api/order থেকেই সার্ভার-সাইডে যায়। ব্রাউজারেরটা শুধু dedup-এর জন্য। */
export function trackPurchaseBrowser(eventId: string, params: Record<string, unknown>) {
  if (window.__mfPixelLoaded && window.fbq) {
    window.fbq('track', 'Purchase', params, { eventID: eventId });
  } else {
    queue.push({ name: 'Purchase', params, eventId });
    bootFbq();   // কেনাকাটা হয়ে গেছে — এখন আর দেরি করার মানে নেই
  }
}

/* ---------------- কম্পোনেন্ট ---------------- */

export default function Pixel() {
  useEffect(() => {
    if (!PIXEL_ID) return;
    ensureFbc();

    let done = false;
    const load = () => {
      if (done) return;
      done = true;
      // bootFbq() নিজেই কিউ ফ্লাশ করে — নিচের track('PageView') সেখানেই
      // জমা আছে, তাই এখানে আলাদা করে আর PageView ফায়ার করা হয় না।
      // করলে ব্রাউজার থেকে দুটো PageView যেত, একটার eventID ছাড়া।
      bootFbq();
      cleanup();
    };

    const timer = window.setTimeout(load, 3000);
    const opts = { once: true, passive: true } as const;
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', load);
      window.removeEventListener('touchstart', load);
      window.removeEventListener('mousemove', load);
      window.removeEventListener('keydown', load);
    };
    window.addEventListener('scroll', load, opts);
    window.addEventListener('touchstart', load, opts);
    window.addEventListener('mousemove', load, opts);
    window.addEventListener('keydown', load, opts);

    // PageView সার্ভার থেকে সাথে সাথেই — ব্রাউজারের জন্য অপেক্ষা নয়
    track('PageView');

    /**
     * রুট বদলালে PageView।
     *
     * দুটো উপায় আগে চেষ্টা করে বাদ দিতে হয়েছে, দুটোই ব্রাউজারে পরীক্ষা করে:
     *
     *  ১. usePathname() — চলেনি। এই কম্পোনেন্ট সার্ভার লেআউটের ভিতরে বসে,
     *     ক্লায়েন্ট-সাইড নেভিগেশনে রি-রেন্ডার হয় না, তাই effect-ও চলে না।
     *  ২. history.pushState প্যাচ — চলেনি। Next.js রাউটার নিজে hydration-এর
     *     সময় pushState প্যাচ করে, আর সেটা আমাদের র‍্যাপারটা মুছে দেয়।
     *
     * তাই সবচেয়ে সাদামাটা উপায় — URL পোল করা। কেউ ওভাররাইট করতে পারে না,
     * সব ব্রাউজারে চলে (navigation API এখনো iOS Safari-তে নেই), আর খরচ
     * বলতে প্রতি ৪০০ms-এ একটা স্ট্রিং তুলনা।
     */
    let last = location.pathname + location.search;
    const onRoute = () => {
      const now = location.pathname + location.search;
      if (now === last) return;
      last = now;
      ensureFbc();

      /**
       * fbevents.js নিজেই SPA রুট বদল ধরে একটা PageView পাঠায় — eventID ছাড়া,
       * আর সেটা বন্ধ করার কোনো সেটিং নেই (Events Manager-এ "Automatic events"
       * ও "Track events automatically without code" — দুটোই Off, তবু পাঠায়)।
       * উপরন্তু ওটা পাঠানোর পর আমাদের PageView কলটা সে চুপচাপ গিলে ফেলে।
       * ব্রাউজারে পরীক্ষা করে দেখা গেছে: হাতে fbq('track','PageView', …,
       * {eventID}) ডাকলেও কোনো রিকোয়েস্টই যায় না।
       *
       * তাই পিক্সেল সত্যিই লোড হয়ে থাকলে রুট বদলে আমরা কিছু পাঠাই না —
       * পাঠালে Meta একই ভিজিটের দুটো PageView গুনত (ওদেরটা ব্রাউজার থেকে,
       * আমাদেরটা সার্ভার থেকে, জোড়া লাগানোর মতো eventID ছাড়া)।
       *
       * কিন্তু পিক্সেল ব্লকড হলে (iOS, অ্যাড-ব্লকার, ট্র্যাকিং প্রোটেকশন)
       * ওদের PageView কখনো যায় না — তখন আমাদের সার্ভার ইভেন্টই একমাত্র ভরসা।
       * CAPI-র আসল কাজ তো এই ভিজিটরদের জন্যই।
       *
       * callMethod আসল fbevents.js লোড হলে তবেই থাকে — শুধু স্টাবে থাকে না।
       */
      const pixelAlive = !!window.fbq?.callMethod;
      if (!pixelAlive) track('PageView');
    };
    const poll = window.setInterval(onRoute, 400);
    window.addEventListener('popstate', onRoute);   // ব্যাক/ফরোয়ার্ড — সাথে সাথে

    return () => {
      cleanup();
      window.clearInterval(poll);
      window.removeEventListener('popstate', onRoute);
    };
  }, []);

  return null;
}
