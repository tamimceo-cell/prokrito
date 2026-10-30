'use client';

import ErrorScreen from '@/components/ErrorScreen';

/**
 * দোকানের কোনো পাতা রেন্ডার করতে গিয়ে ভুল হলে এটা বসে।
 * হেডার-ফুটার টিকে থাকে, তাই কাস্টমার চাইলে মেনু থেকে অন্য পাতায় যেতে পারে।
 */
export default function ShopError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen {...props} />;
}
