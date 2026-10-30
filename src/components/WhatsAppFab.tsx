'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * ভাসমান হোয়াটসঅ্যাপ বাটন।
 *
 * চেকআউট পেইজে দেখানো হয় না — ওখানে "অর্ডার কনফার্ম করুন" বাটনটা
 * পাতার সবার নিচে, আর কাস্টমার স্ক্রল করে ঠিক সেখানেই পৌঁছায়, যেখানে
 * এই ভাসমান বাটনটা বসে থাকে। মোবাইলে মেপে দেখা গেছে দুটো সত্যিই
 * একটার উপর আরেকটা পড়ে — CTA-র ডান পাশে আঙুল পড়লে অর্ডার না হয়ে
 * হোয়াটসঅ্যাপ খুলে যেত।
 *
 * বাকি সব পেইজে থাকে — প্রশ্ন করার জন্য ওটা কাজের।
 */
export default function WhatsAppFab({ phone, hideNear }: { phone: string; hideNear?: string }) {
  const path = usePathname();
  const [hidden, setHidden] = useState(false);

  /*
   * ল্যান্ডিং পেইজে অর্ডার ফর্ম পাতার মাঝেই — ফর্মটা পর্দায় এলে বোতামটা
   * সরে যায়, একই কারণে যে কারণে চেকআউটে দেখানো হয় না: "অর্ডার কনফার্ম"
   * চাপতে গিয়ে আঙুল যেন হোয়াটসঅ্যাপে না পড়ে।
   */
  useEffect(() => {
    if (!hideNear) return;
    const el = document.querySelector(hideNear);
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [hideNear, path]);

  if (path?.startsWith('/checkout') || path?.startsWith('/admin') || hidden) return null;

  return (
    <a
      href={`https://wa.me/${phone}`}
      target="_blank"
      rel="noopener"
      aria-label="হোয়াটসঅ্যাপে মেসেজ দিন"
      className="fixed bottom-4 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-2xl text-white shadow-lg sm:flex sm:h-auto sm:w-auto sm:items-center sm:gap-2 sm:px-5 sm:py-3 sm:font-display sm:text-base sm:font-bold"
    >
      <span aria-hidden="true">💬</span>
      <span className="hidden sm:inline">হোয়াটসঅ্যাপ</span>
    </a>
  );
}
