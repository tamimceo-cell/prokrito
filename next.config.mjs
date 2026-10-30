import { legacyRedirects } from './src/config/redirects.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // শেষের স্ল্যাশ মিডলওয়্যার সামলায় (src/middleware.ts) — রিডাইরেক্ট না করে
  // একই পাতা দেখায়, যাতে পুরনো সাইটের /product/front-button/ লিংকে এডের
  // ভিজিটরকে একটা বাড়তি আসা-যাওয়া করতে না হয়।
  skipTrailingSlashRedirect: true,

  // পুরনো সাইটের যে লিংকগুলোর আর কোনো পাতা নেই — গুগল বা পুরনো
  // শেয়ার থেকে কেউ এলে খালি পাতা না দেখে কাছের পাতায় যায়।
  // স্ল্যাশসহ ও ছাড়া — দুটোই, কারণ স্ল্যাশের রিডাইরেক্ট বন্ধ।
  async redirects() {
    return legacyRedirects.flatMap(([from, to]) => {
      const bare = from.replace(/\/+$/, '');
      return [bare, bare + '/'].map((source) => ({ source, destination: to, permanent: true }));
    });
  },

  // CDN কত পুরনো কপি পর্যন্ত দেখাতে পারে।
  //
  // Next-এর ডিফল্ট এক বছর — অর্থাৎ নতুন কোড ডিপ্লয় করার পরেও Hostinger-এর
  // CDN এক বছরের পুরনো HTML কাউকে দিয়ে দিতে পারত। সেই HTML এমন জাভাস্ক্রিপ্ট
  // ফাইল খোঁজে যেগুলো নতুন বিল্ডে আর নেই, আর কাস্টমারের পর্দায় "Application
  // error" ভেসে ওঠে। এক ঘণ্টা করলে সমস্যাটা নিজে থেকেই মিলিয়ে যায়।
  expireTime: 3600,

  images: {
    formats: ['image/avif', 'image/webp'],
    // অ্যাডমিন থেকে আপলোড করা ছবি একই সাইটের /media/ থেকে আসে —
    // আলাদা হোস্টের অনুমতি লাগে না
    remotePatterns: [
      // প্রোডাক্ট ভিডিওর থাম্বনেইল
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' },
    ],
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};
export default nextConfig;
