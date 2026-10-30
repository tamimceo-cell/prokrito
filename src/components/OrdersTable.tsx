'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bn, tk, STATUS_LABEL } from '@/lib/money';
import type { Order } from '@/lib/types';
import { RateBadge, type CourierStat, type OwnStat } from './RateBadge';

const NEXT_STATUS: Record<string, { to: string; label: string }[]> = {
  new:       [{ to: 'confirmed', label: 'কনফার্ম' }, { to: 'cancelled', label: 'বাতিল' }],
  confirmed: [{ to: 'courier',   label: 'কুরিয়ারে' }, { to: 'cancelled', label: 'বাতিল' }],
  courier:   [{ to: 'delivered', label: 'ডেলিভার্ড' }, { to: 'returned', label: 'রিটার্ন' }],
  delivered: [],
  returned:  [],
  cancelled: [{ to: 'new', label: 'ফিরিয়ে আনুন' }],
};

const TONE: Record<string, string> = {
  new: 'bg-gold/15 text-gold', confirmed: 'bg-brand-soft text-brand',
  courier: 'bg-sky-100 text-sky-800', delivered: 'bg-ok/15 text-ok',
  returned: 'bg-warn/15 text-warn', cancelled: 'bg-ink-3/15 text-ink-3',
};

const COURIER_NAME = { pathao: 'Pathao', steadfast: 'স্টিডফাস্ট' } as const;

export default function OrdersTable({ orders, courier = 'steadfast', courierStats = {}, own = {} }: {
  orders: Order[]; courier?: 'pathao' | 'steadfast';
  courierStats?: Record<string, CourierStat>; own?: Record<string, OwnStat>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [restock, setRestock] = useState(true);

  const toggle = (id: string) =>
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function setStatus(id: string, status: string) {
    const res = await fetch('/api/orders/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const j = await res.json();
    setMsg(j.ok ? 'অবস্থা আপডেট হয়েছে।' : (j.error || 'আপডেট হয়নি।'));
    start(() => router.refresh());
  }

  /** স্থায়ীভাবে মুছে ফেলা — টেস্ট বা ভুয়া অর্ডারের জন্য */
  async function remove(id: string) {
    setConfirmDel(null);
    setMsg('মুছে ফেলা হচ্ছে…');
    const res = await fetch('/api/orders/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restock }),
    });
    const j = await res.json();
    setMsg(j.ok
      ? `অর্ডার #${bn(j.orderNo)} মুছে ফেলা হয়েছে${j.restored ? ` — ${bn(j.restored)} পিস স্টকে ফেরত গেছে` : ''}।`
      : (j.error || 'মোছা যায়নি।'));
    setOpen(null);
    start(() => router.refresh());
  }

  async function sendToCourier() {
    const ids = [...sel];
    if (!ids.length) { setMsg('আগে অর্ডার বাছাই করুন।'); return; }
    setMsg(`${COURIER_NAME[courier]}-এ পাঠানো হচ্ছে…`);
    const res = await fetch(`/api/${courier}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const j = await res.json();
    const fails = Array.isArray(j.failed) && j.failed.length ? ` · ${bn(j.failed.length)}টি যায়নি: ${j.failed.join(' | ')}` : '';
    setMsg(j.ok ? `${bn(j.sent)}টি অর্ডার কুরিয়ারে পাঠানো হয়েছে।${fails}` : (j.error || 'পাঠানো যায়নি।'));
    setSel(new Set());
    start(() => router.refresh());
  }

  /** কুরিয়ারে থাকা অর্ডারের অবস্থা Pathao থেকে টেনে আনা */
  async function syncCourier() {
    setMsg('Pathao থেকে স্ট্যাটাস আনা হচ্ছে…');
    const res = await fetch('/api/pathao/sync', { method: 'POST' });
    const j = await res.json().catch(() => null);
    setMsg(j?.ok ? `${bn(j.checked)}টি দেখা হয়েছে, ${bn(j.changed)}টির অবস্থা বদলেছে।` : (j?.error || 'আনা যায়নি।'));
    start(() => router.refresh());
  }

  if (!orders.length) {
    return <p className="rounded-xl2 border border-line bg-white p-10 text-center text-sm text-ink-3">
      এই তালিকায় কোনো অর্ডার নেই।
    </p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={sendToCourier} disabled={!sel.size || pending}
          className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white disabled:opacity-45">
          {COURIER_NAME[courier]}-এ পাঠান {sel.size ? `(${bn(sel.size)})` : ''}
        </button>
        {courier === 'pathao' && (
          <button onClick={syncCourier} disabled={pending}
            className="rounded-full border-2 border-line bg-white px-4 py-1.5 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand disabled:opacity-45">
            ↻ ডেলিভারি স্ট্যাটাস আপডেট
          </button>
        )}
        {msg && <span className="text-sm text-ink-2">{msg}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl2 border border-line bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="w-10 p-3"></th>
              <th className="p-3">অর্ডার</th>
              <th className="p-3">কাস্টমার</th>
              <th className="p-3">ঠিকানা</th>
              <th className="p-3 text-right">টাকা</th>
              <th className="p-3">অবস্থা</th>
              <th className="p-3">পদক্ষেপ</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr className="border-b border-line/60 align-top">
                  <td className="p-3">
                    <input type="checkbox" checked={sel.has(o.id)} onChange={() => toggle(o.id)}
                      aria-label={`অর্ডার ${o.order_no} বাছাই`} className="accent-brand" />
                  </td>
                  <td className="p-3">
                    <button onClick={() => setOpen(open === o.id ? null : o.id)}
                      className="font-display font-bold tabular-nums hover:text-brand">
                      #{bn(o.order_no)}
                    </button>
                    <div className="text-xs text-ink-3">
                      {new Date(o.created_at).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    {o.is_flagged && (
                      <div className="mt-1 inline-block rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
                        সন্দেহজনক
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{o.name}</div>
                    <a href={`tel:+${o.phone}`} className="text-xs text-ink-2 tabular-nums hover:text-brand">
                      {bn('0' + o.phone.slice(3))}
                    </a>
                    <RateBadge courier={courierStats[o.phone]} own={own[o.phone]} />
                  </td>
                  <td className="max-w-[240px] p-3 text-xs text-ink-2">
                    {o.address}
                    {/* কাস্টমারের লেখা কালার/সাইজ/কোড — কল সেন্টার যেন ফোনে মিলিয়ে নিতে পারে */}
                    {o.note && (
                      <div className="mt-1 rounded bg-brand-soft px-1.5 py-0.5 font-semibold text-brand">📝 {o.note}</div>
                    )}
                    <div className="mt-0.5 font-semibold">
                      {o.city_type === 'inside' ? 'ঢাকা সিটি' : 'ঢাকার বাইরে'}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-display font-bold tabular-nums">{tk(o.total)}</div>
                    <div className="text-xs text-ink-3 tabular-nums">পণ্য {tk(o.subtotal)}</div>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TONE[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                    {o.consignment_id && (
                      <div className="mt-1 text-[11px] text-ink-3">CN {o.consignment_id}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(NEXT_STATUS[o.status] || []).map((a) => (
                        <button key={a.to} onClick={() => setStatus(o.id, a.to)} disabled={pending}
                          className="rounded-full border-2 border-line px-3 py-1 text-xs font-semibold hover:border-brand hover:text-brand disabled:opacity-50">
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
                {open === o.id && (
                  <tr className="border-b border-line/60 bg-cream/60">
                    <td colSpan={7} className="p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="mb-2 font-display font-bold">পণ্য</h4>
                          <ul className="space-y-1 text-sm">
                            {(o.order_items || []).map((it) => (
                              <li key={it.id} className="flex justify-between gap-4">
                                <span>{it.product_name}
                                  <span className="text-ink-3">
                                    {' · '}{[it.opt_label, it.color_label].filter(Boolean).join(' · ') || '—'} · {bn(it.qty)} পিস
                                  </span>
                                </span>
                                <span className="tabular-nums">{tk(it.line_total ?? it.qty * it.unit_price)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="mb-2 font-display font-bold">কোথা থেকে এসেছে</h4>
                          <dl className="space-y-1 text-sm text-ink-2">
                            <div className="flex justify-between gap-4"><dt>ল্যান্ডিং পেইজ</dt><dd>{o.landing_slug || '—'}</dd></div>
                            <div className="flex justify-between gap-4"><dt>ক্যাম্পেইন</dt><dd>{o.utm_campaign || '—'}</dd></div>
                            <div className="flex justify-between gap-4"><dt>অ্যাডসেট</dt><dd>{o.utm_content || '—'}</dd></div>
                            <div className="flex justify-between gap-4"><dt>সোর্স</dt><dd>{o.utm_source || '(direct)'}</dd></div>
                            {o.tracking_code && (
                              <div className="flex justify-between gap-4"><dt>ট্র্যাকিং</dt><dd>{o.tracking_code}</dd></div>
                            )}
                          </dl>
                        </div>
                      </div>

                      {/* মুছে ফেলা — ভুল করে চাপার সুযোগ কম রাখতে দুই ধাপে */}
                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                        {confirmDel === o.id ? (
                          <>
                            <span className="text-sm font-semibold text-pinkc">
                              #{bn(o.order_no)} স্থায়ীভাবে মুছে যাবে — ফেরানো যাবে না।
                            </span>
                            <label className="flex items-center gap-1.5 text-xs text-ink-2">
                              <input type="checkbox" checked={restock}
                                onChange={(e) => setRestock(e.target.checked)} className="accent-brand" />
                              স্টক ফেরত দিন
                            </label>
                            <button onClick={() => remove(o.id)} disabled={pending}
                              className="rounded-full bg-pinkc px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                              হ্যাঁ, মুছে ফেলুন
                            </button>
                            <button onClick={() => setConfirmDel(null)}
                              className="rounded-full border-2 border-line px-4 py-1.5 text-xs font-semibold">
                              থাক
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setConfirmDel(o.id)}
                              className="rounded-full border-2 border-line px-4 py-1.5 text-xs font-semibold text-ink-3 hover:border-pinkc hover:text-pinkc">
                              অর্ডার মুছে ফেলুন
                            </button>
                            <span className="text-[11px] text-ink-3">
                              শুধু টেস্ট বা ভুয়া অর্ডারের জন্য — সাধারণ ক্ষেত্রে &ldquo;বাতিল&rdquo; করুন, তাতে হিসাব থেকে যায়
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
