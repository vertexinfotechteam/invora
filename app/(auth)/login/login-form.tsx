'use client';

import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { signInAction, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useClientValidation } from '@/hooks/use-client-validation';
import { loginSchema } from '@/lib/validation/yup-schemas';

const initialState: FormState = { ok: false };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const { errors: clientErrors, validate } = useClientValidation(loginSchema);

  // Success shows via a flash toast on the destination page — signInAction
  // redirects on success, so this component unmounts before any state here
  // could ever become {ok:true}. Only the failure path resolves back to us.
  React.useEffect(() => {
    if (state === initialState) return;
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <div className="space-y-5">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!validate(new FormData(event.currentTarget))) event.preventDefault();
        }}
        className="space-y-4"
        noValidate
      >
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

      <Field label="Email" htmlFor="email" error={clientErrors.email ?? state.errors?.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          invalid={Boolean(clientErrors.email ?? state.errors?.email)}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={clientErrors.password ?? state.errors?.password} required>
        <PasswordInput
          name="password"
          autoComplete="current-password"
          placeholder="••••••••••"
          required
          invalid={Boolean(clientErrors.password ?? state.errors?.password)}
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
