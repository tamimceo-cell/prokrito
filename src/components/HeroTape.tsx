import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/types';
import { site } from '@/config/site';
import { tk, bn } from '@/lib/money';

/**
 * প্রকৃতর হিরো — ইনারওয়্যার কেনার দুটো চেনা জিনিস দিয়ে:
 *  ১. ট্রায়াল রুমের খিলান-আয়না, ভেতরে একটা প্রোডাক্ট, গায়ে দামের ট্যাগ ঝোলানো
 *  ২. দর্জির হলুদ মাপের ফিতা, তাতে সাইজগুলো — "সব সাইজ আছে, ফোনে মিলিয়ে নিই"
 * ফিতাটাই একমাত্র নড়াচড়া — পাতা খুললে একবার গড়িয়ে আসে।
 */
export default function HeroTape({ product, from }: { product?: Product; from: number }) {
  const h = site.home;
  const sizes = h.tapeSizes || [];
  const phone = site.contact.phone;

  return (
    <section className="relative overflow-hidden bg-[#FDF0F4]">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-14 pt-6 sm:gap-8 sm:pb-20 sm:pt-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:pt-12">
        {/* লেখা — মোবাইলে আয়নার নিচে, বড় পর্দায় বাঁয়ে */}
        <div className="order-2 lg:order-1">
          <p className="font-display text-base font-bold text-[#A61E4D]">{h.heroBadge}</p>
          <h1 className="mt-2 max-w-[12ch] font-display text-[2.6rem] font-extrabold leading-[1.08] tracking-tight text-[#2B2B2B] sm:text-6xl">
            {h.heroTitle}
          </h1>
          <p className="mt-4 max-w-[40ch] text-[1.05rem] leading-relaxed text-[#4A4A4A]">{h.heroSub}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/shop" className="btn-cta px-7 py-3.5 text-base">সব পণ্য দেখুন</Link>
            {phone && (
              <a href={`tel:${phone.replace(/\D/g, '')}`}
                className="inline-flex items-center gap-2 rounded-full border-2 border-[#2B2B2B]/15 bg-white px-5 py-3 font-display font-bold text-[#2B2B2B] tabular-nums hover:border-[#D6336C]">
                কল করুন {bn(phone)}
              </a>
            )}
          </div>
        </div>

        {/* খিলান-আয়না */}
        <div className="relative order-1 mx-auto w-full max-w-[220px] sm:max-w-[320px] lg:order-2 lg:max-w-[400px]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[28px] border-[8px] border-white sm:border-[10px] bg-white shadow-[0_30px_60px_-30px_rgba(166,30,77,.45)]">
            {product?.images?.[0] && (
              <Image src={product.images[0]} alt={product.name} fill priority
                sizes="(max-width: 640px) 220px, 400px" className="object-cover" />
            )}
          </div>
          {/* ঝোলানো দামের ট্যাগ */}
          {from > 0 && (
            <div className="absolute -right-2 top-[18%] origin-top rotate-[8deg] sm:-right-6">
              <span className="mx-auto block h-7 w-px bg-[#2B2B2B]/40" aria-hidden />
              <span className="relative block rounded-lg bg-white px-4 pb-3 pt-4 text-center shadow-md">
                <span className="absolute left-1/2 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full border border-[#2B2B2B]/30" aria-hidden />
                <b className="block font-display text-xl font-extrabold leading-none text-[#D6336C] tabular-nums">{tk(from)}</b>
                <span className="mt-1 block text-[11px] font-semibold text-[#4A4A4A]">থেকে শুরু</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* মাপের ফিতা */}
      {sizes.length > 0 && (
        <div className="relative -mt-6 pb-8">
          <div className="hero-tape -mx-4 -rotate-[1.5deg] shadow-[0_8px_20px_-12px_rgba(0,0,0,.35)]">
            <div className="flex h-[68px] items-end justify-between gap-6 overflow-hidden bg-[#F2C14E] px-6 pb-2.5 [background-image:repeating-linear-gradient(90deg,rgba(43,43,43,.55)_0_1px,transparent_1px_12px),repeating-linear-gradient(90deg,rgba(43,43,43,.8)_0_2px,transparent_2px_60px)] [background-size:100%_12px,100%_22px] [background-repeat:repeat-x] sm:justify-center sm:gap-14">
              {[...sizes, ...sizes].map((s, i) => (
                <span key={i} className={`font-display text-lg font-extrabold leading-none text-[#2B2B2B] tabular-nums ${i >= sizes.length ? 'hidden 2xl:inline' : ''}`}>{s}</span>
              ))}
            </div>
          </div>
          {h.tapeNote && (
            <p className="mx-auto mt-5 max-w-6xl px-4 text-center text-sm font-semibold text-[#A61E4D]">{h.tapeNote}</p>
          )}
        </div>
      )}
    </section>
  );
}
