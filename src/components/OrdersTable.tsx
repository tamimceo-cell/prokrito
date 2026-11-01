'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { num, money, adminTime, STATUS_LABEL } from '@/lib/money';
import type { Order } from '@/lib/types';
import { RateBadge, type CourierStat, type OwnStat } from './RateBadge';

/*
 * hold — কাস্টমার "পরে দিন" বলেছে বা ফোন ধরেনি। কুরিয়ারে পাঠানো যায় না
 * (pathao/send বাদ দেয়), বাতিলও হয় না — পরে এখান থেকেই কনফার্ম বা বাতিল।
 */
const NEXT_STATUS: Record<string, { to: string; label: string }[]> = {
  new:       [{ to: 'confirmed', label: 'Confirm' }, { to: 'hold', label: 'Hold' }, { to: 'cancelled', label: 'Cancel' }],
  hold:      [{ to: 'confirmed', label: 'Confirm' }, { to: 'new', label: 'Release hold' }, { to: 'cancelled', label: 'Cancel' }],
  confirmed: [{ to: 'courier',   label: 'Mark sent to courier' }, { to: 'hold', label: 'Hold' }, { to: 'cancelled', label: 'Cancel' }],
  courier:   [{ to: 'delivered', label: 'Delivered' }, { to: 'returned', label: 'Returned' }],
  delivered: [],
  returned:  [],
  cancelled: [{ to: 'new', label: 'Restore' }],
};

const TONE: Record<string, string> = {
  new: 'bg-gold/15 text-gold', hold: 'bg-violet-100 text-violet-800', confirmed: 'bg-brand-soft text-brand',
  courier: 'bg-sky-100 text-sky-800', delivered: 'bg-ok/15 text-ok',
  returned: 'bg-warn/15 text-warn', cancelled: 'bg-ink-3/15 text-ink-3',
};

const COURIER_NAME = { pathao: 'Pathao', steadfast: 'Steadfast' } as const;

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
    setMsg(j.ok ? `Status changed to ${STATUS_LABEL[status]}.` : (j.error || 'Not updated.'));
    start(() => router.refresh());
  }

  /** স্থায়ীভাবে মুছে ফেলা — টেস্ট বা ভুয়া অর্ডারের জন্য */
  async function remove(id: string) {
    setConfirmDel(null);
    setMsg('Deleting…');
    const res = await fetch('/api/orders/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restock }),
    });
    const j = await res.json();
    setMsg(j.ok
      ? `Order #${j.orderNo} deleted${j.restored ? ` — ${num(j.restored)} pcs returned to stock` : ''}.`
      : (j.error || 'Not deleted.'));
    setOpen(null);
    start(() => router.refresh());
  }

  async function sendToCourier() {
    const ids = [...sel];
    if (!ids.length) { setMsg('Select orders first.'); return; }
    setMsg(`Sending to ${COURIER_NAME[courier]}…`);
    const res = await fetch(`/api/${courier}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const j = await res.json();
    const fails = Array.isArray(j.failed) && j.failed.length ? ` · ${j.failed.length} failed: ${j.failed.join(' | ')}` : '';
    setMsg(j.ok ? `${num(j.sent)} order(s) sent to the courier.${fails}` : (j.error || 'Not sent.'));
    setSel(new Set());
    start(() => router.refresh());
  }

  /** কুরিয়ারে থাকা অর্ডারের অবস্থা Pathao থেকে টেনে আনা */
  async function syncCourier() {
    setMsg('Fetching status from Pathao…');
    const res = await fetch('/api/pathao/sync', { method: 'POST' });
    const j = await res.json().catch(() => null);
    setMsg(j?.ok ? `${num(j.checked)} checked, ${num(j.changed)} changed.` : (j?.error || 'Could not fetch.'));
    start(() => router.refresh());
  }

  if (!orders.length) {
    return <p className="rounded-xl2 border border-line bg-white p-10 text-center text-sm text-ink-3">
      No orders in this list.
    </p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={sendToCourier} disabled={!sel.size || pending}
          className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white disabled:opacity-45">
          Send to {COURIER_NAME[courier]} {sel.size ? `(${sel.size})` : ''}
        </button>
        {courier === 'pathao' && (
          <button onClick={syncCourier} disabled={pending}
            className="rounded-full border-2 border-line bg-white px-4 py-1.5 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand disabled:opacity-45">
            ↻ Update delivery status
          </button>
        )}
        {msg && <span className="text-sm text-ink-2">{msg}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl2 border border-line bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="w-10 p-3"></th>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Address</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr className="border-b border-line/60 align-top">
                  <td className="p-3">
                    <input type="checkbox" checked={sel.has(o.id)} onChange={() => toggle(o.id)}
                      aria-label={`Select order ${o.order_no}`} className="accent-brand" />
                  </td>
                  <td className="p-3">
                    <button onClick={() => setOpen(open === o.id ? null : o.id)}
                      className="font-display font-bold tabular-nums hover:text-brand">
                      #{o.order_no}
                    </button>
                    <div className="text-xs text-ink-3">
                      {adminTime(o.created_at)}
                    </div>
                    {o.is_flagged && (
                      <div className="mt-1 inline-block rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
                        Suspicious
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{o.name}</div>
                    <a href={`tel:+${o.phone}`} className="text-xs text-ink-2 tabular-nums hover:text-brand">
                      {'0' + o.phone.slice(3)}
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
                      {o.city_type === 'inside' ? 'Inside Dhaka' : 'Outside Dhaka'}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-display font-bold tabular-nums">{money(o.total)}</div>
                    <div className="text-xs text-ink-3 tabular-nums">Items {money(o.subtotal)}</div>
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
                          <h4 className="mb-2 font-display font-bold">Items</h4>
                          <ul className="space-y-1 text-sm">
                            {(o.order_items || []).map((it) => (
                              <li key={it.id} className="flex justify-between gap-4">
                                <span>{it.product_name}
                                  <span className="text-ink-3">
                                    {' · '}{[it.opt_label, it.color_label].filter(Boolean).join(' · ') || '—'} · {num(it.qty)} pcs
                                  </span>
                                </span>
                                <span className="tabular-nums">{money(it.line_total ?? it.qty * it.unit_price)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="mb-2 font-display font-bold">Source</h4>
                          <dl className="space-y-1 text-sm text-ink-2">
                            <div className="flex justify-between gap-4"><dt>Landing page</dt><dd>{o.landing_slug || '—'}</dd></div>
                            <div className="flex justify-between gap-4"><dt>Campaign</dt><dd>{o.utm_campaign || '—'}</dd></div>
                            <div className="flex justify-between gap-4"><dt>Ad set</dt><dd>{o.utm_content || '—'}</dd></div>
                            <div className="flex justify-between gap-4"><dt>Source</dt><dd>{o.utm_source || '(direct)'}</dd></div>
                            {o.tracking_code && (
                              <div className="flex justify-between gap-4"><dt>Tracking</dt><dd>{o.tracking_code}</dd></div>
                            )}
                          </dl>
                        </div>
                      </div>

                      {/* মুছে ফেলা — ভুল করে চাপার সুযোগ কম রাখতে দুই ধাপে */}
                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                        {confirmDel === o.id ? (
                          <>
                            <span className="text-sm font-semibold text-pinkc">
                              #{o.order_no} will be permanently deleted — this can't be undone.
                            </span>
                            <label className="flex items-center gap-1.5 text-xs text-ink-2">
                              <input type="checkbox" checked={restock}
                                onChange={(e) => setRestock(e.target.checked)} className="accent-brand" />
                              Return stock
                            </label>
                            <button onClick={() => remove(o.id)} disabled={pending}
                              className="rounded-full bg-pinkc px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                              Yes, delete
                            </button>
                            <button onClick={() => setConfirmDel(null)}
                              className="rounded-full border-2 border-line px-4 py-1.5 text-xs font-semibold">
                              Keep
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setConfirmDel(o.id)}
                              className="rounded-full border-2 border-line px-4 py-1.5 text-xs font-semibold text-ink-3 hover:border-pinkc hover:text-pinkc">
                              Delete order
                            </button>
                            <span className="text-[11px] text-ink-3">
                              Only for test or fake orders — normally use &ldquo;Cancel&rdquo; so the record stays
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
