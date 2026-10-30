import type { Config } from 'tailwindcss';
import { site } from './src/config/site';

/**
 * রং আসে src/config/site.ts থেকে — এই ফাইলে হাত দেওয়ার দরকার নেই।
 * নতুন ক্লায়েন্টে শুধু ওই কনফিগের colors বদলালেই পুরো সাইটের চেহারা বদলায়।
 */
const c = site.colors;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    { DEFAULT: c.ink, 2: c.ink2, 3: c.ink3 },
        cream:  c.cream,
        sunk:   c.sunk,
        line:   c.line,
        brand:  { DEFAULT: c.brand, soft: c.brandSoft, deep: c.brandDeep },
        gold:   { DEFAULT: c.gold, bright: c.goldBright },
        pinkc:  { DEFAULT: c.accent, soft: c.accentSoft },
        ok:     c.ok,
        warn:   c.warn,
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '24px' },
    },
  },
  plugins: [],
} satisfies Config;
