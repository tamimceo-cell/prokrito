/**
 * Meta Conversions API
 * ---------------------------------------------------------------------
 * নিয়ম যেগুলো ভাঙলে ট্র্যাকিং নষ্ট হয়:
 *
 *  ১. প্রতিটি ইভেন্টে একটাই event_id — ব্রাউজার ও সার্ভার দুই দিকেই একই।
 *     না মিললে Meta দুবার গুনবে, ROAS ভুল দেখাবে, ডেলিভারি নষ্ট হবে।
 *  ২. ফোন নম্বর হ্যাশ করার আগে 8801XXXXXXXXX ফরম্যাটে আনতে হবে।
 *     বাংলাদেশে এটাই সবচেয়ে কমন ভুল — নরমালাইজ না করলে ম্যাচ হয় না।
 *  ৩. fbp ও fbc কখনো হ্যাশ করা হয় না। বাকি সব user_data হ্যাশ হয়।
 *  ৪. client_ip_address ও client_user_agent হ্যাশ হয় না।
 */

import crypto from 'node:crypto';

const API_VERSION = process.env.FB_API_VERSION || 'v21.0';
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';
const ACCESS_TOKEN = process.env.FB_CAPI_ACCESS_TOKEN || '';
const TEST_EVENT_CODE = process.env.FB_TEST_EVENT_CODE || '';

export type CapiEventName =
  | 'PageView' | 'ViewContent' | 'AddToCart'
  | 'InitiateCheckout' | 'Purchase' | 'OrderDelivered';

export interface UserInput {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface CustomData {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  num_items?: number;
  order_id?: string;
}

/* ------------------------------------------------------------------ */
/* হ্যাশিং                                                             */
/* ------------------------------------------------------------------ */

const sha256 = (v: string) =>
  crypto.createHash('sha256').update(v, 'utf8').digest('hex');

/** trim → lowercase → sha256. খালি হলে undefined, যাতে ফিল্ডটাই না যায়। */
function hash(v?: string | null): string | undefined {
  if (!v) return undefined;
  const clean = String(v).trim().toLowerCase();
  if (!clean) return undefined;
  return sha256(clean);
}

/**
 * বাংলাদেশি মোবাইল নম্বর → 8801XXXXXXXXX
 *   01712345678   → 8801712345678
 *   +8801712345678→ 8801712345678
 *   ০১৭১২৩৪৫৬৭৮   → 8801712345678   (বাংলা সংখ্যা)
 *   1712345678    → 8801712345678
 */
export function normalizeBdPhone(input?: string | null): string | null {
  if (!input) return null;
  const bnDigits = '০১২৩৪৫৬৭৮৯';
  let d = String(input)
    .replace(/[০-৯]/g, (c) => String(bnDigits.indexOf(c)))
    .replace(/\D/g, '');

  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('880')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);

  // এখন 1XXXXXXXXX (১০ ডিজিট) হওয়ার কথা
  if (d.length !== 10 || !d.startsWith('1')) return null;
  return '880' + d;
}

/** নাম ভেঙে fn / ln */
function splitName(name?: string | null) {
  if (!name) return { fn: undefined, ln: undefined };
  const parts = name.trim().split(/\s+/);
  return {
    fn: parts[0],
    ln: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
  };
}

/**
 * fbc রিকভারি।
 * ভিজিটর ?fbclid= নিয়ে এল কিন্তু _fbc কুকি তৈরি হলো না — এমন হয় যখন
 * পিক্সেল স্ক্রিপ্ট ব্লকড বা দেরিতে লোড হয়। তখন হাতে বানাতে হয়,
 * নইলে ক্লিক-টু-অর্ডার অ্যাট্রিবিউশন ভেঙে যায়।
 */
export function buildFbc(fbc?: string | null, fbclid?: string | null, ts?: number) {
  if (fbc) return fbc;
  if (!fbclid) return undefined;
  return `fb.1.${ts ?? Date.now()}.${fbclid}`;
}

/* ------------------------------------------------------------------ */
/* পে-লোড                                                              */
/* ------------------------------------------------------------------ */

export function buildUserData(u: UserInput) {
  const { fn, ln } = splitName(u.name);
  const phone = normalizeBdPhone(u.phone);

  const ud: Record<string, unknown> = {
    fn: hash(fn),
    ln: hash(ln),
    ph: phone ? sha256(phone) : undefined,   // আগে নরমালাইজ, তারপর হ্যাশ
    ct: hash(u.city),
    country: hash('bd'),
    external_id: hash(u.externalId),
    // এই তিনটি কখনো হ্যাশ করা হয় না
    fbp: u.fbp || undefined,
    fbc: buildFbc(u.fbc, u.fbclid),
    client_ip_address: u.ip || undefined,
    client_user_agent: u.userAgent || undefined,
  };

  for (const k of Object.keys(ud)) if (ud[k] === undefined) delete ud[k];
  return ud;
}

export interface SendArgs {
  eventName: CapiEventName;
  eventId: string;
  eventSourceUrl: string;
  user: UserInput;
  custom?: CustomData;
  eventTime?: number;
  actionSource?: 'website' | 'system_generated';
}

export function buildEvent(a: SendArgs) {
  return {
    event_name: a.eventName,
    event_time: a.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: a.eventId,                 // ব্রাউজারের eventID-র সাথে হুবহু এক
    event_source_url: a.eventSourceUrl,  // ডোমেইন ভেরিফিকেশনের সাথে মিলতে হবে
    action_source: a.actionSource ?? 'website',
    user_data: buildUserData(a.user),
    custom_data: a.custom && Object.keys(a.custom).length ? a.custom : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* পাঠানো                                                              */
/* ------------------------------------------------------------------ */

export interface SendResult {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

export async function sendToMeta(events: unknown[]): Promise<SendResult> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { ok: false, status: 0, body: null, error: 'PIXEL_ID বা ACCESS_TOKEN সেট করা নেই' };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;
  const body: Record<string, unknown> = {
    data: events,
    access_token: ACCESS_TOKEN,
  };
  if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Meta ঝুলে থাকলে অর্ডার কনফার্মেশন আটকে থাকবে না
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body: json };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: (e as Error).message };
  }
}

/** exponential backoff — 0.5s, 1s, 2s */
export async function sendWithRetry(events: unknown[], attempts = 3): Promise<SendResult> {
  let last: SendResult = { ok: false, status: 0, body: null, error: 'চেষ্টাই হয়নি' };
  for (let i = 0; i < attempts; i++) {
    last = await sendToMeta(events);
    if (last.ok) return last;
    // ৪০০-স্তরের ভুল (বাজে পে-লোড) বারবার পাঠিয়ে লাভ নেই
    if (last.status >= 400 && last.status < 500 && last.status !== 429) return last;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  return last;
}

/* ------------------------------------------------------------------ */
/* হেল্পার                                                             */
/* ------------------------------------------------------------------ */

export const newEventId = () => crypto.randomUUID();

/** প্রক্সির পেছন থেকে আসল IP বের করা (Vercel / Cloudflare) */
export function clientIpFrom(headers: Headers): string | undefined {
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf;
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip') || undefined;
}

/** কুকি হেডার থেকে _fbp / _fbc */
export function fbCookiesFrom(cookieHeader?: string | null) {
  if (!cookieHeader) return { fbp: undefined, fbc: undefined };
  const get = (k: string) => {
    const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${k}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : undefined;
  };
  return { fbp: get('_fbp'), fbc: get('_fbc') };
}
