'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CartLine } from '@/lib/types';

interface Ctx {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (l: CartLine) => void;
  remove: (i: number) => void;
  setCombo: (lines: CartLine[]) => void;
  clear: () => void;
}
const CartCtx = createContext<Ctx | null>(null);
export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
};

const KEY = 'mf-cart';

/** একটা সারি সত্যিই কার্টের সারি কিনা — দাম বা সংখ্যা নষ্ট থাকলে বাদ */
function isLine(x: unknown): x is CartLine {
  const l = x as CartLine | null;
  return !!l && typeof l === 'object'
    && typeof l.code === 'string'
    && Number.isFinite(l.price) && Number.isFinite(l.qty) && l.qty > 0;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  // কার্ট শুধু এই ব্রাউজারে থাকে — অর্ডার বসার আগ পর্যন্ত সার্ভারে কিছু যায় না
  //
  // জমানো জিনিসটা যাচাই করে নেওয়া হয়: JSON.parse ভাঙা লেখায় থামে ঠিকই,
  // কিন্তু "null" বা "5" লিখে রাখা থাকলে সে চুপচাপ null বা 5 ফেরত দেয় —
  // আর তখন নিচের lines.reduce গিয়ে পুরো সাইট ভেঙে পড়ে। ব্রাউজার এক্সটেনশন,
  // পুরনো ভার্সন বা আধখানা লেখা হওয়া তথ্য থেকে এমনটা হতেই পারে, তাই
  // অ্যারে না হলে ধরেই নিই কার্ট খালি।
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) setLines(saved.filter(isLine));
      else localStorage.removeItem(KEY);
    } catch {
      try { localStorage.removeItem(KEY); } catch {}
    }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {}
  }, [lines]);

  const value = useMemo<Ctx>(() => ({
    lines,
    count: lines.reduce((a, l) => a + l.qty, 0),
    subtotal: lines.reduce((a, l) => a + l.qty * l.price, 0),
    add: (l) => setLines((cur) => {
      // রঙটাও মেলাতে হবে — নইলে "লাল ৩৬" আর "কালো ৩৬" এক সারিতে জুড়ে যেত
      const i = cur.findIndex((x) => x.code === l.code && x.optKey === l.optKey
        && (x.colorKey || '') === (l.colorKey || '') && x.comboQty === l.comboQty);
      if (i >= 0) { const n = [...cur]; n[i] = { ...n[i], qty: n[i].qty + l.qty }; return n; }
      return [...cur, l];
    }),
    remove: (i) => setLines((cur) => cur.filter((_, x) => x !== i)),
    setCombo: (l) => setLines(l),
    clear: () => setLines([]),
  }), [lines]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
