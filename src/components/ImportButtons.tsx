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
    }).then((x) => x.json()).catch(() => ({ ok: false, error: 'Connection problem' }));
    setBusy(null);
    setMsg(r.ok ? `Done: ${JSON.stringify(r.result)}` : `Failed: ${r.error}`);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
      <button onClick={() => run('catalog')} disabled={!!busy} className="btn-cta w-full py-3 disabled:opacity-60">
        {busy === 'catalog' ? 'Importing…' : '1. Import products and landing pages'}
      </button>
      <button onClick={() => run('orders')} disabled={!!busy} className="btn-out w-full py-3 disabled:opacity-60">
        {busy === 'orders' ? 'Importing… (may take a minute or two)' : '2. Import old orders'}
      </button>
      {msg && <p className="rounded-lg bg-sunk px-3 py-2 text-sm">{msg}</p>}
    </div>
  );
}
