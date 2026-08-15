'use client';

import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { forgotPasswordAction, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useClientValidation } from '@/hooks/use-client-validation';
import { forgotPasswordSchema } from '@/lib/validation/yup-schemas';

const initialState: FormState = { ok: false };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);
  const { errors: clientErrors, validate } = useClientValidation(forgotPasswordSchema);

  React.useEffect(() => {
    if (state === initialState) return;
    if (state.ok) toast.success(state.message ?? 'Reset link sent.');
    else if (state.message) toast.error(state.message);
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we will send you a link to set a new one.
        </p>
      </div>

      {state.ok ? (
        <div className="card-surface space-y-2 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </div>
      ) : (
        <form
          action={formAction}
          onSubmit={(event) => {
            if (!validate(new FormData(event.currentTarget))) event.preventDefault();
          }}
          className="space-y-4"
          noValidate
        >
          {state.message ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {state.message}
            </p>
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

          <Button type="submit" className="w-full" loading={pending}>
            <Mail className="h-4 w-4" />
            Send reset link
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
