import type { Metadata } from 'next';
import { resolvePublicDocument } from '@/lib/share/public-document';
import { PublicDocumentView } from '@/components/public/document-view';
import { PayPanel } from '@/components/public/pay-panel';
import { LinkUnavailable } from '@/components/public/link-unavailable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invoice',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await resolvePublicDocument(token, 'invoice');

  if (!data) return <LinkUnavailable />;

  return (
    <PublicDocumentView data={data} token={token}>
      <PayPanel
        token={token}
        status={data.doc.status as string}
        balancePaise={(data.doc.balance_paise as number) ?? 0}
        currency={data.doc.currency}
        businessName={data.business.name}
        upiId={data.business.upi_id}
        razorpayEnabled={Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)}
      />
    </PublicDocumentView>
  );
}
