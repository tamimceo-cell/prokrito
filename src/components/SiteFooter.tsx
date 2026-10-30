import Link from 'next/link';
import Image from 'next/image';
import { bn, tk } from '@/lib/money';
import { site } from '@/config/site';
import WhatsAppFab from './WhatsAppFab';

export default function SiteFooter({ contact }: { contact: Record<string, string> }) {
  const wa = contact.whatsapp || site.contact.whatsapp;
  const phone = contact.phone || site.contact.phone;
  const email = contact.email || site.contact.email;
  const address = contact.address || site.contact.address;

  const shopLinks: [string, string][] = [
    ['/shop', site.words.allItems],
    ...(site.combos.enabled ? ([['/offer', 'কম্বো অফার']] as [string, string][]) : []),
    ...site.categories.slice(0, 2).map((c) => [`/shop?cat=${c.key}`, c.label] as [string, string]),
  ];

  return (
    <>
      <footer className="mt-12 bg-ink pt-10 text-cream">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <Image src={site.logoSm} alt="" width={54} height={54} className="h-[54px] w-[54px] object-contain" />
                <b className="font-display text-lg">{site.name}</b>
              </div>
              <p className="text-sm opacity-80">{site.description}</p>
              <p className="mt-2 text-sm opacity-80">{site.domain}</p>
            </div>

            <div>
              <h4 className="mb-3 font-display text-gold-bright">দোকান</h4>
              {shopLinks.map(([h, l]) => (
                <Link key={h + l} href={h} className="mb-1.5 block text-sm opacity-80 hover:text-gold-bright hover:opacity-100">{l}</Link>
              ))}
            </div>

            <div>
              <h4 className="mb-3 font-display text-gold-bright">সহায়তা</h4>
              {[['/contact', 'যোগাযোগ'], ['/about', 'আমাদের সম্পর্কে'], ['/contact', 'ডেলিভারি তথ্য'], ['/contact', 'রিটার্ন ও এক্সচেঞ্জ']].map(([h, l], i) => (
                <Link key={i} href={h} className="mb-1.5 block text-sm opacity-80 hover:text-gold-bright hover:opacity-100">{l}</Link>
              ))}
            </div>

            <div>
              <h4 className="mb-3 font-display text-gold-bright">যোগাযোগ</h4>
              {phone && <a href={`tel:+${wa || phone}`} className="mb-1.5 block text-sm opacity-80">ফোন: {bn(phone)}</a>}
              {email && <p className="mb-1.5 text-sm opacity-80">ইমেইল: {email}</p>}
              {address && <p className="mb-1.5 text-sm opacity-80">{address}</p>}
              <p className="mt-3 text-sm opacity-80">
                ডেলিভারি: ঢাকার ভিতরে {tk(site.shipping.inside)} · বাইরে {tk(site.shipping.outside)}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-cream/15 py-4 text-xs opacity-60">
            <span>© {bn(new Date().getFullYear())} {site.name}। সর্বস্বত্ব সংরক্ষিত।</span>
            <span>ক্যাশ অন ডেলিভারি · স্টিডফাস্ট কুরিয়ার</span>
          </div>
        </div>
      </footer>

      {wa && <WhatsAppFab phone={wa} />}
    </>
  );
}
