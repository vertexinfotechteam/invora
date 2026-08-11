import type { Metadata } from 'next';
import { resolvePublicDocument } from '@/lib/share/public-document';
import { PublicDocumentView } from '@/components/public/document-view';
import { QuoteDecision } from '@/components/public/quote-decision';
import { LinkUnavailable } from '@/components/public/link-unavailable';

export const dynamic = 'force-dynamic';

// A shared quotation must never end up in a search index.
export const metadata: Metadata = {
  title: 'Quotation',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PublicQuotationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await resolvePublicDocument(token, 'quotation');

  if (!data) return <LinkUnavailable />;

  const status = data.doc.status as string;
  const canRespond = ['sent', 'viewed'].includes(status);

  return (
    <PublicDocumentView data={data} token={token}>
      <QuoteDecision
        token={token}
        status={status}
        canRespond={canRespond}
        acceptedByName={(data.doc.accepted_by_name as string | null) ?? null}
        businessName={data.business.name}
      />
    </PublicDocumentView>
  );
}
