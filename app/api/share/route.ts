import { NextResponse, type NextRequest } from 'next/server';

import { requireBusiness } from '@/lib/guards/auth';
import { badRequest, notFound, withApiErrors } from '@/lib/guards/errors';
import { enforceRateLimit } from '@/lib/guards/rate-limit';
import { buildShareUrl, generateShareToken } from '@/lib/share/tokens';
import { createShareLinkSchema } from '@/lib/validation/schemas';
import { fieldErrors } from '@/lib/validation/common';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { addDaysIso, todayIso } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/share — mint a public link for a document.
 *
 * The raw token is returned exactly once, in this response. We store only its
 * hash, so this endpoint is the only moment the shareable URL exists in full.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const { user, business } = await requireBusiness();
  await enforceRateLimit('share', user.id);

  const parsed = createShareLinkSchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Check the request.', fieldErrors(parsed.error));
  const { doc_type: docType, doc_id: docId, expires_in_days: expiresInDays } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: doc } = await supabase
    .from(docType === 'quotation' ? 'quotations' : 'invoices')
    .select('id')
    .eq('id', docId)
    .maybeSingle();

  if (!doc) throw notFound('Document not found.');

  // One live link per document: minting a new one revokes the old, so a link
  // you shared by mistake stops working the moment you re-share.
  await supabase
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('doc_type', docType)
    .eq('doc_id', docId)
    .is('revoked_at', null);

  const { token, tokenHash } = generateShareToken();

  const { error } = await supabase.from('share_links').insert({
    business_id: business.id,
    doc_type: docType,
    doc_id: docId,
    token_hash: tokenHash,
    expires_at: new Date(`${addDaysIso(todayIso(), expiresInDays)}T23:59:59Z`).toISOString(),
    created_by: user.id,
  });

  if (error) throw badRequest(`Could not create the link: ${error.message}`);

  return NextResponse.json({
    url: buildShareUrl(docType, token),
    expiresInDays,
  });
});

/** DELETE /api/share?doc_type=…&doc_id=… — revoke every live link for a document. */
export const DELETE = withApiErrors(async (request: NextRequest) => {
  const { user } = await requireBusiness();
  await enforceRateLimit('share', user.id);

  const docType = request.nextUrl.searchParams.get('doc_type');
  const docId = request.nextUrl.searchParams.get('doc_id');
  if ((docType !== 'quotation' && docType !== 'invoice') || !docId) {
    throw badRequest('doc_type and doc_id are required.');
  }

  const supabase = await createSupabaseServerClient();
  await supabase
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('doc_type', docType)
    .eq('doc_id', docId)
    .is('revoked_at', null);

  return NextResponse.json({ revoked: true });
});
