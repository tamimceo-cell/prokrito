'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function RetryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const [msg, setMsg] = useState('');

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm text-ink-2">{msg}</span>}
      <button disabled={busy}
        onClick={async () => {
          setBusy(true); setMsg('পাঠানো হচ্ছে…');
          const r = await fetch('/api/events/retry', { method: 'POST', body: '{}' });
          const j = await r.json();
          setMsg(`${j.sent}/${j.tried} সফল`);
          setBusy(false);
          start(() => router.refresh());
        }}
        className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
        ব্যর্থগুলো আবার পাঠান
      </button>
    </div>
  );
}
