'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { signUpAction, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { OAuthButtons } from '@/app/(auth)/oauth-buttons';

const initialState: FormState = { ok: false };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  if (state.ok) {
    return (
      <div className="card-surface space-y-3 p-6 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-success" />
        <h2 className="text-lg font-semibold">Almost there</h2>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <p className="text-xs text-muted-foreground">
          No email after a few minutes? Check your spam folder, or{' '}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            try again
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <OAuthButtons next="/settings/profile" />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or sign up with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </div>
      ) : null}

      <Field label="Your name" htmlFor="fullName" error={state.errors?.fullName} required>
        <Input
          name="fullName"
          autoComplete="name"
          placeholder="Priya Sharma"
          required
          invalid={Boolean(state.errors?.fullName)}
        />
      </Field>

      <Field
        label="Business name"
        htmlFor="businessName"
        hint="Appears on your quotations and invoices. You can change it later."
        error={state.errors?.businessName}
        required
      >
        <Input
          name="businessName"
          autoComplete="organization"
          placeholder="Sharma Design Studio"
          required
          invalid={Boolean(state.errors?.businessName)}
        />
      </Field>

      <Field label="Work email" htmlFor="email" error={state.errors?.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint="At least 10 characters, with upper case, lower case and a number."
        error={state.errors?.password}
        required
      >
        <PasswordInput
          name="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        error={state.errors?.confirmPassword}
        required
      >
        <PasswordInput
          name="confirmPassword"
          autoComplete="new-password"
          required
          invalid={Boolean(state.errors?.confirmPassword)}
        />
      </Field>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="acceptTerms"
          className="mt-0.5 h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
          required
        />
        <span className="text-muted-foreground">
          I agree to the{' '}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy policy
          </Link>
          .
        </span>
      </label>
      {state.errors?.acceptTerms ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {state.errors.acceptTerms}
        </p>
      ) : null}

      <Button type="submit" className="w-full" loading={pending}>
        Create account
      </Button>
      </form>
    </div>
  );
}
