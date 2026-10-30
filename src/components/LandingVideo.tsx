'use client';

import { useState } from 'react';
import Image from 'next/image';
import { youtubeId, youtubeThumb, youtubeEmbed } from '@/lib/youtube';

/**
 * ল্যান্ডিং পেইজের ভিডিও — ProductVideo-র মতোই আগে শুধু থাম্বনেইল।
 * ইউটিউবের প্লেয়ার ~১ MB; এড থেকে আসা মানুষের ফোনে সেটা আগেভাগে
 * নামালে পাতা দেরিতে খোলে, আর দেরি মানে অর্ডার কম।
 */
export default function LandingVideo({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);
  if (!id) return null;

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-ink">
      {playing ? (
        <iframe
          src={youtubeEmbed(id)}
          title="ভিডিও"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label="ভিডিও চালান" className="group absolute inset-0">
          <Image src={youtubeThumb(id)} alt="" fill priority sizes="(max-width: 768px) 100vw, 720px" className="object-cover" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[#FF0033] text-2xl text-white shadow-lg transition group-hover:scale-110">▶</span>
          </span>
        </button>
      )}
    </div>
  );
}
