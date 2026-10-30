import { notFound, permanentRedirect } from 'next/navigation';
import { legacyProductSlugs } from '@/config/redirects.mjs';
import { defaultTier, splitAtOrder, cleanExtraFields, type Block } from '@/lib/landing';
import { getLanding, getLandingByThankyou, getLandings } from '@/lib/landing-data';
import { getSettings } from '@/lib/catalog';
import { siteUrl } from '@/config/site';
import LandingBlocks from '@/components/LandingBlocks';
import LandingOrder from '@/components/LandingOrder';
import ThankYou from '@/components/ThankYou';

export const revalidate = 300;

export async function generateStaticParams() {
  const all = await getLandings();
  return all.flatMap((l) => [{ slug: l.slug }, ...(l.thankyou_slug ? [{ slug: l.thankyou_slug }] : [])]);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = await getLanding(slug);
  if (l) {
    const img = l.product?.images?.[0];
    return {
      title: l.title,
      description: `${l.product?.name || l.title} — ক্যাশ অন ডেলিভারি।`,
      // পুরনো সাইটের ঠিকানাটাই আসল — স্ল্যাশসহ
      alternates: { canonical: `${siteUrl}/product/${l.slug}/` },
      openGraph: img ? { images: [img.startsWith('http') ? img : `${siteUrl}${img}`] } : undefined,
    };
  }
  if (await getLandingByThankyou(slug)) return { title: 'ধন্যবাদ', robots: { index: false } };
  return {};
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [l, settings] = await Promise.all([getLanding(slug), getSettings()]);

  if (!l) {
    const owner = await getLandingByThankyou(slug);
    if (owner) return <ThankYou />;
    // পুরনো WooCommerce প্রোডাক্ট লিংক (বাংলা স্লাগ)
    const to = (legacyProductSlugs as Record<string, string>)[safeDecode(slug)];
    if (to) permanentRedirect(to);
    notFound();
  }
  if (!l.product || !l.tiers.length) notFound();

  const [before, after] = splitAtOrder(l.blocks);
  const order = (
    <div className="mx-auto max-w-3xl px-4">
      <LandingOrder
        slug={l.slug}
        product={{
          code: l.product.code,
          contentId: l.product.content_id || l.product.code,
          name: l.product.name,
          price: l.product.price,
          image: l.product.images?.[0] || '',
          optKey: l.product.product_variants?.[0]?.opt_key || 'one',
        }}
        tiers={l.tiers}
        initialQty={defaultTier(l.tiers).qty}
        shipping={settings.shipping}
        formTitle={l.form_title}
        noteLabel={l.note_label}
        noteRequired={l.note_required}
        extraFields={cleanExtraFields(l.extra_fields)}
        thankyou={l.thankyou_slug}
      />
    </div>
  );

  return (
    <div className="pb-6 pt-5">
      <Blocks blocks={before} />
      {order}
      {after.length > 0 && <div className="mt-8"><Blocks blocks={after} /></div>}
    </div>
  );
}

/**
 * সাধারণ ব্লক মাঝারি চওড়া কলামে; পুরনো পেইজের HTML পুরো চওড়ায় —
 * ওদের নিজের CSS-এই মাপ ঠিক করা, বাইরে থেকে চাপলে নকশা ভেঙে যেত।
 */
function Blocks({ blocks }: { blocks: Block[] }) {
  const groups: Block[][] = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    const isHtml = b.t === 'html';
    if (last && (last[0].t === 'html') === isHtml) last.push(b);
    else groups.push([b]);
  }
  return (
    <div className="space-y-5">
      {groups.map((g, i) =>
        g[0].t === 'html'
          ? <LandingBlocks key={i} blocks={g} />
          : <div key={i} className="mx-auto max-w-3xl px-4"><LandingBlocks blocks={g} /></div>,
      )}
    </div>
  );
}

function safeDecode(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}
