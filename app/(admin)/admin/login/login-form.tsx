'use client';

import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { adminSignInAction } from './actions';
import type { FormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

const initialState: FormState = { ok: false };

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminSignInAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message && !state.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </div>
      ) : null}

      <Field label="Admin email" htmlFor="email" error={state.errors?.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="admin@invora.app"
          required
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={state.errors?.password} required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••"
          required
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <Button type="submit" className="w-full" loading={pending}>
        Sign in to operations
      </Button>
    </form>
  );
}
