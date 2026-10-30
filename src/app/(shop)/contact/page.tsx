import { getSettings } from '@/lib/catalog';
import { bn, tk } from '@/lib/money';
import { site } from '@/config/site';

export const metadata = { title: 'যোগাযোগ' };

export default async function Contact() {
  const { contact, shipping } = await getSettings();
  const rows: [string, string][] = [
    ['ফোন / হোয়াটসঅ্যাপ', bn(contact.phone || site.contact.phone)],
    ['ইমেইল', contact.email || site.contact.email],
    ['ঠিকানা', contact.address || site.contact.address],
    ['সময়', site.contact.hours],
    ['ডেলিভারি', `ঢাকায় ${tk(shipping.inside)} · বাইরে ${tk(shipping.outside)}`],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <section className="mx-auto max-w-lg px-4 py-11">
      <h1 className="sec-title">যোগাযোগ</h1><div className="rule" />
      <p className="mb-6 text-center text-sm text-ink-3">যেকোনো প্রশ্নে সরাসরি কল বা মেসেজ করুন</p>
      <dl className="rounded-3xl border border-line bg-white p-6">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-dashed border-line py-2.5 last:border-0">
            <dt className="text-sm text-ink-2">{k}</dt>
            <dd className="text-right text-sm font-semibold">{v}</dd>
          </div>
        ))}
        <p className="mt-4 flex gap-2.5 rounded-lg bg-brand-soft p-3.5 text-xs text-ink-2">
          <span>↩️</span>
          <span><b className="text-brand">রিটার্ন ও এক্সচেঞ্জ</b> — {site.returnPolicy}</span>
        </p>
      </dl>
    </section>
  );
}
