import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireBusiness } from '@/lib/guards/auth';
import { assertFeature } from '@/lib/guards/features';
import { badRequest, notFound, withApiErrors } from '@/lib/guards/errors';
import { enforceRateLimit } from '@/lib/guards/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { renderCustomerReportExcel } from '@/lib/excel/render-report';
import { isoDateSchema, uuidSchema } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z
  .object({
    customer_id: uuidSchema.optional(),
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((data) => data.from <= data.to, { path: ['to'], message: '"to" must be on or after "from".' });

/**
 * GET /api/reports/export — an Excel report of quotations/invoices in a date
 * range, optionally narrowed to one customer. Premium ("downloadable
 * reports" — the Reports page's own copy has promised this).
 */
export const GET = withApiErrors(async (request: NextRequest) => {
  const { user, business } = await requireBusiness();
  await enforceRateLimit('share', `report:${user.id}`);
  await assertFeature(business.id, 'full_reports');

  const { searchParams } = request.nextUrl;
  const parsed = querySchema.safeParse({
    customer_id: searchParams.get('customer_id') || undefined,
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  });
  if (!parsed.success) throw badRequest('Choose a valid date range.');

  if (parsed.data.customer_id) {
    // Ownership check — the query param is client-supplied.
    const supabase = await createSupabaseServerClient();
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', parsed.data.customer_id)
      .maybeSingle();
    if (!customer) throw notFound('Customer not found.');
  }

  const { buffer, filename } = await renderCustomerReportExcel({
    businessId: business.id,
    customerId: parsed.data.customer_id ?? null,
    from: parsed.data.from,
    to: parsed.data.to,
  });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
});
