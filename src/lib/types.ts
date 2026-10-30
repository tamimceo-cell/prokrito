export interface Variant {
  id: string; product_id: string;
  /** সাইজের অক্ষ — '32', 'm' … বা সাইজ না থাকলে 'one' */
  opt_key: string; opt_label: string;
  /** রঙের অক্ষ — খালি স্ট্রিং মানে এই পণ্যের রঙ নেই */
  color_key: string; color_label: string | null; color_hex: string | null;
  /** এই সাইজ+রঙ জোড়ার স্টক */
  stock: number; sort: number;
}
export interface Product {
  id: string; code: string;
  /** Meta-তে content_ids হিসেবে যায় — খালি হলে code (pixelId() দেখুন) */
  content_id?: string | null;
  name: string; slug: string; category: string;
  price: number; compare_price: number | null; images: string[];
  description: string | null; video_url: string | null; active: boolean; sort: number;
  product_variants?: Variant[];
}
export interface Combo { id: string; qty: number; price: number; compare_price: number | null; tag: string | null; active: boolean; sort: number }
export interface OrderItem {
  id: string; order_id: string; product_code: string | null; product_name: string;
  opt_key: string | null; opt_label: string | null;
  color_key: string | null; color_label: string | null;
  qty: number; unit_price: number; combo_qty: number | null;
  /** সারির আসল মোট — ল্যান্ডিং অফারে (১৩৯০ ÷ ৩) ভাগ না মিললে এটাই সঠিক */
  line_total?: number | null;
}
export interface Order {
  id: string; order_no: number; name: string; phone: string; address: string;
  city_type: 'inside' | 'outside'; note: string | null;
  subtotal: number; shipping: number; total: number;
  status: 'new' | 'confirmed' | 'courier' | 'delivered' | 'returned' | 'cancelled';
  utm_campaign: string | null; landing_slug?: string | null; utm_content: string | null; utm_source: string | null;
  consignment_id: string | null; tracking_code: string | null; courier_status: string | null;
  is_flagged: boolean; flag_reason: string | null;
  created_at: string; order_items?: OrderItem[];
}
export interface CartLine {
  code: string;
  /** Meta-র content_id (pixelId) — না থাকলে code */
  cid?: string;
  name: string; image: string;
  optKey: string; optLabel: string;
  /** রঙ না থাকলে দুটোই ফাঁকা */
  colorKey?: string; colorLabel?: string | null;
  qty: number; price: number; comboQty?: number;
}

/** Meta-র content_id — পুরনো সাইটের প্রোডাক্ট আইডি থাকলে সেটাই, নইলে কোড */
export const pixelId = (p: { code: string; content_id?: string | null }) => p.content_id || p.code;
