'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { submitContactAction, type FormState } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useClientValidation } from '@/hooks/use-client-validation';
import { contactSchema } from '@/lib/validation/yup-schemas';

const initialState: FormState = { ok: false };

export function ContactForm({ defaultMessage }: { defaultMessage?: string }) {
  const [state, formAction, pending] = useActionState(submitContactAction, initialState);
  const { errors: clientErrors, validate } = useClientValidation(contactSchema);

  React.useEffect(() => {
    if (state === initialState) return;
    if (state.ok) toast.success(state.message ?? 'Message sent.');
    else if (state.message) toast.error(state.message);
  }, [state]);

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
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!validate(new FormData(event.currentTarget))) event.preventDefault();
      }}
      className="card-surface space-y-4 p-6"
      noValidate
    >
      {state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </div>
      ) : null}

      <Field label="Your name" htmlFor="name" error={clientErrors.name ?? state.errors?.name} required>
        <Input
          name="name"
          autoComplete="name"
          placeholder="Priya Sharma"
          required
          invalid={Boolean(clientErrors.name ?? state.errors?.name)}
        />
      </Field>

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

      <Field
        label="How can we help?"
        htmlFor="message"
        error={clientErrors.message ?? state.errors?.message}
        hint="Tell us what you're trying to do — the more detail, the faster we can help."
        required
      >
        <Textarea
          name="message"
          rows={5}
          defaultValue={defaultMessage}
          placeholder="I'd like to ask about…"
          required
          invalid={Boolean(clientErrors.message ?? state.errors?.message)}
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
