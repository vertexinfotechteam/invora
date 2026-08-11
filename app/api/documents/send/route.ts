import { NextResponse, type NextRequest } from 'next/server';

import { requireBusiness } from '@/lib/guards/auth';
import { badRequest, notFound, withApiErrors } from '@/lib/guards/errors';
import { enforceRateLimit } from '@/lib/guards/rate-limit';
import { sendDocumentSchema } from '@/lib/validation/schemas';
import { fieldErrors } from '@/lib/validation/common';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { renderDocumentPdf } from '@/lib/pdf/render';
import { buildShareUrl, generateShareToken } from '@/lib/share/tokens';
import { sendEmail } from '@/lib/email/send';
import { documentEmail } from '@/lib/email/templates';
import { recordDocumentEvent } from '@/lib/events';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/documents/send — email a quotation or invoice to the customer,
 * with the PDF attached and a private view link in the body.
 *
 * Sending is also what moves a draft to `sent`, which is what makes the
 * "viewed" transition on the public page meaningful.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const { user, business } = await requireBusiness();
  await enforceRateLimit('email', user.id);

  const parsed = sendDocumentSchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Check the message.', fieldErrors(parsed.error));
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const isQuote = input.doc_type === 'quotation';
  const table = isQuote ? 'quotations' : 'invoices';

  const { data: doc } = await supabase
    .from(table)
    .select('*, customers(name, company)')
    .eq('id', input.doc_id)
    .maybeSingle();

  if (!doc) throw notFound('Document not found.');

  // A live share link is what the email links to.
  await admin
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('doc_type', input.doc_type)
    .eq('doc_id', input.doc_id)
    .is('revoked_at', null);

  const { token, tokenHash } = generateShareToken();
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 60);

  await admin.from('share_links').insert({
    business_id: business.id,
    doc_type: input.doc_type,
    doc_id: input.doc_id,
    token_hash: tokenHash,
    expires_at: expires.toISOString(),
    created_by: user.id,
  });

  const viewUrl = buildShareUrl(input.doc_type, token);

  const attachments = input.attach_pdf
    ? await (async () => {
        const { buffer, filename } = await renderDocumentPdf(input.doc_type, input.doc_id, {
          payUrl: isQuote ? null : viewUrl,
        });
        return [{ filename, content: buffer }];
      })()
    : undefined;

  const customer = doc.customers as unknown as { name?: string; company?: string } | null;
  const secondaryDate = isQuote
    ? (doc as { valid_until?: string | null }).valid_until
    : (doc as { due_date?: string | null }).due_date;

  const mail = documentEmail({
    businessName: business.name || 'Your supplier',
    brandColor: business.brand_color || '#4F46E5',
    customerName: customer?.name || 'there',
    docLabel: isQuote ? 'Quotation' : 'Invoice',
    docNumber: doc.number,
    amountFormatted: formatPaise(doc.total_paise, doc.currency),
    dueOrValidLabel: isQuote ? 'Valid until' : 'Due',
    dueOrValidDate: secondaryDate ? formatDate(secondaryDate) : null,
    message: input.message,
    viewUrl,
  });

  const result = await sendEmail({
    to: input.to,
    cc: input.cc,
    subject: input.subject || mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: business.email ?? undefined,
    attachments,
    businessId: business.id,
    template: isQuote ? 'quotation_sent' : 'invoice_sent',
    docType: input.doc_type,
    docId: input.doc_id,
  });

  if (!result.sent) {
    throw badRequest(
      result.error === 'email_not_configured'
        ? 'Email is not configured yet. Add a Resend API key in Settings to send documents.'
        : `The email could not be sent: ${result.error}`,
    );
  }

  // draft -> sent. Anything further along is left alone.
  if (doc.status === 'draft') {
    await supabase
      .from(table)
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', input.doc_id);
  }

  await recordDocumentEvent({
    businessId: business.id,
    docType: input.doc_type,
    docId: input.doc_id,
    event: 'sent',
    actor: 'user',
    actorId: user.id,
    meta: { to: input.to, attached_pdf: input.attach_pdf },
  });

  return NextResponse.json({ sent: true, viewUrl });
});
