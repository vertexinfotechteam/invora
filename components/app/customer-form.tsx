'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { saveCustomerAction, type ActionState } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useClientValidation } from '@/hooks/use-client-validation';
import { customerSchema } from '@/lib/validation/yup-schemas';
import type { Customer } from '@/lib/types/database';

const initialState: ActionState = { ok: false };

export function CustomerForm({ customer }: { customer?: Customer }) {
  const action = saveCustomerAction.bind(null, customer?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initialState);
  const { errors: clientErrors, validate } = useClientValidation(customerSchema);

  // Success shows via a flash toast on the destination page —
  // saveCustomerAction redirects on success, unmounting this component.
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
      className="space-y-6"
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

      <section className="card-surface space-y-4 p-5">
        <h2 className="text-sm font-semibold">Contact</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" htmlFor="name" error={clientErrors.name ?? state.errors?.name} required>
            <Input
              name="name"
              defaultValue={customer?.name}
              required
              invalid={Boolean(clientErrors.name ?? state.errors?.name)}
            />
          </Field>
          <Field label="Company" htmlFor="company" error={clientErrors.company ?? state.errors?.company}>
            <Input name="company" defaultValue={customer?.company ?? ''} />
          </Field>
          <Field label="Email" htmlFor="email" error={clientErrors.email ?? state.errors?.email}>
            <Input
              name="email"
              type="email"
              defaultValue={customer?.email ?? ''}
              invalid={Boolean(clientErrors.email ?? state.errors?.email)}
            />
          </Field>
          <Field label="Phone" htmlFor="phone" error={clientErrors.phone ?? state.errors?.phone}>
            <Input
              name="phone"
              defaultValue={customer?.phone ?? ''}
              invalid={Boolean(clientErrors.phone ?? state.errors?.phone)}
            />
          </Field>
          <Field
            label="GSTIN"
            htmlFor="gstin"
            hint="Required on their side for input tax credit."
            error={clientErrors.gstin ?? state.errors?.gstin}
          >
            <Input
              name="gstin"
              defaultValue={customer?.gstin ?? ''}
              className="uppercase"
              invalid={Boolean(clientErrors.gstin ?? state.errors?.gstin)}
            />
          </Field>
        </div>
      </section>

      <section className="card-surface space-y-4 p-5">
        <h2 className="text-sm font-semibold">Billing address</h2>
        <p className="-mt-2 text-xs text-muted-foreground">Printed on every document you send them.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" htmlFor="address_line1" className="sm:col-span-2">
            <Input name="address_line1" defaultValue={customer?.address_line1 ?? ''} />
          </Field>
          <Field label="Address line 2" htmlFor="address_line2" className="sm:col-span-2">
            <Input name="address_line2" defaultValue={customer?.address_line2 ?? ''} />
          </Field>
          <Field label="City" htmlFor="city">
            <Input name="city" defaultValue={customer?.city ?? ''} />
          </Field>
          <Field label="State" htmlFor="state">
            <Input name="state" defaultValue={customer?.state ?? ''} />
          </Field>
          <Field label="Postal code" htmlFor="postal_code">
            <Input name="postal_code" defaultValue={customer?.postal_code ?? ''} />
          </Field>
          <Field label="Country" htmlFor="country" hint="Two-letter code, e.g. IN.">
            <Input name="country" defaultValue={customer?.country ?? 'IN'} maxLength={2} className="uppercase" />
          </Field>
        </div>
      </section>

      <section className="card-surface space-y-4 p-5">
        <Field
          label="Internal notes"
          htmlFor="notes"
          hint="Only you see these. They never appear on a document."
        >
          <Textarea name="notes" defaultValue={customer?.notes ?? ''} rows={3} />
        </Field>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={pending}>
          {customer ? 'Save changes' : 'Add customer'}
        </Button>
      </div>
    </form>
  );
}
