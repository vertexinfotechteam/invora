'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { adminSignInAction } from './actions';
import type { FormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useClientValidation } from '@/hooks/use-client-validation';
import { loginSchema } from '@/lib/validation/yup-schemas';

const initialState: FormState = { ok: false };

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminSignInAction, initialState);
  const { errors: clientErrors, validate } = useClientValidation(loginSchema);

  // Success shows via a flash toast on /admin — adminSignInAction redirects
  // on success, unmounting this component before any client state could
  // reflect it.
  React.useEffect(() => {
    if (state === initialState) return;
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!validate(new FormData(event.currentTarget))) event.preventDefault();
      }}
      className="space-y-4"
      noValidate
    >
      {state.message && !state.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </div>
      ) : null}

      <Field label="Admin email" htmlFor="email" error={clientErrors.email ?? state.errors?.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="admin@invora.app"
          required
          invalid={Boolean(clientErrors.email ?? state.errors?.email)}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={clientErrors.password ?? state.errors?.password} required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••"
          required
          invalid={Boolean(clientErrors.password ?? state.errors?.password)}
        />
      </Field>

      <Button type="submit" className="w-full" loading={pending}>
        Sign in to operations
      </Button>
    </form>
  );
}
