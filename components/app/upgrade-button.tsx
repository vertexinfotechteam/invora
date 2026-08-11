'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { isPlanComingSoon } from '@/lib/plans';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/**
 * Starts a Razorpay subscription.
 *
 * The checkout handler shows an optimistic "activating" toast and refreshes —
 * it does not mark the plan active. That happens when the
 * `subscription.activated` webhook arrives. Disabling this component entirely
 * still results in a working upgrade, which is the property Phase 7 tests.
 */
export function UpgradeButton({
  isFree,
  planCode = 'premium_monthly',
  cancelAtPeriodEnd = false,
  label,
  className,
}: {
  isFree: boolean;
  planCode?: 'premium_monthly' | 'premium_yearly';
  cancelAtPeriodEnd?: boolean;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [scriptReady, setScriptReady] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  async function upgrade() {
    setPending(true);
    try {
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_code: planCode }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'Could not start the upgrade.');
        return;
      }

      if (!window.Razorpay) {
        toast.error('The payment window could not load. Disable your ad blocker and try again.');
        return;
      }

      const checkout = new window.Razorpay({
        key: payload.keyId,
        subscription_id: payload.subscriptionId,
        name: 'Invora',
        description: planCode === 'premium_yearly' ? 'Premium — annual' : 'Premium — monthly',
        prefill: { email: payload.email, name: payload.businessName },
        theme: { color: '#4F46E5' },
        handler: () => {
          toast.success('Payment received — activating your plan.', {
            description: 'This usually takes a few seconds. The page will update itself.',
          });
          setTimeout(() => router.refresh(), 3000);
        },
        modal: {
          ondismiss: () => toast.info('Upgrade cancelled. Nothing was charged.'),
        },
      });

      checkout.open();
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    if (!confirm('Cancel at the end of the current period? You keep Premium until then.')) return;
    if (cancelling) return;

    setCancelling(true);
    try {
      const response = await fetch('/api/subscription/checkout', { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json();
        toast.error(payload?.error?.message ?? 'Could not cancel.');
        return;
      }
      toast.success('Cancellation scheduled for the end of this period.');
      router.refresh();
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setCancelling(false);
    }
  }

  if (isPlanComingSoon(planCode)) {
    return (
      <Button disabled className={className} title="This plan isn't purchasable yet.">
        Coming soon
      </Button>
    );
  }

  if (!isFree) {
    return cancelAtPeriodEnd ? (
      <p className="text-xs text-muted-foreground">
        Cancels at the end of this period. Nothing further will be charged.
      </p>
    ) : (
      <Button variant="ghost" size="sm" onClick={cancel} loading={cancelling} className={className}>
        Cancel subscription
      </Button>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptReady(true)}
        strategy="lazyOnload"
      />
      <Button onClick={upgrade} loading={pending} disabled={!scriptReady} className={className}>
        {label ?? 'Upgrade to Premium'}
      </Button>
    </>
  );
}
