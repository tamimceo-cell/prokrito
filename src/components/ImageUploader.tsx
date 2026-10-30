'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';

/**
 * প্রোডাক্টের ছবি — ফোন বা কম্পিউটার থেকে সরাসরি।
 *
 * পাঠানোর আগে ছবিটা ব্রাউজারেই ছোট করে নেওয়া হয়:
 *   - বড় দিক সর্বোচ্চ ১২০০px
 *   - WebP ফরম্যাট, কোয়ালিটি ০.৮২
 *
 * ফোনের ক্যামেরার ছবি সাধারণত ৩-৫ MB, ৪০০০px চওড়া। ওটা তুললে
 * প্রতিটা প্রোডাক্ট পেইজ ভারী হতো, আর বাংলাদেশের মোবাইল ডাটায় খুলতে
 * সময় লাগত। ছোট করে নিলে ১৫০-৩০০ KB-তে নামে, চোখে পার্থক্য বোঝা যায় না।
 */

const MAX_SIDE = 1200;
const QUALITY = 0.82;

async function shrink(file: File): Promise<File> {
  // যা ছবি নয় বা ইতিমধ্যে ছোট, সেটা যেমন আছে তেমনই থাক
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob(res, 'image/webp', QUALITY));
  if (!blob || blob.size >= file.size) return file;   // ছোট না হলে আসলটাই ভালো

  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
}

export default function ImageUploader({
  images, onChange,
}: { images: string[]; onChange: (next: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState(false);

  async function handleFiles(list: FileList | File[]) {
    const files = [...list].filter((f) => f.type.startsWith('image/'));
    if (!files.length) { setMsg('শুধু ছবি ফাইল দিন।'); return; }
    if (images.length + files.length > 8) { setMsg('একটি প্রোডাক্টে সর্বোচ্চ ৮টি ছবি।'); return; }

    setBusy(true); setMsg('ছবি ছোট করা হচ্ছে…');
    let fd: FormData;
    try {
      const small = await Promise.all(files.map(shrink));
      const totalKb = Math.round(small.reduce((a, f) => a + f.size, 0) / 1024);
      setMsg(`আপলোড হচ্ছে… (${totalKb} KB)`);
      fd = new FormData();
      for (const f of small) fd.append('file', f);
    } catch {
      setBusy(false); setMsg('ছবিটি পড়া যায়নি। অন্য ছবি দিয়ে দেখুন।');
      return;
    }

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => null);
      setBusy(false);
      if (!j?.ok) { setMsg(j?.error || 'আপলোড হয়নি।'); return; }
      onChange([...images, ...j.urls]);
      setMsg(`${j.urls.length}টি ছবি যোগ হয়েছে।`);
      setTimeout(() => setMsg(''), 2500);
    } catch {
      setBusy(false);
      setMsg('ইন্টারনেট সংযোগে সমস্যা। আবার চেষ্টা করুন।');
    }
    if (input.current) input.current.value = '';
  }

  function removeAt(i: number) {
    const url = images[i];
    onChange(images.filter((_, k) => k !== i));
    // স্টোরেজ থেকেও মুছি, যাতে অব্যবহৃত ছবি জমে না থাকে
    fetch(`/api/upload?url=${encodeURIComponent(url)}`, { method: 'DELETE' }).catch(() => {});
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        className={`cursor-pointer rounded-xl2 border-2 border-dashed p-5 text-center transition ${
          drag ? 'border-brand bg-brand-soft' : 'border-line bg-cream hover:border-brand'}`}>
        <p className="text-3xl">🖼️</p>
        <p className="mt-1 font-display font-bold">ছবি যোগ করুন</p>
        <p className="mt-0.5 text-xs text-ink-3">
          ছবিতে ক্লিক করে বাছুন, অথবা এখানে টেনে ছাড়ুন · সর্বোচ্চ ৮টি
        </p>
        <input ref={input} type="file" accept="image/*" multiple hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>

      {(busy || msg) && (
        <p className={`mt-2 text-sm font-semibold ${busy ? 'text-ink-2' : 'text-brand'}`}>
          {busy ? '⏳ ' : ''}{msg}
        </p>
      )}

      {!!images.length && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((src, i) => (
            <div key={src + i} className="relative overflow-hidden rounded-lg border-2 border-line bg-white">
              <div className="relative aspect-square">
                <Image src={src} alt="" fill sizes="120px" className="object-contain" />
              </div>
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                  প্রধান
                </span>
              )}
              <div className="flex items-center justify-between border-t border-line bg-cream px-1 py-0.5">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  aria-label="আগে সরান" className="px-1.5 text-sm disabled:opacity-25">←</button>
                <button type="button" onClick={() => removeAt(i)}
                  aria-label="মুছুন" className="px-1.5 text-sm text-pinkc">✕</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}
                  aria-label="পরে সরান" className="px-1.5 text-sm disabled:opacity-25">→</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!!images.length && (
        <p className="mt-1.5 text-[11px] text-ink-3">
          প্রথম ছবিটাই প্রোডাক্টের প্রধান ছবি — ← → দিয়ে ক্রম বদলাতে পারেন।
        </p>
      )}
    </div>
  );
}
