import Image from 'next/image';
import type { Block, Img } from '@/lib/landing';
import LandingVideo from './LandingVideo';

/**
 * ল্যান্ডিং পেইজের অংশগুলো আঁকা। সার্ভারেই HTML হয়ে যায় —
 * ব্রাউজারে কোনো জাভাস্ক্রিপ্ট লাগে না, শুধু ভিডিও আর অর্ডার ফর্ম ছাড়া।
 */
export default function LandingBlocks({ blocks }: { blocks: Block[] }) {
  // প্রথম ছবিটা স্ক্রিনের উপরেই থাকে — ওটা আগে লোড হলে LCP ভালো হয়
  let firstImage = true;
  const eager = () => { const v = firstImage; firstImage = false; return v; };

  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'heading': {
            const size = b.size === 'xl'
              ? 'text-2xl sm:text-3xl text-brand'
              : b.size === 'md' ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl';
            return (
              <h2 key={i} style={b.color ? { color: b.color } : undefined}
                className={`whitespace-pre-line text-balance text-center font-display font-extrabold leading-snug ${size}`}>
                {b.text}
              </h2>
            );
          }
          case 'text':
            return <p key={i} style={b.color ? { color: b.color } : undefined} className="whitespace-pre-line text-center leading-relaxed text-ink-2">{b.text}</p>;

          case 'image':
            return <Pic key={i} img={b.img} priority={eager()} sizes="(max-width: 768px) 100vw, 720px" />;

          case 'gallery': {
            const cols = b.cols === 1 ? 'grid-cols-1' : b.cols === 3 ? 'grid-cols-3' : 'grid-cols-2';
            return (
              <div key={i} className={`grid gap-3 ${cols}`}>
                {b.images.map((img, j) => (
                  <figure key={j} className="m-0">
                    <Pic img={img} priority={j === 0 && eager()} sizes="(max-width: 768px) 50vw, 360px" />
                    {img.caption && (
                      <figcaption className="mt-1.5 text-center font-display text-base font-bold">{img.caption}</figcaption>
                    )}
                  </figure>
                ))}
              </div>
            );
          }
          case 'video':
            return <LandingVideo key={i} url={b.url} />;

          case 'list':
            return (
              <section key={i} className="rounded-2xl border border-line bg-white p-5">
                {b.title && <h3 className="mb-3 text-center font-display text-lg font-extrabold">{b.title}</h3>}
                <ul className="space-y-2.5">
                  {b.items.map((t, j) => (
                    <li key={j} className="flex gap-2.5 leading-relaxed" style={b.color ? { color: b.color } : undefined}>
                      <span style={b.icon ? { background: b.icon } : undefined}
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok text-[11px] font-bold text-white">✓</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );

          case 'features':
            return (
              <section key={i}>
                {b.title && <h3 className="mb-3 text-center font-display text-xl font-extrabold">{b.title}</h3>}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {b.items.map((f, j) => (
                    <div key={j} className="rounded-xl border border-line bg-white p-3.5 text-center">
                      <b className="block font-display text-sm">{f.title}</b>
                      {f.desc && <span className="mt-0.5 block text-xs text-ink-3">{f.desc}</span>}
                    </div>
                  ))}
                </div>
              </section>
            );

          case 'compare':
            return (
              <section key={i}>
                {b.title && <h3 className="mb-3 text-center font-display text-xl font-extrabold">{b.title}</h3>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-sunk p-5">
                    <b className="mb-2 block font-display">{b.bad.title}</b>
                    <ul className="space-y-2 text-sm text-ink-2">
                      {b.bad.items.map((t, j) => <li key={j} className="flex gap-2"><span className="text-warn">✕</span>{t}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-2xl border-2 border-brand bg-brand-soft p-5">
                    <b className="mb-2 block font-display text-brand">{b.good.title}</b>
                    <ul className="space-y-2 text-sm">
                      {b.good.items.map((t, j) => <li key={j} className="flex gap-2"><span className="text-ok">✓</span>{t}</li>)}
                    </ul>
                  </div>
                </div>
              </section>
            );

          case 'cta':
            return (
              <div key={i} className="text-center">
                {/* ফর্মের কাছে নিয়ে যায় — CartFlows পেইজের "#order" বোতামের মতোই */}
                <a href="#order" className="btn-cta animate-nudge px-8 py-3.5 text-lg"
                  style={b.bg ? { background: b.bg, color: b.fg || '#fff' } : undefined}>
                  {b.text || 'এখানে অর্ডার করুন'}
                </a>
              </div>
            );

          case 'section':
            // মোবাইলে কিনারা পর্যন্ত রঙ, বড় পর্দায় গোল কোণার কার্ড
            return (
              <section key={i} style={b.bg ? { background: b.bg } : undefined}
                className="-mx-4 px-4 py-7 sm:mx-0 sm:rounded-2xl sm:px-6">
                <LandingBlocks blocks={b.blocks} />
              </section>
            );

          case 'html':
            // সার্ভার থেকে HTML হিসেবেই যায়, তাই ভেতরের <script> ব্রাউজার
            // প্রথমবার পাতা পড়ার সময় নিজেই চালায় — পুরনো পেইজের স্লাইডার,
            // টাইমার, প্রশ্নোত্তর আগের মতোই কাজ করে।
            return <div key={i} className="lp-html" dangerouslySetInnerHTML={{ __html: b.html }} />;

          case 'order':
            return null;   // পেইজ নিজে ফর্মটা এখানে বসায় (splitAtOrder)

          default:
            return null;
        }
      })}
    </div>
  );
}

function Pic({ img, priority, sizes }: { img: Img; priority?: boolean; sizes: string }) {
  if (img.maxw) {
    return (
      <Image src={img.src} alt={img.alt || ''} width={img.w} height={img.h} priority={priority}
        sizes={`${img.maxw}px`} style={{ maxWidth: img.maxw }} className="mx-auto h-auto w-full" />
    );
  }
  return (
    <Image
      src={img.src} alt={img.alt || ''} width={img.w} height={img.h}
      priority={priority} sizes={sizes}
      className="h-auto w-full rounded-2xl border border-line bg-white"
    />
  );
}
