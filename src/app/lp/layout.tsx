import Image from 'next/image';
import Pixel from '@/components/Pixel';
import { getSettings } from '@/lib/catalog';
import { site } from '@/config/site';
import { bn } from '@/lib/money';
import WhatsAppFab from '@/components/WhatsAppFab';

/**
 * ল্যান্ডিং পেইজের লেআউট — দোকানের মেনু, কার্ট, সার্চ কিছুই নেই।
 * এড থেকে আসা মানুষের সামনে একটাই কাজ: অর্ডার করা। পুরনো CartFlows
 * পেইজও এমনই ছিল (Elementor Canvas), তাই কনভার্শনের ধরন একই থাকে।
 */
export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  const { contact } = await getSettings();
  const phone = contact.phone || site.contact.phone;
  const wa = contact.whatsapp || site.contact.whatsapp;
  const address = contact.address || site.contact.address;

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex items-center gap-2">
            <Image src={site.logoSm} alt={site.name} width={40} height={40} priority className="h-10 w-10 object-contain" />
            <b className="font-display text-base">{site.name}</b>
          </span>
          {phone && (
            <a href={`tel:${phone.replace(/\D/g, '')}`} className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-bold text-brand tabular-nums">
              📞 {bn(phone)}
            </a>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-10 border-t border-line bg-white py-6 text-center text-xs text-ink-3">
        <p className="font-display text-sm font-bold text-ink">{site.name}</p>
        <p className="mt-1">{site.description}</p>
        {phone && <p className="mt-1 tabular-nums">মোবাইল ও হোয়াটসঅ্যাপ: <a href={`tel:${phone.replace(/\D/g, '')}`} className="font-semibold text-brand">{bn(phone)}</a></p>}
        {address && <p className="mx-auto mt-1 max-w-md px-4">{address}</p>}
        <p className="mt-2">© {bn(new Date().getFullYear())} {site.domain}</p>
      </footer>
      {/* হোয়াটসঅ্যাপ বোতাম — পুরনো পেইজে "ইনবক্স করুন" ছিল, এখানে সরাসরি চ্যাট */}
      {wa && <WhatsAppFab phone={wa} hideNear="#order-form" />}
      <Pixel />
    </>
  );
}
