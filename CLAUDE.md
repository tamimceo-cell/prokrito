# prokrito.com — Prokrito (প্রকৃত এন্টারপ্রাইজ)

নারীদের ইনারওয়্যার (ব্রা), শেপওয়্যার, বাচ্চাদের পোশাক। ফেইসবুক এড →
ল্যান্ডিং পেইজ → ক্যাশ অন ডেলিভারি। আগে WordPress + CartFlows +
PixelYourSite PRO ছিল; ২০২৬-এর অক্টোবর-নভেম্বরে এই স্ট্যাকে আনা হচ্ছে।

**মালিক:** Tamim (tamim.acca19@gmail.com) · কথা বলুন **বাংলায়**।

## স্ট্যাক

| কী | কোথায় |
|---|---|
| কোড | `github.com/tamimceo-cell/prokrito` (প্রাইভেট) |
| টেমপ্লেট | sohashopbd থেকে নেওয়া, কিন্তু **ডাটাবেস MySQL** (Supabase নয়) |
| হোস্টিং | Hostinger Cloud → Web Apps (Node.js), GitHub থেকে অটো-ডিপ্লয় |
| ডাটাবেস | Hostinger MySQL — `db/schema.sql`; কোড `src/lib/db.ts` (Supabase-ধাঁচের ছোট বিল্ডার) |
| অ্যাডমিন লগইন | নিজস্ব — scrypt হ্যাশ + সই করা কুকি (`src/lib/auth.ts`); প্রথম অ্যাডমিন `/admin/setup` |
| ছবি | সার্ভারের `MEDIA_DIR` (`/home/u914342140/media/prokrito`), দেখায় `/media/…` — ডিপ্লয়ে মোছে না |
| কুরিয়ার | Pathao (Prokrito.Com অ্যাকাউন্ট) |
| ট্র্যাকিং | Meta Pixel `1403169921223046` (পুরনো সাইটেরটাই) + Conversions API |

## এড চলছে — যা কখনো বদলাবেন না

- ল্যান্ডিং পেইজের লিংক (শেষের স্ল্যাশসহ): `/product/front-button-bra/`,
  `/product/net-floral-bra-new/`, `/product/net-floral-bra/`, `/product/button-bra/`,
  `/product/magic-bra/`, `/product/fita-button-bra/`, `/product/hook-body-shaper/`,
  `/product/magic-slimming-belt/`, `/product/baby-dress/`
- ধন্যবাদ পাতা — পুরনো CartFlows-এর মতোই: `thank-you-new-button`, `thank-you-woo-5-2`,
  `thank-you-woo-5`, `thank-you-woo`, `thank-you`, `thank-you-2`, `thank-you-woo-2`,
  `thank-you-woo-2-2`, `thank-you-woo-4`
- পিক্সেল আইডি।
- **content_ids = পুরনো WooCommerce প্রোডাক্ট আইডি** (`products.content_id`: 13, 15112 …)।
  PixelYourSite এগুলোই পাঠাত; বদলালে এডের অডিয়েন্স/ক্যাটালগ মিলবে না।
- **Purchase value = ডেলিভারি চার্জসহ মোট** (`site.purchaseValueIncludesShipping`) —
  PixelYourSite-এর ডিফল্ট এটাই ছিল।
- অর্ডার নম্বর পুরনো WooCommerce-এর ধারাবাহিকতায় (শেষ পুরনো #19824-এর পরে)।

## ল্যান্ডিং পেইজ

- `front-button-bra` আর `net-floral-bra-new` — Elementor-এর HTML উইজেটে হাতে বানানো
  নকশা। হুবহু রাখা হয়েছে `html` ব্লকে (স্লাইডার, টাইমার, কম্বো কার্ড, FAQ সব
  নিজের স্ক্রিপ্টে চলে)। ফর্মের জায়গা `order` ব্লক। ফর্মের `id="order-form"` —
  ওই পেইজের বোতামগুলো এটাতেই স্ক্রল করে।
- পেইজের কম্বো কার্ড `pkPackageChange` ইভেন্ট ছাড়ে — ফর্মের অফার সেটায় বদলায়।
- বাকি ৭টা পুরনো Elementor উইজেট থেকে ব্লকে (heading/text/image/list/cta…)।
- ফর্মে কালার/সাইজ (বা ড্রেস কোড/বয়স) — `extra_fields`, উত্তর অর্ডারের নোটে যায়।

## পুরনো ডাটা আনা

WordPress আর নতুন অ্যাপ একই সার্ভারে। WordPress-এর দিক থেকে স্ক্রিপ্ট
`IMPORT_DIR`-এ `catalog.json` আর `orders-1.ndjson` লেখে; অ্যাডমিন → "পুরনো ডাটা"
থেকে বোতাম চাপলে বসে। দুবার চালালেও ডুপ্লিকেট হয় না। WooCommerce-এর
"completed" → এখানে "confirmed" (ডেলিভার্ড নিশ্চিত নয় বলে)।

## যা মনে রাখতে হবে

- পুরনো WordPress **হ্যাক হয়েছিল** (Hello Elementor-এ "panox1" ম্যালওয়্যার, এপ্রিল
  ২০২৬-এ বানানো ভুয়া অ্যাডমিন — ১৪ অক্টোবর মুছে ফেলা)। ওখান থেকে শুধু লেখা, ছবি
  (নতুন করে WebP এনকোড) আর অর্ডার আনা — কোনো কোড/ফাইল নয়। WordPress-এর
  ডাটাবেস পাসওয়ার্ড নতুন অ্যাপে ব্যবহার করা হয়নি।
- **কোনো কি, টোকেন বা পাসওয়ার্ড চ্যাটে দেখাবেন না** — Tamim নিজে Hostinger-এ বসান।
- **ডাটাবেস বদল আগে, পুশ পরে।** নতুন টেবিল/কলাম `db/schema.sql`-এ; প্রথম সেটআপে অ্যাপ নিজে চালায়
  (`ensureSchema`), পরের বদল phpMyAdmin-এ হাতে।
- ফন্ট @fontsource থেকে (Google Fonts নয়) — Hostinger-এর বিল্ডে next/font/google ভেঙেছিল।

## কাজের ধরন

Tamim ডেভেলপার নন — ব্যাখ্যা নয়, কাজ চান। ভুল হলে সরাসরি বলা পছন্দ করেন।
কোডের মন্তব্য বাংলায়, "কেন" লেখা থাকে। পরিবর্তন লাইভে যাচাই করে তারপর
বলবেন যে হয়েছে।
