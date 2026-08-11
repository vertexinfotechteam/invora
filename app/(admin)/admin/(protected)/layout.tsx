import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';

import { getOptionalAppUser, getOptionalUser } from '@/lib/guards/auth';

export const dynamic = 'force-dynamic';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/businesses', label: 'Businesses' },
  { href: '/admin/reconcile', label: 'Reconciliation' },
];

/**
 * The admin shell.
 *
 * This is a distinct portal from the customer app: signing into a normal
 * account and browsing here does not work — anyone without a valid session,
 * or with one that isn't flagged `admin` in app_users, is bounced to the
 * dedicated /admin/login page instead of the customer /login. The role check
 * happens here AND in every /api/admin/* handler; middleware alone would be a
 * single point of failure, and a raw fetch bypasses it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();
  if (!user) redirect('/admin/login');

  const appUser = await getOptionalAppUser(user.id);
  if (!appUser || appUser.role !== 'admin' || appUser.suspended_at) redirect('/admin/login');

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="border-b border-border bg-navy-900 text-white">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold tracking-tight">Invora operations</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-navy-300 hover:text-white">
              Back to the app
            </Link>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1.5 text-sm text-navy-300 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="container flex gap-1 pb-2" aria-label="Admin sections">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-md px-3 py-1.5 text-sm text-navy-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="container py-8">{children}</main>
    </div>
  );
}
