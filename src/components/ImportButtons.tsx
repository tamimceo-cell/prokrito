'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function run(what: 'catalog' | 'orders') {
    setBusy(what); setMsg('');
    const r = await fetch('/api/admin/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ what }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: 'নেটওয়ার্কে সমস্যা' }));
    setBusy(null);
    setMsg(r.ok ? `হয়েছে: ${JSON.stringify(r.result)}` : `হয়নি: ${r.error}`);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
      <button onClick={() => run('catalog')} disabled={!!busy} className="btn-cta w-full py-3 disabled:opacity-60">
        {busy === 'catalog' ? 'আনা হচ্ছে…' : '১. প্রোডাক্ট ও ল্যান্ডিং পেইজ আনুন'}
      </button>
      <button onClick={() => run('orders')} disabled={!!busy} className="btn-out w-full py-3 disabled:opacity-60">
        {busy === 'orders' ? 'আনা হচ্ছে… (এক-দুই মিনিট লাগতে পারে)' : '২. পুরনো অর্ডার আনুন'}
      </button>
      {msg && <p className="rounded-lg bg-sunk px-3 py-2 text-sm">{msg}</p>}
    </div>
  );
}
