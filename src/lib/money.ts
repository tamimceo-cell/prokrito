const BN = '০১২৩৪৫৬৭৮৯';

/** ইংরেজি সংখ্যা → বাংলা */
export const bn = (v: string | number) =>
  String(v).replace(/\d/g, (d) => BN[+d]);

/** বাংলা সংখ্যা → ইংরেজি */
export const en = (v: string) =>
  String(v).replace(/[০-৯]/g, (c) => String(BN.indexOf(c)));

/** ৳১,৯৫০ */
export const tk = (n: number) => '৳' + bn(n.toLocaleString('en-US'));

/* ---------------------------------------------------------------------
 *  অ্যাডমিন প্যানেল ইংরেজিতে (Tamim-এর অনুরোধ, নভেম্বর ২০২৬) — তাই
 *  সেখানে ইংরেজি সংখ্যা। দোকানের পাতায় আগের মতোই bn()/tk()।
 * ------------------------------------------------------------------- */

/** 1,950 */
export const num = (n: number | string) => Number(n).toLocaleString('en-US');

/** ৳1,950 — টাকার চিহ্ন রাখা, যাতে টাকা বলে চেনা যায় */
export const money = (n: number) => '৳' + Number(n).toLocaleString('en-US');

/** অ্যাডমিনের তারিখ-সময়, ঢাকার সময়ে */
export const adminTime = (d: string | Date) =>
  new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Dhaka' });

/**
 * অর্ডারের অবস্থা। hold — কাস্টমার পরে নিতে বলেছে / ফোন ধরেনি / টাকা
 * জোগাড় করছে: বাতিলও নয়, কুরিয়ারেও পাঠানোর মতো নয়।
 */
export const STATUS_LABEL: Record<string, string> = {
  new: 'New', hold: 'On hold', confirmed: 'Confirmed', courier: 'With courier',
  delivered: 'Delivered', returned: 'Returned', cancelled: 'Cancelled',
};

/* সাইজ ও ক্যাটাগরি আর এখানে নেই — সেগুলো ক্লায়েন্ট-ভেদে আলাদা,
   তাই src/config/site.ts-এ। ওখান থেকেই import করুন। */
