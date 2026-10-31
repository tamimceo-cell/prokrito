import { getDb } from '@/lib/db';
import { bn } from '@/lib/money';
import RetryButton from '@/components/RetryButton';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const db = getDb();
  const [{ data: rows }, sent, failed] = await Promise.all([
    db.from('capi_events').select('*').order('created_at', { ascending: false }).limit(60),
    db.from('capi_events').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    db.from('capi_events').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">পিক্সেল ইভেন্ট</h1>
          <p className="text-sm text-ink-3">
            সার্ভার থেকে Meta-তে পাঠানো ইভেন্টের হিসাব — সফল {bn(sent.count ?? 0)}, ব্যর্থ {bn(failed.count ?? 0)}
          </p>
        </div>
        {(failed.count ?? 0) > 0 && <RetryButton />}
      </div>

      <div className="overflow-x-auto rounded-xl2 border border-line bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="p-3">সময়</th><th className="p-3">ইভেন্ট</th>
              <th className="p-3">event_id</th><th className="p-3">অবস্থা</th><th className="p-3">বার্তা</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r: any) => (
              <tr key={r.id} className="border-b border-line/60">
                <td className="p-3 text-xs text-ink-3">
                  {new Date(r.created_at).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Dhaka' })}
                </td>
                <td className="p-3 font-medium">{r.event_name}</td>
                <td className="p-3 font-mono text-[11px] text-ink-3">{String(r.event_id).slice(0, 13)}…</td>
                <td className="p-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    r.status === 'sent' ? 'bg-ok/15 text-ok'
                    : r.status === 'failed' ? 'bg-pinkc-soft text-pinkc' : 'bg-gold/15 text-gold'}`}>
                    {r.status === 'sent' ? 'পৌঁছেছে' : r.status === 'failed' ? 'ব্যর্থ' : 'অপেক্ষায়'}
                  </span>
                </td>
                <td className="max-w-[260px] truncate p-3 text-xs text-ink-3">
                  {r.error || (r.response?.events_received ? `received ${r.response.events_received}` : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows?.length && (
        <p className="rounded-xl2 border border-line bg-white p-10 text-center text-sm text-ink-3">
          এখনো কোনো ইভেন্ট পাঠানো হয়নি।
        </p>
      )}
    </div>
  );
}
