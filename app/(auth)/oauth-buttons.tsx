'use client';

import * as React from 'react';
import { Github } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { safeRedirectPath } from '@/lib/validation/common';

type Provider = 'google' | 'github';

/**
 * Redirects to the provider's consent screen, then back to
 * app/auth/callback/route.ts — the same code-exchange route email links
 * already use, since Supabase OAuth goes through the identical PKCE flow.
 * Google and GitHub both hand Supabase an already-verified email address, so
 * there is no separate "verify your email" step for either provider the way
 * there is for a password sign-up.
 */
export function OAuthButtons({ next }: { next?: string }) {
  const [pending, setPending] = React.useState<Provider | null>(null);

  async function signInWith(provider: Provider) {
    setPending(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeRedirectPath(next))}`,
      },
    });

    if (error) {
      setPending(null);
      toast.error(`Could not start sign-in with ${provider === 'google' ? 'Google' : 'GitHub'}.`, {
        description: error.message,
      });
    }
    // On success the browser is already navigating away — nothing left to do.
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => void signInWith('google')}
        loading={pending === 'google'}
        disabled={pending !== null}
      >
        {pending !== 'google' ? <GoogleIcon className="h-4 w-4" /> : null}
        Google
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => void signInWith('github')}
        loading={pending === 'github'}
        disabled={pending !== null}
      >
        {pending !== 'github' ? <Github className="h-4 w-4" /> : null}
        GitHub
      </Button>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.48c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.25 21.3 7.29 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 010-4.54V6.64H1.27a12 12 0 000 10.72l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.29 0 3.25 2.7 1.27 6.64l4 3.09c.95-2.85 3.6-4.98 6.73-4.98z"
      />
    </svg>
  );
}
