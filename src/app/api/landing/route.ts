/** ল্যান্ডিং পেইজ তৈরি / আপডেট — অ্যাডমিন */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { cleanExtraFields, cleanTiers } from '@/lib/landing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9][a-z0-9-]{1,80}$/;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });

  const b = await req.json().catch(() => null);
  const l = b?.landing;
  if (!l) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });

  const tiers = cleanTiers(l.tiers);
  const slug = String(l.slug || '').trim().toLowerCase();
  const thankyou = String(l.thankyou_slug || '').trim().toLowerCase() || null;

  if (!SLUG.test(slug)) return NextResponse.json({ ok: false, error: 'Link may only use lowercase English letters, numbers and -.' }, { status: 400 });
  if (thankyou && !SLUG.test(thankyou)) return NextResponse.json({ ok: false, error: 'Thank-you page link is not valid.' }, { status: 400 });
  if (!l.product_id) return NextResponse.json({ ok: false, error: 'Choose a product.' }, { status: 400 });
  if (!tiers.length) return NextResponse.json({ ok: false, error: 'Add at least one offer (quantity + price).' }, { status: 400 });

  // ব্লকগুলো JSON হিসেবে আসে — তালিকা না হলে সেভ নয়, নইলে পাতা ভেঙে যাবে
  if (!Array.isArray(l.blocks)) return NextResponse.json({ ok: false, error: 'Page blocks are not valid.' }, { status: 400 });

  const row = {
    slug, product_id: l.product_id, title: String(l.title || slug).trim(),
    blocks: l.blocks, tiers,
    form_title: String(l.form_title || '').trim() || null,
    note_label: String(l.note_label || '').trim() || null,
    note_required: !!l.note_required && !!String(l.note_label || '').trim(),
    extra_fields: cleanExtraFields(l.extra_fields),
    thankyou_slug: thankyou,
    active: l.active !== false,
    sort: Number(l.sort) || 0,
  };

  const db = getDb();
  const { data, error } = l.id
    ? await db.from('landing_pages').update(row).eq('id', l.id).select('id').single()
    : await db.from('landing_pages').insert(row).select('id').single();
  if (error) {
    const dup = /duplicate|unique/i.test(error.message);
    return NextResponse.json({ ok: false, error: dup ? 'A page already exists at this link.' : error.message }, { status: 400 });
  }

  await db.from('audit_log').insert({
    actor: admin.id, action: l.id ? 'landing.update' : 'landing.create',
    entity: 'landing_pages', entity_id: data?.id, detail: { slug, tiers },
  });
  revalidateTag('landing');
  return NextResponse.json({ ok: true, id: data?.id });
}
