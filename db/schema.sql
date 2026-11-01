-- =====================================================================
--  দোকানের ডাটাবেজ স্কিমা — MySQL / MariaDB (Hostinger)
--
--  Hostinger hPanel → Databases → phpMyAdmin → এই ডাটাবেস বাছুন →
--  Import → এই ফাইল। তারপর একই ভাবে db/seed.sql।
--
--  আগে Supabase (Postgres) ছিল। Hostinger-এর MySQL-এ আনার কারণ: সাইট আর
--  ডাটাবেস একই সার্ভারে, আলাদা অ্যাকাউন্ট বা প্রজেক্ট-লিমিটের ঝামেলা নেই,
--  আর Hostinger-এর ব্যাকআপে ডাটাবেসও ধরা থাকে।
--
--  সব সময় UTC-তে রাখা (DATETIME), দেখানোর সময় ঢাকার সময়ে বদলানো হয়।
--  আইডি UUID — অ্যাপ নিজেই বানায়; SQL থেকে বসালে ডিফল্টে UUID() বসে।
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- প্রোডাক্ট
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  code          VARCHAR(32)  NOT NULL,                 -- PK-01 (প্রিফিক্স site.ts-এ)
  -- Meta-তে content_ids হিসেবে যা যায়। পুরনো WooCommerce সাইট প্রোডাক্টের
  -- আইডি পাঠাত (যেমন "13") — এডের অডিয়েন্স ও ক্যাটালগ ওই আইডি চেনে, তাই
  -- পুরনো প্রোডাক্টে সেটাই রাখা। খালি থাকলে code যায়।
  content_id    VARCHAR(64)  NULL,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(191) NOT NULL,
  category      VARCHAR(64)  NOT NULL,                 -- key আসে src/config/site.ts → categories থেকে
  price         INT          NOT NULL,                 -- বিক্রয় মূল্য, টাকায়
  compare_price INT          NULL,                     -- কাটা দাম
  images        JSON         NOT NULL DEFAULT ('[]'),
  description   TEXT         NULL,
  video_url     VARCHAR(500) NULL,                     -- ইউটিউব লিংক (ঐচ্ছিক)
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  sort          INT          NOT NULL DEFAULT 0,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY products_code_uq (code),
  UNIQUE KEY products_slug_uq (slug),
  KEY products_active_idx (active, sort),
  KEY products_category_idx (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ভ্যারিয়েন্ট ও স্টক — সাইজ + রঙের জোড়া ধরে স্টক
CREATE TABLE IF NOT EXISTS product_variants (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  product_id  CHAR(36)     NOT NULL,
  opt_key     VARCHAR(64)  NOT NULL,                   -- 32, 34 … বা 'one'
  opt_label   VARCHAR(128) NOT NULL,
  color_key   VARCHAR(64)  NOT NULL DEFAULT '',        -- '' = রঙের ঘর নেই
  color_label VARCHAR(128) NULL,
  color_hex   VARCHAR(16)  NULL,
  stock       INT          NOT NULL DEFAULT 0,
  sort        INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY variants_combo_uq (product_id, opt_key, color_key),
  CONSTRAINT variants_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- দোকানের কম্বো প্যাকেজ (শপ পেইজের জন্য; ল্যান্ডিং পেইজের অফার আলাদা)
CREATE TABLE IF NOT EXISTS combos (
  id            CHAR(36)    NOT NULL DEFAULT (UUID()),
  qty           INT         NOT NULL,
  price         INT         NOT NULL,
  compare_price INT         NULL,
  tag           VARCHAR(128) NULL,
  active        TINYINT(1)  NOT NULL DEFAULT 1,
  sort          INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY combos_qty_uq (qty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- অর্ডার
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  -- পুরনো WooCommerce-এর অর্ডার নম্বরই রাখা হয়, নতুনগুলো তার পর থেকে —
  -- কল সেন্টার ও কুরিয়ারে আগের নম্বর দিয়ে খোঁজা চলতেই থাকে
  order_no      BIGINT       NOT NULL AUTO_INCREMENT,
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(32)  NOT NULL,                 -- 8801XXXXXXXXX (নরমালাইজড)
  phone_raw     VARCHAR(64)  NULL,
  address       TEXT         NOT NULL,
  city_type     VARCHAR(16)  NOT NULL DEFAULT 'inside',-- inside | outside
  note          TEXT         NULL,
  subtotal      INT          NOT NULL,
  shipping      INT          NOT NULL,
  total         INT          NOT NULL,
  -- hold — কাস্টমার পরে নিতে বলেছে/ফোন ধরেনি; কুরিয়ারে পাঠানো যায় না (নভেম্বর ২০২৬)
  status        ENUM('new','hold','confirmed','courier','delivered','returned','cancelled') NOT NULL DEFAULT 'new',
  status_note   TEXT         NULL,
  -- অ্যাট্রিবিউশন (CAPI-র জন্য জরুরি)
  fbp           VARCHAR(255) NULL,
  fbc           VARCHAR(500) NULL,
  fbclid        VARCHAR(500) NULL,
  client_ip     VARCHAR(64)  NULL,
  user_agent    TEXT         NULL,
  utm_source    VARCHAR(255) NULL,
  utm_medium    VARCHAR(255) NULL,
  utm_campaign  VARCHAR(255) NULL,
  utm_content   VARCHAR(255) NULL,
  utm_term      VARCHAR(255) NULL,
  landing_url   TEXT         NULL,
  referrer      TEXT         NULL,
  landing_slug  VARCHAR(191) NULL,
  -- কুরিয়ার
  courier            VARCHAR(32)  NULL,
  consignment_id     VARCHAR(128) NULL,
  tracking_code      VARCHAR(128) NULL,
  courier_status     VARCHAR(128) NULL,
  courier_synced_at  DATETIME(3)  NULL,
  courier_fee        INT          NULL,
  delivered_at       DATETIME(3)  NULL,
  -- ফ্রড সিগন্যাল
  is_flagged    TINYINT(1)   NOT NULL DEFAULT 0,
  flag_reason   VARCHAR(255) NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY orders_no_uq (order_no),
  KEY orders_status_idx (status, created_at),
  KEY orders_created_idx (created_at),
  KEY orders_phone_idx (phone),
  KEY orders_campaign_idx (utm_campaign, created_at),
  KEY orders_consignment_idx (consignment_id),
  KEY orders_landing_idx (landing_slug, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()),
  order_id     CHAR(36)     NOT NULL,
  product_id   CHAR(36)     NULL,
  product_code VARCHAR(32)  NULL,
  product_name VARCHAR(255) NOT NULL,
  opt_key      VARCHAR(64)  NULL,
  opt_label    VARCHAR(128) NULL,
  color_key    VARCHAR(64)  NULL,
  color_label  VARCHAR(128) NULL,
  qty          INT          NOT NULL,
  unit_price   INT          NOT NULL,
  combo_qty    INT          NULL,
  line_total   INT          NULL,                      -- সারির আসল মোট (১৩৯০ ÷ ৩ মেলে না)
  PRIMARY KEY (id),
  KEY order_items_order_idx (order_id),
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- CAPI ইভেন্ট লগ — প্রতিটি সার্ভার ইভেন্টের হিসাব
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capi_events (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  order_id    CHAR(36)     NULL,
  event_name  VARCHAR(64)  NOT NULL,
  event_id    VARCHAR(128) NOT NULL,                   -- ব্রাউজারের eventID-র সাথে মিলবে
  event_time  BIGINT       NOT NULL,
  payload     JSON         NOT NULL,
  status      VARCHAR(16)  NOT NULL DEFAULT 'pending', -- pending | sent | failed
  attempts    INT          NOT NULL DEFAULT 0,
  response    JSON         NULL,
  error       TEXT         NULL,
  sent_at     DATETIME(3)  NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY capi_events_evt_uq (event_name, event_id),
  KEY capi_events_status_idx (status, created_at),
  CONSTRAINT capi_events_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- সেটিংস (ডেলিভারি চার্জ, যোগাযোগ, কুরিয়ারের টোকেন)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  `key`      VARCHAR(64) NOT NULL,
  value      JSON        NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO settings (`key`, value) VALUES
  ('shipping', '{"inside":70,"outside":120}'),
  ('contact',  '{}');

-- ---------------------------------------------------------------------
-- অ্যাডমিন — নিজস্ব লগইন (Supabase Auth-এর বদলে)
-- পাসওয়ার্ড কখনো সরাসরি রাখা হয় না, শুধু scrypt হ্যাশ।
-- প্রথম অ্যাডমিন বানানো: অ্যাপ চালু হলে /admin/setup (README দেখুন)।
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  username      VARCHAR(64)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(16)  NOT NULL DEFAULT 'staff', -- owner | staff
  -- পাসওয়ার্ড বদলালে বা "সব জায়গা থেকে লগআউট" চাইলে এটা বাড়ে —
  -- পুরনো সব সেশন কুকি তখন আর চলে না
  session_ver   INT          NOT NULL DEFAULT 1,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY admin_users_username_uq (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- অ্যাডমিন অ্যাকশন লগ
CREATE TABLE IF NOT EXISTS audit_log (
  id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  actor      CHAR(36)     NULL,
  action     VARCHAR(64)  NOT NULL,
  entity     VARCHAR(64)  NULL,
  entity_id  VARCHAR(128) NULL,
  detail     JSON         NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY audit_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- ল্যান্ডিং পেইজ (CartFlows-এর বদলে)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS landing_pages (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  slug          VARCHAR(191) NOT NULL,                 -- /product/<slug>/ — এডের লিংক এটাই, বদলাবেন না
  product_id    CHAR(36)     NULL,
  title         VARCHAR(255) NOT NULL,
  blocks        JSON         NOT NULL DEFAULT ('[]'),
  tiers         JSON         NOT NULL DEFAULT ('[]'),  -- [{qty, price(মোট), label, tag, default}]
  form_title    VARCHAR(255) NULL,
  note_label    VARCHAR(255) NULL,
  note_required TINYINT(1)   NOT NULL DEFAULT 0,
  -- ফর্মের বাড়তি ঘর — [{"name":"কালার","label":"কালার লিখুন(…)","required":false}]
  -- পুরনো CartFlows ফর্মে কালার ও সাইজের আলাদা ঘর ছিল; উত্তরগুলো অর্ডারের নোটে যায়
  extra_fields  JSON         NOT NULL DEFAULT ('[]'),
  thankyou_slug VARCHAR(191) NULL,                     -- অর্ডারের পরে /product/<এটা>/
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  sort          INT          NOT NULL DEFAULT 0,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY landing_slug_uq (slug),
  KEY landing_thankyou_idx (thankyou_slug),
  CONSTRAINT landing_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- কাস্টমারের ডেলিভারি ইতিহাস (Pathao থেকে, ২৪ ঘণ্টা ক্যাশ)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_courier_stats (
  phone      VARCHAR(32)  NOT NULL,                    -- 01XXXXXXXXX
  courier    VARCHAR(32)  NOT NULL DEFAULT 'pathao',
  total      INT          NOT NULL DEFAULT 0,
  success    INT          NOT NULL DEFAULT 0,
  rating     VARCHAR(64)  NULL,
  error      VARCHAR(255) NULL,
  fetched_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- রিপোর্টিং ভিউ — অ্যাডমিন ড্যাশবোর্ডের জন্য
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW daily_stats AS
SELECT
  DATE(created_at)                                       AS day,
  COUNT(*)                                               AS orders,
  SUM(status <> 'cancelled')                             AS valid_orders,
  SUM(status = 'delivered')                              AS delivered,
  SUM(status = 'returned')                               AS returned,
  COALESCE(SUM(CASE WHEN status = 'delivered' THEN total END), 0) AS revenue
FROM orders
GROUP BY DATE(created_at);

CREATE OR REPLACE VIEW campaign_stats AS
SELECT
  COALESCE(utm_campaign, '(direct)')                     AS campaign,
  COALESCE(utm_content,  '(none)')                       AS adset,
  COUNT(*)                                               AS orders,
  SUM(status = 'delivered')                              AS delivered,
  SUM(status = 'returned')                               AS returned,
  COALESCE(SUM(CASE WHEN status = 'delivered' THEN total END), 0) AS revenue
FROM orders
GROUP BY COALESCE(utm_campaign, '(direct)'), COALESCE(utm_content, '(none)');
