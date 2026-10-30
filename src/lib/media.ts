import 'server-only';
import path from 'path';

/**
 * ছবি রাখার জায়গা — Hostinger সার্ভারের একটা স্থায়ী ফোল্ডার।
 *
 * অ্যাপের নিজের ফোল্ডারে (public/) রাখা যায় না: প্রতিবার GitHub থেকে
 * ডিপ্লয় হলে Hostinger পুরো ফোল্ডার নতুন করে বানায়, আর আপলোড করা সব
 * ছবি মুছে যেত। তাই অ্যাপের বাইরের ফোল্ডার — MEDIA_DIR — যেটা ডিপ্লয়ে
 * হাত পড়ে না। ছবি দেখানো হয় /media/… ঠিকানায় (app/media/[...path])।
 */
export function mediaRoot(): string {
  const dir = process.env.MEDIA_DIR;
  if (!dir) throw new Error('MEDIA_DIR সেট করা নেই');
  return path.resolve(dir);
}

/** /media/… ঠিকানা → ডিস্কের পথ। ফোল্ডারের বাইরে যাওয়ার চেষ্টা (../) হলে null */
export function mediaPath(rel: string): string | null {
  const root = mediaRoot();
  const full = path.resolve(root, rel);
  return full.startsWith(root + path.sep) ? full : null;
}

export const MEDIA_PREFIX = '/media/';
