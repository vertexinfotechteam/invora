import { NextResponse, type NextRequest } from 'next/server';

import { requireBusiness } from '@/lib/guards/auth';
import { withApiErrors, badRequest } from '@/lib/guards/errors';
import { runStructuredAi } from '@/lib/ai/pipeline';
import { QuotationDraftSchema } from '@/lib/ai/schemas';
import { QUOTATION_SYSTEM_PROMPT, buildQuotationBrief } from '@/lib/ai/prompts';
import { aiQuotationRequestSchema } from '@/lib/validation/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fieldErrors } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/quotation — the flagship "Generate with AI" flow.
 *
 * Returns a structured draft for the editor to render. Nothing is written to
 * the database here: the user reviews, edits, and saves. Suggested rates come
 * back as chips, not as values in money fields.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  // 1 — auth, before the rate limiter (which keys on user id) and before any
  //     provider call. An unauthenticated POST makes zero Anthropic requests.
  const { user, business } = await requireBusiness();

  const parsed = aiQuotationRequestSchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Check the form.', fieldErrors(parsed.error));
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();

  const [{ data: customer }, { data: catalog }] = await Promise.all([
    input.customer_id
      ? supabase
          .from('customers')
          .select('name, company')
          .eq('id', input.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('products')
      .select('name, unit, description')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const userContent = buildQuotationBrief({
    brief: input.brief,
    businessName: business.name || 'this business',
    businessCity: business.city,
    currency: business.currency,
    customerName: customer?.name ?? null,
    customerCompany: customer?.company ?? null,
    includePricing: input.include_pricing,
    tone: input.tone,
    language: input.language,
    catalog: catalog ?? [],
  });

  const result = await runStructuredAi(
    { businessId: business.id, userId: user.id },
    {
      feature: 'QUOTATION_GENERATE',
      system: QUOTATION_SYSTEM_PROMPT,
      userContent,
      schema: QuotationDraftSchema,
      meta: {
        includePricing: input.include_pricing,
        language: input.language,
        briefLength: input.brief.length,
      },
    },
  );

  // Belt and braces: strip any suggested rate the model produced despite being
  // told not to. A price the user did not ask for must not reach the UI.
  const draft = result.data;
  if (!input.include_pricing) {
    draft.lineItems = draft.lineItems.map((item) => ({
      ...item,
      suggestedRatePaise: null,
      rateConfidence: 'none' as const,
    }));
  } else {
    draft.lineItems = draft.lineItems.map((item) => ({
      ...item,
      suggestedRatePaise:
        typeof item.suggestedRatePaise === 'number' && Number.isFinite(item.suggestedRatePaise)
          ? Math.max(0, Math.round(item.suggestedRatePaise))
          : null,
    }));
  }

  return NextResponse.json({
    draft,
    meta: { model: result.model, latencyMs: result.latencyMs, cacheHit: result.cacheHit },
  });
});
