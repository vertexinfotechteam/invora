import type { Metadata } from 'next';

// Covers /admin/login and every page under /admin/(protected) — none of it
// is content a search engine should surface, and there's no upside to a
// staff sign-in page being discoverable via search either.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
