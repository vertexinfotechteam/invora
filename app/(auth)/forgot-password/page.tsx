'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { forgotPasswordAction, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

const initialState: FormState = { ok: false };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

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
        <form action={formAction} className="space-y-4" noValidate>
          {state.message ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {state.message}
            </p>
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
