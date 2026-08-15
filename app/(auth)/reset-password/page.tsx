'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { resetPasswordAction, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useClientValidation } from '@/hooks/use-client-validation';
import { resetPasswordSchema } from '@/lib/validation/yup-schemas';

const initialState: FormState = { ok: false };

/**
 * Reached from the emailed link, after /auth/callback has exchanged the code
 * for a session. Without that session the action refuses and tells the user to
 * request a fresh link.
 */
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const { errors: clientErrors, validate } = useClientValidation(resetPasswordSchema);

  // Only the failure path resolves here — resetPasswordAction redirects to
  // /dashboard on success (with its own flash toast), which unmounts this
  // component before any client state could reflect that outcome.
  React.useEffect(() => {
    if (state === initialState) return;
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          Ten characters or more, with upper case, lower case and a number.
        </p>
      </div>

      <form
        action={formAction}
        onSubmit={(event) => {
          if (!validate(new FormData(event.currentTarget))) event.preventDefault();
        }}
        className="space-y-4"
        noValidate
      >
        {state.message ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {state.message}
          </p>
        ) : null}

        <Field label="New password" htmlFor="password" error={clientErrors.password ?? state.errors?.password} required>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            invalid={Boolean(clientErrors.password ?? state.errors?.password)}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={clientErrors.confirmPassword ?? state.errors?.confirmPassword}
          required
        >
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            required
            invalid={Boolean(clientErrors.confirmPassword ?? state.errors?.confirmPassword)}
          />
        </Field>

        <Button type="submit" className="w-full" loading={pending}>
          Update password
        </Button>
      </form>
    </div>
  );
}
