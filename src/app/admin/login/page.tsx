'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_USERNAME_HINT } from '@/lib/admin-user';
import { site } from '@/config/site';

export default function Login() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userId, password: pass }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: 'Connection problem. Please try again.' }));
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'Wrong username or password.'); return; }
    router.replace('/admin');
    router.refresh();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 text-ink">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl2 border border-line bg-white p-7">
        <h1 className="font-display text-2xl font-extrabold">Admin login</h1>
        <p className="mb-6 mt-1 text-sm text-ink-3">{site.name}</p>

        <label className="mb-1.5 block text-sm font-semibold" htmlFor="userid">Username</label>
        <input id="userid" type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false}
          placeholder={ADMIN_USERNAME_HINT} value={userId} onChange={(e) => setUserId(e.target.value)}
          className="mb-4 w-full rounded-lg border-2 border-line bg-cream px-4 py-2.5 outline-none focus:border-brand" />

        <label className="mb-1.5 block text-sm font-semibold" htmlFor="pass">Password</label>
        <input id="pass" type="password" required autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)}
          className="mb-5 w-full rounded-lg border-2 border-line bg-cream px-4 py-2.5 outline-none focus:border-brand" />

        {err && <p className="mb-4 rounded-lg bg-pinkc-soft px-3 py-2 text-sm text-pinkc">{err}</p>}

        <button disabled={busy}
          className="w-full rounded-full bg-brand py-3 font-display font-bold text-white disabled:opacity-60">
          {busy ? 'Please wait…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
