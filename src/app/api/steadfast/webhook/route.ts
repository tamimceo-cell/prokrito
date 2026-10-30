/**
 * POST /api/steadfast/webhook — ডেলিভারি স্ট্যাটাস অটো আপডেট
 *
 * Steadfast পোর্টালে এই URL বসাবেন:
 *   https://masruphafashion.com/api/steadfast/webhook?token=<STEADFAST_WEBHOOK_SECRET>
 *
 * ডেলিভার্ড হলে Meta-তে OrderDelivered কাস্টম ইভেন্ট যায়, যাতে পরে
 * আসল লাভজনকতার উপর অপ্টিমাইজ করা যায় — অর্ডার প্লেসমেন্টের উপর নয়।
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { mapCourierStatus } from '@/lib/steadfast';
import { buildEvent, sendWithRetry, newEventId } from '@/lib/capi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!process.env.STEADFAST_WEBHOOK_SECRET || token !== process.env.STEADFAST_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const b: any = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ ok: false }, { status: 400 });

  const invoice = String(b.invoice ?? b.order_id ?? '');
  const consignment = b.consignment_id ? String(b.consignment_id) : null;
  const courierStatus = String(b.status ?? b.delivery_status ?? '');
  if (!invoice && !consignment) return NextResponse.json({ ok: false }, { status: 400 });

  const db = getDb();
  const q = db.from('orders').select('id, order_no, name, phone, subtotal, fbp, fbc, fbclid, client_ip, user_agent, landing_url, status');
  const { data: order } = consignment
    ? await q.eq('consignment_id', consignment).maybeSingle()
    : await q.eq('order_no', Number(invoice)).maybeSingle();

  if (!order) return NextResponse.json({ ok: false, error: 'অর্ডার পাওয়া যায়নি' }, { status: 404 });

  const mapped = mapCourierStatus(courierStatus);
  const patch: Record<string, unknown> = {
    courier_status: courierStatus,
    courier_synced_at: new Date().toISOString(),
  };
  if (mapped) patch.status = mapped;
  if (mapped === 'delivered') patch.delivered_at = new Date().toISOString();

  await db.from('orders').update(patch).eq('id', order.id);

  // ডেলিভার্ড হলে একবারই OrderDelivered পাঠাই
  if (mapped === 'delivered' && order.status !== 'delivered') {
    const eventId = newEventId();
    const event = buildEvent({
      eventName: 'OrderDelivered',
      eventId,
      eventSourceUrl: order.landing_url || process.env.NEXT_PUBLIC_SITE_URL || '',
      actionSource: 'system_generated',
      user: {
        name: order.name, phone: order.phone, externalId: String(order.order_no),
        fbp: order.fbp, fbc: order.fbc, fbclid: order.fbclid,
        ip: order.client_ip, userAgent: order.user_agent,
      },
      custom: { value: order.subtotal, currency: 'BDT', order_id: String(order.order_no) },
    });

    const { data: log } = await db.from('capi_events').insert({
      order_id: order.id, event_name: 'OrderDelivered', event_id: eventId,
      event_time: (event as any).event_time, payload: event as any, status: 'pending',
    }).select('id').single();

    const r = await sendWithRetry([event]);
    if (log) {
      await db.from('capi_events').update({
        status: r.ok ? 'sent' : 'failed', attempts: 1,
        response: (r.body ?? null) as any, error: r.error ?? null,
        sent_at: new Date().toISOString(),
      }).eq('id', log.id);
    }
  }

  return NextResponse.json({ ok: true });
}
