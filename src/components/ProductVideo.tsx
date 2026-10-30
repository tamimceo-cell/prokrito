'use client';

import { useState } from 'react';
import Image from 'next/image';
import { youtubeId, youtubeThumb, youtubeEmbed } from '@/lib/youtube';

/**
 * প্রোডাক্টের ইউটিউব ভিডিও।
 *
 * ভিডিওটা সাথে সাথে বসানো হয় না — আগে শুধু ইউটিউবের থাম্বনেইল আর
 * একটা প্লে বোতাম দেখানো হয়, কাস্টমার চাপলে তখন আসল প্লেয়ার আসে।
 *
 * কারণ: ইউটিউবের iframe নিজে প্রায় ১ MB স্ক্রিপ্ট টেনে আনে। প্রতিটা
 * প্রোডাক্ট পেইজে ওটা আগেভাগে বসিয়ে দিলে বাংলাদেশের মোবাইল ডাটায়
 * পাতা খুলতে কয়েক সেকেন্ড বেশি লাগত — যে গতির জন্য পুরো সাইটটা নতুন
 * করে বানানো, সেটাই নষ্ট হতো। থাম্বনেইলটা মাত্র ১৫-২০ KB।
 *
 * যারা ভিডিও দেখতে চায় তারা এক ক্লিকেই পায়, যারা চায় না তাদের
 * ডাটা খরচ হয় না।
 */
export default function ProductVideo({ url, title }: { url?: string | null; title: string }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);

  // লিংক না থাকলে বা চেনা না গেলে ঘরটাই দেখাই না
  if (!id) return null;

  return (
    <section className="mt-4">
      <h2 className="mb-2 font-display text-sm font-bold">ভিডিওতে দেখুন</h2>

      <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-ink">
        {playing ? (
          <iframe
            src={youtubeEmbed(id)}
            title={`${title} — ভিডিও`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${title} — ভিডিওটি চালান`}
            className="group absolute inset-0 h-full w-full"
          >
            <Image
              src={youtubeThumb(id)}
              alt=""
              fill
              sizes="(max-width: 980px) 100vw, 45vw"
              className="object-cover transition group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-ink/25 transition group-hover:bg-ink/10" />
            <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-110">
              {/* প্লে ত্রিভুজ */}
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" className="ml-1 text-brand" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>

      {!playing && (
        <p className="mt-1.5 text-[11px] text-ink-3">
          ছবিতে চাপলে ভিডিও চালু হবে — আগে থেকে ডাটা খরচ হয় না।
        </p>
      )}
    </section>
  );
}
