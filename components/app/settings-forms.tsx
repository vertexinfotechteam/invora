'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  saveBankAction,
  saveBrandingAction,
  saveDefaultsAction,
  saveProfileAction,
  type ActionState,
} from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { LogoUploader } from '@/components/app/logo-uploader';
import { useClientValidation } from '@/hooks/use-client-validation';
import {
  businessBankSchema,
  businessDefaultsSchema,
  businessProfileSchema,
} from '@/lib/validation/yup-schemas';
import type { Business } from '@/lib/types/database';

const initialState: ActionState = { ok: false };

/**
 * None of these four settings actions redirect — each returns
 * `{ok, message}` straight back to the form that called it — so a toast can
 * just watch the state directly, unlike the redirect-based forms elsewhere
 * that need the flash-cookie handoff (see lib/flash.ts).
 */
function useActionToast(state: ActionState) {
  React.useEffect(() => {
    if (state === initialState) return;
    if (state.ok) toast.success(state.message ?? 'Saved.');
    else if (state.message) toast.error(state.message);
  }, [state]);
}

function Banner({ state }: { state: ActionState }) {
  if (!state.message) return null;
  const good = state.ok;
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
        good
          ? 'border-success/30 bg-success/5 text-success'
          : 'border-destructive/30 bg-destructive/5 text-destructive'
      }`}
    >
      {good ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {state.message}
    </div>
  );
}

export function ProfileForm({ business }: { business: Business }) {
  const [state, formAction, pending] = useActionState(saveProfileAction, initialState);
  const [bankState, bankAction, bankPending] = useActionState(saveBankAction, initialState);
  const { errors: clientErrors, validate } = useClientValidation(businessProfileSchema);
  const { errors: bankClientErrors, validate: validateBank } = useClientValidation(businessBankSchema);

  useActionToast(state);
  useActionToast(bankState);

  return (
    <>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!validate(new FormData(event.currentTarget))) event.preventDefault();
        }}
        className="space-y-6"
        noValidate
      >
        <Banner state={state} />

        <section className="card-surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Identity</h2>
          <p className="-mt-2 text-xs text-muted-foreground">
            This is what your customers see at the top of every document.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="name" error={clientErrors.name ?? state.errors?.name} required>
              <Input name="name" defaultValue={business.name} required invalid={Boolean(clientErrors.name ?? state.errors?.name)} />
            </Field>
            <Field
              label="Legal name"
              htmlFor="legal_name"
              hint="If it differs from your trading name."
            >
              <Input name="legal_name" defaultValue={business.legal_name ?? ''} />
            </Field>
            <Field label="Email" htmlFor="email" error={clientErrors.email ?? state.errors?.email}>
              <Input
                name="email"
                type="email"
                defaultValue={business.email ?? ''}
                invalid={Boolean(clientErrors.email ?? state.errors?.email)}
              />
            </Field>
            <Field label="Phone" htmlFor="phone" error={clientErrors.phone ?? state.errors?.phone}>
              <Input
                name="phone"
                defaultValue={business.phone ?? ''}
                invalid={Boolean(clientErrors.phone ?? state.errors?.phone)}
              />
            </Field>
            <Field label="Website" htmlFor="website" className="sm:col-span-2">
              <Input name="website" defaultValue={business.website ?? ''} placeholder="https://" />
            </Field>
          </div>
        </section>

        <section className="card-surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Registered address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1" htmlFor="address_line1" className="sm:col-span-2">
              <Input name="address_line1" defaultValue={business.address_line1 ?? ''} />
            </Field>
            <Field label="Address line 2" htmlFor="address_line2" className="sm:col-span-2">
              <Input name="address_line2" defaultValue={business.address_line2 ?? ''} />
            </Field>
            <Field label="City" htmlFor="city">
              <Input name="city" defaultValue={business.city ?? ''} />
            </Field>
            <Field label="State" htmlFor="state">
              <Input name="state" defaultValue={business.state ?? ''} />
            </Field>
            <Field label="Postal code" htmlFor="postal_code">
              <Input name="postal_code" defaultValue={business.postal_code ?? ''} />
            </Field>
            <Field label="Country" htmlFor="country" hint="Two-letter code.">
              <Input name="country" defaultValue={business.country} maxLength={2} className="uppercase" />
            </Field>
          </div>
        </section>

        <section className="card-surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Tax registration</h2>
          <p className="-mt-2 text-xs text-muted-foreground">
            With a GSTIN set, your invoices print as tax invoices with a per-rate tax breakup.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GSTIN" htmlFor="gstin" error={clientErrors.gstin ?? state.errors?.gstin}>
              <Input
                name="gstin"
                defaultValue={business.gstin ?? ''}
                className="uppercase"
                invalid={Boolean(clientErrors.gstin ?? state.errors?.gstin)}
              />
            </Field>
            <Field label="PAN" htmlFor="pan" error={clientErrors.pan ?? state.errors?.pan}>
              <Input
                name="pan"
                defaultValue={business.pan ?? ''}
                className="uppercase"
                invalid={Boolean(clientErrors.pan ?? state.errors?.pan)}
              />
            </Field>
          </div>
        </section>

        {/* Uploaded via Supabase Storage; these carry the resulting URLs. */}
        <input type="hidden" name="logo_url" defaultValue={business.logo_url ?? ''} />
        <input type="hidden" name="signature_url" defaultValue={business.signature_url ?? ''} />

        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Save profile
          </Button>
        </div>
      </form>

      <form
        action={bankAction}
        onSubmit={(event) => {
          if (!validateBank(new FormData(event.currentTarget))) event.preventDefault();
        }}
        className="mt-6 space-y-4"
        noValidate
      >
        <Banner state={bankState} />

        <section className="card-surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Payment details</h2>
          <p className="-mt-2 text-xs text-muted-foreground">
            Printed on invoices so a customer paying by transfer does not have to ask.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account name" htmlFor="bank_account_name">
              <Input name="bank_account_name" defaultValue={business.bank_account_name ?? ''} />
            </Field>
            <Field label="Bank name" htmlFor="bank_name">
              <Input name="bank_name" defaultValue={business.bank_name ?? ''} />
            </Field>
            <Field label="Account number" htmlFor="bank_account_no">
              <Input name="bank_account_no" defaultValue={business.bank_account_no ?? ''} />
            </Field>
            <Field label="IFSC" htmlFor="bank_ifsc" error={bankClientErrors.bank_ifsc ?? bankState.errors?.bank_ifsc}>
              <Input
                name="bank_ifsc"
                defaultValue={business.bank_ifsc ?? ''}
                className="uppercase"
                invalid={Boolean(bankClientErrors.bank_ifsc ?? bankState.errors?.bank_ifsc)}
              />
            </Field>
            <Field label="UPI ID" htmlFor="upi_id" className="sm:col-span-2">
              <Input name="upi_id" defaultValue={business.upi_id ?? ''} placeholder="name@bank" />
            </Field>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" variant="outline" loading={bankPending}>
            Save payment details
          </Button>
        </div>
      </form>
    </>
  );
}

export function DefaultsForm({ business }: { business: Business }) {
  const [state, formAction, pending] = useActionState(saveDefaultsAction, initialState);
  const { errors: clientErrors, validate } = useClientValidation(businessDefaultsSchema);
  useActionToast(state);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!validate(new FormData(event.currentTarget))) event.preventDefault();
      }}
      className="space-y-6"
      noValidate
    >
      <Banner state={state} />

      <section className="card-surface space-y-4 p-5">
        <h2 className="text-sm font-semibold">Numbering</h2>
        <p className="-mt-2 text-xs text-muted-foreground">
          Numbers are drawn in the database, so two documents created at the same moment can never
          collide. Changing a prefix affects future documents only.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Quotation prefix" htmlFor="quote_prefix">
            <Input name="quote_prefix" defaultValue={business.quote_prefix} />
          </Field>
          <Field label="Invoice prefix" htmlFor="invoice_prefix">
            <Input name="invoice_prefix" defaultValue={business.invoice_prefix} />
          </Field>
          <Field label="Digits" htmlFor="number_padding" hint="4 gives QT-0001." error={clientErrors.number_padding}>
            <Input
              name="number_padding"
              type="number"
              min={1}
              max={8}
              defaultValue={business.number_padding}
              invalid={Boolean(clientErrors.number_padding)}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Next quotation: <strong>{business.quote_prefix}{String(business.next_quote_no).padStart(business.number_padding, '0')}</strong>
          {' · '}
          Next invoice: <strong>{business.invoice_prefix}{String(business.next_invoice_no).padStart(business.number_padding, '0')}</strong>
        </p>
      </section>

      <section className="card-surface space-y-4 p-5">
        <h2 className="text-sm font-semibold">Tax & currency</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Currency" htmlFor="currency" hint="Three-letter code.">
            <Input name="currency" defaultValue={business.currency} maxLength={3} className="uppercase" />
          </Field>
          <Field label="Default tax rate %" htmlFor="default_tax_rate" error={clientErrors.default_tax_rate}>
            <Input
              name="default_tax_rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={business.default_tax_rate}
              className="tabular"
              invalid={Boolean(clientErrors.default_tax_rate)}
            />
          </Field>
          <Field label="Tax mode" htmlFor="default_tax_mode">
            <select
              name="default_tax_mode"
              defaultValue={business.default_tax_mode}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="exclusive">Added to rates</option>
              <option value="inclusive">Included in rates</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="card-surface space-y-4 p-5">
        <h2 className="text-sm font-semibold">Validity & due dates</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Quotations valid for (days)"
            htmlFor="quote_validity_days"
            hint="After this, the quotation expires automatically and can no longer be accepted."
            error={clientErrors.quote_validity_days}
          >
            <Input
              name="quote_validity_days"
              type="number"
              min={1}
              max={365}
              defaultValue={business.quote_validity_days}
              invalid={Boolean(clientErrors.quote_validity_days)}
            />
          </Field>
          <Field label="Invoices due in (days)" htmlFor="invoice_due_days" error={clientErrors.invoice_due_days}>
            <Input
              name="invoice_due_days"
              type="number"
              min={0}
              max={365}
              defaultValue={business.invoice_due_days}
              invalid={Boolean(clientErrors.invoice_due_days)}
            />
          </Field>
        </div>
      </section>

      <section className="card-surface space-y-4 p-5">
        <h2 className="text-sm font-semibold">Standard wording</h2>
        <Field label="Default payment terms" htmlFor="default_payment_terms">
          <Textarea name="default_payment_terms" defaultValue={business.default_payment_terms} rows={2} />
        </Field>
        <Field label="Default terms & conditions" htmlFor="default_terms">
          <Textarea name="default_terms" defaultValue={business.default_terms ?? ''} rows={6} />
        </Field>
        <Field label="Default notes" htmlFor="default_notes">
          <Textarea name="default_notes" defaultValue={business.default_notes ?? ''} rows={3} />
        </Field>
      </section>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save defaults
        </Button>
      </div>
    </form>
  );
}

export function BrandingForm({
  business,
  allowedTemplates,
}: {
  business: Business;
  allowedTemplates: string[];
}) {
  const [state, formAction, pending] = useActionState(saveBrandingAction, initialState);
  useActionToast(state);

  const templates = [
    { value: 'classic', label: 'Classic', description: 'Conservative letterhead. Prints cleanly in mono.' },
    { value: 'modern', label: 'Modern', description: 'Coloured masthead with the amount stated up front.' },
    { value: 'minimal', label: 'Minimal', description: 'Typographic and spacious. No logo block.' },
  ];

  return (
    <div className="space-y-6">
      <LogoUploader business={business} />

      <form action={formAction} className="space-y-6" noValidate>
        <Banner state={state} />

        <section className="card-surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Brand colour</h2>
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="brand_color"
              defaultValue={business.brand_color}
              aria-label="Brand colour"
              className="h-10 w-16 cursor-pointer rounded-lg border border-input bg-background p-1"
            />
            <p className="text-xs text-muted-foreground">
              Used for headings and the totals band on your PDFs.
            </p>
          </div>
        </section>

        <section className="card-surface space-y-3 p-5">
          <h2 className="text-sm font-semibold">PDF template</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {templates.map((template) => {
              const locked = !allowedTemplates.includes(template.value);
              return (
                <label
                  key={template.value}
                  className={`relative flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors ${
                    locked ? 'cursor-not-allowed border-dashed opacity-60' : 'hover:border-primary'
                  }`}
                >
                  <input
                    type="radio"
                    name="pdf_template"
                    value={template.value}
                    defaultChecked={business.pdf_template === template.value}
                    disabled={locked}
                    className="absolute right-3 top-3"
                  />
                  <span className="text-sm font-medium">{template.label}</span>
                  <span className="text-xs text-muted-foreground">{template.description}</span>
                  {locked ? (
                    <span className="mt-1 text-[11px] font-medium text-primary">Premium</span>
                  ) : null}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Template choice is enforced when the PDF is generated, so a lapsed subscription reverts
            to Classic automatically rather than printing something you are no longer paying for.
          </p>
        </section>

        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Save branding
          </Button>
        </div>
      </form>
    </div>
  );
}
