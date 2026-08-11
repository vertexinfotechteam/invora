import type { Metadata } from 'next';
import { Clause, LegalPage } from '../legal-content';

export const metadata: Metadata = { title: 'Refunds & cancellation', alternates: { canonical: '/refunds' } };

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds & cancellation policy"
      updated="9 August 2026"
      intro="How Invora subscriptions are billed, how to cancel, and when we refund. This policy covers your subscription to Invora — not the invoices you issue to your own customers."
    >
      <Clause heading="Billing">
        <p>
          Premium — Monthly (₹299/month) and Premium — Yearly (₹999/year) are coming soon and are
          not yet billable. When they open, Premium will be billed in advance through Razorpay
          Subscriptions; your billing period will start on the day the first payment is confirmed
          and renew automatically until you cancel.
        </p>
        <p>The Free plan is free and is never charged.</p>
      </Clause>

      <Clause heading="Cancellation">
        <p>
          You can cancel at any time from Settings → Plan. Cancellation takes effect at the end of
          the period you have already paid for: you keep Premium features until then, and your
          account reverts to the Free plan afterwards.
        </p>
        <p>
          Cancelling never deletes anything. Documents beyond the Free plan&rsquo;s allowance become
          read-only; you keep full access to view, download and export everything.
        </p>
      </Clause>

      <Clause heading="Refunds">
        <p>
          <strong className="text-foreground">Within 7 days of your first payment:</strong> a full
          refund, no questions asked. Write to billing@invora.app from your account email address.
        </p>
        <p>
          <strong className="text-foreground">After 7 days:</strong> subscription fees for the
          current period are non-refundable, because the allowance for that period has been made
          available to you. Cancelling stops the next renewal.
        </p>
        <p>
          <strong className="text-foreground">Service failure:</strong> if a sustained outage or a
          defect on our side prevented you from using Invora for a material part of a billing
          period, tell us and we will refund that period pro rata.
        </p>
        <p>
          <strong className="text-foreground">Accidental renewal:</strong> if you are charged for a
          renewal you did not intend and you have not used the new period&apos;s allowance, contact us
          within 7 days of the charge and we will refund it in full.
        </p>
      </Clause>

      <Clause heading="How refunds are paid">
        <p>
          Approved refunds are issued to the original payment method through Razorpay. Razorpay
          typically settles refunds within 5–7 working days; the exact timing depends on your bank
          or card issuer.
        </p>
      </Clause>

      <Clause heading="Payments your customers make to you">
        <p>
          Payments your customers make against your invoices are between you and them. Invora
          records the payment and marks the invoice settled; we do not hold your funds and we cannot
          reverse a customer&apos;s payment. Refunding a customer is done from your own Razorpay
          dashboard, and you should then record the adjustment on the invoice in Invora.
        </p>
      </Clause>

      <Clause heading="Contact">
        <p>
          For anything billing-related, email billing@invora.app from the address on your account.
          We reply within two working days.
        </p>
      </Clause>
    </LegalPage>
  );
}
