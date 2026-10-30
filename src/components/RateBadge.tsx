import { bn } from '@/lib/money';

export interface CourierStat { total: number; success: number; rating: string | null; error?: string | null }
export interface OwnStat { orders: number; delivered: number; returned: number }

const RATING: Record<string, string> = {
  excellent_customer: 'চমৎকার', good_customer: 'ভালো', moderate_customer: 'মাঝারি',
  risky_customer: 'ঝুঁকিপূর্ণ', new_customer: 'নতুন',
};

/** ৮০%+ সবুজ, ৫০-৮০ হলুদ, তার নিচে লাল — অর্ডার কনফার্মের আগে এক নজরে */
export function rateTone(pct: number) {
  return pct >= 80 ? 'bg-ok/15 text-ok' : pct >= 50 ? 'bg-gold/20 text-[#8a6100]' : 'bg-warn/15 text-warn';
}

/**
 * অর্ডারের পাশে কাস্টমারের ডেলিভারি ইতিহাস।
 * "Pathao ৫৬% (২২১/৩৯৭)" — সব মার্চেন্ট মিলিয়ে; "এখানে ২/৩" — আমাদের দোকানে।
 */
export function RateBadge({ courier, own }: { courier?: CourierStat; own?: OwnStat }) {
  const hasCourier = courier && courier.total > 0;
  const pct = hasCourier ? Math.round((courier!.success / courier!.total) * 100) : null;
  const settled = own ? own.delivered + own.returned : 0;

  return (
    <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold">
      {hasCourier ? (
        <span className={`rounded-full px-2 py-0.5 tabular-nums ${rateTone(pct!)}`}
          title={`Pathao: ${courier!.total}টি পার্সেলের ${courier!.success}টি ডেলিভার্ড`}>
          Pathao {bn(pct!)}% ({bn(courier!.success)}/{bn(courier!.total)})
          {courier!.rating && RATING[courier!.rating] ? ` · ${RATING[courier!.rating]}` : ''}
        </span>
      ) : courier && !courier.error ? (
        <span className="rounded-full bg-sunk px-2 py-0.5 text-ink-3">Pathao-তে নতুন</span>
      ) : null}
      {settled > 0 && (
        <span className={`rounded-full px-2 py-0.5 tabular-nums ${rateTone((own!.delivered / settled) * 100)}`}
          title="আমাদের দোকানে এই নম্বরের আগের অর্ডার">
          এখানে {bn(own!.delivered)}/{bn(settled)}
        </span>
      )}
    </div>
  );
}
