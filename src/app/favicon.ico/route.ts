/**
 * GET /favicon.ico — কিছু ব্রাউজার আর গুগল সরাসরি এই ঠিকানা খোঁজে।
 * আলাদা ফাইল না রেখে site.ts-এর logoSm-টাই দেওয়া হয়, যাতে লোগো বদলালে
 * এক জায়গায় বদলালেই হয়।
 */
import { promises as fs } from 'fs';
import path from 'path';
import { mediaPath } from '@/lib/media';
import { site } from '@/config/site';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

export async function GET() {
  const rel = site.logoSm.replace(/^\/media\//, '');
  const full = mediaPath(rel);
  const type = TYPES[path.extname(rel).toLowerCase()];
  if (!full || !type) return new Response('Not found', { status: 404 });
  try {
    const buf = await fs.readFile(full);
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
