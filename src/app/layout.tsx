import type { Metadata } from 'next';
/*
 * ফন্ট নিজের সার্ভার থেকে (@fontsource), Google Fonts থেকে নয়।
 * কেন: next/font/google বিল্ডের সময় Google-এ যায় — Hostinger-এর বিল্ডে সেটা
 * একবার ভেঙে গিয়েছিল ("Cannot read properties of null"), আর ডিপ্লয় আটকে
 * গিয়েছিল। নিজের ফাইলে সেই ঝুঁকি নেই, আর ফোনেও বাড়তি ডোমেইনে যেতে হয় না।
 * শুধু বাংলা আর ল্যাটিন অংশ — বাকি ভাষার ফাইল ফোনে নামে না।
 */
import '@fontsource/baloo-da-2/bengali-500.css';
import '@fontsource/baloo-da-2/bengali-700.css';
import '@fontsource/baloo-da-2/bengali-800.css';
import '@fontsource/baloo-da-2/latin-500.css';
import '@fontsource/baloo-da-2/latin-700.css';
import '@fontsource/baloo-da-2/latin-800.css';
import '@fontsource/hind-siliguri/bengali-400.css';
import '@fontsource/hind-siliguri/bengali-600.css';
import '@fontsource/hind-siliguri/bengali-700.css';
import '@fontsource/hind-siliguri/latin-400.css';
import '@fontsource/hind-siliguri/latin-600.css';
import '@fontsource/hind-siliguri/latin-700.css';
import { site, siteUrl } from '@/config/site';
import Housekeeping from '@/components/Housekeeping';
import './globals.css';


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
    <html lang="bn">
      <body className="font-body">
        {children}
        <Housekeeping />
      </body>
    </html>
  );
}
