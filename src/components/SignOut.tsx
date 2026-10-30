'use client';
import { useRouter } from 'next/navigation';

export default function SignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
        router.replace('/admin/login'); router.refresh();
      }}
      className="rounded-full border-2 border-line px-4 py-1.5 font-semibold hover:border-brand hover:text-brand">
      লগআউট
    </button>
  );
}
