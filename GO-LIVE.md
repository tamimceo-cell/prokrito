# prokrito.com — লাইভে নেওয়ার ধাপ (এড না থামিয়ে)

পুরনো WordPress সাইট শেষ ধাপ পর্যন্ত চালু থাকবে। নতুন সাইট আগে একটা
টেস্ট ঠিকানায় (`new.prokrito.com`) চলবে; সব মিললে তবেই ডোমেইন বদল।

## ১. ডাটাবেস (Hostinger → prokrito.com → Databases)
- [x] MySQL Databases → নতুন ডাটাবেস + নতুন ইউজার + শক্ত পাসওয়ার্ড
- টেবিল বানাতে কিছু করতে হবে না — `/admin/setup`-এ প্রথম অ্যাডমিন বানানোর সময় অ্যাপ নিজেই বানায়

## ২. Meta
- [ ] Events Manager → পিক্সেল `1403169921223046` → Settings → Conversions API → **Generate access token**
      (PixelYourSite-এ যেটা বসানো ছিল সেটাও চলবে) — শুধু Hostinger-এ বসাবেন, চ্যাটে নয়

## ৩. Pathao (Prokrito.Com অ্যাকাউন্ট)
- [ ] merchant.pathao.com → Developer's API → client_id, client_secret
- [ ] Stores → পিকআপ স্টোরের **Store ID**
- [ ] নিজে একটা লম্বা র‍্যান্ডম লেখা → `PATHAO_WEBHOOK_PATH`

## ৪. Hostinger Web App — টেস্ট ঠিকানায়
- [ ] Domains → সাবডোমেইন `new.prokrito.com`
- [ ] Websites → Add website → **Node.js Web App** → GitHub রিপো `prokrito` → ডোমেইন `new.prokrito.com`
- [ ] Environment variables (`.env.example` দেখুন): DB_*, SESSION_SECRET, ADMIN_SETUP_TOKEN,
      MEDIA_DIR, IMPORT_DIR, NEXT_PUBLIC_FB_PIXEL_ID, FB_CAPI_ACCESS_TOKEN,
      FB_TEST_EVENT_CODE (শুধু টেস্টে), PATHAO_*, NEXT_PUBLIC_SITE_URL=https://prokrito.com, REVALIDATE_SECRET
- [ ] ডিপ্লয় শেষে `https://new.prokrito.com/admin/setup` → সেটআপ টোকেন দিয়ে প্রথম অ্যাডমিন
- [ ] অ্যাডমিন → **পুরনো ডাটা** → "১. প্রোডাক্ট ও ল্যান্ডিং পেইজ আনুন" → "২. পুরনো অর্ডার আনুন"

## ৫. টেস্ট (new.prokrito.com)
- [ ] ৯টা পেইজ পুরনো সাইটের পাশাপাশি খুলে মিলিয়ে দেখুন — লেখা, ছবি, দাম, অফার
- [ ] front-button-bra-তে কম্বো কার্ড বদলালে ফর্মের অফারও বদলায় কিনা
- [ ] টেস্ট অর্ডার → ধন্যবাদ পাতা (`/product/thank-you-new-button/`)
- [ ] Events Manager → Test events: PageView, ViewContent, InitiateCheckout, Purchase —
      Purchase-এ Browser + Server দুটোই, deduplicated; content_ids = 13 (পুরনোর মতো)
- [ ] অ্যাডমিন → অর্ডার: টেস্ট অর্ডারে কালার/সাইজ নোটে আছে; অ্যাডমিন → পিক্সেল ইভেন্ট: `sent`
- [ ] টেস্ট অর্ডার মুছে দিন

## ৬. ডোমেইন বদল (রাত ২-৫টা, এড খরচ সবচেয়ে কম)
- [ ] ⚠️ **`FB_TEST_EVENT_CODE` খালি করুন**
- [ ] WordPress-এর ফুল ব্যাকআপ (ফাইল + ডাটাবেস) ডাউনলোড
- [ ] WordPress থেকে অর্ডার ফাইল নতুন করে বানানো (Claude করবে) → অ্যাডমিন → "পুরনো অর্ডার আনুন"
      — টেস্টের পর থেকে আসা অর্ডারগুলোও চলে আসবে
- [ ] Hostinger-এ WordPress-কে অস্থায়ী ডোমেইনে সরান, Node অ্যাপে `prokrito.com` যোগ করুন
- [ ] SSL চালু হলে `https://prokrito.com/product/front-button-bra/` খুলে দেখুন
- [ ] মোবাইল ডাটায় একটা আসল অর্ডার, পরে বাতিল
- [ ] PixelYourSite যেহেতু আর চলছে না, একই পিক্সেলে ডাবল ইভেন্টের ভয় নেই

## ৭. প্রথম ২৪ ঘণ্টা
- [ ] এডস ম্যানেজারে Purchase আসছে কিনা
- [ ] অ্যাডমিন → অর্ডার: অর্ডার আসছে কিনা
- [ ] WordPress অন্তত ৭ দিন অস্থায়ী ডোমেইনে রেখে দিন (ফেরত যাওয়ার রাস্তা), তারপর বন্ধ

## যদি কিছু ভাঙে
Hostinger-এ ডোমেইন আবার পুরনো WordPress-এ ফিরিয়ে দিন — এড একই লিংকে
চলছে, তাই এডে কিছু বদলাতে হবে না।
