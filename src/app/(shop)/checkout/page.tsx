import CheckoutForm from '@/components/CheckoutForm';
import { getSettings } from '@/lib/catalog';

export const metadata = { title: 'চেকআউট', robots: { index: false } };

export default async function Checkout() {
  const { shipping } = await getSettings();
  return (
    <section className="mx-auto max-w-6xl px-4 py-9">
      <CheckoutForm shipping={shipping} />
    </section>
  );
}
