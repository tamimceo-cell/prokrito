'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCart } from './CartContext';
import { bn } from '@/lib/money';
import { site } from '@/config/site';

const NAV = [
  { href: '/', label: 'হোম' },
  { href: '/shop', label: site.words.allItems },
  ...(site.combos.enabled ? [{ href: '/offer', label: 'কম্বো অফার' }] : []),
  { href: '/about', label: 'আমাদের সম্পর্কে' },
  { href: '/contact', label: 'যোগাযোগ' },
];

export default function SiteHeader({ contact }: { contact: Record<string, string> }) {
  const { count } = useCart();
  const path = usePathname();

  const phone = contact.phone || site.contact.phone;
  const wa = contact.whatsapp || site.contact.whatsapp;
  const address = contact.address || site.contact.address;

  return (
    <>
      {(phone || address) && (
        <div className="bg-ink text-cream">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs">
            {phone && (
              <span>
                হেল্পলাইন: <a href={`tel:+${wa || phone}`} className="font-semibold text-gold-bright">{bn(phone)}</a>
                {site.contact.hours && <> · {site.contact.hours}</>}
              </span>
            )}
            {address && <span className="opacity-80">{address} · ক্যাশ অন ডেলিভারি</span>}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:gap-4">
          <Link href="/" className="mr-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
            <Image src={site.logoSm} alt={site.name} width={52} height={52} priority
              className="h-11 w-11 object-contain sm:h-[52px] sm:w-[52px]" />
            <span className="leading-tight">
              <span className="block font-display text-base font-extrabold sm:text-lg">{site.name}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-brand sm:text-[11px] sm:tracking-wider">
                {site.tagline}
              </span>
            </span>
          </Link>
          <form action="/shop" className="hidden flex-1 overflow-hidden rounded-full border-2 border-line bg-cream sm:flex">
            <input name="q" placeholder={site.words.searchHint} aria-label={`${site.words.item} খুঁজুন`}
              className="min-w-0 flex-1 bg-transparent px-5 py-2.5 outline-none" />
            <button className="bg-brand px-6 font-semibold text-white">খুঁজুন</button>
          </form>
          <Link href="/checkout" aria-label="কার্ট"
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-line bg-cream">
            🛒
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold tabular-nums text-white">
              {bn(count)}
            </span>
          </Link>
        </div>
      </header>

      <nav className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-semibold ${
                path === n.href ? 'border-brand text-brand' : 'border-transparent text-ink-2 hover:text-ink'}`}>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
