import { type NextRequest } from 'next/server';

import { renderDocumentExcel } from '@/lib/excel/render';
import { requireBusiness } from '@/lib/guards/auth';
import { badRequest, notFound, withApiErrors } from '@/lib/guards/errors';
import { clientIp, enforceRateLimit } from '@/lib/guards/rate-limit';
import { hashToken, isWellFormedToken } from '@/lib/share/tokens';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { DocumentType } from '@/lib/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/excel/quotation/:id  |  /api/excel/invoice/:id
 *
 * Same access rule as /api/pdf/[docType]/[id] — signed in and the document
 * belongs to your business, or a live share token — because it reads from
 * the identical loadDocumentPdfData(), just rendered as a workbook instead
 * of a PDF page.
 */
export const GET = withApiErrors(
  async (request: NextRequest, context: { params: Promise<{ docType: string; id: string }> }) => {
    const { docType: rawDocType, id } = await context.params;

    if (rawDocType !== 'quotation' && rawDocType !== 'invoice') {
      throw badRequest('Unknown document type.');
    }
    const docType = rawDocType as DocumentType;

    const token = request.nextUrl.searchParams.get('token');

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

    const { buffer, filename } = await renderDocumentExcel(docType, id);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="${filename}"`,
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
