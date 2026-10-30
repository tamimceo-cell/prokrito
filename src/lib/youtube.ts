/**
 * ইউটিউব লিংক → ভিডিও আইডি।
 *
 * ক্লায়েন্ট অ্যাডমিন প্যানেলে যেভাবে খুশি লিংক পেস্ট করতে পারে —
 * ব্রাউজারের অ্যাড্রেস বার থেকে, "Share" বোতাম থেকে, বা শর্টস থেকে।
 * সবগুলো চেহারাই এখানে ধরা হয়:
 *
 *   youtube.com/watch?v=ID
 *   youtu.be/ID
 *   youtube.com/shorts/ID
 *   youtube.com/embed/ID
 *   youtube.com/live/ID
 *   শুধু ID (১১ অক্ষর)
 *
 * চেনা না গেলে null — তখন প্রোডাক্ট পেইজে ভিডিওর ঘরটাই দেখায় না,
 * ভাঙা প্লেয়ার বসে থাকে না।
 */

const ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeId(input?: string | null): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;

  // কেউ শুধু আইডিটাই বসিয়ে দিলে
  if (ID.test(raw)) return raw;

  let u: URL;
  try {
    u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;

  // youtu.be/ID
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return ID.test(id) ? id : null;
  }

  // youtube.com/watch?v=ID
  const v = u.searchParams.get('v');
  if (v && ID.test(v)) return v;

  // /shorts/ID, /embed/ID, /live/ID, /v/ID
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
    return ID.test(parts[1]) ? parts[1] : null;
  }

  return null;
}

/** ছবিটা ইউটিউবের সার্ভার থেকে — maxres না থাকলে ব্রাউজার hq-তে নেমে যায় */
export const youtubeThumb = (id: string) =>
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** nocookie ডোমেইন — ভিডিও না চালালে ইউটিউব কুকি বসাতে পারে না */
export const youtubeEmbed = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
