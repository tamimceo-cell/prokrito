import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { sql, tx } from './db';
import { normalizeBdPhone } from './capi';
import { cleanExtraFields, cleanTiers } from './landing';

/* =====================================================================
 *  পুরনো WordPress থেকে আনা — একবারের কাজ (আর কাটওভারের রাতে আরেকবার)
 *
 *  WordPress আর নতুন অ্যাপ একই Hostinger সার্ভারে। WordPress-এর দিক থেকে
 *  একটা স্ক্রিপ্ট সব কিছু ফাইলে লিখে রাখে (IMPORT_DIR), আর এখান থেকে সেই
 *  ফাইল পড়ে ডাটাবেসে বসানো হয়। ফলে কাস্টমারের নাম-ফোন কোথাও আপলোড বা
 *  ডাউনলোড করতে হয় না, সার্ভারের ভেতরেই থাকে।
 *
 *  দুবার চালালেও ক্ষতি নেই:
 *    - অর্ডার: যে অর্ডার নম্বর আগে থেকে আছে, সেটা ছোঁয়া হয় না
 *    - প্রোডাক্ট/ল্যান্ডিং: কোড/লিংক মিললে নতুন তথ্যে বদলে যায়
 * ===================================================================== */

function importDir(): string {
  const d = process.env.IMPORT_DIR;
  if (!d) throw new Error('IMPORT_DIR সেট করা নেই');
  return path.resolve(d);
}

interface ExportProduct {
  code: string; content_id: string; name: string; slug: string; category: string;
  price: number; compare_price?: number | null; images: string[]; description?: string | null; sort: number;
}
interface ExportLanding {
  slug: string; product_content_id: string; title: string; blocks: unknown[]; tiers: unknown[];
  extra_fields: unknown[]; form_title?: string | null; thankyou_slug: string | null; sort: number;
}

export async function importCatalog(): Promise<{ products: number; landings: number }> {
  const raw = JSON.parse(await fs.readFile(path.join(importDir(), 'catalog.json'), 'utf8')) as {
    products: ExportProduct[]; landings: ExportLanding[];
  };

  return tx(async (c) => {
    for (const p of raw.products) {
      await c.query(
        `INSERT INTO products (id, code, content_id, name, slug, category, price, compare_price, images, description, active, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE content_id = VALUES(content_id), name = VALUES(name), category = VALUES(category),
           price = VALUES(price), compare_price = VALUES(compare_price), images = VALUES(images),
           description = VALUES(description), sort = VALUES(sort)`,
        [randomUUID(), p.code, p.content_id, p.name, p.slug, p.category, p.price, p.compare_price ?? null,
          JSON.stringify(p.images || []), p.description ?? null, p.sort],
      );
      // সাইজ-কালার ফোনে নিশ্চিত হয়, তাই এক পণ্যে একটাই স্টকের ঘর — বড় স্টক
      await c.query(
        `INSERT IGNORE INTO product_variants (id, product_id, opt_key, opt_label, color_key, stock, sort)
         SELECT ?, id, 'one', 'এক সাইজ', '', 9999, 0 FROM products WHERE code = ?`,
        [randomUUID(), p.code],
      );
    }

    for (const l of raw.landings) {
      const [prod] = (await c.query('SELECT id FROM products WHERE content_id = ? LIMIT 1', [l.product_content_id]))[0] as any[];
      await c.query(
        `INSERT INTO landing_pages (id, slug, product_id, title, blocks, tiers, extra_fields, form_title, thankyou_slug, active, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE product_id = VALUES(product_id), title = VALUES(title), blocks = VALUES(blocks),
           tiers = VALUES(tiers), extra_fields = VALUES(extra_fields), form_title = VALUES(form_title),
           thankyou_slug = VALUES(thankyou_slug), sort = VALUES(sort)`,
        [randomUUID(), l.slug, prod?.id ?? null, l.title, JSON.stringify(l.blocks), JSON.stringify(cleanTiers(l.tiers)),
          JSON.stringify(cleanExtraFields(l.extra_fields)), l.form_title ?? null, l.thankyou_slug, l.sort],
      );
    }
    return { products: raw.products.length, landings: raw.landings.length };
  });
}

/* --------------------------------------------------------------------- */

interface ExportOrder {
  order_no: number; created_at: string; wc_status: string;
  name: string; phone: string; address: string; shipping: number; subtotal: number; total: number;
  note?: string | null; landing_slug?: string | null;
  utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null;
  utm_content?: string | null; utm_term?: string | null; referrer?: string | null;
  fbp?: string | null; fbc?: string | null; client_ip?: string | null; user_agent?: string | null;
  items: { content_id: string; name: string; qty: number; line_total: number }[];
}

/**
 * WooCommerce-এর অবস্থা → আমাদের অবস্থা।
 * পুরনো সাইটে প্রায় সব অর্ডার "completed" করা হতো — সেটা "পাঠানো হয়েছে"
 * বোঝাত, "ডেলিভার্ড" নিশ্চিত নয়। তাই "confirmed" — ডেলিভারির হিসাবে ভুল
 * করে ফোলানো সংখ্যা না আসে।
 */
const STATUS: Record<string, string> = {
  'wc-completed': 'confirmed', 'wc-processing': 'new', 'wc-on-hold': 'new', 'wc-pending': 'new',
  'wc-cancelled': 'cancelled', 'wc-failed': 'cancelled', 'wc-refunded': 'returned',
};

export async function importOrders(): Promise<{ read: number; added: number; skipped: number }> {
  const dir = importDir();
  const files = (await fs.readdir(dir)).filter((f) => /^orders.*\.ndjson$/.test(f)).sort();
  if (!files.length) throw new Error('orders*.ndjson ফাইল পাওয়া যায়নি');

  // প্রোডাক্ট চেনা হয় পুরনো আইডি (content_id) দিয়ে
  const prods = await sql<{ id: string; code: string; content_id: string | null }>('SELECT id, code, content_id FROM products');
  const byCid = new Map(prods.filter((p) => p.content_id).map((p) => [String(p.content_id), p]));

  let read = 0; let added = 0; let skipped = 0;
  let batch: ExportOrder[] = [];

  const flush = async () => {
    if (!batch.length) return;
    const nos = batch.map((o) => o.order_no);
    const have = new Set(
      (await sql<{ order_no: number }>(`SELECT order_no FROM orders WHERE order_no IN (${nos.map(() => '?').join(',')})`, nos))
        .map((r) => Number(r.order_no)),
    );
    const fresh = batch.filter((o) => !have.has(o.order_no) && STATUS[o.wc_status]);
    skipped += batch.length - fresh.length;
    if (fresh.length) {
      await tx(async (c) => {
        const orderRows: unknown[][] = []; const itemRows: unknown[][] = [];
        for (const o of fresh) {
          const id = randomUUID();
          const phone = normalizeBdPhone(o.phone) || String(o.phone || '').replace(/\D/g, '').slice(0, 20) || '0';
          const created = new Date(o.created_at.replace(' ', 'T') + 'Z').toISOString().replace('T', ' ').replace('Z', '');
          orderRows.push([
            id, o.order_no, (o.name || '—').slice(0, 255), phone, o.phone || null, o.address || '—',
            o.shipping >= 100 ? 'outside' : 'inside', o.note || null,
            Math.round(o.subtotal), Math.round(o.shipping), Math.round(o.total), STATUS[o.wc_status],
            'পুরনো WordPress সাইট থেকে আনা', o.fbp || null, o.fbc || null, o.client_ip || null, o.user_agent || null,
            o.utm_source || null, o.utm_medium || null, o.utm_campaign || null, o.utm_content || null, o.utm_term || null,
            o.referrer || null, o.landing_slug || null, created, created,
          ]);
          for (const it of o.items) {
            const p = byCid.get(String(it.content_id));
            const qty = Math.max(1, Math.round(it.qty));
            itemRows.push([randomUUID(), id, p?.id ?? null, p?.code ?? null, (it.name || '—').slice(0, 255),
              'one', 'এক সাইজ', qty, Math.round(it.line_total / qty), Math.round(it.line_total)]);
          }
        }
        await c.query(
          `INSERT INTO orders (id, order_no, name, phone, phone_raw, address, city_type, note, subtotal, shipping, total, status,
            status_note, fbp, fbc, client_ip, user_agent, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            referrer, landing_slug, created_at, updated_at) VALUES ?`,
          [orderRows],
        );
        if (itemRows.length) {
          await c.query(
            `INSERT INTO order_items (id, order_id, product_id, product_code, product_name, opt_key, opt_label, qty, unit_price, line_total) VALUES ?`,
            [itemRows],
          );
        }
      });
      added += fresh.length;
    }
    batch = [];
  };

  for (const f of files) {
    const text = await fs.readFile(path.join(dir, f), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      batch.push(JSON.parse(line));
      read++;
      if (batch.length >= 300) await flush();
    }
  }
  await flush();
  return { read, added, skipped };
}
