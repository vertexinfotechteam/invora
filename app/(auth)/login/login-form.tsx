'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { signInAction, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { OAuthButtons } from '@/app/(auth)/oauth-buttons';

const initialState: FormState = { ok: false };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <div className="space-y-5">
      <OAuthButtons next={next} />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or sign in with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? '/dashboard'} />

      {state.message && !state.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </div>
      ) : null}

      <Field label="Email" htmlFor="email" error={state.errors?.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={state.errors?.password} required>
        <PasswordInput
          name="password"
          autoComplete="current-password"
          placeholder="••••••••••"
          required
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot your password?
        </Link>
      </div>

      <Button type="submit" className="w-full" loading={pending}>
        Sign in
      </Button>
      </form>
    </div>
  );
}
