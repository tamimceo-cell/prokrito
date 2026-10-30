import type { Metadata } from 'next';
import { Baloo_Da_2, Hind_Siliguri } from 'next/font/google';
import { site, siteUrl } from '@/config/site';
import Housekeeping from '@/components/Housekeeping';
import './globals.css';

const display = Baloo_Da_2({
  subsets: ['bengali', 'latin'], weight: ['500', '600', '700', '800'],
  variable: '--font-display', display: 'swap',
});
const body = Hind_Siliguri({
  subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700'],
  variable: '--font-body', display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { type: 'website', locale: 'bn_BD', siteName: site.name },
  robots: { index: true, follow: true },
  // Meta ডোমেইন ভেরিফিকেশন — Business Settings → Brand safety → Domains
  // এটা কোডেই রাখা হলো, DNS-এ নয়: DNS পরে অন্য জায়গায় সরালেও ভেরিফিকেশন টিকে থাকে
  ...(site.facebookDomainVerification
    ? { verification: { other: { 'facebook-domain-verification': site.facebookDomainVerification } } }
    : {}),
};

/**
 * রুট লেআউট — শুধু html/body ও ফন্ট।
 * দোকানের হেডার-ফুটার (shop)/layout.tsx-এ, অ্যাডমিনের চেহারা
 * admin/(dash)/layout.tsx-এ। দুটো আলাদা রাখায় অ্যাডমিন প্যানেলে
 * দোকানের হেডার আসে না।
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${display.variable} ${body.variable}`}>
      <body className="font-body">
        {children}
        <Housekeeping />
      </body>
    </html>
  );
}
