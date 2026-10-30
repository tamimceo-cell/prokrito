import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import SignOut from '@/components/SignOut';
import AdminNav from '@/components/AdminNav';
import { toUsername } from '@/lib/admin-user';
import { site } from '@/config/site';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        {/*
          মোবাইলে দুই সারি — উপরে নাম ও লগআউট, নিচে মেনু।
          এক সারিতে তিনটেই রাখলে মেনুটা চেপে গিয়ে অপশনগুলো লুকিয়ে যেত।
        */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:gap-x-4 sm:py-3">
          <Link href="/admin" className="order-1 font-display text-base font-extrabold sm:text-lg">
            {site.name} <span className="text-brand">অ্যাডমিন</span>
          </Link>

          <div className="order-2 ml-auto flex items-center gap-3 text-sm sm:order-3">
            <span className="hidden text-ink-3 md:inline">{toUsername(admin.email)}</span>
            <SignOut />
          </div>

          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
