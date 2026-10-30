import Pixel from '@/components/Pixel';
import { CartProvider } from '@/components/CartContext';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { getSettings } from '@/lib/catalog';

/** দোকানের অংশ — হেডার, ফুটার, কার্ট ও পিক্সেল শুধু এখানেই */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { contact } = await getSettings();
  return (
    <CartProvider>
      <SiteHeader contact={contact} />
      <main>{children}</main>
      <SiteFooter contact={contact} />
      <Pixel />
    </CartProvider>
  );
}
