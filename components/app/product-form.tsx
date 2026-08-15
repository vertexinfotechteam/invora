'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { saveProductAction, type ActionState } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { parseAmountToPaise } from '@/lib/money';
import { useClientValidation } from '@/hooks/use-client-validation';
import { productSchema } from '@/lib/validation/yup-schemas';
import type { Product } from '@/lib/types/database';

const initialState: ActionState = { ok: false };
const TAX_PRESETS = [0, 5, 12, 18, 28];

export function ProductForm({ product }: { product?: Product }) {
  const action = saveProductAction.bind(null, product?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initialState);
  const { errors: clientErrors, validate } = useClientValidation(productSchema);

  // Success shows via a flash toast on /products — saveProductAction
  // redirects on success, unmounting this component.
  React.useEffect(() => {
    if (state === initialState) return;
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  // The visible field is rupees; the hidden field carries integer paise, which
  // is the only representation the server accepts.
  const [rupees, setRupees] = React.useState(
    product ? (product.default_price_paise / 100).toString() : '',
  );
  const paise = parseAmountToPaise(rupees) ?? 0;

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
        <Field label="Name" htmlFor="name" error={clientErrors.name ?? state.errors?.name} required>
          <Input
            name="name"
            defaultValue={product?.name}
            placeholder="UI design — per screen"
            required
            invalid={Boolean(clientErrors.name ?? state.errors?.name)}
          />
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          hint="Pre-fills the line-item description. Keep it client-readable."
        >
          <Textarea name="description" defaultValue={product?.description ?? ''} rows={3} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Unit"
            htmlFor="unit"
            hint="hour, day, screen, licence, project…"
            error={clientErrors.unit}
            required
          >
            <Input name="unit" defaultValue={product?.unit ?? 'unit'} required invalid={Boolean(clientErrors.unit)} />
          </Field>

          <Field label="SKU or code" htmlFor="sku">
            <Input name="sku" defaultValue={product?.sku ?? ''} />
          </Field>

          <Field
            label="Default rate"
            htmlFor="price"
            hint="In rupees. Stored internally as whole paise."
            error={clientErrors.default_price_paise ?? state.errors?.default_price_paise}
          >
            <Input
              id="price"
              inputMode="decimal"
              value={rupees}
              onChange={(event) => setRupees(event.target.value)}
              placeholder="0.00"
              className="tabular"
            />
          </Field>
          <input type="hidden" name="default_price_paise" value={paise} />

          <Field label="Tax rate" htmlFor="tax_rate">
            <select
              name="tax_rate"
              defaultValue={product?.tax_rate ?? 18}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {TAX_PRESETS.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </Field>

          <Field label="Default discount %" htmlFor="default_discount_pct">
            <Input
              name="default_discount_pct"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={product?.default_discount_pct ?? 0}
              className="tabular"
            />
          </Field>

          <Field label="HSN / SAC" htmlFor="hsn_sac" hint="Printed on GST invoices.">
            <Input name="hsn_sac" defaultValue={product?.hsn_sac ?? ''} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {product ? 'Save changes' : 'Add to catalog'}
        </Button>
      </div>
    </form>
  );
}
