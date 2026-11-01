'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { num, money } from '@/lib/money';
import { site } from '@/config/site';
import { youtubeId } from '@/lib/youtube';
import { variantAxes, type Axis } from '@/lib/variants';
import type { Product } from '@/lib/types';
import ImageUploader from './ImageUploader';
import VariantEditor, { type ColorAxis } from './VariantEditor';

interface Axes { sizes: Axis[]; colors: ColorAxis[] }

/** অ্যাডমিন ইংরেজিতে — ক্যাটাগরির নাম site.ts-এ বাংলায় (দোকানের জন্য), এখানে ইংরেজি */
const CAT_EN: Record<string, string> = { 'ladies-inner': 'Ladies inner', shapewear: 'Shapewear', baby: 'Baby', gadget: 'Gadget' };

/** নতুন প্রোডাক্টে কনফিগের চেনা সাইজগুলো বসানো থাকে, রঙ কিছু নয় */
const freshAxes = (): Axes => ({
  sizes: site.options.enabled ? site.options.values.map((v) => ({ key: v.key, label: v.label })) : [],
  colors: [],
});

/** এডিট করতে খোলা প্রোডাক্টের বর্তমান সাইজ-রঙ, চাবিসহ হুবহু */
function axesOf(p: Product): Axes {
  const { sizes, colors } = variantAxes(p.product_variants || []);
  return {
    // একটাই সাইজ আর তার চাবি 'one' = এই পণ্যের আসলে সাইজ নেই
    sizes: sizes.length === 1 && sizes[0].key === 'one' ? [] : sizes,
    colors: colors.map((c) => ({ key: c.key, label: c.label, hex: c.hex || '#CCCCCC' })),
  };
}

const EMPTY: Partial<Product> = {
  code: '', name: '', slug: '', category: site.categories[0]?.key || 'general',
  price: 0, compare_price: null, images: [], description: '', video_url: '', active: true, sort: 99,
};

export default function ProductManager({ initial }: { initial: Product[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const [axes, setAxes] = useState<Axes>(freshAxes);
  // মডাল খোলার সময় যা ছিল — কী কী বদলাল সেটা বোঝাতে
  const [axes0, setAxes0] = useState<Axes>(freshAxes);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  /**
   * স্টকের সংখ্যাগুলো এখানে আলাদা করে রাখি, যাতে বাটনে চাপ দিলে
   * সার্ভারের উত্তরের জন্য অপেক্ষা না করেই সংখ্যাটা বদলে যায়।
   * সার্ভার থেকে নতুন ডাটা এলে আবার মিলিয়ে নেওয়া হয়।
   */
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const m: Record<string, number> = {};
    for (const p of initial) for (const v of p.product_variants || []) m[v.id] = v.stock;
    setStocks(m);
  }, [initial]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initial;
    return initial.filter((p) =>
      p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s));
  }, [initial, q]);

  /* ---------------- সেভ ---------------- */

  async function save() {
    if (!edit) return;
    setBusy(true); setMsg('Saving…');
    const res = await fetch('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', product: edit, sizes: axes.sizes, colors: axes.colors }),
    });
    const j = await res.json();
    setBusy(false);
    if (!j.ok) { setMsg(j.error || 'Not saved.'); return; }
    setMsg(j.note ? `Saved — ${j.note}` : 'Saved.'); setEdit(null);
    start(() => router.refresh());
  }

  function flash(ids: string[]) {
    setSaved((s) => ({ ...s, ...Object.fromEntries(ids.map((i) => [i, true])) }));
    setTimeout(() => setSaved((s) => {
      const n = { ...s }; for (const i of ids) delete n[i]; return n;
    }), 1400);
  }

  /** নির্দিষ্ট সংখ্যা বসানো */
  async function setStock(variantId: string, stock: number) {
    const next = Math.max(0, stock);
    setStocks((s) => ({ ...s, [variantId]: next }));
    const res = await fetch('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stock', variantId, stock: next }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) flash([variantId]); else setMsg('Stock not saved.');
    start(() => router.refresh());
  }

  /** যোগ/বিয়োগ — এক বা একাধিক ঘরে */
  async function addStock(variantIds: string[], delta: number) {
    if (!variantIds.length || !delta) return;
    setStocks((s) => {
      const n = { ...s };
      for (const id of variantIds) n[id] = Math.max(0, (n[id] ?? 0) + delta);
      return n;
    });
    const res = await fetch('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stockAdd', variantIds, delta }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) {
      if (res.stocks) setStocks((s) => ({ ...s, ...res.stocks }));
      flash(variantIds);
    } else setMsg('Stock not saved.');
    start(() => router.refresh());
  }

  async function toggle(p: Product) {
    await fetch('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', id: p.id, active: !p.active }),
    });
    start(() => router.refresh());
  }

  /* ---------------- রেন্ডার ---------------- */

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => { const a = freshAxes(); setAxes(a); setAxes0(a); setEdit({ ...EMPTY }); }}
          className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white">
          + New product
        </button>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or code"
          className="min-w-52 flex-1 rounded-full border-2 border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand sm:max-w-xs" />
        <span className="text-sm text-ink-3">{num(list.length)} products</span>
        {msg && <span className="text-sm font-semibold text-brand">{msg}</span>}
      </div>

      {edit && (
        <EditModal
          edit={edit} setEdit={setEdit} save={save} busy={busy}
          axes={axes} setAxes={setAxes} axes0={axes0}
          close={() => { setEdit(null); setMsg(''); }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p) => (
          <ProductRow
            key={p.id} p={p} stocks={stocks} saved={saved}
            onEdit={() => { const a = axesOf(p); setAxes(a); setAxes0(a); setEdit(p); }} onToggle={() => toggle(p)}
            setStock={setStock} addStock={addStock}
          />
        ))}
      </div>

      {!list.length && (
        <p className="rounded-xl2 border border-line bg-white p-10 text-center text-sm text-ink-3">
          {q ? 'Nothing matches that search.' : 'No products yet. Add one with the button above.'}
        </p>
      )}
    </div>
  );
}

/* ================= একটি প্রোডাক্টের কার্ড ================= */

function ProductRow({
  p, stocks, saved, onEdit, onToggle, setStock, addStock,
}: {
  p: Product;
  stocks: Record<string, number>;
  saved: Record<string, boolean>;
  onEdit: () => void;
  onToggle: () => void;
  setStock: (id: string, n: number) => void;
  addStock: (ids: string[], d: number) => void;
}) {
  const variants = [...(p.product_variants || [])].sort((a, b) => a.sort - b.sort);
  const ids = variants.map((v) => v.id);
  const total = ids.reduce((a, id) => a + (stocks[id] ?? 0), 0);
  const [bulk, setBulk] = useState(10);

  // রঙ ধরে ধরে ভাগ করা। রঙ না থাকলে একটাই দল, শিরোনামে সাইজের নাম।
  const groups = useMemo(() => {
    const by = new Map<string, { key: string; label: string; hex: string | null; variants: typeof variants; ids: string[] }>();
    for (const v of variants) {
      const key = v.color_key || '';
      if (!by.has(key)) {
        by.set(key, {
          key,
          label: key ? (v.color_label || key) : 'Stock by size',
          hex: key ? v.color_hex : null,
          variants: [], ids: [],
        });
      }
      const g = by.get(key)!;
      g.variants.push(v); g.ids.push(v.id);
    }
    return [...by.values()];
  }, [variants]);

  return (
    <div className={`rounded-xl2 border bg-white p-4 ${p.active ? 'border-line' : 'border-line opacity-60'}`}>
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
          {p.images?.[0] && (
            <Image src={p.images[0]} alt={p.name} fill sizes="96px" className="object-contain" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="text-xs text-ink-3">{p.code}</p>
            </div>
            <span className="font-display font-bold tabular-nums text-brand">{money(p.price)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={onEdit}
              className="rounded-full border-2 border-line px-3 py-1 text-xs font-semibold hover:border-brand hover:text-brand">
              Edit
            </button>
            <button onClick={onToggle}
              className="rounded-full border-2 border-line px-3 py-1 text-xs font-semibold hover:border-warn hover:text-warn">
              {p.active ? 'Hide' : 'Show'}
            </button>
            <span className={`rounded-full px-3 py-1 text-xs font-bold tabular-nums ${
              total === 0 ? 'bg-pinkc-soft text-pinkc' : 'bg-brand-soft text-brand'}`}>
              Total {num(total)} pcs
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-line/60 pt-3">
        {/* সব ঘরে একসাথে যোগ — নতুন মাল এলে এক ক্লিকে */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-cream p-2">
          <span className="text-xs font-semibold">New stock arrived?</span>
          <input type="number" min={1} value={bulk}
            onChange={(e) => setBulk(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded-md border-2 border-line bg-white px-2 py-1 text-center text-sm tabular-nums outline-none focus:border-brand" />
          <button onClick={() => addStock(ids, bulk)}
            className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
            +{num(bulk)} to all
          </button>
        </div>

        {/*
          রঙ থাকলে রঙ ধরে ধরে আলাদা সারি — নইলে "লাল ৩৬" আর "কালো ৩৬"
          পাশাপাশি বসে যেত আর কোনটা কোন রঙের বোঝা যেত না।
          রঙ না থাকলে আগের মতোই একটাই তালিকা।
        */}
        {groups.map((g) => (
          <div key={g.key} className="mb-3 last:mb-0">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
                {g.hex && <span style={{ background: g.hex }} className="h-3 w-3 rounded-full border border-line" />}
                {g.label}
              </span>
              {groups.length > 1 && (
                <button onClick={() => addStock(g.ids, bulk)}
                  className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-brand hover:border-brand">
                  +{num(bulk)} to this colour
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {g.variants.map((v) => {
                const n = stocks[v.id] ?? v.stock;
                return (
                  <div key={v.id}
                    className={`rounded-lg border-2 p-1.5 transition-colors ${
                      saved[v.id] ? 'border-ok bg-ok/5'
                        : n === 0 ? 'border-pinkc/40'
                        : n <= 3 ? 'border-warn/50' : 'border-line'}`}>
                    <span className="mb-1 block text-center text-[10px] text-ink-3">{v.opt_label}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => addStock([v.id], -1)} aria-label="Decrease"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded font-bold text-ink-3 hover:bg-sunk">−</button>
                      <input type="number" min={0} value={n}
                        onChange={(e) => setStock(v.id, Number(e.target.value))}
                        className={`w-full min-w-0 rounded border-0 bg-transparent px-0 py-0.5 text-center text-sm font-bold tabular-nums outline-none ${
                          n === 0 ? 'text-pinkc' : n <= 3 ? 'text-warn' : ''}`} />
                      <button onClick={() => addStock([v.id], 1)} aria-label="Increase"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded font-bold text-brand hover:bg-sunk">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <p className="mt-1.5 text-[11px] text-ink-3">
          − / + saves instantly. Typing a number also saves.
        </p>
      </div>
    </div>
  );
}

/* ================= এডিট মডাল ================= */

function EditModal({
  edit, setEdit, save, busy, close, axes, setAxes, axes0,
}: {
  edit: Partial<Product>;
  setEdit: (p: Partial<Product>) => void;
  save: () => void;
  busy: boolean;
  close: () => void;
  axes: Axes;
  setAxes: (a: Axes) => void;
  axes0: Axes;
}) {
  const box = useRef<HTMLDivElement>(null);

  // Esc-এ বন্ধ, আর পিছনের পাতা যাতে স্ক্রল না করে
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    box.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:items-center">
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true"
        className="my-auto w-full max-w-2xl rounded-xl2 border-2 border-brand bg-white p-5 shadow-2xl outline-none">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold">
            {edit.id ? `Edit product — ${edit.code}` : 'New product'}
          </h2>
          <button onClick={close} aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xl text-ink-3 hover:bg-sunk">×</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" hint={`e.g. ${site.codePrefix}-17`}>
            <input value={edit.code || ''} onChange={(e) => setEdit({ ...edit, code: e.target.value })} className={INPUT} />
          </Field>
          <Field label="Name">
            <input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={INPUT} />
          </Field>
          <Field label="Category">
            <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className={INPUT}>
              {site.categories.map((c) => <option key={c.key} value={c.key}>{CAT_EN[c.key] || c.label}</option>)}
            </select>
          </Field>
          <Field label="Sort order" hint="Lower numbers show first">
            <input type="number" value={edit.sort ?? 99}
              onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} className={INPUT} />
          </Field>
          <Field label="Price (৳)">
            <input type="number" value={edit.price ?? 0}
              onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} className={INPUT} />
          </Field>
          <Field label="Compare-at price (৳)" hint="Used to calculate the discount badge">
            <input type="number" value={edit.compare_price ?? 0}
              onChange={(e) => setEdit({ ...edit, compare_price: Number(e.target.value) })} className={INPUT} />
          </Field>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold">Product images</span>
            <ImageUploader
              images={edit.images || []}
              onChange={(next) => setEdit({ ...edit, images: next })}
            />
          </div>
          <div className="sm:col-span-2">
            <Field label="YouTube video link (optional)"
              hint="Paste the link — watch, youtu.be or shorts all work">
              <input value={edit.video_url || ''} placeholder="https://www.youtube.com/watch?v=..."
                onChange={(e) => setEdit({ ...edit, video_url: e.target.value })} className={INPUT} />
            </Field>
            {edit.video_url && !youtubeId(edit.video_url) && (
              <p className="mt-1 text-xs font-semibold text-pinkc">
                This doesn't look like a YouTube link — the video won't show on the product page.
              </p>
            )}
            {youtubeId(edit.video_url) && (
              <p className="mt-1 text-xs font-semibold text-ok">✓ Video recognised</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <VariantEditor
              sizes={axes.sizes} colors={axes.colors}
              onChange={setAxes} isNew={!edit.id} initial={axes0}
            />
          </div>
          <div className="sm:col-span-2">
            <Field label="Description (optional)">
              <textarea rows={3} value={edit.description || ''}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })} className={INPUT} />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={save} disabled={busy}
            className="rounded-full bg-brand px-6 py-2.5 font-display font-bold text-white disabled:opacity-60">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button onClick={close}
            className="rounded-full border-2 border-line px-6 py-2.5 font-display font-bold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const INPUT = 'w-full rounded-lg border-2 border-line bg-cream px-3 py-2 text-sm outline-none focus:border-brand focus:bg-white';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}
