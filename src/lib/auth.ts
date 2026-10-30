import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { sql } from './db';

/* =====================================================================
 *  অ্যাডমিন লগইন — নিজস্ব, Supabase Auth-এর বদলে
 *
 *  পাসওয়ার্ড: scrypt হ্যাশ (লবণসহ)। ডাটাবেস চুরি হলেও আসল পাসওয়ার্ড
 *  বের করা কার্যত অসম্ভব।
 *
 *  সেশন: একটা সই করা কুকি — "কে, কোন সংস্করণ, কবে শেষ"। সই করা হয়
 *  SESSION_SECRET দিয়ে, তাই কেউ কুকি বানিয়ে বা বদলে ঢুকতে পারে না।
 *  পাসওয়ার্ড বদলালে session_ver বাড়ে, আর আগের সব কুকি অচল হয়ে যায়।
 * ===================================================================== */

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'pk_admin';
const SESSION_DAYS = 14;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET সেট করা নেই (কমপক্ষে ৩২ অক্ষর)');
  return s;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, s, k] = String(stored).split('$');
  if (algo !== 'scrypt' || !s || !k) return false;
  const want = Buffer.from(k, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function makeSession(userId: string, ver: number): { value: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 86400;
  const body = b64(JSON.stringify({ u: userId, v: ver, e: Math.floor(Date.now() / 1000) + maxAge }));
  return { value: `${body}.${sign(body)}`, maxAge };
}

function readSession(value: string | undefined): { u: string; v: number } | null {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const want = sign(body);
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p?.u || !(p.e > Date.now() / 1000)) return null;
    return { u: String(p.u), v: Number(p.v) };
  } catch { return null; }
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

/** লগইন করা ইউজার অ্যাডমিন কিনা — না হলে null */
export async function requireAdmin(): Promise<{ id: string; email: string; username: string; role: string } | null> {
  const store = await cookies();
  const s = readSession(store.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const rows = await sql<{ id: string; username: string; role: string; session_ver: number }>(
    'SELECT id, username, role, session_ver FROM admin_users WHERE id = ? LIMIT 1', [s.u]);
  const a = rows[0];
  if (!a || Number(a.session_ver) !== s.v) return null;
  // email — পুরনো কোডে স্ক্রিনে দেখানোর জন্য ব্যবহার হতো, তাই রেখে দেওয়া
  return { id: a.id, email: a.username, username: a.username, role: a.role };
}
