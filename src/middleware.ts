import { NextResponse, type NextRequest } from 'next/server';
import { site } from '@/config/site';

/**
 * পুরনো WordPress সাইটের লিংক হুবহু চালু রাখা — ফেইসবুক এডে এগুলোই চলছে।
 *
 * ১. শেষের স্ল্যাশ: WordPress-এর লিংক /product/front-button/ — স্ল্যাশসহ।
 *    Next নিজে থাকলে স্ল্যাশ ছাড়া ঠিকানায় 308 রিডাইরেক্ট করত। কাজ চলত,
 *    কিন্তু এডে ক্লিক করা প্রতিটা মানুষের ফোনে একটা বাড়তি আসা-যাওয়া —
 *    বাংলাদেশের মোবাইল নেটে ২০০-৫০০ms, আর ল্যান্ডিং পেইজে প্রতিটা
 *    মুহূর্তে লোক চলে যায়। তাই রিডাইরেক্ট নয়, ভেতরে ভেতরে একই পাতা দেখানো
 *    (next.config.mjs → skipTrailingSlashRedirect)।
 *
 * ২. /product/<কিছু> — এখানে দুই রকম পাতা থাকে: দোকানের প্রোডাক্ট
 *    (PK-01 ধরনের কোড) আর CartFlows-এর ল্যান্ডিং পেইজ (front-button)।
 *    কোডের ধরনে না মিললে ল্যান্ডিং পেইজের রুটে পাঠাই। ল্যান্ডিং পেইজের
 *    আলাদা লেআউট — দোকানের হেডার-মেনু নেই, যাতে মনোযোগ শুধু অর্ডারে থাকে।
 */

const CODE = new RegExp(`^${site.codePrefix}-\\d+$`, 'i');

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  let path = url.pathname;
  let changed = false;

  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
    changed = true;
  }

  const m = path.match(/^\/product\/([^/]+)$/);
  if (m && !CODE.test(decodeURIComponent(m[1]))) {
    url.pathname = `/lp/${m[1]}`;
    return NextResponse.rewrite(url);
  }

  if (changed) {
    url.pathname = path;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  // স্ট্যাটিক ফাইল, ছবি আর API-তে মিডলওয়্যার চালানোর দরকার নেই
  matcher: ['/((?!_next/|api/|media/|img/|lp-img/|favicon|robots\\.txt|sitemap\\.xml).*)'],
};
