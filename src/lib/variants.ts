/**
 * সাইজ ও রঙের হিসাব — অ্যাডমিন প্যানেল আর প্রোডাক্ট পেইজ দুটোই এখান থেকেই নেয়।
 *
 * ভাবনাটা সহজ: ডাটাবেসে প্রতিটি সারি একটা *জোড়া* — "লাল ৩৬", "কালো ৩৬"।
 * স্টকও ওই জোড়ার। সাইজ আর রঙের আলাদা তালিকা কোথাও রাখা নেই, সারিগুলো
 * থেকেই বের করে নেওয়া হয়।
 *
 * কেন আলাদা তালিকা রাখি না: রাখলে দুই জায়গায় একই তথ্য থাকত, আর একটা
 * বদলে অন্যটা না বদলালে সাইটে এমন সাইজ দেখা যেত যার কোনো স্টকের ঘরই নেই।
 * সারি থেকে বের করলে সে ভুলটা হওয়ার পথই থাকে না।
 *
 * রঙ না থাকলে color_key খালি স্ট্রিং — তখন পেইজে রঙ বাছার ঘরটাই ওঠে না।
 * সাইজ না থাকলে একটাই সারি ('one'), তখন সাইজের ঘরও ওঠে না। ফলে গহনার
 * পাতা আগের মতোই সরল থাকে, আর ব্রায়ের পাতায় দুটো ঘরই আসে।
 */

import type { Variant } from './types';

export interface Axis {
  key: string;
  label: string;
  /** শুধু রঙের ক্ষেত্রে — গোল বোতামের রং */
  hex?: string | null;
}

/** রঙ নেই মানে খালি স্ট্রিং। null/undefined-কেও তাই ধরি। */
export const colorKeyOf = (v: { color_key?: string | null }) => v.color_key || '';

/**
 * সারিগুলো থেকে সাইজ ও রঙের তালিকা।
 * ক্রম ঠিক রাখতে sort মেনে চলি, আর প্রথম যেটা এসেছে সেটাই আগে।
 */
export function variantAxes(variants: Variant[]): { sizes: Axis[]; colors: Axis[] } {
  const ordered = [...variants].sort((a, b) => a.sort - b.sort);
  const sizes = new Map<string, Axis>();
  const colors = new Map<string, Axis>();

  for (const v of ordered) {
    if (!sizes.has(v.opt_key)) sizes.set(v.opt_key, { key: v.opt_key, label: v.opt_label });
    const ck = colorKeyOf(v);
    if (ck && !colors.has(ck)) {
      colors.set(ck, { key: ck, label: v.color_label || ck, hex: v.color_hex || null });
    }
  }
  return { sizes: [...sizes.values()], colors: [...colors.values()] };
}

/** একটা নির্দিষ্ট জোড়া */
export function findVariant(variants: Variant[], optKey: string, colorKey: string) {
  return variants.find((v) => v.opt_key === optKey && colorKeyOf(v) === colorKey);
}

/** এই রঙে সব সাইজ মিলিয়ে কত আছে — রঙের বোতাম নিষ্ক্রিয় করব কিনা ঠিক করতে */
export const stockOfColor = (variants: Variant[], colorKey: string) =>
  variants.filter((v) => colorKeyOf(v) === colorKey).reduce((a, v) => a + v.stock, 0);

/** এই সাইজে সব রঙ মিলিয়ে কত আছে */
export const stockOfSize = (variants: Variant[], optKey: string) =>
  variants.filter((v) => v.opt_key === optKey).reduce((a, v) => a + v.stock, 0);

/**
 * এই রঙে প্রথম যে সাইজটা স্টকে আছে।
 *
 * রঙ বদলালে এটা লাগে: কাস্টমার "লাল ৩৬" দেখছিল, এখন কালো বাছল, কিন্তু
 * কালোয় ৩৬ নেই। তাকে "স্টক শেষ" দেখিয়ে আটকে না রেখে কালোর প্রথম
 * চালু সাইজে নিয়ে যাওয়াই ভালো।
 */
export function firstSizeInStock(variants: Variant[], colorKey: string, fallback: string) {
  const inColor = variants
    .filter((v) => colorKeyOf(v) === colorKey)
    .sort((a, b) => a.sort - b.sort);
  return (inColor.find((v) => v.stock > 0) || inColor[0])?.opt_key || fallback;
}

/**
 * নাম থেকে চাবি বানানো।
 *
 * চাবিটা ডাটাবেসে পরিচয় হিসেবে থাকে, তাই একবার বসলে আর বদলানো যায় না —
 * বদলালে ডাটাবেস ওটাকে নতুন ঘর ভেবে বসবে আর পুরনো ঘরের স্টক হারিয়ে যাবে।
 * সেজন্য অ্যাডমিন প্যানেল পুরনো ঘরগুলোর চাবি হুবহু ধরে রাখে; এই ফাংশনটা
 * শুধু নতুন লেখা নামের জন্য।
 *
 * বাংলা অক্ষরও চাবিতে থাকতে পারে — Postgres-এর তাতে অসুবিধা নেই, আর
 * "লাল" লেখা চাবি দেখতে "c3f9a1"-এর চেয়ে বোধগম্য।
 */
export function axisKey(label: string, taken: string[] = []): string {
  const base = label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '')
    || 'x';
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
