import { site } from '@/config/site';

export const metadata = { title: 'আমাদের সম্পর্কে' };

export default function About() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-11">
      <h1 className="sec-title">আমাদের সম্পর্কে</h1><div className="rule" />
      <div className="mt-6 space-y-4 text-ink-2">
        {site.about.map((para, i) => <p key={i}>{para}</p>)}
      </div>
    </section>
  );
}
