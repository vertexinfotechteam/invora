import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getOptionalAppUser, getOptionalBusiness, getOptionalUser } from '@/lib/guards/auth';
import { getUsageSnapshot } from '@/lib/guards/quota';
import { MobileNav, Sidebar } from '@/components/app/sidebar';
import { Topbar } from '@/components/app/topbar';

export const dynamic = 'force-dynamic';
// Every page under here is a signed-in tenant's private data — search
// engines have nothing to index and shouldn't be told otherwise just because
// they inherit the root layout's index:true by default.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();
  if (!user) redirect('/login');

  // These share their underlying queries (via React `cache()`) with whatever
  // the page itself calls further down the tree — requireBusiness/requireAdmin
  // resolve to the same in-flight lookups instead of re-querying Supabase.
  const [business, profile] = await Promise.all([
    getOptionalBusiness(user.id),
    getOptionalAppUser(user.id),
  ]);

  // The bootstrap trigger creates this row with the auth user. If it is
  // missing, something went wrong at signup — send them somewhere they can act.
  if (!business) redirect('/onboarding');

  const usage = await getUsageSnapshot(business.id);

  return (
    <div className="flex min-h-dvh">
      <Sidebar usage={usage} businessName={business.name || 'Your business'} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userEmail={user.email}
          userName={profile?.full_name ?? ''}
          isAdmin={profile?.role === 'admin'}
        />
        <main className="flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-10">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
