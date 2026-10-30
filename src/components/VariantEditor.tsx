'use client';

import { useState } from 'react';
import { bn } from '@/lib/money';
import { site } from '@/config/site';
import { axisKey, type Axis } from '@/lib/variants';

/**
 * প্রোডাক্টের সাইজ ও রঙ ঠিক করার ঘর।
 *
 * দুটো আলাদা তালিকা — সাইজ আর রঙ। ডাটাবেসে যা বসে সেটা এই দুইয়ের সব
 * জোড়া: ৩টি সাইজ × ২টি রঙ = ৬টি স্টকের ঘর। জোড়াগুলো নিজে হাতে বানাতে
 * হয় না, সার্ভার নিজেই গুণ করে নেয়।
 *
 * ⚠️ চাবি (key) নিয়ে সতর্কতা:
 * ডাটাবেসে প্রতিটি ঘর চেনা যায় তার চাবি দিয়ে। পুরনো ঘরের চাবি বদলে
 * গেলে ডাটাবেস সেটাকে নতুন ঘর ভাববে — পুরনোটা মুছে যাবে, সাথে তার
 * স্টকও। তাই নাম বদলালে (যেমন "লাল" → "গাঢ় লাল") চাবিটা অপরিবর্তিত
 * রাখা হয়; নতুন চাবি বসে শুধু নতুন লেখা নামে।
 */

export interface ColorAxis extends Axis { hex: string }

export default function VariantEditor({
  sizes, colors, onChange, isNew, initial,
}: {
  sizes: Axis[];
  colors: ColorAxis[];
  onChange: (next: { sizes: Axis[]; colors: ColorAxis[] }) => void;
  /** নতুন প্রোডাক্ট হলে স্টক হারানোর সতর্কতা দেখানোর দরকার নেই */
  isNew: boolean;
  /** মডাল খোলার সময় যা ছিল — কী বদলাল সেটা বোঝাতে */
  initial: { sizes: Axis[]; colors: ColorAxis[] };
}) {
  const [sizeText, setSizeText] = useState('');
  const [colorText, setColorText] = useState('');
  const [colorHex, setColorHex] = useState('#A8386B');

  const combos = Math.max(1, sizes.length || 1) * Math.max(1, colors.length || 1);

  /*
    প্রথমবার রঙ যোগ করা আলাদা ব্যাপার।

    এখন স্টক আছে রঙহীন ঘরে ("৩৬ — ১২ পিস")। রঙ যোগ করলে ঘরগুলো হয়ে
    যায় "লাল ৩৬", "কালো ৩৬" — সম্পূর্ণ নতুন ঘর, আর পুরনোটা মুছে যায়।
    পুরনো ১২ পিস কোন রঙের ছিল সেটা কেউ জানে না, তাই ভাগ করে দেওয়ারও
    উপায় নেই। সেভ করার পর সংখ্যাগুলো আবার বসাতে হয় — এটা আগে থেকে
    না জানালে দোকানদার ভাববে স্টক হারিয়ে গেছে।
  */
  const firstColor = initial.colors.length === 0 && colors.length > 0;
  const key = (a: { key: string; label: string }[]) => a.map((x) => `${x.key}:${x.label}`).join('|');
  const changed = key(sizes) !== key(initial.sizes) || key(colors) !== key(initial.colors);

  function addSize() {
    const label = sizeText.trim();
    if (!label) return;
    if (sizes.some((s) => s.label === label)) { setSizeText(''); return; }
    onChange({ sizes: [...sizes, { key: axisKey(label, sizes.map((s) => s.key)), label }], colors });
    setSizeText('');
  }

  function addColor(label: string, hex: string) {
    const name = label.trim();
    if (!name) return;
    if (colors.some((c) => c.label === name)) { setColorText(''); return; }
    onChange({ sizes, colors: [...colors, { key: axisKey(name, colors.map((c) => c.key)), label: name, hex }] });
    setColorText('');
  }

  const unusedSuggestions = site.colorSuggestions.filter(
    (s) => !colors.some((c) => c.label === s.label),
  );

  return (
    <div className="rounded-xl2 border-2 border-line bg-cream p-3.5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-sm font-bold">
          {site.words.optionAxis} ও {site.words.colorAxis}
        </span>
        <span className="text-[11px] text-ink-3">
          স্টকের ঘর হবে {bn(combos)}টি
          {sizes.length > 0 && colors.length > 0 &&
            ` (${bn(sizes.length)} × ${bn(colors.length)})`}
        </span>
      </div>

      {/* ---- সাইজ ---- */}
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
        {site.words.optionAxis}
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {sizes.map((s) => (
          <Chip key={s.key} label={s.label}
            onRemove={() => onChange({ sizes: sizes.filter((x) => x.key !== s.key), colors })} />
        ))}
        {!sizes.length && (
          <span className="text-xs text-ink-3">
            কিছু না দিলে এই পণ্যের {site.words.optionAxis} থাকবে না — একটাই স্টকের ঘর।
          </span>
        )}
      </div>
      <div className="mb-4 flex gap-1.5">
        <input
          value={sizeText}
          onChange={(e) => setSizeText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } }}
          placeholder={`${site.words.optionAxis} লিখে Enter — যেমন ৩৬`}
          className="min-w-0 flex-1 rounded-lg border-2 border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand" />
        <button type="button" onClick={addSize}
          className="shrink-0 rounded-lg border-2 border-line bg-white px-3 text-sm font-bold text-brand hover:border-brand">
          যোগ
        </button>
      </div>
      {!!site.options.values.length && !sizes.length && (
        <button type="button"
          onClick={() => onChange({ sizes: site.options.values.map((v) => ({ key: v.key, label: v.label })), colors })}
          className="mb-4 -mt-2 block text-[11px] font-semibold text-brand underline">
          চেনা {site.words.optionAxis}গুলো বসিয়ে দিন ({site.options.values.map((v) => v.label).join(', ')})
        </button>
      )}

      {/* ---- রঙ ---- */}
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
        {site.words.colorAxis}
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <Chip key={c.key} label={c.label} hex={c.hex}
            onRemove={() => onChange({ sizes, colors: colors.filter((x) => x.key !== c.key) })} />
        ))}
        {!colors.length && (
          <span className="text-xs text-ink-3">
            কিছু না দিলে প্রোডাক্ট পেইজে {site.words.colorAxis} বাছার ঘরটাই দেখাবে না।
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        {/* input[type=color] — ব্রাউজারের নিজের কালার পিকার */}
        <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)}
          aria-label={`${site.words.colorAxis} বাছুন`}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border-2 border-line bg-white p-0.5" />
        <input
          value={colorText}
          onChange={(e) => setColorText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColor(colorText, colorHex); } }}
          placeholder={`${site.words.colorAxis}ের নাম লিখে Enter — যেমন লাল`}
          className="min-w-0 flex-1 rounded-lg border-2 border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand" />
        <button type="button" onClick={() => addColor(colorText, colorHex)}
          className="shrink-0 rounded-lg border-2 border-line bg-white px-3 text-sm font-bold text-brand hover:border-brand">
          যোগ
        </button>
      </div>

      {!!unusedSuggestions.length && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-3">চাপলেই যোগ হবে:</span>
          {unusedSuggestions.map((c) => (
            <button key={c.key} type="button" onClick={() => addColor(c.label, c.hex)}
              className="flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-semibold hover:border-brand">
              <span style={{ background: c.hex }} className="h-3 w-3 rounded-full border border-line" />
              {c.label}
            </button>
          ))}
        </div>
      )}

      {!isNew && firstColor && (
        <p className="mt-3 rounded-lg border-2 border-warn/40 bg-white p-2 text-[11px] leading-relaxed text-warn">
          {/* {' '} লাগছে কারণ লেখার পর নতুন লাইনে {expression} বসলে JSX
              মাঝের ফাঁকাটা মুছে দেয় — "আছেরঙহীন" হয়ে যাচ্ছিল */}
          <b>খেয়াল করুন:</b> এই পণ্যে এখন {site.words.colorAxis} নেই, তাই স্টক আছে{' '}
          {site.words.colorAxis}হীন ঘরে। {site.words.colorAxis} যোগ করলে ওই ঘরগুলো
          মুছে গিয়ে নতুন জোড়াগুলো ০ থেকে শুরু হবে — সেভ করার পর স্টকের সংখ্যাগুলো
          আবার বসিয়ে নিতে হবে।
        </p>
      )}

      {!isNew && !firstColor && changed && (
        <p className="mt-3 rounded-lg bg-white p-2 text-[11px] leading-relaxed text-ink-3">
          সেভ করলে নতুন জোড়াগুলো ০ স্টক নিয়ে যোগ হবে, আর তালিকা থেকে বাদ দেওয়া
          ঘরগুলো তাদের স্টকসহ মুছে যাবে। শুধু নাম বদলালে স্টকে হাত পড়ে না, আর
          পুরনো অর্ডারে কোনো অবস্থাতেই কিছু বদলায় না।
        </p>
      )}
    </div>
  );
}

function Chip({ label, hex, onRemove }: { label: string; hex?: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-line bg-white py-1 pl-2.5 pr-1 text-sm font-semibold">
      {hex && <span style={{ background: hex }} className="h-3.5 w-3.5 rounded-full border border-line" />}
      {label}
      <button type="button" onClick={onRemove} aria-label={`${label} বাদ দিন`}
        className="grid h-5 w-5 place-items-center rounded-full text-ink-3 hover:bg-sunk hover:text-pinkc">
        ×
      </button>
    </span>
  );
}
