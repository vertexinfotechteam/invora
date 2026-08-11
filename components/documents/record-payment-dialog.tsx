'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { formatPaise, parseAmountToPaise } from '@/lib/money';
import { todayIso } from '@/lib/utils';

const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

/**
 * Records money received outside the gateway. Partial payments are the normal
 * case, not an edge case, so the amount defaults to the full balance but is
 * freely editable and validated against it.
 */
export function RecordPaymentDialog({
  invoiceId,
  balancePaise,
  currency,
}: {
  invoiceId: string;
  balancePaise: number;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [amount, setAmount] = React.useState((balancePaise / 100).toString());
  const [paidAt, setPaidAt] = React.useState(todayIso());
  const [method, setMethod] = React.useState('bank_transfer');
  const [reference, setReference] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const amountPaise = parseAmountToPaise(amount) ?? 0;
  const tooMuch = amountPaise > balancePaise;
  const invalid = amountPaise <= 0 || tooMuch;

  async function submit() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoiceId,
          amount_paise: amountPaise,
          paid_at: paidAt,
          method,
          reference: reference || undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'Could not record the payment.');
        return;
      }

      toast.success(
        payload.status === 'paid'
          ? 'Invoice settled in full.'
          : `Payment recorded. ${formatPaise(payload.balancePaise, currency)} still outstanding.`,
      );
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="success" onClick={() => setOpen(true)}>
        <CircleDollarSign className="h-4 w-4" />
        Record payment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              For money received outside Invora — cash, UPI, a bank transfer or a cheque. Online
              payments are recorded automatically.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Field
            label="Amount received"
            htmlFor="payment-amount"
            hint={`Balance outstanding: ${formatPaise(balancePaise, currency)}`}
            error={tooMuch ? 'That is more than the outstanding balance.' : undefined}
            required
          >
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="tabular"
              invalid={tooMuch}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date received" htmlFor="payment-date" required>
              <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
            </Field>

            <Field label="Method" htmlFor="payment-method" required>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Reference"
            htmlFor="payment-reference"
            hint="UTR, cheque number, or anything that helps you reconcile later."
          >
            <Input value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={submit} loading={pending} disabled={invalid}>
              Record {amountPaise > 0 ? formatPaise(amountPaise, currency) : 'payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
