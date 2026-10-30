import { getDb } from './db';
import { pathaoOrderInfo, mapPathaoStatus } from './pathao';
import { sendDeliveredEvent } from './delivered';

/** একটা অর্ডারের আসল অবস্থা Pathao থেকে এনে বসানো। বদলালে true। */
export async function syncOne(o: any & { consignment_id: string }) {
  const db = getDb();
  const info = await pathaoOrderInfo(o.consignment_id);
  const mapped = mapPathaoStatus(info.status);
  const patch: Record<string, unknown> = { courier_status: info.status, courier_synced_at: new Date().toISOString() };
  // ডেলিভার্ড/রিটার্নড থেকে পিছনে যাওয়া নয় — পরের "পেমেন্ট" স্ট্যাটাসে অবস্থা নষ্ট হতো
  const final = ['delivered', 'returned'].includes(o.status);
  if (mapped && !final && mapped !== o.status) patch.status = mapped;
  if (patch.status === 'delivered') patch.delivered_at = new Date().toISOString();
  await db.from('orders').update(patch).eq('id', o.id);
  if (patch.status === 'delivered') await sendDeliveredEvent(o);
  return !!patch.status;
}
