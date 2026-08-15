import { NextResponse, type NextRequest } from 'next/server';

import { badRequest, conflict, notFound, withApiErrors } from '@/lib/guards/errors';
import { clientIp, enforceRateLimit } from '@/lib/guards/rate-limit';
import { hashToken, isWellFormedToken } from '@/lib/share/tokens';
import { publicQuoteResponseSchema } from '@/lib/validation/schemas';
import { fieldErrors } from '@/lib/validation/common';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordDocumentEvent } from '@/lib/events';
import { sendEmail } from '@/lib/email/send';
import { quoteDecisionEmail } from '@/lib/email/templates';
import { appUrl as siteUrl } from '@/lib/app-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/share/respond — a customer accepts or declines a quotation from the
 * public page. No account, no session.
 *
 * The audit trail (typed name + timestamp + IP + user agent) is what makes an
 * acceptance defensible later, so it is captured on the server from request
 * metadata rather than trusted from the payload.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const ip = clientIp(request);
  await enforceRateLimit('publicView', `respond:${ip}`);

  const parsed = publicQuoteResponseSchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Check the form.', fieldErrors(parsed.error));
  const { token, decision, signed_name: signedName, comment } = parsed.data;

  if (!isWellFormedToken(token)) throw notFound('This link is no longer available.');

  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from('share_links')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  const expired = link?.expires_at ? new Date(link.expires_at) < new Date() : false;
  if (!link || link.revoked_at || expired || link.doc_type !== 'quotation') {
    throw notFound('This link is no longer available.');
  }

  const { data: quote } = await admin
    .from('quotations')
    .select('id, business_id, number, status, customer_id')
    .eq('id', link.doc_id)
    .maybeSingle();

  if (!quote) throw notFound('This link is no longer available.');

  if (['accepted', 'rejected'].includes(quote.status)) {
    throw conflict('This quotation has already been responded to.');
  }
  if (quote.status === 'expired') {
    throw conflict('This quotation has expired. Please ask for an updated copy.');
  }

  const accepted = decision === 'accept';
  const now = new Date().toISOString();

  const { error } = await admin
    .from('quotations')
    .update({
      status: accepted ? 'accepted' : 'rejected',
      responded_at: now,
      accepted_by_name: signedName,
      accepted_ip: ip === 'unknown' ? null : ip,
      accepted_user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
    })
    .eq('id', quote.id);

  if (error) throw badRequest('Could not record your response. Please try again.');

  await recordDocumentEvent({
    businessId: quote.business_id,
    docType: 'quotation',
    docId: quote.id,
    event: accepted ? 'accepted' : 'rejected',
    actor: 'customer',
    meta: {
      signed_name: signedName,
      comment: comment ?? null,
      ip: ip === 'unknown' ? null : ip,
      user_agent: request.headers.get('user-agent')?.slice(0, 200) ?? null,
    },
  });

  // Tell the owner. Best-effort: a mail failure must not undo the acceptance.
  const { data: business } = await admin
    .from('businesses')
    .select('name, email, brand_color')
    .eq('id', quote.business_id)
    .maybeSingle();

  const { data: customer } = quote.customer_id
    ? await admin.from('customers').select('name, company').eq('id', quote.customer_id).maybeSingle()
    : { data: null };

  if (business?.email) {
    const appUrl = siteUrl();
    const mail = quoteDecisionEmail({
      businessName: business.name || 'Your business',
      brandColor: business.brand_color || '#4F46E5',
      quoteNumber: quote.number,
      customerLabel: customer?.company || customer?.name || signedName,
      accepted,
      signedName,
      comment: comment ?? null,
      manageUrl: `${appUrl}/quotations/${quote.id}`,
    });

    await sendEmail({
      to: business.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      businessId: quote.business_id,
      template: accepted ? 'quote_accepted' : 'quote_rejected',
      docType: 'quotation',
      docId: quote.id,
    });
  }

  return NextResponse.json({ status: accepted ? 'accepted' : 'rejected' });
});
