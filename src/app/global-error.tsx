'use client';

import { useEffect } from 'react';
import { recoverFromStaleBuild, clearReloadMark } from '@/lib/stale';
import { site } from '@/config/site';
import './globals.css';

/**
 * শেষ রক্ষাকবচ।
 *
 * (shop)/error.tsx ধরে দোকানের ভেতরের ভুলগুলো। কিন্তু রুট লেআউটটাই যদি
 * চালু হতে না পারে — যেমন পুরনো বিল্ডের জাভাস্ক্রিপ্ট ফাইল হারিয়ে গেলে —
 * তখন ওটা পর্যন্ত পৌঁছানোই যায় না। সেই অবস্থায় এই ফাইলটা পুরো <html>
 * নিজে বানায়।
 *
 * এখানে সাইটের ফন্ট বা হেডার-ফুটার কিছুই নেই, থাকা সম্ভবও না — তাই
 * সাজসজ্জা যতটা সম্ভব সরল রাখা হয়েছে, যাতে যেকোনো অবস্থায় অন্তত লেখাটা
 * পড়া যায়।
 */
export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    recoverFromStaleBuild(error);
  }, [error]);

  // এখানে Tailwind-এর ক্লাস ভরসা করা যায় না (CSS ফাইলটাও হারিয়ে থাকতে পারে),
  // তাই রংগুলো সরাসরি site.ts থেকে নিয়ে ইনলাইন বসানো হয়
  const c = site.colors;

  return (
    <html lang="bn">
      <body style={{ background: c.cream, color: c.ink, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, margin: 0 }}>😕</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginTop: 16 }}>
            দুঃখিত, পাতাটা খুলতে পারলাম না
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: c.ink3, marginTop: 8 }}>
            সাময়িক সমস্যা। একবার আবার চেষ্টা করলেই সাধারণত ঠিক হয়ে যায়।
          </p>
          <button
            onClick={() => { clearReloadMark(); reset(); }}
            style={{
              marginTop: 24, width: '100%', padding: '13px 20px', borderRadius: 12,
              border: 0, background: c.brand, color: '#fff', fontWeight: 700, fontSize: 15,
            }}
          >
            আবার চেষ্টা করুন
          </button>
          <a
            href="/"
            style={{
              display: 'block', marginTop: 10, padding: '13px 20px', borderRadius: 12,
              border: `1px solid ${c.line}`, color: c.ink2, fontWeight: 600,
              fontSize: 15, textDecoration: 'none',
            }}
          >
            হোমে ফিরে যান
          </a>
          {error.digest && (
            <p style={{ marginTop: 24, fontSize: 11, color: c.ink3 }}>
              সমস্যা নম্বর: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
