import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

import { getOptionalAppUser, getOptionalUser } from '@/lib/guards/auth';
import { AdminLoginForm } from './login-form';

export const metadata: Metadata = { title: 'Operations sign-in' };
export const dynamic = 'force-dynamic';

/**
 * The admin portal's own front door — deliberately not the customer /login.
 *
 * A customer session sitting in the browser is irrelevant here: this page
 * only cares whether the credentials submitted below belong to an
 * `app_users.role = 'admin'` account, checked fresh in adminSignInAction.
 */
export default async function AdminLoginPage() {
  const user = await getOptionalUser();
  if (user) {
    const appUser = await getOptionalAppUser(user.id);
    if (appUser && appUser.role === 'admin' && !appUser.suspended_at) redirect('/admin');
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy-900 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold tracking-tight text-white">Invora operations</span>
          </div>
          <p className="mt-4 text-sm text-navy-300">
            Staff sign-in. If you&rsquo;re a customer looking for your account, use the{' '}
            <a href="/login" className="text-white underline-offset-4 hover:underline">
              regular sign-in
            </a>{' '}
            instead.
          </p>
        </div>

        <div className="card-surface bg-background p-6">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
