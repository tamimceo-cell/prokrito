'use client';

import { useEffect } from 'react';
import { site } from '@/config/site';

/**
 * ব্রাউজারে জমে থাকা পুরনো জিনিস পরিষ্কার করা।
 *
 * কেন দরকার:
 * এই টেমপ্লেটের দোকানগুলো সাধারণত পুরনো WordPress সাইটের জায়গায় বসে,
 * আর সেসব সাইট প্রায়ই ম্যালওয়্যারে আক্রান্ত থাকে।
 * ওই ধরনের ম্যালওয়্যার কাস্টমারের ব্রাউজারে "service worker" বসিয়ে রাখে —
 * এটা এমন একটা ছোট প্রোগ্রাম যা ডোমেইনের সব রিকোয়েস্টের মাঝখানে বসে থাকে
 * এবং সার্ভারের বদলে নিজের জমানো কপি ফেরত দিতে পারে।
 *
 * সার্ভার থেকে ম্যালওয়্যার সরালেও ওটা সরে না। যে কাস্টমার আগে পুরনো
 * সাইটে ঢুকেছিল, তার ফোনে ওটা রয়ে গেছে — এবং এখনো সে নতুন সাইটের বদলে
 * পুরনো, ভাঙা বা ক্ষতিকর কিছু দেখতে পারে। নতুন সাইট নিজে কোনো service
 * worker ব্যবহার করে না, তাই যা পাওয়া যাবে তার সবটাই পুরনো — নির্দ্বিধায়
 * মুছে ফেলা যায়।
 *
 * একই সাথে জমানো ক্যাশও মুছে দেওয়া হয়, কারণ ম্যালওয়্যার সরে গেলেও তার
 * রেখে যাওয়া কপিগুলো ক্যাশে বসে থাকতে পারে।
 *
 * কাজটা একবারই হয় (localStorage-এ দাগ থাকে), আর পাতা আঁকা শেষ হওয়ার পরে
 * চলে — তাই সাইট খোলার গতিতে এর কোনো প্রভাব নেই।
 */

const DONE = `${site.codePrefix.toLowerCase()}:cleaned:1`;

export default function Housekeeping() {
  useEffect(() => {
    try { if (localStorage.getItem(DONE)) return; } catch { return; }

    const run = async () => {
      let removed = 0;
      try {
        const regs = await navigator.serviceWorker?.getRegistrations?.();
        for (const r of regs || []) { await r.unregister(); removed++; }
      } catch {}

      // service worker থাকলেই কেবল ক্যাশ মুছি — নাহলে অযথা কাজ
      if (removed && 'caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch {}
      }

      try { localStorage.setItem(DONE, '1'); } catch {}

      // পুরনো service worker এতক্ষণ পাতাটা নিজের কপি থেকে দিচ্ছিল —
      // তাকে সরানোর পর একবার নতুন করে লোড না করলে কাস্টমার পুরনোটাই দেখতে থাকবে
      if (removed) window.location.reload();
    };

    const idle = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void;
    }).requestIdleCallback;
    if (idle) idle(run, { timeout: 4000 });
    else setTimeout(run, 1500);
  }, []);

  return null;
}
