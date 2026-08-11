import { NextResponse, type NextRequest } from 'next/server';

import { requireBusiness } from '@/lib/guards/auth';
import { badRequest, notFound, withApiErrors } from '@/lib/guards/errors';
import { runStructuredAi } from '@/lib/ai/pipeline';
import { CommandPlanSchema } from '@/lib/ai/schemas';
import { COMMAND_SYSTEM_PROMPT, buildCommandRequest } from '@/lib/ai/prompts';
import { applyCommandPlan, type CommandLine } from '@/lib/ai/commands';
import { aiCommandRequestSchema } from '@/lib/validation/schemas';
import { fieldErrors } from '@/lib/validation/common';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TaxMode } from '@/lib/calc/totals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/command — the editing command bar.
 *
 * The split that keeps this safe:
 *   • The model classifies the instruction and returns parameters
 *     (intent, scope, percentage, line index). It returns no amounts.
 *   • This handler applies those parameters and re-runs computeTotals.
 *   • The response is a PREVIEW. Nothing is persisted. The client renders a
 *     before/after diff with a totals-delta banner and the user clicks Apply.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const { user, business } = await requireBusiness();

  const parsed = aiCommandRequestSchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Check the command.', fieldErrors(parsed.error));
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();
  const table = input.doc_type === 'quotation' ? 'quotations' : 'invoices';
  const itemsTable = input.doc_type === 'quotation' ? 'quotation_items' : 'invoice_items';
  const fk = input.doc_type === 'quotation' ? 'quotation_id' : 'invoice_id';

  const { data: doc } = await supabase
    .from(table)
    .select('id, doc_discount_pct, tax_mode, scope, notes, terms, payment_terms')
    .eq('id', input.doc_id)
    .maybeSingle();

  if (!doc) throw notFound('Document not found.');

  const { data: items } = await supabase
    .from(itemsTable)
    .select('name, qty, rate_paise, discount_pct, tax_rate, unit, description')
    .eq(fk, input.doc_id)
    .order('position', { ascending: true });

  const lines: CommandLine[] = (items ?? []).map((item) => ({
    name: item.name,
    qty: Number(item.qty),
    rate_paise: item.rate_paise,
    discount_pct: Number(item.discount_pct),
    tax_rate: Number(item.tax_rate),
    unit: item.unit,
    description: item.description,
  }));

  const planResult = await runStructuredAi(
    { businessId: business.id, userId: user.id },
    {
      feature: 'EDIT_COMMAND',
      system: COMMAND_SYSTEM_PROMPT,
      userContent: buildCommandRequest({
        command: input.command,
        docType: input.doc_type,
        lineNames: lines.map((line) => line.name),
        currentDiscountPct: Number(doc.doc_discount_pct),
        hasScope: Boolean((doc as { scope?: string | null }).scope),
      }),
      schema: CommandPlanSchema,
      meta: { docType: input.doc_type, commandLength: input.command.length },
    },
  );

  const plan = planResult.data;

  const preview = applyCommandPlan(
    {
      lines,
      docDiscountPct: Number(doc.doc_discount_pct),
      taxMode: doc.tax_mode as TaxMode,
    },
    plan,
  );

  return NextResponse.json({
    plan,
    preview: {
      applied: preview.applied,
      reason: preview.reason ?? null,
      summary: preview.summary,
      requiresConfirmation: preview.requiresConfirmation,
      totalDeltaPaise: preview.totalDeltaPaise,
      before: {
        subtotalPaise: preview.before.subtotalPaise,
        discountPaise: preview.before.discountPaise,
        taxPaise: preview.before.taxPaise,
        totalPaise: preview.before.totalPaise,
      },
      after: {
        subtotalPaise: preview.after.subtotalPaise,
        discountPaise: preview.after.discountPaise,
        taxPaise: preview.after.taxPaise,
        totalPaise: preview.after.totalPaise,
      },
      nextLines: preview.next.lines,
      nextDocDiscountPct: preview.next.docDiscountPct,
    },
    meta: {
      model: planResult.model,
      latencyMs: planResult.latencyMs,
      cacheHit: planResult.cacheHit,
    },
  });
});
