/**
 * GET /media/… — MEDIA_DIR থেকে ছবি দেওয়া
 *
 * ফাইলের নাম প্রতিবার আলাদা (আপলোডের সময় বানানো), তাই এক বছরের ক্যাশ
 * নিরাপদ — ব্রাউজার ও Hostinger-এর CDN একবার নিলে আর সার্ভারে আসে না।
 */
import { promises as fs } from 'fs';
import path from 'path';
import { mediaPath } from '@/lib/media';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = {
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
};

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const rel = parts.map((p) => decodeURIComponent(p)).join('/');
  const type = TYPES[path.extname(rel).toLowerCase()];
  const full = type ? mediaPath(rel) : null;
  if (!full) return new Response('Not found', { status: 404 });
  try {
    const buf = await fs.readFile(full);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': type!,
        'Cache-Control': 'public, max-age=31536000, immutable',
        // SVG-তে স্ক্রিপ্ট থাকতে পারে — আলাদা করে চালাতে না দেওয়া
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
