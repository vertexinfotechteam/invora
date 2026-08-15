'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { submitContactAction, type FormState } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

const initialState: FormState = { ok: false };

export function ContactForm({ defaultMessage }: { defaultMessage?: string }) {
  const [state, formAction, pending] = useActionState(submitContactAction, initialState);

  if (state.ok) {
    return (
      <div className="card-surface space-y-3 p-6 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-success" />
        <h2 className="text-lg font-semibold">Message sent</h2>
        <p className="text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card-surface space-y-4 p-6" noValidate>
      {state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </div>
      ) : null}

      <Field label="Your name" htmlFor="name" error={state.errors?.name} required>
        <Input name="name" autoComplete="name" placeholder="Priya Sharma" required invalid={Boolean(state.errors?.name)} />
      </Field>

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

      <Field
        label="How can we help?"
        htmlFor="message"
        error={state.errors?.message}
        hint="Tell us what you're trying to do — the more detail, the faster we can help."
        required
      >
        <Textarea
          name="message"
          rows={5}
          defaultValue={defaultMessage}
          placeholder="I'd like to ask about…"
          required
          invalid={Boolean(state.errors?.message)}
        />
      </Field>

      {/* Honeypot — hidden from real visitors via CSS, not just "off-screen". */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company_website">Company website</label>
        <input id="company_website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" className="w-full" loading={pending}>
        Send message
      </Button>
    </form>
  );
}
