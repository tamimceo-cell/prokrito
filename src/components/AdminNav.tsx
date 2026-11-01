'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin',          label: 'Dashboard' },
  { href: '/admin/orders',   label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/landing',  label: 'Landing pages' },
  { href: '/admin/events',   label: 'Pixel events' },
  { href: '/admin/import',   label: 'Old site data' },
];

export default function AdminNav() {
  const path = usePathname();

  return (
    /*
     * মোবাইলে মেনুটা নিজের সারিতে (w-full), কারণ লোগো আর লগআউট বাটনের
     * পাশে এক সারিতে রাখলে জায়গা থাকে না — আগে ~৬০px-এ চেপে গিয়ে শুধু
     * "ড্যাশবো…" দেখা যেত, বাকি তিনটে অপশন লুকিয়ে থাকত।
     * ৬৪০px থেকে আগের মতোই এক সারিতে।
     */
    <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-2 sm:mx-0 sm:w-auto sm:flex-1 sm:px-0">
      {NAV.map((n) => {
        const active = n.href === '/admin' ? path === '/admin' : path?.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition sm:px-4 ${
              active ? 'bg-brand text-white' : 'text-ink-2 hover:bg-sunk hover:text-ink'}`}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
