'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatPaise } from '@/lib/money';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type State = 'idle' | 'opening' | 'processing' | 'confirmed' | 'error';

/**
 * Pay-now on the public invoice page.
 *
 * The important behaviour here is what happens *after* checkout succeeds: the
 * component shows "processing" and polls. It does not mark anything paid. The
 * invoice settles when the signature-verified webhook lands, which is why this
 * whole component can be deleted and payments still work.
 */
export function PayPanel({
  token,
  status,
  balancePaise,
  currency,
  businessName,
  upiId,
  razorpayEnabled,
}: {
  token: string;
  status: string;
  balancePaise: number;
  currency: string;
  businessName: string;
  upiId: string | null;
  razorpayEnabled: boolean;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<State>('idle');
  const [message, setMessage] = React.useState<string | null>(null);
  const [scriptReady, setScriptReady] = React.useState(false);

  // While "processing", re-fetch until the webhook has done its work.
  React.useEffect(() => {
    if (state !== 'processing') return;
    const timer = setInterval(() => router.refresh(), 4000);
    const stop = setTimeout(() => clearInterval(timer), 60_000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [state, router]);

  React.useEffect(() => {
    if (status === 'paid') setState('confirmed');
  }, [status]);

  if (status === 'paid' || state === 'confirmed') {
    return (
      <div className="card-surface mt-6 flex items-start gap-3 border-success/40 bg-success/[0.04] p-6">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
        <div>
          <p className="font-medium">Paid in full</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thank you. {businessName} has been notified and a receipt is on its way.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="card-surface mt-6 p-6 text-sm text-muted-foreground">
        This invoice has been cancelled. No payment is due.
      </div>
    );
  }

  if (balancePaise <= 0) return null;

  async function pay() {
    setState('opening');
    setMessage(null);

    try {
      const response = await fetch('/api/payments/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setState('error');
        setMessage(payload?.error?.message ?? 'We could not start the payment.');
        return;
      }

      if (!window.Razorpay) {
        setState('error');
        setMessage('The payment window could not load. Disable your ad blocker and try again.');
        return;
      }

      const checkout = new window.Razorpay({
        key: payload.keyId,
        order_id: payload.orderId,
        amount: payload.amountPaise,
        currency: payload.currency,
        name: businessName,
        description: `Invoice ${payload.invoiceNumber}`,
        theme: { color: '#4F46E5' },
        handler: async (result: Record<string, string>) => {
          setState('processing');
          // Signature check only — this call changes nothing server-side.
          await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result),
          }).catch(() => undefined);
        },
        modal: {
          ondismiss: () => {
            setState('idle');
            setMessage(null);
          },
        },
      });

      checkout.open();
    } catch {
      setState('error');
      setMessage('Something went wrong starting the payment.');
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptReady(true)}
        strategy="lazyOnload"
      />

      <div className="card-surface mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Amount due
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatPaise(balancePaise, currency)}
            </p>
          </div>

          {razorpayEnabled ? (
            <Button
              size="lg"
              onClick={pay}
              disabled={!scriptReady || state === 'opening' || state === 'processing'}
            >
              {state === 'processing' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {state === 'processing' ? 'Confirming…' : 'Pay now'}
            </Button>
          ) : null}
        </div>

        {state === 'processing' ? (
          <p className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
            Payment received — we are waiting for the gateway to confirm it. This page updates
            itself, usually within a few seconds. You can safely close this window; your payment is
            already recorded with Razorpay.
          </p>
        ) : null}

        {message ? (
          <p role="alert" className="mt-4 rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
            {message}
          </p>
        ) : null}

        {upiId ? (
          <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
            Prefer UPI directly? Pay to <strong className="text-foreground">{upiId}</strong> and
            mention the invoice number as the reference.
          </p>
        ) : null}

        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Payments are processed by Razorpay. Invora never sees your card or bank details.
        </p>
      </div>
    </>
  );
}
