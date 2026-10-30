/**
 * POST /api/admin/setup — প্রথম অ্যাডমিন বানানো (একবারই)
 *
 * শুধু তখনই চলে যখন:
 *  ১. ডাটাবেসে একজনও অ্যাডমিন নেই, আর
 *  ২. Hostinger-এ বসানো ADMIN_SETUP_TOKEN মিলে যায়।
 * প্রথম অ্যাডমিন হয়ে গেলে এই রুট আর কিছুই করে না — টোকেন ফাঁস হলেও না।
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { sql, ensureSchema } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const want = process.env.ADMIN_SETUP_TOKEN || '';
  let body: any = {};
  try { body = await req.json(); } catch { /* নিচে */ }
  const got = String(body.token || '');
  const tokenOk = want.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!tokenOk) return NextResponse.json({ ok: false, error: 'সেটআপ টোকেন মিলছে না।' }, { status: 401 });

  // নতুন ফাঁকা ডাটাবেস — টেবিলগুলো এখানেই বানিয়ে নিই
  try { await ensureSchema(); }
  catch (e) { return NextResponse.json({ ok: false, error: `ডাটাবেসে টেবিল বানানো যায়নি: ${(e as Error).message}` }, { status: 500 }); }

  const [{ n }] = await sql<{ n: number }>('SELECT COUNT(*) AS n FROM admin_users');
  if (Number(n) > 0) return NextResponse.json({ ok: false, error: 'অ্যাডমিন আগেই বানানো হয়েছে।' }, { status: 409 });

  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return NextResponse.json({ ok: false, error: 'ইউজারনেম ৩-৩২ অক্ষর — ইংরেজি ছোট হাতের অক্ষর, সংখ্যা।' }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ ok: false, error: 'পাসওয়ার্ড কমপক্ষে ১০ অক্ষর।' }, { status: 400 });
  }

  await sql('INSERT INTO admin_users (id, username, password_hash, role) VALUES (UUID(), ?, ?, ?)',
    [username, await hashPassword(password), 'owner']);
  return NextResponse.json({ ok: true });
}
