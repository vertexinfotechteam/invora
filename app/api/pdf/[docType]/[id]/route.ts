import { type NextRequest } from 'next/server';

import { renderDocumentPdf } from '@/lib/pdf/render';
import { requireBusiness } from '@/lib/guards/auth';
import { badRequest, notFound, withApiErrors } from '@/lib/guards/errors';
import { clientIp, enforceRateLimit } from '@/lib/guards/rate-limit';
import { hashToken, isWellFormedToken } from '@/lib/share/tokens';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { DocumentType } from '@/lib/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pdf/quotation/:id  |  /api/pdf/invoice/:id
 *
 * Two ways in:
 *   • signed in and the document belongs to your business, or
 *   • ?token=<share token> matching a live share_links row for this document.
 *
 * Everything else 404s — including a revoked or expired token, which must not
 * be distinguishable from a token that never existed.
 */
export const GET = withApiErrors(
  async (request: NextRequest, context: { params: Promise<{ docType: string; id: string }> }) => {
    const { docType: rawDocType, id } = await context.params;

    if (rawDocType !== 'quotation' && rawDocType !== 'invoice') {
      throw badRequest('Unknown document type.');
    }
    const docType = rawDocType as DocumentType;

    const token = request.nextUrl.searchParams.get('token');
    const download = request.nextUrl.searchParams.get('download') === '1';

    if (token) {
      await enforceRateLimit('pdf', `ip:${clientIp(request)}`);
      await assertTokenGrantsAccess(token, docType, id);
    } else {
      const { user, business } = await requireBusiness();
      await enforceRateLimit('pdf', user.id);

      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from(docType === 'quotation' ? 'quotations' : 'invoices')
        .select('business_id')
        .eq('id', id)
        .maybeSingle();

      if (!data || data.business_id !== business.id) throw notFound('Document not found.');
    }

    const { buffer, filename } = await renderDocumentPdf(docType, id);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
        // Financial documents change; never let a CDN keep a stale copy.
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  },
);

async function assertTokenGrantsAccess(token: string, docType: DocumentType, docId: string) {
  if (!isWellFormedToken(token)) throw notFound('Document not found.');

  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from('share_links')
    .select('doc_type, doc_id, expires_at, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  const expired = link?.expires_at ? new Date(link.expires_at) < new Date() : false;

  if (!link || link.revoked_at || expired || link.doc_type !== docType || link.doc_id !== docId) {
    throw notFound('Document not found.');
  }
}
