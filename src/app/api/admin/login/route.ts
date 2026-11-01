/**
 * POST /api/admin/login — ইউজারনেম + পাসওয়ার্ড → সই করা সেশন কুকি
 *
 * পরপর ভুল পাসওয়ার্ডে এক আইপি থেকে ১০ মিনিটে ৮ বারের বেশি চেষ্টা করা
 * যায় না — অনুমান করে পাসওয়ার্ড ভাঙার চেষ্টা থামাতে।
 */
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword, makeSession, cookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { clientIpFrom } from '@/lib/capi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fails = new Map<string, number[]>();
const WINDOW = 10 * 60_000;

export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers) || 'unknown';
  const now = Date.now();
  const recent = (fails.get(ip) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= 8) {
    return NextResponse.json({ ok: false, error: 'Too many failed attempts. Try again in 10 minutes.' }, { status: 429 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* নিচে ধরা পড়বে */ }
  // পুরনো অভ্যাসে কেউ "name@domain" লিখলে @-এর আগের অংশটাই ইউজারনেম
  const username = String(body.username || '').trim().toLowerCase().split('@')[0];
  const password = String(body.password || '');

  const rows = username
    ? await sql<{ id: string; password_hash: string; session_ver: number }>(
        'SELECT id, password_hash, session_ver FROM admin_users WHERE username = ? LIMIT 1', [username])
    : [];
  const a = rows[0];
  const ok = !!a && (await verifyPassword(password, a.password_hash));

  if (!ok) {
    recent.push(now); fails.set(ip, recent);
    if (fails.size > 5000) fails.clear();
    return NextResponse.json({ ok: false, error: 'Wrong username or password.' }, { status: 401 });
  }

  fails.delete(ip);
  const s = makeSession(a.id, Number(a.session_ver));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.value, cookieOptions(s.maxAge));
  return res;
}
