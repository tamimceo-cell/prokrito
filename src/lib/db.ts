import 'server-only';
import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';
import { randomUUID } from 'crypto';

/* =====================================================================
 *  ডাটাবেস — Hostinger-এর MySQL/MariaDB
 *
 *  আগে Supabase ছিল, আর পুরো কোড লেখা ছিল তার ধাঁচে:
 *    db.from('orders').select('*, order_items(*)').eq('status','new')
 *  সেই ২৮টা ফাইল নতুন করে লেখার বদলে এখানে একই ধাঁচের ছোট একটা
 *  কোয়েরি-বিল্ডার বানানো, যা ভেতরে সাধারণ SQL চালায়। এতে বাকি কোড
 *  প্রায় অক্ষত থাকে, আর টেমপ্লেটের অন্য সাইটগুলোর সাথে মিলও থাকে।
 *
 *  যা যা আছে — কোডে যা ব্যবহার হয় ঠিক ততটুকুই:
 *    select (এক ধাপের নেস্টেড টেবিলসহ), insert, update, upsert, delete,
 *    eq/neq/gt/gte/lt/lte/in/is/not/like/ilike/or/match,
 *    order, limit, range, single, maybeSingle, count/head, rpc
 *
 *  সব ব্যবহারকারী-ইনপুট "?" প্লেসহোল্ডারে যায় — SQL ইনজেকশনের সুযোগ নেই।
 *  কলামের নাম কোড থেকে আসে, তবু নামের ধরন যাচাই করা হয়।
 * ===================================================================== */

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  const base = url
    ? { uri: url }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      };
  if (!url && !process.env.DB_NAME) throw new Error('DB_NAME / DB_USER / DB_PASSWORD সেট করা নেই');
  pool = mysql.createPool({
    ...base,
    // Hostinger-এর শেয়ার্ড সার্ভারে কানেকশন সীমিত — কম রাখাই নিরাপদ
    connectionLimit: Number(process.env.DB_POOL || 5),
    waitForConnections: true,
    // সব সময় UTC — দেখানোর সময় ঢাকার সময়ে বদলানো হয়
    timezone: 'Z',
    dateStrings: true,
    charset: 'utf8mb4',
    enableKeepAlive: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
  } as any);
  return pool;
}

/** কাঁচা SQL — বিল্ডারে না কুলালে (রিপোর্ট, ইমপোর্ট) */
export async function sql<T = any>(query: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getPool().query(query, params);
  return rows as T[];
}

/** একাধিক লেখা একসাথে — হয় সব হবে, নয় কোনোটাই না */
export async function tx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await getPool().getConnection();
  try {
    await c.beginTransaction();
    const r = await fn(c);
    await c.commit();
    return r;
  } catch (e) {
    await c.rollback().catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/* ---------------------------------------------------------------------
 *  কলামের ধরন — MySQL JSON আর বুলিয়ান লেখা হিসেবে ফেরত দেয়,
 *  Supabase দিত আসল অবজেক্ট/true-false। কোড যেন তফাত টের না পায়।
 * ------------------------------------------------------------------- */
const JSON_COLS = new Set(['images', 'blocks', 'tiers', 'extra_fields', 'payload', 'response', 'value', 'detail']);
const BOOL_COLS = new Set(['active', 'is_flagged', 'note_required']);
const DATE_COLS = new Set([
  'created_at', 'updated_at', 'sent_at', 'delivered_at', 'courier_synced_at', 'fetched_at',
]);
// ভিউ-র গণনা কলাম MariaDB দশমিক লেখা হিসেবে দেয়
const NUM_COLS = new Set(['orders', 'valid_orders', 'delivered', 'returned', 'revenue']);

/** কোন টেবিলের আইডি নিজে বানাতে হবে (UUID) */
const UUID_TABLES = new Set([
  'products', 'product_variants', 'combos', 'orders', 'order_items', 'capi_events',
  'admin_users', 'audit_log', 'landing_pages',
]);

/**
 * নেস্টেড সিলেক্টের সম্পর্ক — Supabase এগুলো ফরেন কি দেখে নিজে বুঝত।
 *   many: এক সারির নিচে অনেক সারি (অর্ডার → আইটেম)
 *   one : এক সারির উপরে একটা সারি (ভ্যারিয়েন্ট → প্রোডাক্ট)
 */
const RELATIONS: Record<string, Record<string, { kind: 'many' | 'one'; local: string; foreign: string }>> = {
  orders: { order_items: { kind: 'many', local: 'id', foreign: 'order_id' } },
  products: { product_variants: { kind: 'many', local: 'id', foreign: 'product_id' } },
  product_variants: { products: { kind: 'one', local: 'product_id', foreign: 'id' } },
  order_items: {
    orders: { kind: 'one', local: 'order_id', foreign: 'id' },
    products: { kind: 'one', local: 'product_id', foreign: 'id' },
  },
  landing_pages: { products: { kind: 'one', local: 'product_id', foreign: 'id' } },
  capi_events: { orders: { kind: 'one', local: 'order_id', foreign: 'id' } },
};

const IDENT = /^[a-z_][a-z0-9_]*$/i;
function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`অচেনা কলাম/টেবিল: ${name}`);
  return '`' + name + '`';
}

/** ISO → MySQL DATETIME (UTC) */
function toDbDate(v: unknown): unknown {
  if (v === null || v === undefined || v === '') return v ?? null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (isNaN(d.getTime())) return v;
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

/** MySQL DATETIME (UTC) → ISO */
function fromDbDate(v: unknown): unknown {
  if (typeof v !== 'string' || !v) return v;
  return v.includes('T') ? v : v.replace(' ', 'T') + 'Z';
}

function toDbValue(col: string, v: unknown): unknown {
  if (v === undefined) return null;
  if (JSON_COLS.has(col)) return v === null ? null : JSON.stringify(v);
  if (DATE_COLS.has(col)) return toDbDate(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

function fromDbRow(row: Record<string, any>): Record<string, any> {
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (JSON_COLS.has(k) && typeof v === 'string') {
      try { row[k] = JSON.parse(v); } catch { /* যেমন আছে তেমন */ }
    } else if (BOOL_COLS.has(k) && v !== null) {
      row[k] = !!Number(v);
    } else if (DATE_COLS.has(k)) {
      row[k] = fromDbDate(v);
    } else if (NUM_COLS.has(k) && v !== null && typeof v === 'string') {
      row[k] = Number(v);
    }
  }
  return row;
}

/* ---------------------------------------------------------------------
 *  select('a, b, rel(x, y)') ভাঙা
 * ------------------------------------------------------------------- */
interface Nested { name: string; as: string; cols: ParsedCols }
interface ParsedCols { star: boolean; cols: string[]; nested: Nested[] }

function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function parseCols(s: string): ParsedCols {
  const r: ParsedCols = { star: false, cols: [], nested: [] };
  for (const part of splitTop(s || '*')) {
    // product:products(...) — নাম বদলে (alias) জোড়া
    const m = part.match(/^(?:([a-z_][a-z0-9_]*)\s*:\s*)?([a-z_][a-z0-9_]*)\s*\((.*)\)$/is);
    if (m) r.nested.push({ name: m[2], as: m[1] || m[2], cols: parseCols(m[3]) });
    else if (part === '*') r.star = true;
    else r.cols.push(part);
  }
  if (!r.cols.length && !r.nested.length) r.star = true;
  return r;
}

function colList(p: ParsedCols, extra: string[] = []): string {
  if (p.star) return '*';
  const set = new Set([...p.cols, ...extra]);
  return [...set].map(ident).join(', ');
}

/* --------------------------------------------------------------------- */

type DbError = { message: string; code?: string };
export type Result<T = any> = { data: T; error: DbError | null; count?: number | null };

type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

class Query<T = any[]> implements PromiseLike<Result<T>> {
  private op: Op = 'select';
  private cols = '*';
  private countMode = false;
  private head = false;
  private returning: string | null = null;
  private where: string[] = [];
  private params: unknown[] = [];
  private orders: string[] = [];
  private lim: number | null = null;
  private off = 0;
  private one: 'single' | 'maybe' | null = null;
  private payload: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private ignoreDup = false;

  constructor(private table: string) { ident(table); }

  /* ---------- কী করা হবে ---------- */
  select(cols = '*', opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    if (this.op === 'select') {
      this.cols = cols;
      this.countMode = !!opts?.count;
      this.head = !!opts?.head;
    } else {
      this.returning = cols;   // insert(...).select('id') — লেখার পরে ফেরত
    }
    return this;
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this;
  }
  upsert(rows: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows];
    this.ignoreDup = !!opts?.ignoreDuplicates; return this;
  }
  update(patch: Record<string, unknown>) { this.op = 'update'; this.patch = patch; return this; }
  delete() { this.op = 'delete'; return this; }

  /* ---------- শর্ত ---------- */
  private cond(col: string, opSql: string, v: unknown) {
    this.where.push(`${ident(col)} ${opSql} ?`);
    this.params.push(toDbValue(col, v));
    return this;
  }
  eq(c: string, v: unknown) { return v === null ? this.is(c, null) : this.cond(c, '=', v); }
  neq(c: string, v: unknown) { return this.cond(c, '<>', v); }
  gt(c: string, v: unknown) { return this.cond(c, '>', v); }
  gte(c: string, v: unknown) { return this.cond(c, '>=', v); }
  lt(c: string, v: unknown) { return this.cond(c, '<', v); }
  lte(c: string, v: unknown) { return this.cond(c, '<=', v); }
  like(c: string, v: string) { return this.cond(c, 'LIKE', v); }
  // কলেশন utf8mb4_unicode_ci — LIKE এমনিতেই বড়-ছোট হাতের অক্ষর মানে না
  ilike(c: string, v: string) { return this.cond(c, 'LIKE', v); }
  is(c: string, v: null | boolean) {
    if (v === null) this.where.push(`${ident(c)} IS NULL`);
    else { this.where.push(`${ident(c)} = ?`); this.params.push(v ? 1 : 0); }
    return this;
  }
  in(c: string, arr: unknown[]) {
    if (!arr.length) { this.where.push('0 = 1'); return this; }
    this.where.push(`${ident(c)} IN (${arr.map(() => '?').join(', ')})`);
    this.params.push(...arr.map((v) => toDbValue(c, v)));
    return this;
  }
  not(c: string, op: string, v: unknown) {
    if (op === 'is' && v === null) { this.where.push(`${ident(c)} IS NOT NULL`); return this; }
    if (op === 'eq') return this.cond(c, '<>', v);
    if (op === 'in') {
      const arr = Array.isArray(v) ? v : String(v).replace(/^\(|\)$/g, '').split(',').map((x) => x.trim());
      this.where.push(`${ident(c)} NOT IN (${arr.map(() => '?').join(', ')})`);
      this.params.push(...arr);
      return this;
    }
    throw new Error(`not(${op}) সাপোর্ট নেই`);
  }
  match(obj: Record<string, unknown>) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }
  /** PostgREST-এর or('name.ilike.%x%,phone.ilike.%x%') — যতটুকু লাগে */
  or(expr: string) {
    const parts: string[] = [];
    for (const piece of splitTop(expr)) {
      const m = piece.match(/^([a-z_][a-z0-9_]*)\.(eq|neq|ilike|like|gt|gte|lt|lte)\.(.*)$/is);
      if (!m) throw new Error(`or() বুঝতে পারিনি: ${piece}`);
      const map: Record<string, string> = { eq: '=', neq: '<>', ilike: 'LIKE', like: 'LIKE', gt: '>', gte: '>=', lt: '<', lte: '<=' };
      parts.push(`${ident(m[1])} ${map[m[2].toLowerCase()]} ?`);
      this.params.push(m[3].replace(/\*/g, '%'));
    }
    if (parts.length) this.where.push(`(${parts.join(' OR ')})`);
    return this;
  }
  /** Supabase-এর filter(col, op, value) */
  filter(c: string, op: string, v: unknown) {
    const map: Record<string, keyof Query> = { eq: 'eq', neq: 'neq', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte', like: 'like', ilike: 'ilike' };
    const fn = map[op];
    if (!fn) throw new Error(`filter(${op}) সাপোর্ট নেই`);
    return (this as any)[fn](c, v);
  }

  /* ---------- সাজানো ও সীমা ---------- */
  order(c: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const asc = opts?.ascending !== false;
    // MySQL-এ NULL ছোট ধরা হয়: ASC-তে আগে, DESC-তে পরে। দরকার হলে উল্টে দিই।
    if (opts?.nullsFirst !== undefined) {
      const wantFirst = opts.nullsFirst;
      if (asc !== wantFirst) this.orders.push(`(${ident(c)} IS NULL) ${wantFirst ? 'DESC' : 'ASC'}`);
    }
    this.orders.push(`${ident(c)} ${asc ? 'ASC' : 'DESC'}`);
    return this;
  }
  limit(n: number) { this.lim = Math.max(0, Math.floor(n)); return this; }
  range(from: number, to: number) { this.off = from; this.lim = to - from + 1; return this; }
  single() { this.one = 'single'; return this as unknown as Query<any>; }
  maybeSingle() { this.one = 'maybe'; return this as unknown as Query<any>; }

  /* ---------- চালানো ---------- */
  then<A = Result<T>, B = never>(ok?: ((v: Result<T>) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, bad);
  }

  private whereSql() { return this.where.length ? ` WHERE ${this.where.join(' AND ')}` : ''; }

  private async run(): Promise<Result<any>> {
    try {
      switch (this.op) {
        case 'select': return await this.runSelect();
        case 'insert':
        case 'upsert': return await this.runInsert();
        case 'update': return await this.runUpdate();
        case 'delete': return await this.runDelete();
      }
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') console.error('[db]', this.table, e?.message);
      return { data: null, error: { message: e?.message || String(e), code: e?.code }, count: null };
    }
  }

  private shape(rows: any[]): Result<any> {
    if (this.one) {
      if (rows.length === 1) return { data: rows[0], error: null };
      if (rows.length === 0 && this.one === 'maybe') return { data: null, error: null };
      return { data: null, error: { message: rows.length ? 'একাধিক সারি পাওয়া গেছে' : 'কোনো সারি পাওয়া যায়নি', code: 'PGRST116' } };
    }
    return { data: rows, error: null };
  }

  private async runSelect(): Promise<Result<any>> {
    const p = parseCols(this.cols);
    const t = ident(this.table);
    let count: number | null = null;

    if (this.countMode) {
      const r = await sql<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}${this.whereSql()}`, this.params);
      count = Number(r[0]?.n || 0);
      if (this.head) return { data: null, error: null, count };
    }

    let q = `SELECT ${colList(p, localKeys(this.table, p))} FROM ${t}${this.whereSql()}`;
    if (this.orders.length) q += ` ORDER BY ${this.orders.join(', ')}`;
    if (this.lim !== null) q += ` LIMIT ${this.lim}`;
    if (this.off) q += ` OFFSET ${Math.floor(this.off)}`;
    const rows = (await sql(q, this.params)).map(fromDbRow);
    await attach(this.table, rows, p.nested);

    const res = this.shape(rows);
    return { ...res, count };
  }

  private async runInsert(): Promise<Result<any>> {
    if (!this.payload.length) return { data: [], error: null };
    const t = ident(this.table);
    const rows = this.payload.map((r) => {
      const row = { ...r };
      if (UUID_TABLES.has(this.table) && !row.id) row.id = randomUUID();
      return row;
    });
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const values = rows.map((r) => cols.map((c) => toDbValue(c, r[c])));
    const ph = `(${cols.map(() => '?').join(', ')})`;

    let q = `INSERT ${this.op === 'upsert' && this.ignoreDup ? 'IGNORE ' : ''}INTO ${t} (${cols.map(ident).join(', ')}) VALUES ${rows.map(() => ph).join(', ')}`;
    if (this.op === 'upsert' && !this.ignoreDup) {
      // শুধু যে কলামগুলো পাঠানো হয়েছে সেগুলোই বদলায় — বাকিগুলো যেমন ছিল
      q += ` ON DUPLICATE KEY UPDATE ${cols.filter((c) => c !== 'id').map((c) => `${ident(c)} = VALUES(${ident(c)})`).join(', ')}`;
    }
    await sql(q, values.flat());

    if (this.returning === null) return { data: null, error: null };

    // লেখা সারিগুলো ফেরত — MariaDB-র RETURNING upsert-এ চলে না, তাই আবার পড়ি
    const p = parseCols(this.returning);
    const key = UUID_TABLES.has(this.table) ? 'id' : primaryKey(this.table);
    const ids = rows.map((r) => r[key]);
    const back = (await sql(
      `SELECT ${colList(p, [key])} FROM ${t} WHERE ${ident(key)} IN (${ids.map(() => '?').join(', ')})`,
      ids,
    )).map(fromDbRow);
    back.sort((a, b) => ids.indexOf(a[key]) - ids.indexOf(b[key]));
    return this.shape(back);
  }

  private async runUpdate(): Promise<Result<any>> {
    const cols = Object.keys(this.patch).filter((c) => this.patch[c] !== undefined);
    if (!cols.length) return { data: null, error: null };
    if (!this.where.length) throw new Error('শর্ত ছাড়া update বন্ধ — পুরো টেবিল বদলে যেত');
    const t = ident(this.table);
    const set = cols.map((c) => `${ident(c)} = ?`).join(', ');
    await sql(`UPDATE ${t} SET ${set}${this.whereSql()}`, [...cols.map((c) => toDbValue(c, this.patch[c])), ...this.params]);
    if (this.returning === null) return { data: null, error: null };
    const p = parseCols(this.returning);
    const rows = (await sql(`SELECT ${colList(p)} FROM ${t}${this.whereSql()}`, this.params)).map(fromDbRow);
    return this.shape(rows);
  }

  private async runDelete(): Promise<Result<any>> {
    if (!this.where.length) throw new Error('শর্ত ছাড়া delete বন্ধ — পুরো টেবিল মুছে যেত');
    await sql(`DELETE FROM ${ident(this.table)}${this.whereSql()}`, this.params);
    return { data: null, error: null };
  }
}

/** নেস্টেড টেবিল জোড়ার জন্য মূল টেবিল থেকে যে কলাম লাগবে */
function localKeys(table: string, p: ParsedCols): string[] {
  const rel = RELATIONS[table] || {};
  return p.nested.map((n) => {
    const r = rel[n.name];
    if (!r) throw new Error(`${table} → ${n.name} সম্পর্ক জানা নেই`);
    return r.local;
  });
}

/** নেস্টেড টেবিলগুলো এনে প্রতিটা সারির নিচে বসানো — দরকারে আরও এক ধাপ ভেতরে */
async function attach(table: string, rows: any[], nested: Nested[]): Promise<void> {
  for (const n of nested) {
    const r = RELATIONS[table][n.name];
    const keys = [...new Set(rows.map((x) => x[r.local]).filter((v) => v !== null && v !== undefined))];
    const child = keys.length
      ? (await sql(
          `SELECT ${colList(n.cols, [r.foreign, ...localKeys(n.name, n.cols)])} FROM ${ident(n.name)} WHERE ${ident(r.foreign)} IN (${keys.map(() => '?').join(', ')})`,
          keys,
        )).map(fromDbRow)
      : [];
    if (n.cols.nested.length) await attach(n.name, child, n.cols.nested);
    // স্থির ক্রম — ভ্যারিয়েন্টে sort কলাম থাকলে সেটা ধরে
    if (child.length && 'sort' in child[0]) child.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    for (const row of rows) {
      const hits = child.filter((c) => c[r.foreign] === row[r.local]);
      row[n.as] = r.kind === 'many' ? hits : hits[0] ?? null;
    }
  }
}

function primaryKey(table: string): string {
  if (table === 'settings') return 'key';
  if (table === 'customer_courier_stats') return 'phone';
  return 'id';
}

/* ---------------------------------------------------------------------
 *  স্টক — আগে Postgres ফাংশন ছিল (reserve_stock …)। এখানে একই কাজ:
 *  পড়া আর লেখা একই UPDATE-এ, তাই দুজন একসাথে কিনলেও স্টক ঠিক থাকে।
 * ------------------------------------------------------------------- */
async function stockUpdate(setSql: string, whereExtra: string, id: string, n: number): Promise<number | null> {
  const [res] = await getPool().query(
    `UPDATE product_variants SET stock = ${setSql} WHERE id = ?${whereExtra}`,
    whereExtra ? [n, id, n] : [n, id],
  );
  if (!(res as any).affectedRows) return null;
  const r = await sql<{ stock: number }>('SELECT stock FROM product_variants WHERE id = ?', [id]);
  return r[0]?.stock ?? null;
}

const RPC: Record<string, (a: any) => Promise<unknown>> = {
  // স্টক কম পড়লে null — অর্ডার নেওয়া হবে না
  reserve_stock: ({ p_variant_id, p_qty }) =>
    !(p_qty > 0) ? Promise.resolve(null) : stockUpdate('stock - ?', ' AND stock >= ?', p_variant_id, p_qty),
  release_stock: ({ p_variant_id, p_qty }) =>
    !(p_qty > 0) ? Promise.resolve(null) : stockUpdate('stock + ?', '', p_variant_id, p_qty),
  adjust_stock: ({ p_variant_id, p_delta }) =>
    stockUpdate('GREATEST(0, stock + ?)', '', p_variant_id, Number(p_delta) || 0),
};

export interface Db {
  from<T = any[]>(table: string): Query<T>;
  rpc(name: string, args: Record<string, unknown>): Promise<Result<any>>;
}

const instance: Db = {
  from<T = any[]>(table: string) { return new Query<T>(table); },
  async rpc(name, args) {
    const fn = RPC[name];
    if (!fn) return { data: null, error: { message: `rpc ${name} নেই` } };
    try { return { data: await fn(args), error: null }; }
    catch (e: any) { return { data: null, error: { message: e?.message || String(e) } }; }
  },
};

/** কোডের সব জায়গায় এটাই — getDb().from('orders')… */
export const getDb = (): Db => instance;

/**
 * টেবিলগুলো না থাকলে বানানো — প্রথম অ্যাডমিন সেটআপের সময় চলে।
 * schema.sql-এর সব কমান্ড "না থাকলে বানাও" ধরনের, তাই বারবার চালালেও ক্ষতি নেই।
 */
export async function ensureSchema(): Promise<number> {
  const { SCHEMA_SQL } = await import('./schema.generated');
  const statements = SCHEMA_SQL
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  for (const s of statements) await getPool().query(s);
  return statements.length;
}
