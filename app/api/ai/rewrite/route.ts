import { NextResponse, type NextRequest } from 'next/server';

import { requireBusiness } from '@/lib/guards/auth';
import { badRequest, withApiErrors } from '@/lib/guards/errors';
import { runStructuredAi } from '@/lib/ai/pipeline';
import { RewriteResultSchema } from '@/lib/ai/schemas';
import { REWRITE_SYSTEM_PROMPT, buildRewriteRequest } from '@/lib/ai/prompts';
import { aiRewriteRequestSchema } from '@/lib/validation/schemas';
import { fieldErrors } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Every token that must survive a rewrite byte-for-byte. */
const PRESERVE_PATTERNS: RegExp[] = [
  /[₹$€£]\s?[\d,.]+/g, // currency amounts
  /\b\d[\d,]*\.?\d*\s?%/g, // percentages
  /\b\d{4}-\d{2}-\d{2}\b/g, // ISO dates
  /\b(?:QT|INV)-?\d+\b/gi, // document numbers
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, // emails
  /\bhttps?:\/\/\S+/g, // URLs
];

function extractTokens(text: string): string[] {
  const found: string[] = [];
  for (const pattern of PRESERVE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match[0]) found.push(match[0]);
    }
  }
  return found;
}

/**
 * POST /api/ai/rewrite — professionalize / shorten / expand / fix / translate.
 *
 * After the model responds, we verify that every number, currency amount,
 * percentage, date, document number, email and URL present in the source still
 * appears in the output. Translation is where this matters most: a Hindi
 * rendering that helpfully localises "₹1,20,000" is a commercial defect.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const { user, business } = await requireBusiness();

  const parsed = aiRewriteRequestSchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('Check the form.', fieldErrors(parsed.error));
  const input = parsed.data;

  if (input.action === 'translate' && !input.target_language) {
    throw badRequest('Choose a language to translate into.');
  }

  const result = await runStructuredAi(
    { businessId: business.id, userId: user.id },
    {
      feature: 'TEXT_REWRITE',
      system: REWRITE_SYSTEM_PROMPT,
      userContent: buildRewriteRequest({
        text: input.text,
        action: input.action,
        targetLanguage: input.target_language,
      }),
      schema: RewriteResultSchema,
      meta: { action: input.action, sourceLength: input.text.length },
    },
  );

  const expected = extractTokens(input.text);
  const missing = expected.filter((token) => !result.data.text.includes(token));

  return NextResponse.json({
    result: result.data,
    original: input.text,
    // Surfaced in the diff panel as a warning banner rather than silently
    // discarded — the user decides whether the rewrite is still acceptable.
    integrity: {
      ok: missing.length === 0,
      missingTokens: missing.slice(0, 10),
    },
    meta: { model: result.model, latencyMs: result.latencyMs, cacheHit: result.cacheHit },
  });
});
