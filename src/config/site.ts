/* =====================================================================
 *  এক ক্লায়েন্ট = এই একটি ফাইল
 * =====================================================================
 *
 *  নতুন দোকান বানাতে হলে পুরো প্রজেক্ট কপি করে শুধু এই ফাইলটা বদলান,
 *  আর public/img/ ফোল্ডারে লোগো দুটো রাখুন। কোডের আর কোথাও ব্র্যান্ডের
 *  নাম, রং, ফোন নম্বর বা বাংলা লেখা বসানো নেই।
 *
 *  বদলানোর পর:
 *    1. supabase/seed.sql-এ প্রোডাক্ট বসান
 *    2. .env.local-এ কি-গুলো বসান
 *    3. npm run build
 *
 *  ⚠️ রং বদলালে tailwind.config.ts নিজে থেকেই সেটা তুলে নেয় —
 *     ওই ফাইলে হাত দেওয়ার দরকার নেই।
 * ===================================================================== */

export interface SiteConfig {
  name: string;
  tagline: string;
  domain: string;
  description: string;
  logo: string;
  logoSm: string;
  codePrefix: string;
  facebookDomainVerification?: string;
  adminEmailDomain: string;
  words: Words;
  colors: Colors;
  categories: Category[];
  options: OptionAxis;
  colorSuggestions: ColorOption[];
  combos: CombosConfig;
  contact: Contact;
  shipping: Shipping;
  home: HomeContent;
  about: string[];
  returnPolicy: string;
  /** কোন কুরিয়ারে পার্সেল যায় — অ্যাডমিনের বোতাম ও স্ট্যাটাস আপডেট এটা ধরে */
  courier: 'pathao' | 'steadfast';
  /**
   * Purchase ইভেন্টের value-তে ডেলিভারি চার্জ ধরা হবে কিনা।
   * পুরনো WordPress সাইটের PixelYourSite চার্জসহ মোট টাকা পাঠাত — এড ম্যানেজারের
   * ROAS/Purchase value হঠাৎ বদলে না যেতে ওই সাইটে true রাখা।
   */
  purchaseValueIncludesShipping?: boolean;
  /** ধন্যবাদ পাতার বোতাম — খালি থাকলে বোতাম দেখায় না */
  social?: { facebookPage?: string; facebookGroup?: string };
}

interface Words {
  /** একটি পণ্যকে কী বলব — "পোশাক", "গহনা", "পণ্য" */
  item: string;
  /** মেনুতে ও শপ পেইজে — "সব পোশাক" */
  allItems: string;
  /** সাইজের অক্ষের নাম — "সাইজ", "বয়স", "মাপ" */
  optionAxis: string;
  /** রঙের অক্ষের নাম — "রঙ", "কালার", "ডিজাইন" */
  colorAxis: string;
  /** সার্চ বক্সের হিন্ট */
  searchHint: string;
}

interface Colors {
  ink: string; ink2: string; ink3: string;
  cream: string; sunk: string; line: string;
  brand: string; brandSoft: string; brandDeep: string;
  gold: string; goldBright: string;
  accent: string; accentSoft: string;
  ok: string; warn: string;
}

interface Category { key: string; label: string }

interface OptionAxis {
  /** false হলে সাইজ বাছার ঘরটাই দেখাবে না — এক পণ্যে এক স্টক */
  enabled: boolean;
  /** নতুন প্রোডাক্টে যে ভ্যারিয়েন্টগুলো বসবে */
  values: { key: string; label: string }[];
  /** enabled=false হলে ভেতরে যে একটিমাত্র ভ্যারিয়েন্ট থাকে */
  singleLabel: string;
}

interface ColorOption { key: string; label: string; hex: string }

interface CombosConfig {
  /** false হলে কম্বো অফার পেইজ ও মেনু লুকানো থাকে */
  enabled: boolean;
  /** "৩ পিস সেট" — {n} জায়গায় সংখ্যা বসে */
  unitLabel: string;
  popularTag: string;
}

interface Contact {
  phone: string; whatsapp: string; email: string; address: string; hours: string;
}

interface Shipping { inside: number; outside: number }

interface HomeContent {
  /**
   * হিরোর ধরন। 'collage' — চারটে প্রোডাক্টের ছবি (টেমপ্লেটের ডিফল্ট)।
   * 'tape' — খিলান-আয়নায় একটা প্রোডাক্ট + নিচে সাইজের ফিতা (ইনারওয়্যারের দোকানের জন্য)।
   */
  heroStyle?: 'collage' | 'tape';
  /** 'tape' হিরোর আয়নায় কোন প্রোডাক্ট (কোড) */
  heroProduct?: string;
  /** ফিতায় লেখা সাইজগুলো */
  tapeSizes?: string[];
  /** ফিতার নিচের এক লাইন */
  tapeNote?: string;
  heroBadge: string;
  heroTitle: string;
  /** শিরোনামের যে অংশটা ব্র্যান্ড রঙে আলাদা দেখাবে */
  heroAccent: string;
  heroTail: string;
  heroSub: string;
  chips: string[];
  trust: [string, string, string][];
  featuredTitle: string;
  featuredSub: string;
  categoryTitle: string;
  categorySub: string;
}

/* ===================================================================== */

export const site: SiteConfig = {
  name: 'Prokrito',
  tagline: 'Trusted quality and service',
  domain: 'prokrito.com',
  description:
    'আরামদায়ক ও অরিজিনাল নারীদের ইনারওয়্যার, শেপওয়্যার, বাচ্চাদের পোশাক ও দরকারি গ্যাজেট — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।',

  // পুরনো সাইটের লোগো — সার্ভারের MEDIA_DIR-এ নতুন করে এনকোড করে রাখা
  logo: '/media/brand/cropped-website-black.webp',
  logoSm: '/media/brand/cropped-website1.webp',

  /** প্রোডাক্ট কোড — PK-01, PK-02 … */
  codePrefix: 'PK',

  /** Meta Business Settings → Brand safety → Domains থেকে নিন */
  facebookDomainVerification: '',

  adminEmailDomain: 'prokrito.com',

  words: {
    item: 'পণ্য',
    allItems: 'সব পণ্য',
    optionAxis: 'সাইজ',
    colorAxis: 'কালার',
    searchHint: 'কোড বা পণ্যের নাম লিখে খুঁজুন…',
  },

  /* রং — পুরনো ল্যান্ডিং পেইজের গোলাপি (#D6336C) থেকে */
  colors: {
    ink: '#2B2B2B', ink2: '#4A4A4A', ink3: '#6B6B6B',
    cream: '#FDF7F9', sunk: '#F7EEF2', line: '#F0E5E9',
    brand: '#D6336C', brandSoft: '#F8D7E3', brandDeep: '#A61E4D',
    gold: '#E8590C', goldBright: '#FAB005',
    accent: '#862E9C', accentSoft: '#F3E8F7',
    ok: '#2F9E44', warn: '#B4541C',
  },

  categories: [
    { key: 'ladies-inner', label: 'লেডিস ইনার' },
    { key: 'shapewear', label: 'শেপওয়্যার' },
    { key: 'baby', label: 'বাচ্চাদের পোশাক' },
    { key: 'gadget', label: 'গ্যাজেট' },
  ],

  /* সাইজ ও কালার ফর্মের ঘরে লেখা হয়, কল সেন্টার ফোনে নিশ্চিত করে —
     তাই আলাদা স্টকের ঘর নেই। এক পণ্যে এক স্টক। */
  options: {
    enabled: false,
    values: [{ key: 'one', label: 'এক সাইজ' }],
    singleLabel: 'এক সাইজ',
  },

  colorSuggestions: [
    { key: 'skin',   label: 'স্কিন',   hex: '#E3BFA3' },
    { key: 'pink',   label: 'পিংক',    hex: '#E8739F' },
    { key: 'coffee', label: 'কফি',     hex: '#6F4E37' },
    { key: 'maroon', label: 'মেরুন',   hex: '#7B1E3A' },
    { key: 'black',  label: 'কালো',    hex: '#1C1C1E' },
    { key: 'paste',  label: 'পেস্ট',   hex: '#9FD8CB' },
  ],

  combos: {
    enabled: false,
    unitLabel: '{n} পিস প্যাক',
    popularTag: 'সবচেয়ে জনপ্রিয়',
  },

  contact: {
    phone: '01715-987848',
    /** wa.me লিংকের জন্য — দেশের কোডসহ, চিহ্ন ছাড়া */
    whatsapp: '8801715987848',
    email: '',
    address: '',
    hours: 'প্রতিদিন সকাল ৯টা – রাত ৯টা',
  },

  shipping: { inside: 70, outside: 120 },

  home: {
    heroStyle: 'tape',
    heroProduct: 'PK-02',
    tapeSizes: ['৩০', '৩২', '৩৪', '৩৬', '৩৮', '৪০', '৪২', '৪৪', '৪৬'],
    tapeNote: 'কোন সাইজ নেবেন বুঝতে পারছেন না? অর্ডার দিন, আমরা ফোন করে মিলিয়ে দেব।',
    heroBadge: 'ফোম ছাড়া, নরম কাপড়ের ব্রা',
    heroTitle: 'সারাদিন আরাম, ঠিক আপনার মাপে',
    heroAccent: '',
    heroTail: '',
    heroSub:
      'ব্রা, শেপওয়্যার আর বাচ্চাদের পোশাক। পণ্য হাতে পেয়ে, দেখে, তারপর টাকা দিন।',
    chips: ['ক্যাশ অন ডেলিভারি', 'অগ্রিম টাকা লাগে না', 'সারা দেশে ডেলিভারি'],
    trust: [
      ['🚚', 'ক্যাশ অন ডেলিভারি', 'পণ্য হাতে পেয়ে টাকা দিন'],
      ['✅', 'দেখে নিন', 'কোয়ালিটি চেক করে পেমেন্ট'],
      ['🔄', 'সহজ এক্সচেঞ্জ', 'পছন্দ না হলে সহজে বদলে নিন'],
      ['📞', 'কল করে নিশ্চিত', 'সাইজ ও কালার ফোনে কনফার্ম'],
    ],
    featuredTitle: 'জনপ্রিয় পণ্য',
    featuredSub: 'এই মুহূর্তে সবচেয়ে বেশি অর্ডার হচ্ছে যেগুলো',
    categoryTitle: 'ক্যাটাগরি থেকে দেখুন',
    categorySub: 'যা খুঁজছেন তা দ্রুত পেতে ক্যাটাগরি বেছে নিন',
  },

  about: [
    'প্রকৃত এন্টারপ্রাইজ — আরামদায়ক ও অরিজিনাল নারীদের ইনারওয়্যার, বিশ্বস্ত সেবা।',
    'আমরা কোনো অগ্রিম টাকা নিই না। পণ্য হাতে পেয়ে, দেখে, তারপর মূল্য পরিশোধ করবেন।',
    'অর্ডারের পরে আমাদের কল সেন্টার থেকে ফোন করে সাইজ ও কালার নিশ্চিত করা হয়।',
  ],

  returnPolicy:
    'পণ্য পছন্দ না হলে সহজেই এক্সচেঞ্জ করতে পারবেন — আমাদের নম্বরে কল বা হোয়াটসঅ্যাপ করুন।',

  courier: 'pathao',

  purchaseValueIncludesShipping: true,

  social: { facebookPage: 'https://www.facebook.com/107783068325055', facebookGroup: '' },
};

/* ---- ছোট সহায়ক ---- */

export const catLabel = (key: string) =>
  site.categories.find((c) => c.key === key)?.label || key;

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || `https://${site.domain}`;
