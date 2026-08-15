import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Reasons /auth/callback can bounce someone back here. Without this the page
 * rendered as if nothing had happened, so a expired verification link and a
 * cancelled Google consent screen both looked like "the site just logged me
 * out for no reason".
 */
const CALLBACK_ERRORS: Record<string, string> = {
  expired_link: 'That link has expired or was already used. Sign in below, or request a new one.',
  missing_code: 'That sign-in link was incomplete. Please try again.',
  access_denied: 'You cancelled the sign-in before it finished. Try again when you are ready.',
  server_error: 'The sign-in provider had a problem. Please try again in a moment.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; error_description?: string }>;
}) {
  const { next, error, error_description: errorDescription } = await searchParams;

  const errorMessage = error
    ? (CALLBACK_ERRORS[error] ?? errorDescription ?? 'We could not complete that sign-in. Please try again.')
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your Invora account.</p>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      ) : null}

      <LoginForm next={next} />

      <p className="text-center text-sm text-muted-foreground">
        New to Invora?{' '}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
  );
}
