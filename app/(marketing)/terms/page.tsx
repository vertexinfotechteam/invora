import type { Metadata } from 'next';
import { Clause, LegalPage } from '../legal-content';

export const metadata: Metadata = { title: 'Terms of service', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="9 August 2026"
      intro="These terms govern your use of Invora, a quotation and invoicing service operated by Vertex Infotech. By creating an account you agree to them."
    >
      <Clause heading="1. The service">
        <p>
          Invora lets you create quotations and invoices, share them with your customers, collect
          payments through Razorpay, and use AI assistance to draft the wording of those documents.
          We provide the software; the commercial relationship with your customers is entirely
          yours.
        </p>
      </Clause>

      <Clause heading="2. Your account">
        <p>
          You are responsible for the accuracy of your business details, for keeping your password
          confidential, and for everything done through your account. Tell us promptly at
          support@invora.app if you believe your account has been accessed by someone else.
        </p>
        <p>
          One business profile is created per account. You must be authorised to act for the
          business whose details you enter.
        </p>
      </Clause>

      <Clause heading="3. Your content and your customers' data">
        <p>
          You keep ownership of everything you put into Invora — your documents, your customer
          records, your catalog. We store and process it to provide the service, and we do not sell
          it or use it to train models.
        </p>
        <p>
          You are responsible for having a lawful basis to store the customer information you enter,
          and for the content of the documents you send.
        </p>
      </Clause>

      <Clause heading="4. AI assistance">
        <p>
          Invora&apos;s AI features generate draft text. Drafts are suggestions and may be wrong,
          incomplete or unsuitable for your situation. You are responsible for reviewing every
          document before you send it.
        </p>
        <p>
          Monetary totals, tax and discounts are calculated by Invora&apos;s own deterministic engine,
          not by a language model. Where the assistant suggests a rate, it is presented as a
          suggestion that you must explicitly accept.
        </p>
        <p>
          AI requests are processed on our servers by Anthropic&apos;s Claude models. We send the
          relevant document context needed to fulfil your request and nothing else.
        </p>
      </Clause>

      <Clause heading="5. Not tax, legal or accounting advice">
        <p>
          Invora produces GST-ready documents, but it is not a tax filing service and nothing in the
          product is tax, legal or accounting advice. The correctness of the tax rates you apply,
          and of your filings, remains your responsibility and your accountant&apos;s.
        </p>
      </Clause>

      <Clause heading="6. Plans, limits and payment">
        <p>
          The free plan includes the allowances published on our pricing page. Paid plans are billed
          in advance through Razorpay Subscriptions. Allowances reset at the start of each billing
          period and do not carry over.
        </p>
        <p>
          Exceeding an allowance blocks the creation of new documents or AI requests until the
          period resets or you upgrade. It never restricts access to documents you have already
          created.
        </p>
      </Clause>

      <Clause heading="7. Acceptable use">
        <p>
          Do not use Invora to send unsolicited bulk email, to issue fraudulent or misleading
          invoices, to impersonate another business, to attempt to access other tenants&apos; data, or to
          probe, scan or overload our infrastructure. We may suspend an account that does.
        </p>
      </Clause>

      <Clause heading="8. Availability">
        <p>
          We aim for high availability but do not guarantee uninterrupted service. Planned
          maintenance will be announced in advance where practical. Third-party outages — Razorpay,
          our email provider, our AI provider — may affect specific features.
        </p>
      </Clause>

      <Clause heading="9. Termination">
        <p>
          You may close your account at any time from Settings. We may suspend or terminate an
          account for a material breach of these terms, with notice where the circumstances allow.
          On termination you may export your data for 30 days.
        </p>
      </Clause>

      <Clause heading="10. Liability">
        <p>
          To the extent permitted by law, our aggregate liability arising from your use of Invora is
          limited to the fees you paid us in the twelve months preceding the claim. We are not
          liable for lost profits, lost business, or indirect or consequential loss.
        </p>
      </Clause>

      <Clause heading="11. Changes and governing law">
        <p>
          We may update these terms; material changes will be notified by email at least 14 days
          before they take effect. These terms are governed by the laws of India, and the courts of
          Gujarat have exclusive jurisdiction.
        </p>
      </Clause>
    </LegalPage>
  );
}
