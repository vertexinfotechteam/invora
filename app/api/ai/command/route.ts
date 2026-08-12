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

  // Only for ownership (RLS-scoped: a document belonging to another business
  // reads back as not-found) and `scope`, which the prompt needs. The lines,
  // discount and tax mode themselves come from the request body — what's
  // actually on screen right now, not a fresh database read — otherwise an
  // edit made in the few seconds before autosave fires would be silently
  // discarded the moment a command is applied on top of it.
  const { data: doc } = await supabase.from(table).select('id, scope').eq('id', input.doc_id).maybeSingle();

  if (!doc) throw notFound('Document not found.');

  const lines: CommandLine[] = input.lines.map((line) => ({
    name: line.name,
    qty: line.qty,
    rate_paise: line.rate_paise,
    discount_pct: line.discount_pct,
    tax_rate: line.tax_rate,
    unit: line.unit,
    description: line.description,
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
        currentDiscountPct: input.doc_discount_pct,
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
      docDiscountPct: input.doc_discount_pct,
      taxMode: input.tax_mode as TaxMode,
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
