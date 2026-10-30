import { NextResponse } from 'next/server';
import { SESSION_COOKIE, cookieOptions } from '@/lib/auth';

export const runtime = 'nodejs';

/** POST /api/admin/logout — কুকি মুছে দেওয়া */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  return res;
}
