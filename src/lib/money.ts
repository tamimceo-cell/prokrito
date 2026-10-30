const BN = '০১২৩৪৫৬৭৮৯';

/** ইংরেজি সংখ্যা → বাংলা */
export const bn = (v: string | number) =>
  String(v).replace(/\d/g, (d) => BN[+d]);

/** বাংলা সংখ্যা → ইংরেজি */
export const en = (v: string) =>
  String(v).replace(/[০-৯]/g, (c) => String(BN.indexOf(c)));

/** ৳১,৯৫০ */
export const tk = (n: number) => '৳' + bn(n.toLocaleString('en-US'));

export const STATUS_LABEL: Record<string, string> = {
  new: 'নতুন', confirmed: 'কনফার্মড', courier: 'কুরিয়ারে',
  delivered: 'ডেলিভার্ড', returned: 'রিটার্নড', cancelled: 'বাতিল',
};

/* সাইজ ও ক্যাটাগরি আর এখানে নেই — সেগুলো ক্লায়েন্ট-ভেদে আলাদা,
   তাই src/config/site.ts-এ। ওখান থেকেই import করুন। */
