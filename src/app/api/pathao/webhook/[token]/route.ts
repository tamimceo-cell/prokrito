/**
 * POST /api/pathao/webhook/<PATHAO_WEBHOOK_PATH> — Pathao থেকে স্ট্যাটাস আপডেট
 *
 * Pathao মার্চেন্ট প্যানেল → Developer's API → Webhook-এ এই URL বসাবেন:
 *   https://prokrito.com/api/pathao/webhook/<PATHAO_WEBHOOK_PATH>
 *
 * নিরাপত্তা: Pathao-র ওয়েবহুক সিক্রেট সব মার্চেন্টের জন্য একই (ওদের নিজেদের
 * WordPress প্লাগিনেই লেখা আছে), তাই ওটা দিয়ে "Pathao-ই পাঠিয়েছে" প্রমাণ হয় না।
 * দুটো ব্যবস্থা:
 *  ১. URL-এর শেষ অংশ গোপন (PATHAO_WEBHOOK_PATH) — না মিললে 404।
 *  ২. পেলোডের স্ট্যাটাস বিশ্বাস করি না — শুধু "এই পার্সেলে কিছু বদলেছে"
 *     সংকেত হিসেবে নিই, তারপর Pathao-র API থেকে আসল অবস্থা পড়ি।
 *
 * Pathao চায়: ১০ সেকেন্ডের মধ্যে উত্তর, আর উত্তরের হেডারে
 * X-Pathao-Merchant-Webhook-Integration-Secret = সিক্রেট। নইলে URL সেভ হয় না।
 */
import { NextResponse, after } from 'next/server';
import { getDb } from '@/lib/db';
import { ORDER_FOR_EVENT } from '@/lib/delivered';
import { syncOne } from '@/lib/pathao-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const path = process.env.PATHAO_WEBHOOK_PATH;
  if (!path || token !== path) return new NextResponse(null, { status: 404 });

  const headers = { 'X-Pathao-Merchant-Webhook-Integration-Secret': process.env.PATHAO_WEBHOOK_SECRET || '' };
  const b: any = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ ok: false }, { status: 400, headers });

  // সংযোগ যাচাই — Pathao URL সেভ করার সময় এটা পাঠায়
  if (b.event === 'webhook_integration') return NextResponse.json({ ok: true }, { status: 202, headers });

  const cn = b.consignment_id ? String(b.consignment_id) : '';
  if (cn) {
    // ১০ সেকেন্ডের সীমা — Pathao-র API ডাকা উত্তরের পরে
    after(async () => {
      const { data: o } = await getDb().from('orders')
        .select(`${ORDER_FOR_EVENT}, consignment_id`).eq('consignment_id', cn).maybeSingle();
      if (o) await syncOne(o as any).catch(() => {});
    });
  }
  return NextResponse.json({ ok: true }, { status: 202, headers });
}
