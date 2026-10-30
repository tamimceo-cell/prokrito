'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { site } from '@/config/site';

/**
 * প্রথম অ্যাডমিন বানানোর পাতা — একবারই কাজ করে।
 * টোকেনটা Hostinger-এর Environment variables-এ ADMIN_SETUP_TOKEN নামে বসানো।
 */
export default function Setup() {
  const router = useRouter();
  const [f, setF] = useState({ token: '', username: '', password: '', again: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (f.password !== f.again) { setErr('দুই পাসওয়ার্ড মিলছে না।'); return; }
    setBusy(true);
    const r = await fetch('/api/admin/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: f.token, username: f.username, password: f.password }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: 'নেটওয়ার্কে সমস্যা।' }));
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.replace('/admin/login');
  }

  const input = 'mb-4 w-full rounded-lg border-2 border-line bg-cream px-4 py-2.5 outline-none focus:border-brand';
  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 text-ink">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl2 border border-line bg-white p-7">
        <h1 className="font-display text-2xl font-extrabold">প্রথম অ্যাডমিন</h1>
        <p className="mb-6 mt-1 text-sm text-ink-3">{site.name} — শুধু একবার</p>
        <label className="mb-1.5 block text-sm font-semibold">সেটআপ টোকেন</label>
        <input required type="password" value={f.token} onChange={set('token')} className={input} />
        <label className="mb-1.5 block text-sm font-semibold">ইউজারনেম (ইংরেজিতে)</label>
        <input required autoCapitalize="none" spellCheck={false} value={f.username} onChange={set('username')} className={input} />
        <label className="mb-1.5 block text-sm font-semibold">পাসওয়ার্ড (কমপক্ষে ১০ অক্ষর)</label>
        <input required type="password" autoComplete="new-password" value={f.password} onChange={set('password')} className={input} />
        <label className="mb-1.5 block text-sm font-semibold">আবার পাসওয়ার্ড</label>
        <input required type="password" autoComplete="new-password" value={f.again} onChange={set('again')} className={input} />
        {err && <p className="mb-4 rounded-lg bg-pinkc-soft px-3 py-2 text-sm text-pinkc">{err}</p>}
        <button disabled={busy} className="w-full rounded-full bg-brand py-3 font-display font-bold text-white disabled:opacity-60">
          {busy ? 'অপেক্ষা করুন…' : 'অ্যাডমিন বানান'}
        </button>
      </form>
    </div>
  );
}
