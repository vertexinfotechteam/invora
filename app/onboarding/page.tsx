import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

import { getOptionalUser } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Finish setting up' };
export const dynamic = 'force-dynamic';

/**
 * The recovery path when a business row is missing.
 *
 * The signup trigger creates it in the same transaction as the auth user, so
 * landing here means something genuinely went wrong. Rather than a confusing
 * redirect loop, say so and give the person a way out.
 */
export default async function OnboardingPage() {
  const user = await getOptionalUser();
  if (!user) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (business) redirect('/dashboard');

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-6">
      <div className="card-surface max-w-md p-8 text-center">
        <div className="mx-auto w-fit rounded-full bg-warning/15 p-3">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>

        <h1 className="mt-4 text-lg font-semibold">We could not find your business profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account exists, but the business record that should have been created alongside it is
          missing. This is on us, not you — support can restore it in a couple of minutes.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href={`mailto:support@invora.app?subject=Missing%20business%20profile&body=Account:%20${encodeURIComponent(user.email)}`}>
              Email support
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Try again</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">Reference: {user.id.slice(0, 8)}</p>
      </div>
    </main>
  );
}
