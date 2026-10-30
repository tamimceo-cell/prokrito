'use client';

import { useState } from 'react';
import { bn } from '@/lib/money';
import { RateBadge, type CourierStat } from './RateBadge';

/**
 * যেকোনো নম্বরের ডেলিভারি ইতিহাস — ফোনে অর্ডার নেওয়ার সময় বা সন্দেহ হলে।
 * Pathao মার্চেন্ট প্যানেলে "নতুন ডেলিভারি"-তে যে সংখ্যা দেখায়, সেটাই।
 */
export default function CustomerCheck() {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ pathao: CourierStat | null; pathaoError: string | null; own: any } | null>(null);
  const [err, setErr] = useState('');

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(''); setRes(null);
    const r = await fetch('/api/pathao/customer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, force: true }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (!j?.ok) { setErr(j?.error || 'দেখা যায়নি'); return; }
    setRes(j);
  }

  return (
    <form onSubmit={check} className="flex flex-wrap items-center gap-2 rounded-xl2 border border-line bg-white p-3">
      <b className="font-display text-sm">কাস্টমার চেক</b>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="০১XXXXXXXXX"
        className="w-40 rounded-full border-2 border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
      <button disabled={busy || phone.length < 11} className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-45">
        {busy ? 'দেখা হচ্ছে…' : 'সাকসেস রেট দেখুন'}
      </button>
      {err && <span className="text-sm text-warn">{err}</span>}
      {res && (
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <RateBadge courier={res.pathao || undefined} own={res.own} />
          {!res.pathao && <span className="text-xs text-warn">Pathao: {res.pathaoError}</span>}
          <span className="text-xs text-ink-3">
            আমাদের দোকানে {bn(res.own.orders)}টি অর্ডার · ডেলিভার্ড {bn(res.own.delivered)} · রিটার্ন {bn(res.own.returned)} · বাতিল {bn(res.own.cancelled)}
          </span>
        </span>
      )}
    </form>
  );
}
