'use client';

import { useState } from 'react';
import { bn, tk } from '@/lib/money';
import type { Tier, ExtraField } from '@/lib/landing';

interface Row {
  id?: string; slug: string; product_id: string | null; title: string;
  blocks: unknown[]; tiers: Tier[]; form_title: string | null;
  note_label: string | null; note_required: boolean; extra_fields?: ExtraField[]; thankyou_slug: string | null;
  active: boolean; sort: number;
}
interface Prod { id: string; code: string; name: string; price: number }

const blank = (): Row => ({
  slug: '', product_id: null, title: '', blocks: [{ t: 'heading', text: '', size: 'xl' }, { t: 'cta' }],
  tiers: [{ qty: 1, price: 0, default: true }], form_title: null, note_label: null,
  note_required: false, thankyou_slug: null, active: true, sort: 0,
});

export default function LandingManager({
  initial, products, counts,
}: { initial: Row[]; products: Prod[]; counts: Record<string, number> }) {
  const [rows, setRows] = useState(initial);
  const [edit, setEdit] = useState<Row | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setEdit(blank())} className="btn-cta px-5 py-2.5 text-sm">+ নতুন ল্যান্ডিং পেইজ</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {rows.length === 0 && <p className="p-6 text-center text-sm text-ink-3">এখনো কোনো পেইজ নেই</p>}
        {rows.map((r) => {
          const p = products.find((x) => x.id === r.product_id);
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line/60 p-4 last:border-0">
              <div className="min-w-0 flex-1">
                <b className="font-display">{r.title}</b>
                {!r.active && <span className="ml-2 rounded-full bg-sunk px-2 py-0.5 text-xs">বন্ধ</span>}
                <a href={`/product/${r.slug}/`} target="_blank" className="block truncate text-xs text-brand">/product/{r.slug}/</a>
                <span className="text-xs text-ink-3">
                  {p ? `${p.code} · ${p.name}` : 'প্রোডাক্ট নেই'} · {r.tiers.map((t) => `${bn(t.qty)}টা ${tk(t.price)}`).join(' | ')}
                </span>
              </div>
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
                ৩০ দিনে {bn(counts[r.slug] || 0)} অর্ডার
              </span>
              <button onClick={() => setEdit(structuredClone(r))} className="btn-out px-4 py-1.5 text-sm">এডিট</button>
            </div>
          );
        })}
      </div>

      {edit && (
        <Editor
          row={edit} products={products}
          onClose={() => setEdit(null)}
          onSaved={(r) => {
            setRows((rs) => (rs.some((x) => x.id === r.id) ? rs.map((x) => (x.id === r.id ? r : x)) : [...rs, r]));
            setEdit(null);
          }}
        />
      )}
    </>
  );
}

function Editor({ row, products, onClose, onSaved }: {
  row: Row; products: Prod[]; onClose: () => void; onSaved: (r: Row) => void;
}) {
  const [r, setR] = useState<Row>(row);
  const [blocks, setBlocks] = useState(JSON.stringify(row.blocks, null, 2));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<Row>) => setR((x) => ({ ...x, ...patch }));
  const setTier = (i: number, patch: Partial<Tier>) =>
    set({ tiers: r.tiers.map((t, j) => (j === i ? { ...t, ...patch } : patch.default ? { ...t, default: false } : t)) });

  // আগে থেকে চালু থাকা পেইজের লিংক বদলানো = এডের লিংক ভাঙা
  const slugLocked = !!row.id;

  async function save() {
    setErr('');
    let parsed: unknown;
    try { parsed = JSON.parse(blocks); } catch { setErr('পেইজের অংশ (JSON) ঠিক নেই — কমা বা ব্র্যাকেট দেখুন।'); return; }
    setBusy(true);
    const landing = { ...r, blocks: parsed };
    const res = await fetch('/api/landing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ landing }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(false);
    if (!j?.ok) { setErr(j?.error || 'সেভ হয়নি'); return; }
    onSaved({ ...(landing as Row), id: j.id });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-3 sm:p-8" onClick={onClose}>
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-xl font-extrabold">{row.id ? 'ল্যান্ডিং পেইজ এডিট' : 'নতুন ল্যান্ডিং পেইজ'}</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <L label="নাম (ট্যাবে দেখায়)"><input className="field" value={r.title} onChange={(e) => set({ title: e.target.value })} /></L>
          <L label="প্রোডাক্ট">
            <select className="field" value={r.product_id || ''} onChange={(e) => set({ product_id: e.target.value || null })}>
              <option value="">— বেছে নিন —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name} ({tk(p.price)})</option>)}
            </select>
          </L>
          <L label={`লিংক: /product/${r.slug || '…'}/`}>
            <input className="field disabled:opacity-60" value={r.slug} disabled={slugLocked}
              onChange={(e) => set({ slug: e.target.value.toLowerCase() })} placeholder="front-button" />
          </L>
          <L label="অর্ডারের পরে যে পাতা (ঐচ্ছিক)">
            <input className="field" value={r.thankyou_slug || ''} onChange={(e) => set({ thankyou_slug: e.target.value.toLowerCase() })} placeholder="thank-you" />
          </L>
        </div>
        {slugLocked && <p className="mt-1 text-xs text-warn">চালু পেইজের লিংক বদলানো যায় না — এড এই লিংকেই চলছে।</p>}

        <h3 className="mb-2 mt-5 font-display font-bold">অফার</h3>
        <div className="space-y-2">
          {r.tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-[70px_100px_1fr_auto_auto] items-center gap-2">
              <input className="field px-2 py-2" type="number" min={1} value={t.qty} title="কয়টা"
                onChange={(e) => setTier(i, { qty: Number(e.target.value) })} />
              <input className="field px-2 py-2" type="number" min={1} value={t.price || ''} title="মোট দাম" placeholder="দাম"
                onChange={(e) => setTier(i, { price: Number(e.target.value) })} />
              <input className="field px-2 py-2" value={t.tag || ''} placeholder="ট্যাগ (ঐচ্ছিক)"
                onChange={(e) => setTier(i, { tag: e.target.value })} />
              <label className="flex items-center gap-1 text-xs" title="পাতা খুললে এটা বাছা থাকবে">
                <input type="radio" checked={!!t.default} onChange={() => setTier(i, { default: true })} /> ডিফল্ট
              </label>
              <button onClick={() => set({ tiers: r.tiers.filter((_, j) => j !== i) })} className="text-sm text-ink-3 hover:text-warn">✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => set({ tiers: [...r.tiers, { qty: (r.tiers.at(-1)?.qty || 0) + 1, price: 0 }] })}
          className="mt-2 text-sm font-semibold text-brand">+ অফার যোগ করুন</button>
        <p className="mt-1 text-xs text-ink-3">দাম = ওই কয়টার মোট দাম (যেমন ২টা ৯৫০), প্রতি পিসের নয়।</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <L label="ফর্মের শিরোনাম (ঐচ্ছিক)"><input className="field" value={r.form_title || ''} onChange={(e) => set({ form_title: e.target.value })} /></L>
          <L label="বাড়তি ঘর (যেমন: ড্রেসের কোড)"><input className="field" value={r.note_label || ''} onChange={(e) => set({ note_label: e.target.value })} /></L>
        </div>
        <L label="ফর্মের আরও ঘর — প্রতি লাইনে একটা (যেমন: কালার লিখুন(স্কিন, পিংক)); বাধ্যতামূলক হলে শেষে *">
          <textarea className="field h-20 text-sm" spellCheck={false}
            value={(r.extra_fields || []).map((x) => x.label + (x.required ? ' *' : '')).join('\n')}
            onChange={(e) => set({
              extra_fields: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => ({
                name: '', label: line.replace(/\s*\*$/, ''), required: /\*$/.test(line),
              })),
            })} />
        </L>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.note_required} onChange={(e) => set({ note_required: e.target.checked })} /> বাড়তি ঘর পূরণ বাধ্যতামূলক</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.active} onChange={(e) => set({ active: e.target.checked })} /> চালু</label>
        </div>

        <details className="mt-5">
          <summary className="cursor-pointer font-display font-bold">পেইজের লেখা ও ছবি (অ্যাডভান্সড)</summary>
          <p className="my-2 text-xs text-ink-3">
            ধরন: heading · text · image · gallery · video · list · features · compare · cta · html · order (ফর্মের জায়গা) — না বুঝলে এখানে হাত দেবেন না।
          </p>
          <textarea className="field h-80 font-mono text-xs" value={blocks} onChange={(e) => setBlocks(e.target.value)} spellCheck={false} />
        </details>

        {err && <p className="mt-4 rounded-lg bg-pinkc-soft px-4 py-3 text-sm font-semibold text-pinkc">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-out px-5 py-2.5 text-sm">বাতিল</button>
          <button onClick={save} disabled={busy} className="btn-cta px-6 py-2.5 text-sm disabled:opacity-60">{busy ? 'সেভ হচ্ছে…' : 'সেভ করুন'}</button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}</label>;
}
