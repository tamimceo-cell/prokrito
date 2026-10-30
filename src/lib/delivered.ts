/**
 * অর্ডার ডেলিভার্ড হলে Meta-তে OrderDelivered কাস্টম ইভেন্ট — একবারই।
 * পরে "অর্ডার" নয়, "আসলে ডেলিভার হওয়া অর্ডার"-এর উপর এড অপটিমাইজ করা যায়।
 * কুরিয়ার যেটাই হোক (Pathao, Steadfast) — এখান থেকেই যায়।
 */
import { getDb } from './db';
import { buildEvent, sendWithRetry, newEventId } from './capi';

export async function sendDeliveredEvent(order: {
  id: string; order_no: number; name: string; phone: string; subtotal: number;
  fbp: string | null; fbc: string | null; fbclid: string | null;
  client_ip: string | null; user_agent: string | null; landing_url: string | null;
}) {
  const db = getDb();
  const eventId = newEventId();
  const event = buildEvent({
    eventName: 'OrderDelivered',
    eventId,
    eventSourceUrl: order.landing_url || process.env.NEXT_PUBLIC_SITE_URL || '',
    actionSource: 'system_generated',
    user: {
      name: order.name, phone: order.phone, externalId: order.phone,
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

export const ORDER_FOR_EVENT =
  'id, order_no, name, phone, subtotal, fbp, fbc, fbclid, client_ip, user_agent, landing_url, status';
