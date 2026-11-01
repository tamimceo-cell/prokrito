/**
 * Pathao Courier — Merchant API
 * ডক: merchant.pathao.com → Developer's API (অফিসিয়াল)
 *
 * সব কল সার্ভার থেকে। কি-গুলো শুধু Hostinger-এর env-এ:
 *   PATHAO_BASE_URL       https://api-hermes.pathao.com (টেস্টে courier-api-sandbox.pathao.com)
 *   PATHAO_CLIENT_ID      Developer's API → Merchant API Credentials
 *   PATHAO_CLIENT_SECRET
 *   PATHAO_USERNAME       মার্চেন্ট প্যানেলের লগইন ইমেইল
 *   PATHAO_PASSWORD       মার্চেন্ট প্যানেলের পাসওয়ার্ড
 *   PATHAO_STORE_ID       যে স্টোর থেকে পিকআপ হবে
 *   PATHAO_WEBHOOK_SECRET Developer's API → Webhook-এ দেখানো সিক্রেট
 */
import { getDb } from './db';

const BASE = (process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com').replace(/\/+$/, '');
/** কাস্টমারের সাকসেস রেট মার্চেন্ট প্যানেলের API থেকে আসে — ডেভেলপার API-তে এটা নেই */
const PANEL = (process.env.PATHAO_PANEL_URL || 'https://merchant.pathao.com').replace(/\/+$/, '');

export const pathaoConfigured = () =>
  !!(process.env.PATHAO_CLIENT_ID && process.env.PATHAO_CLIENT_SECRET &&
     process.env.PATHAO_USERNAME && process.env.PATHAO_PASSWORD && process.env.PATHAO_STORE_ID);

/* ------------------------------------------------------------------ */
/* টোকেন                                                               */
/* ------------------------------------------------------------------ */
/*
 * Pathao-র টোকেন ৫ দিন চলে। প্রতিবার নতুন নিলে ওদের রেট লিমিটে আটকায়,
 * আর Hostinger অ্যাপ রিস্টার্ট হলে মেমরি মুছে যায় — তাই টোকেন settings
 * টেবিলেও রাখা (শুধু service_role পড়তে পারে; পাবলিক নীতিতে এই কি নেই)।
 */
type Tok = { access: string; refresh?: string; exp: number };
const mem: Record<string, Tok | undefined> = {};

async function loadTok(key: string): Promise<Tok | undefined> {
  if (mem[key] && mem[key]!.exp > Date.now()) return mem[key];
  const { data } = await getDb().from('settings').select('value').eq('key', key).maybeSingle();
  const t = data?.value as Tok | undefined;
  if (t?.access && t.exp > Date.now()) return (mem[key] = t);
  return t; // মেয়াদ গেলেও refresh টোকেনের জন্য ফেরত দিই
}
async function saveTok(key: string, t: Tok) {
  mem[key] = t;
  await getDb().from('settings').upsert({ key, value: t as any, updated_at: new Date().toISOString() });
}

async function issue(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/aladdin/api/v1/issue-token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PATHAO_CLIENT_ID, client_secret: process.env.PATHAO_CLIENT_SECRET, ...body,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) throw new Error(j?.message || `Pathao login failed (${res.status})`);
  return { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 - 3600_000 } as Tok;
}

async function apiToken(force = false): Promise<string> {
  if (!pathaoConfigured()) throw new Error('Pathao API keys are not set in Hostinger');
  const key = 'pathao_token';
  const cur = force ? undefined : await loadTok(key);
  if (cur && cur.exp > Date.now()) return cur.access;
  let t: Tok | null = null;
  if (cur?.refresh) { try { t = await issue({ grant_type: 'refresh_token', refresh_token: cur.refresh }); } catch { t = null; } }
  if (!t) t = await issue({ grant_type: 'password', username: process.env.PATHAO_USERNAME, password: process.env.PATHAO_PASSWORD });
  await saveTok(key, t);
  return t.access;
}

async function call(path: string, init: RequestInit = {}, retried = false): Promise<any> {
  const tok = await apiToken(retried);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', Accept: 'application/json', Authorization: `Bearer ${tok}`, ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 401 && !retried) return call(path, init, true);
  const j: any = await res.json().catch(() => null);
  if (!res.ok) {
    // Pathao ভুল ঘরের বিবরণ errors-এ দেয় — সেটাই দেখাই, নইলে বোঝা যায় না কী ভুল
    const detail = j?.errors ? Object.values(j.errors).flat().join(' · ') : '';
    throw new Error([j?.message || `Pathao error (${res.status})`, detail].filter(Boolean).join(' — '));
  }
  return j;
}

/* ------------------------------------------------------------------ */
/* অর্ডার                                                               */
/* ------------------------------------------------------------------ */

/** 8801XXXXXXXXX → 01XXXXXXXXX (Pathao ১১ ডিজিট চায়) */
export function localPhone(p: string) {
  const d = String(p).replace(/\D/g, '');
  if (d.startsWith('880')) return '0' + d.slice(3);
  if (d.length === 10) return '0' + d;
  return d;
}

export interface PathaoOrderInput {
  orderNo: number; name: string; phone: string; address: string;
  amount: number; qty: number; description?: string; note?: string;
}

export async function createPathaoOrder(i: PathaoOrderInput) {
  // ঠিকানা থেকে শহর/জোন Pathao নিজেই বের করে নেয় (ডক: recipient_city ঐচ্ছিক)
  const name = i.name.trim().length >= 3 ? i.name.trim() : `${i.name.trim()} (কাস্টমার)`;
  const j = await call('/aladdin/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      store_id: Number(process.env.PATHAO_STORE_ID),
      merchant_order_id: String(i.orderNo),
      recipient_name: name.slice(0, 100),
      recipient_phone: localPhone(i.phone),
      recipient_address: i.address.trim().slice(0, 220),
      delivery_type: 48,
      item_type: 2,
      item_quantity: Math.max(1, i.qty),
      item_weight: 0.5,
      item_description: (i.description || '').slice(0, 250) || undefined,
      special_instruction: i.note || undefined,
      amount_to_collect: Math.round(i.amount),
    }),
  });
  return {
    consignmentId: String(j?.data?.consignment_id || ''),
    status: String(j?.data?.order_status || 'Pending'),
    fee: Number(j?.data?.delivery_fee) || null,
  };
}

export async function pathaoOrderInfo(consignmentId: string) {
  const j = await call(`/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`);
  return {
    status: String(j?.data?.order_status_slug || j?.data?.order_status || ''),
    updatedAt: j?.data?.updated_at as string | undefined,
  };
}

/**
 * Pathao-র স্ট্যাটাস → আমাদের স্ট্যাটাস। null = আমাদের স্ট্যাটাস বদলাবে না।
 * "Payment_Invoice" (টাকা পেয়ে গেছি) ডেলিভার্ডের পরে আসে — ওটায় কিছু বদলাই না।
 */
export function mapPathaoStatus(s?: string): 'courier' | 'delivered' | 'returned' | 'cancelled' | null {
  const v = String(s || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (!v) return null;
  if (v.includes('partial') || v === 'delivered' || v.endsWith('.delivered')) return 'delivered';
  if (v.includes('return')) return 'returned';
  if (v.includes('pickup_cancel')) return 'cancelled';
  if (v.includes('payment') || v.includes('paid') || v.includes('invoice')) return null;
  return 'courier';
}

/* ------------------------------------------------------------------ */
/* কাস্টমারের ডেলিভারি সাকসেস রেট                                       */
/* ------------------------------------------------------------------ */
/*
 * Pathao-র মার্চেন্ট প্যানেলে নতুন ডেলিভারি বানানোর সময় ফোন নম্বর দিলে
 * "Delivered 221 / Processed 397" দেখায় — সব মার্চেন্ট মিলিয়ে এই কাস্টমারের
 * ইতিহাস। ওটা আসে /api/v1/user/success থেকে (অক্টোবর ২০২৬-এ ব্রাউজারে যাচাই করা)।
 *
 * এটা অফিসিয়াল ডেভেলপার API-র অংশ নয় — Pathao বদলালে ভেঙে যেতে পারে।
 * তাই ভাঙলেও অর্ডার বা কুরিয়ারে পাঠানো কখনো আটকায় না; শুধু রেটটা ফাঁকা থাকে।
 */
export interface CustomerRate { total: number; success: number; rating: string | null }

async function panelToken(force = false): Promise<string> {
  const key = 'pathao_panel_token';
  const cur = force ? undefined : await loadTok(key);
  if (cur && cur.exp > Date.now()) return cur.access;
  const res = await fetch(`${PANEL}/api/v1/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: process.env.PATHAO_USERNAME, password: process.env.PATHAO_PASSWORD }),
    signal: AbortSignal.timeout(15000),
  });
  const j: any = await res.json().catch(() => null);
  const access = j?.access_token || j?.data?.access_token || j?.token || j?.data?.token;
  if (!res.ok || !access) throw new Error(j?.message || `Pathao panel login failed (${res.status})`);
  const t: Tok = { access, exp: Date.now() + (Number(j?.expires_in || j?.data?.expires_in) || 86400) * 1000 - 3600_000 };
  await saveTok(key, t);
  return t.access;
}

export async function pathaoCustomerRate(phone: string, retried = false): Promise<CustomerRate> {
  if (!process.env.PATHAO_USERNAME || !process.env.PATHAO_PASSWORD) throw new Error('Pathao login is not set in env');
  const tok = await panelToken(retried);
  const res = await fetch(`${PANEL}/api/v1/user/success`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ phone: localPhone(phone) }),
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 401 && !retried) return pathaoCustomerRate(phone, true);
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.data) throw new Error(j?.message || `Could not get success rate (${res.status})`);
  return {
    total: Number(j.data.customer?.total_delivery) || 0,
    success: Number(j.data.customer?.successful_delivery) || 0,
    rating: j.data.customer_rating || null,
  };
}

/**
 * রেট আনো ও ক্যাশ করো। একই নম্বর ২৪ ঘণ্টার মধ্যে আবার জিজ্ঞেস করা হয় না —
 * একজন কাস্টমার দিনে কয়েকবার অর্ডার দিলে Pathao-কে বারবার ডাকার মানে নেই।
 */
export async function refreshCustomerRate(phone: string, force = false): Promise<CustomerRate | null> {
  const db = getDb();
  const p = localPhone(phone);
  if (!force) {
    const { data } = await db.from('customer_courier_stats').select('*').eq('phone', p).maybeSingle();
    if (data && Date.now() - new Date(data.fetched_at).getTime() < 24 * 3600_000) {
      return { total: data.total, success: data.success, rating: data.rating };
    }
  }
  try {
    const r = await pathaoCustomerRate(p);
    await db.from('customer_courier_stats').upsert({
      phone: p, courier: 'pathao', total: r.total, success: r.success, rating: r.rating,
      error: null, fetched_at: new Date().toISOString(),
    });
    return r;
  } catch (e) {
    // ভুল হলে পুরনো সংখ্যা রেখে দিই, আর এক ঘণ্টা পরে আবার চেষ্টা হয়
    await db.from('customer_courier_stats').upsert({
      phone: p, courier: 'pathao', error: (e as Error).message.slice(0, 200),
      fetched_at: new Date(Date.now() - 23 * 3600_000).toISOString(),
    });
    return null;
  }
}

/** Pathao-র রেটিং → বাংলা */
export const RATING_LABEL: Record<string, string> = {
  excellent_customer: 'Excellent', good_customer: 'Good', moderate_customer: 'Moderate',
  risky_customer: 'Risky', new_customer: 'New',
};
