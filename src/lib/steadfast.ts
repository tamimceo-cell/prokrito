/**
 * Steadfast Courier — Merchant API
 * ডক: https://steadfast.com.bd  (Portal > API)
 *
 * টোকেন কখনো ক্লায়েন্টে যায় না — সব কল সার্ভার রুট থেকে।
 */

const BASE = process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1';

function headers() {
  const key = process.env.STEADFAST_API_KEY;
  const secret = process.env.STEADFAST_SECRET_KEY;
  if (!key || !secret) throw new Error('Steadfast API key/secret সেট করা নেই');
  return {
    'Api-Key': key,
    'Secret-Key': secret,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export interface ConsignmentInput {
  invoice: string;          // আমাদের order_no
  recipientName: string;
  recipientPhone: string;   // 01XXXXXXXXX — Steadfast এই ফরম্যাট চায়
  recipientAddress: string;
  codAmount: number;        // মোট টাকা (ডেলিভারি চার্জসহ)
  note?: string;
}

export interface ConsignmentResult {
  ok: boolean;
  consignmentId?: string;
  trackingCode?: string;
  status?: string;
  error?: string;
}

/** 8801XXXXXXXXX বা +88... → 01XXXXXXXXX */
export function toLocalPhone(p: string) {
  const d = String(p).replace(/\D/g, '');
  if (d.startsWith('880')) return '0' + d.slice(3);
  if (d.startsWith('0')) return d;
  if (d.length === 10) return '0' + d;
  return d;
}

function mapOne(i: ConsignmentInput) {
  return {
    invoice: i.invoice,
    recipient_name: i.recipientName,
    recipient_phone: toLocalPhone(i.recipientPhone),
    recipient_address: i.recipientAddress,
    cod_amount: i.codAmount,
    note: i.note || '',
  };
}

/** একটি কনসাইনমেন্ট */
export async function createConsignment(i: ConsignmentInput): Promise<ConsignmentResult> {
  try {
    const res = await fetch(`${BASE}/create_order`, {
      method: 'POST', headers: headers(), body: JSON.stringify(mapOne(i)),
      signal: AbortSignal.timeout(15000),
    });
    const j: any = await res.json().catch(() => null);
    if (!res.ok || j?.status !== 200) {
      return { ok: false, error: j?.message || `Steadfast ত্রুটি (${res.status})` };
    }
    return {
      ok: true,
      consignmentId: String(j.consignment?.consignment_id ?? ''),
      trackingCode: j.consignment?.tracking_code,
      status: j.consignment?.status,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** এক কলে অনেকগুলো (Steadfast সর্বোচ্চ ৫০০ নেয়) */
export async function createBulk(list: ConsignmentInput[]) {
  try {
    const res = await fetch(`${BASE}/create_order/bulk-order`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ data: list.map(mapOne) }),
      signal: AbortSignal.timeout(30000),
    });
    const j: any = await res.json().catch(() => null);
    if (!res.ok) return { ok: false as const, error: j?.message || `Steadfast ত্রুটি (${res.status})`, rows: [] };
    return { ok: true as const, rows: (j?.data || []) as any[] };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message, rows: [] };
  }
}

/** ডেলিভারি স্ট্যাটাস জিজ্ঞেস করা */
export async function checkStatusByInvoice(invoice: string) {
  try {
    const res = await fetch(`${BASE}/status_by_invoice/${encodeURIComponent(invoice)}`, {
      headers: headers(), signal: AbortSignal.timeout(12000),
    });
    const j: any = await res.json().catch(() => null);
    return { ok: res.ok, status: j?.delivery_status as string | undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** কুরিয়ারের স্ট্যাটাস → আমাদের স্ট্যাটাস */
export function mapCourierStatus(s?: string): 'courier' | 'delivered' | 'returned' | null {
  if (!s) return null;
  const v = s.toLowerCase();
  if (v.includes('deliver')) return 'delivered';
  if (v.includes('return') || v.includes('cancel')) return 'returned';
  if (v.includes('pending') || v.includes('progress') || v.includes('hold')) return 'courier';
  return null;
}
