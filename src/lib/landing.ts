import type { Product } from './types';

/* ---------------------------------------------------------------------
 *  এই ফাইলে শুধু ধরন আর ছোট হিসাব — ব্রাউজারেও লাগে। ডাটাবেস থেকে পড়া
 *  landing-data.ts-এ, নইলে Supabase-এর পুরো লাইব্রেরি ফোনে চলে যেত।
 *
 *  ল্যান্ডিং পেইজের অংশ — CartFlows/Elementor-এর উইজেটের বদলে।
 *  ইচ্ছে করেই অল্প কয়েকটা ধরন: এতেই পুরনো সব পেইজ বানানো গেছে, আর
 *  কম ধরন মানে অ্যাডমিন থেকে ভুল করার সুযোগও কম।
 * ------------------------------------------------------------------- */
/** maxw — ছবির সর্বোচ্চ চওড়া (px), যেমন পুরনো পেইজের ছোট লোগো */
export type Img = { src: string; w: number; h: number; alt?: string; caption?: string; maxw?: number };

export type Block =
  /*
   * color/bg/fg/icon — পুরনো Elementor পেইজের নিজের রং (সবুজ পটভূমি, হলুদ
   * বোতাম …)। না দিলে দোকানের রং। পুরনো পেইজের চেহারা যেন না বদলায়।
   */
  | { t: 'heading'; text: string; size?: 'xl' | 'lg' | 'md'; color?: string }
  | { t: 'text'; text: string; color?: string }
  | { t: 'image'; img: Img }
  | { t: 'gallery'; images: Img[]; cols?: 1 | 2 | 3 }
  | { t: 'video'; url: string }
  | { t: 'list'; title?: string; items: string[]; color?: string; icon?: string }
  | { t: 'features'; title?: string; items: { title: string; desc?: string }[] }
  | { t: 'compare'; title?: string; bad: { title: string; items: string[] }; good: { title: string; items: string[] } }
  | { t: 'cta'; text?: string; bg?: string; fg?: string }
  /** রঙিন পটভূমির অংশ — ভেতরে আরও ব্লক (পুরনো পেইজের সবুজ "হিরো" ইত্যাদি) */
  | { t: 'section'; bg?: string; blocks: Block[] }
  /**
   * পুরনো পেইজের নিজের HTML/CSS/JS হুবহু — নতুন ডিজাইনের পেইজগুলো
   * (front-button-bra, net-floral-bra-new) Elementor-এর HTML উইজেটে হাতে
   * বানানো ছিল। ব্লকে ভাঙলে চেহারা বদলে যেত, তাই যেমন ছিল তেমনই রাখা।
   * শুধু অ্যাডমিন লিখতে পারে, কাস্টমার নয়।
   */
  | { t: 'html'; html: string }
  /** অর্ডার ফর্ম এখানে বসবে — না থাকলে পেইজের শেষে */
  | { t: 'order' };

/** ফর্মের বাড়তি ঘর — উত্তর অর্ডারের নোটে "নাম: উত্তর" হয়ে যায় */
export interface ExtraField { name: string; label: string; required?: boolean }

export interface Tier {
  qty: number;
  /** ওই সংখ্যার মোট দাম — প্রতি পিসের নয় */
  price: number;
  label?: string;
  tag?: string;
  default?: boolean;
}

export interface Landing {
  id: string;
  slug: string;
  product_id: string | null;
  title: string;
  blocks: Block[];
  tiers: Tier[];
  form_title: string | null;
  note_label: string | null;
  note_required: boolean;
  extra_fields: ExtraField[];
  thankyou_slug: string | null;
  active: boolean;
  product?: Product | null;
}

/** তালিকার মধ্যে যেটা আগে থেকে বাছা থাকবে */
export const defaultTier = (tiers: Tier[]) => tiers.find((t) => t.default) || tiers[0];

/** কাটা দাম — এক পিসের দাম × সংখ্যা। বেশি না হলে দেখানোর মানে নেই। */
export const tierCompare = (t: Tier, unitPrice: number) =>
  unitPrice * t.qty > t.price ? unitPrice * t.qty : null;

/**
 * অ্যাডমিন থেকে আসা দাম-ধাপ পরিষ্কার করা — সার্ভার এটার উপর ভরসা করে
 * দাম হিসাব করে, তাই আজেবাজে মান এখানেই আটকানো।
 */
export function cleanTiers(raw: unknown): Tier[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: Tier[] = [];
  for (const r of raw as any[]) {
    const qty = Math.round(Number(r?.qty));
    const price = Math.round(Number(r?.price));
    if (!(qty >= 1 && qty <= 50) || !(price > 0) || seen.has(qty)) continue;
    seen.add(qty);
    out.push({
      qty, price,
      label: String(r?.label || '').trim() || undefined,
      tag: String(r?.tag || '').trim() || undefined,
      default: !!r?.default,
    });
  }
  return out.sort((a, b) => a.qty - b.qty);
}

/** অ্যাডমিন থেকে আসা বাড়তি ঘর পরিষ্কার করা */
export function cleanExtraFields(raw: unknown): ExtraField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const label = String(r?.label || '').trim();
      const name = String(r?.name || '').trim() || label.split('লিখুন')[0].replace(/[(:]+$/, '').trim() || label;
      return { name: name.slice(0, 60), label: label.slice(0, 200), required: !!r?.required };
    })
    .filter((f) => f.label)
    .slice(0, 6);
}

/**
 * ব্লকগুলো অর্ডার ফর্মের আগে আর পরে — দুই ভাগ।
 * পুরনো নতুন-ডিজাইনের পেইজে ফর্মের পরেও অংশ ছিল (প্রশ্নোত্তর, ফুটার),
 * তাই ফর্ম সব সময় শেষে বসালে পেইজের ক্রম বদলে যেত।
 */
export function splitAtOrder(blocks: Block[]): [Block[], Block[]] {
  const i = blocks.findIndex((b) => b.t === 'order');
  return i < 0 ? [blocks, []] : [blocks.slice(0, i), blocks.slice(i + 1)];
}
