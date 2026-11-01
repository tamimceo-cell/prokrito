/**
 * POST /api/admin/import — পুরনো WordPress-এর ডাটা আনা (শুধু owner)
 * { what: 'catalog' | 'orders' }
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { importCatalog, importOrders } from '@/lib/importer';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'owner') return NextResponse.json({ ok: false, error: 'Owner only' }, { status: 403 });
  const { what } = await req.json().catch(() => ({}));
  try {
    const result = what === 'orders' ? await importOrders() : await importCatalog();
    if (what !== 'orders') { revalidateTag('catalog'); revalidateTag('landing'); }
    await getDb().from('audit_log').insert({ actor: admin.id, action: `import.${what === 'orders' ? 'orders' : 'catalog'}`, detail: result });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
