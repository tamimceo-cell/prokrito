/**
 * POST /api/track — সার্ভার-সাইড CAPI (Purchase ছাড়া বাকি ইভেন্ট)
 *
 * ব্রাউজার একই event_id নিয়ে fbq('track', ...) করে; এখান থেকে একই id-তে
 * সার্ভার ইভেন্ট যায়। Meta দুটো মিলিয়ে একটাই গোনে।
 */
import { NextResponse } from 'next/server';
import { buildEvent, sendToMeta, clientIpFrom, fbCookiesFrom, type CapiEventName } from '@/lib/capi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED: CapiEventName[] = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout'];

export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const name = b.event_name as CapiEventName;
  if (!ALLOWED.includes(name) || !b.event_id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { fbp, fbc } = fbCookiesFrom(req.headers.get('cookie'));
  const event = buildEvent({
    eventName: name,
    eventId: String(b.event_id),
    eventSourceUrl: String(b.event_source_url || process.env.NEXT_PUBLIC_SITE_URL || ''),
    user: {
      fbp: b.fbp || fbp, fbc: b.fbc || fbc, fbclid: b.fbclid,
      ip: clientIpFrom(req.headers),
      userAgent: req.headers.get('user-agent') || undefined,
    },
    custom: b.custom_data && typeof b.custom_data === 'object' ? b.custom_data : undefined,
  });

  // sendBeacon-এর উত্তরের জন্য কেউ অপেক্ষা করে না — একবারই চেষ্টা
  await sendToMeta([event]);
  return NextResponse.json({ ok: true });
}
