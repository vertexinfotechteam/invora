/**
 * Model routing.
 *
 * A config map, not hardcoded strings scattered through route handlers — so
 * re-routing a feature after two weeks of real ai_usage_logs data is a
 * one-line change here.
 *
 * These Claude model ids only take effect when ANTHROPIC_API_KEY is
 * configured — see lib/ai/provider.ts. Every feature falls back to Gemini
 * automatically when it isn't, so the model names below are a preference,
 * not a hard dependency: the product works end to end on either key.
 *
 * Rationale (2026-08-09):
 *   • Opus 5 for quotation generation and the editing command bar. This is the
 *     flagship "Generate with AI" flow and the product's differentiator; the
 *     quality is worth the rate.
 *   • Haiku 4.5 for high-frequency, low-judgement text work (rewrite, shorten,
 *     translate, reminder drafts) where Opus buys nothing a customer notices.
 */
export const AI_MODELS = {
  QUOTATION_GENERATE: 'claude-opus-5',
  INVOICE_ASSIST: 'claude-opus-5',
  EDIT_COMMAND: 'claude-opus-5',
  TEXT_REWRITE: 'claude-haiku-4-5',
  REMINDER_DRAFT: 'claude-haiku-4-5',
} as const;

export type AiFeature = keyof typeof AI_MODELS;
export type AiModelId = (typeof AI_MODELS)[AiFeature];

/**
 * Effort tunes thinking depth and overall token spend on the Opus-tier models.
 * Generation gets `high`; classification-style work gets `low` because the
 * answer space is small and latency is user-visible.
 */
export const AI_EFFORT: Record<AiFeature, 'low' | 'medium' | 'high' | 'xhigh' | 'max'> = {
  QUOTATION_GENERATE: 'high',
  INVOICE_ASSIST: 'medium',
  EDIT_COMMAND: 'medium',
  TEXT_REWRITE: 'low',
  REMINDER_DRAFT: 'low',
};

/**
 * max_tokens has to cover thinking *plus* the visible response on Opus 5,
 * where thinking is on by default. Budget generously or long quotations
 * truncate mid-object.
 */
export const AI_MAX_TOKENS: Record<AiFeature, number> = {
  QUOTATION_GENERATE: 12_000,
  INVOICE_ASSIST: 8_000,
  EDIT_COMMAND: 8_000,
  TEXT_REWRITE: 4_000,
  REMINDER_DRAFT: 2_000,
};

/** Requests larger than this are rejected with 413 before reaching Anthropic. */
export const AI_MAX_INPUT_TOKENS = 30_000;

/** Human-readable feature slugs written to ai_usage_logs.feature. */
export const AI_FEATURE_SLUG: Record<AiFeature, string> = {
  QUOTATION_GENERATE: 'quotation_generate',
  INVOICE_ASSIST: 'invoice_assist',
  EDIT_COMMAND: 'edit_command',
  TEXT_REWRITE: 'text_rewrite',
  REMINDER_DRAFT: 'reminder_draft',
};

/**
 * The only feature that spends an AI credit. Generating a quotation is the
 * flagship, expensive (Opus, high-effort) call — editing one afterward
 * (the command bar, rewrite, invoice-assist wording, reminder drafts) is
 * meant to feel free so nobody hesitates to polish a draft before sending
 * it. `runStructuredAi` checks this before reserving or charging anything.
 */
export const CREDIT_METERED_FEATURES: ReadonlySet<AiFeature> = new Set(['QUOTATION_GENERATE']);
