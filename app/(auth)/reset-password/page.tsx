'use client';

import { useActionState } from 'react';
import { resetPasswordAction, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

const initialState: FormState = { ok: false };

/**
 * Reached from the emailed link, after /auth/callback has exchanged the code
 * for a session. Without that session the action refuses and tells the user to
 * request a fresh link.
 */
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          Ten characters or more, with upper case, lower case and a number.
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        {state.message ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {state.message}
          </p>
        ) : null}

        <Field label="New password" htmlFor="password" error={state.errors?.password} required>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            invalid={Boolean(state.errors?.password)}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={state.errors?.confirmPassword}
          required
        >
          <Input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            invalid={Boolean(state.errors?.confirmPassword)}
          />
        </Field>

        <Button type="submit" className="w-full" loading={pending}>
          Update password
        </Button>
      </form>
    </div>
  );
}
