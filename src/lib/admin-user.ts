import { site } from '@/config/site';

/**
 * অ্যাডমিনের ইউজারনেম ↔ ইমেইল।
 *
 * Supabase-এর লগইন ব্যবস্থা ইমেইল ছাড়া চলে না। কিন্তু ক্লায়েন্টের জন্য
 * ছোট একটা ইউজারনেম টাইপ করাই সহজ, লম্বা ইমেইল মনে রাখার দরকার নেই।
 * তাই ইউজারনেমের পেছনে একটা স্থির ডোমেইন জুড়ে দেওয়া হয় — ব্যবহারকারী
 * সেটা কখনো দেখেও না।
 *
 *   etysworld  →  etysworld@etysworld.com
 *
 * কেউ পুরো ইমেইল লিখলে সেটাই ব্যবহার হয়, যাতে পুরনো অ্যাকাউন্টগুলোও
 * আগের মতো কাজ করে।
 */
export const ADMIN_EMAIL_DOMAIN = site.adminEmailDomain;

/** ফর্মে যা লেখা হয়েছে → Supabase-এর জন্য ইমেইল */
export function toLoginEmail(input: string): string {
  const v = input.trim().toLowerCase();
  if (!v) return '';
  return v.includes('@') ? v : `${v}@${ADMIN_EMAIL_DOMAIN}`;
}

/** ইমেইল → স্ক্রিনে দেখানোর ইউজারনেম */
export function toUsername(email?: string | null): string {
  if (!email) return '';
  return email.endsWith(`@${ADMIN_EMAIL_DOMAIN}`) ? email.split('@')[0] : email;
}

/** লগইন ফর্মের placeholder — ডোমেইনের প্রথম অংশ */
export const ADMIN_USERNAME_HINT = ADMIN_EMAIL_DOMAIN.split('.')[0];
