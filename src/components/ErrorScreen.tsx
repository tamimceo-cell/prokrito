'use client';

import { useEffect } from 'react';
import { recoverFromStaleBuild, clearReloadMark } from '@/lib/stale';

/**
 * কিছু ভেঙে গেলে কাস্টমার যা দেখবে।
 *
 * আগে দেখাত Next-এর নিজের পাতা — সাদা পর্দায় ইংরেজিতে
 * "Application error: a client-side exception has occurred"। বাংলাদেশের
 * কাস্টমারের কাছে ওটা অর্থহীন, আর দোকানের নামও থাকে না; মনে হয় সাইটটাই
 * মরে গেছে। তাই এখানে বাংলায় বলা হয়, আর একটা বোতাম দেওয়া হয় যাতে সে
 * অন্তত আবার চেষ্টা করতে পারে বা হোমে ফিরতে পারে।
 *
 * বেশিরভাগ ক্ষেত্রে অবশ্য এই পাতাটা সে দেখবেই না — কারণ পুরনো বিল্ডের
 * ভুল হলে নিচের useEffect নিজেই একবার রিফ্রেশ করে দেয়।
 */
export default function ErrorScreen({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // পুরনো ফাইল না পাওয়ার সমস্যা হলে নিঃশব্দে একবার রিফ্রেশ
    recoverFromStaleBuild(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-4xl">😕</p>
      <h1 className="mt-4 font-display text-xl font-extrabold">
        দুঃখিত, পাতাটা খুলতে পারলাম না
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">
        সাময়িক সমস্যা। একবার আবার চেষ্টা করলেই সাধারণত ঠিক হয়ে যায়।
      </p>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          onClick={() => { clearReloadMark(); reset(); }}
          className="rounded-xl bg-brand px-5 py-3 font-bold text-white"
        >
          আবার চেষ্টা করুন
        </button>
        {/* ইচ্ছে করেই <a>, <Link> নয় — রাউটারটাই ভেঙে থাকতে পারে,
            তখন পুরো পাতা নতুন করে লোড হওয়াই নিরাপদ */}
        <a href="/" className="rounded-xl border border-line px-5 py-3 font-semibold text-ink-2">
          হোমে ফিরে যান
        </a>
      </div>

      {error.digest && (
        <p className="mt-6 text-[11px] text-ink-3">সমস্যা নম্বর: {error.digest}</p>
      )}
    </div>
  );
}
