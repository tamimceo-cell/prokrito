/**
 * পুরনো বিল্ড ধরা ও নিজে থেকে সারিয়ে নেওয়া।
 *
 * সমস্যাটা কী:
 * নতুন কোড ডিপ্লয় হলে Next প্রতিটা জাভাস্ক্রিপ্ট ফাইলের নাম বদলে দেয়
 * (/_next/static/<নতুন আইডি>/…), আর পুরনো ফাইলগুলো সার্ভার থেকে মুছে যায়।
 * কিন্তু কাস্টমারের ফোনে বা CDN-এ আগের HTML পাতাটা জমা থাকতে পারে — সেই
 * পুরনো HTML এমন ফাইল খোঁজে যেটা আর নেই। তখন ব্রাউজার পুরো অ্যাপটা চালু
 * করতে পারে না, আর পর্দায় ভেসে ওঠে ইংরেজিতে "Application error"।
 *
 * মজার ব্যাপার হলো এটা শুধু তাদেরই হয় যারা আগে সাইটটা দেখেছে — অর্থাৎ
 * নিয়মিত কাস্টমার। নতুন কেউ এলে তার কাছে ঠিকই কাজ করে। তাই বাইরে থেকে
 * দেখে বোঝা যায় না, অথচ যারা বারবার আসে তারাই আটকায়।
 *
 * সমাধান:
 * এই ধরনের ভুল চিনতে পারলে পাতাটা একবার নিজে থেকেই রিফ্রেশ হয়ে যাবে —
 * রিফ্রেশে নতুন HTML নামবে, নতুন ফাইলের নাম পাবে, সব ঠিক হয়ে যাবে।
 * কাস্টমার কিছু বুঝবেও না।
 *
 * "একবার" কথাটা জরুরি: রিফ্রেশের পরেও যদি ভুল থাকে, তার মানে কারণটা অন্য।
 * তখন আবার রিফ্রেশ করলে পাতাটা অনন্তকাল ঘুরতেই থাকবে। তাই sessionStorage-এ
 * দাগ রেখে দেওয়া হয় — একই ট্যাবে দ্বিতীয়বার আর চেষ্টা করে না, বরং বাংলায়
 * একটা বোধগম্য বার্তা দেখায়।
 */

import { site } from '@/config/site';

/** পুরনো বিল্ডের ফাইল না পাওয়ার ভুলগুলো ব্রাউজারভেদে আলাদা ভাষায় আসে */
const STALE =
  /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to load script/i;

export function isStaleBuild(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string };
  return STALE.test(`${e.name || ''} ${e.message || ''}`);
}

// কি-টা ক্লায়েন্টভেদে আলাদা, যাতে টেমপ্লেট থেকে বানানো দুটো দোকান
// একই ব্রাউজারে খোলা থাকলেও একে অন্যের দাগ পড়তে না পারে
const MARK = `${site.codePrefix.toLowerCase()}:reloaded`;

/** "আবার চেষ্টা করুন" চাপলে দাগটা মুছে দিই — নাহলে দ্বিতীয় সুযোগ থাকে না */
export function clearReloadMark(): void {
  try { sessionStorage.removeItem(MARK); } catch {}
}

/**
 * পুরনো বিল্ডের ভুল হলে একবার হার্ড রিফ্রেশ করে true ফেরত দেয়।
 * false মানে — হয় কারণটা অন্য, নয়তো একবার চেষ্টা করা হয়ে গেছে।
 */
export function recoverFromStaleBuild(err: unknown): boolean {
  if (typeof window === 'undefined' || !isStaleBuild(err)) return false;
  try {
    if (sessionStorage.getItem(MARK)) return false;
    sessionStorage.setItem(MARK, String(Date.now()));
  } catch {
    // প্রাইভেট মোডে sessionStorage বন্ধ থাকতে পারে — তখন ঝুঁকি না নিয়ে থেমে যাই
    return false;
  }
  window.location.reload();
  return true;
}
