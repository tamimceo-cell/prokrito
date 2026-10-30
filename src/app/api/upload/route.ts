/**
 * POST /api/upload — অ্যাডমিন প্যানেল থেকে প্রোডাক্টের ছবি আপলোড
 *
 * আগে requireAdmin() দিয়ে যাচাই, তারপর সার্ভারের স্থায়ী ফোল্ডারে
 * (MEDIA_DIR/products/) লেখা। ছবি দেখা যায় /media/products/… ঠিকানায়।
 *
 * ছবি ব্রাউজারেই ছোট করে WebP বানিয়ে পাঠানো হয় (ImageUploader.tsx দেখুন),
 * তাই এখানে সাধারণত ১৫০-৩০০ KB আসে। তবু সার্ভারে আবার মাপ যাচাই করা হয় —
 * ক্লায়েন্টের পাঠানো কিছুতেই ভরসা নয়।
 */
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { mediaRoot, mediaPath, MEDIA_PREFIX } from '@/lib/media';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'products';
const MAX_BYTES = 4 * 1024 * 1024;          // ৪ MB
const OK_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'অনুমতি নেই' }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: 'ফাইল পড়া যায়নি।' }, { status: 400 }); }

  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (!files.length) {
    return NextResponse.json({ ok: false, error: 'কোনো ছবি পাওয়া যায়নি।' }, { status: 400 });
  }
  if (files.length > 8) {
    return NextResponse.json({ ok: false, error: 'একসাথে সর্বোচ্চ ৮টি ছবি।' }, { status: 400 });
  }

  const db = getDb();
  const urls: string[] = [];

  for (const file of files) {
    if (!OK_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: 'শুধু ছবি আপলোড করা যাবে (JPG, PNG বা WebP)।' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'ছবিটি অনেক বড়। ৪ MB-র কম হতে হবে।' }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
    // ফাইলের নাম আমরাই বানাই — ব্যবহারকারীর দেওয়া নামে পথ বদলে দেওয়ার
    // চেষ্টা (../) বা বাংলা/স্পেস থাকতে পারে
    const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    try {
      const dir = path.join(mediaRoot(), BUCKET);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: `আপলোড হয়নি: ${(e as Error).message}` }, { status: 500 });
    }

    urls.push(`${MEDIA_PREFIX}${BUCKET}/${name}`);
  }

  await db.from('audit_log').insert({
    actor: admin.id, action: 'image.upload', entity: 'storage',
    detail: { count: urls.length },
  });

  return NextResponse.json({ ok: true, urls });
}

/** DELETE /api/upload?url=… — ছবি মুছে ফেলা */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'অনুমতি নেই' }, { status: 401 });

  const url = new URL(req.url).searchParams.get('url') || '';
  const marker = `${MEDIA_PREFIX}${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) {
    // আমাদের বাকেটের ছবি নয় (যেমন /img/mf01.webp) — মোছার কিছু নেই
    return NextResponse.json({ ok: true, skipped: true });
  }

  const name = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  const full = mediaPath(`${BUCKET}/${path.basename(name)}`);
  if (!full) return NextResponse.json({ ok: false, error: 'ভুল ঠিকানা' }, { status: 400 });
  // মুছে না ফেলে নাম বদলে রাখি — ভুল করে মুছলে ফেরত আনা যায়
  await fs.rename(full, full + '.deleted').catch(() => {});

  return NextResponse.json({ ok: true });
}
