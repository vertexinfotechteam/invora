import type { Metadata } from 'next';
import { Clause, LegalPage } from '../legal-content';

export const metadata: Metadata = { title: 'Privacy policy', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="9 August 2026"
      intro="This policy explains what Invora collects, why, who we share it with, and what you can ask us to do with it. Invora is operated by Vertex Infotech."
    >
      <Clause heading="What we collect">
        <p>
          <strong className="text-foreground">Account data</strong> — your name, email address and
          password hash, plus the business profile you enter (business name, address, GSTIN, PAN,
          bank details, logo and signature images).
        </p>
        <p>
          <strong className="text-foreground">Customer records</strong> — the customer names,
          companies, addresses, emails, phone numbers and GSTINs that you enter. This is your data
          about your customers; we act as a processor for it.
        </p>
        <p>
          <strong className="text-foreground">Document data</strong> — the content of your
          quotations and invoices, including line items and amounts.
        </p>
        <p>
          <strong className="text-foreground">Acceptance records</strong> — when a customer accepts
          or declines a quotation through a public link, we record the name they typed, the
          timestamp, their IP address and their browser user agent, because that is what makes the
          acceptance evidentially useful to you.
        </p>
        <p>
          <strong className="text-foreground">Usage and diagnostics</strong> — feature usage counts,
          AI request metadata (feature, model, token counts, latency, outcome), and error reports.
        </p>
      </Clause>

      <Clause heading="What we do not collect">
        <p>
          We never see or store your card or bank credentials. Payments are handled entirely by
          Razorpay on their own infrastructure; we receive a payment identifier and an amount.
        </p>
      </Clause>

      <Clause heading="How AI requests are handled">
        <p>
          AI features run server-side. Your browser never talks to the AI provider directly. When
          you use an AI feature we send Anthropic the text needed for that specific request — your
          brief, the relevant document fields, your catalog item names — and receive a draft back.
        </p>
        <p>
          We log metadata about each request (which feature, which model, token counts, latency,
          success or failure) so we can meter usage and control cost. We do not use your content to
          train models.
        </p>
      </Clause>

      <Clause heading="Who we share data with">
        <p>
          Our processors are: Supabase (database, authentication and file storage), Vercel
          (application hosting), Anthropic (AI processing), Razorpay (payments), Resend (email
          delivery), Upstash (rate limiting) and Sentry (error monitoring). Each receives only what
          it needs to perform its function.
        </p>
        <p>We do not sell personal data, and we do not share it for advertising.</p>
      </Clause>

      <Clause heading="Tenant isolation">
        <p>
          Every record in Invora is tagged with a business identifier, and the database enforces
          row-level security so a query made on behalf of one business cannot return another
          business&apos;s rows — regardless of any bug in the application layer above it.
        </p>
      </Clause>

      <Clause heading="Retention">
        <p>
          We keep your documents for as long as your account is open, because invoices are financial
          records you may need years later. After you close your account we retain data for 30 days
          to allow export and recovery, then delete it, except where we are required to keep records
          for tax or legal reasons.
        </p>
        <p>Financial records are archived rather than hard-deleted while your account is active.</p>
      </Clause>

      <Clause heading="Your rights">
        <p>
          You can access and correct your data in the product at any time. You can request an export
          or a deletion by writing to privacy@invora.app; we respond within 30 days. If we process
          data as your processor (your customers&apos; data), we will act on your instructions.
        </p>
      </Clause>

      <Clause heading="Security">
        <p>
          Data is encrypted in transit and at rest. Access to production systems is restricted and
          audited. Administrative actions taken by our staff are recorded with a mandatory reason
          and a before-and-after snapshot.
        </p>
        <p>
          If a breach affects your data, we will notify you without undue delay and tell you what we
          know and what we are doing about it.
        </p>
      </Clause>

      <Clause heading="Cookies">
        <p>
          We set a session cookie so you stay signed in, and nothing else. There are no advertising
          or cross-site tracking cookies in Invora.
        </p>
      </Clause>
    </LegalPage>
  );
}
