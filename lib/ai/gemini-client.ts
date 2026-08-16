import 'server-only';

// Must match lib/ai/schemas.ts — the schemas are Zod v4, whose toJSONSchema is
// built in. The separate zod-to-json-schema package is v3-only and silently
// produces something Gemini ignores.
import { z } from 'zod/v4';

/**
 * SERVER ONLY.
 *
 * GEMINI_API_KEY must never reach a client bundle — same rule as
 * lib/ai/client.ts, enforced by the same no-restricted-imports entry in
 * .eslintrc.json.
 *
 * Scope: every AI feature routes through lib/ai/pipeline.ts, which calls
 * into this module whenever lib/ai/provider.ts resolves to 'gemini' — i.e.
 * whenever ANTHROPIC_API_KEY isn't set but GEMINI_API_KEY is. The public
 * support-chat widget (app/api/ai/support-chat) also falls back to this
 * client under the same rule. Nothing hardcodes Gemini to one feature;
 * whichever key is configured decides.
 *
 * A plain fetch against the REST API rather than the Google SDK: not enough
 * call sites to justify a new dependency.
 */

// An alias Google keeps pointed at their current flash-tier model, not a
// pinned version — pinned Gemini model ids get retired every few months
// (gemini-2.0-flash 404s as of 2026-08), and -latest is what survives that.
// Exported so callers that need to log/report a model name before a response
// exists (e.g. a pre-flight size-guard rejection) never hand-duplicate it.
export const GEMINI_MODEL = 'gemini-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiTurn {
  role: 'user' | 'model';
  content: string;
}

export interface GeminiUsage {
  input_tokens: number;
  output_tokens: number;
}

interface RawGeminiResponse {
  text: string;
  finishReason: string | null;
  usage: GeminiUsage;
}

/** Gemini Flash returns these while it is busy; the request is fine, the
 * capacity is not. The Anthropic SDK retries its equivalents for us, so this
 * gap only became visible once Gemini became the only provider — in testing,
 * roughly one call in three hit a 503 during a busy spell. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestGemini(body: Record<string, unknown>): Promise<RawGeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  let response!: Response;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) break;

    // 1s, then 2s. Short enough to stay inside the caller's patience, long
    // enough for a demand spike to pass.
    await sleep(1000 * attempt);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Gemini ${response.status}: ${errBody.slice(0, 300)}`);
  }

  const payload = await response.json();
  const candidate = payload.candidates?.[0];
  const text: string =
    candidate?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? '';

  return {
    text,
    finishReason: candidate?.finishReason ?? null,
    usage: {
      input_tokens: payload.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

export interface GeminiResult {
  reply: string;
  model: string;
  finishReason: string | null;
  usage: GeminiUsage;
}

export async function callGemini(systemPrompt: string, turns: GeminiTurn[]): Promise<GeminiResult> {
  const result = await requestGemini({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] })),
    generationConfig: { maxOutputTokens: 500 },
  });

  return { reply: result.text, model: GEMINI_MODEL, finishReason: result.finishReason, usage: result.usage };
}

export interface GeminiJsonResult {
  /** Raw response text — the caller validates it against its own schema. */
  text: string;
  model: string;
  finishReason: string | null;
  usage: GeminiUsage;
}

/**
 * JSON-mode call for structured generation.
 *
 * Gemini's REST API doesn't offer Anthropic's zodOutputFormat guarantee, so
 * this only forces syntactically-valid JSON (`responseMimeType`) — shape
 * conformance depends on the prompt describing the exact fields, and the
 * caller MUST validate the result against the real Zod schema before
 * trusting it. That validation, not this function, is what upholds the
 * money-safety guarantee regardless of provider.
 */
export async function callGeminiJson(
  systemPrompt: string,
  userContent: string,
  maxOutputTokens: number,
  responseSchema?: unknown,
): Promise<GeminiJsonResult> {
  const result = await requestGemini({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: {
      maxOutputTokens,
      responseMimeType: 'application/json',
      // Constrains the *shape*, not just the syntax. Without it Gemini invents
      // its own field names and the caller's Zod parse rejects the result —
      // quotation generation, rewrite and translate all failed that way, while
      // the command bar passed only because its shape was simple enough to
      // guess. Optional so callers without a schema behave exactly as before.
      ...(responseSchema ? { responseSchema } : {}),
    },
  });

  return { text: result.text, model: GEMINI_MODEL, finishReason: result.finishReason, usage: result.usage };
}

/**
 * Converts a Zod schema into the dialect Gemini accepts.
 *
 * Gemini implements a subset of JSON Schema: it rejects `$ref`/`$schema`,
 * `additionalProperties`, and unknown string formats outright, so the raw
 * converter output cannot be sent as-is.
 */
export function toGeminiSchema(zodSchema: unknown): unknown {
  // `io: 'output'` describes what the model must produce; `target: 'draft-7'`
  // avoids the 2020-12 keywords Gemini does not implement.
  const json = z.toJSONSchema(zodSchema as z.ZodType, {
    io: 'output',
    target: 'draft-7',
    unrepresentable: 'any',
  });
  return stripUnsupported(json);
}

const ALLOWED_STRING_FORMATS = new Set(['date-time', 'date', 'time', 'duration', 'email']);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (!node || typeof node !== 'object') return node;

  const source = node as Record<string, unknown>;

  // Zod renders `T | null` as anyOf[T, {type:'null'}]. Gemini has no null type
  // and rejects the whole request with a bare "invalid argument"; it expresses
  // the same thing as `nullable: true` on the non-null branch. Quotation
  // drafts hit this via suggestedRatePaise, which is number | null.
  const anyOf = source.anyOf;
  if (Array.isArray(anyOf)) {
    const branches = anyOf as Record<string, unknown>[];
    const nonNull = branches.filter((b) => b?.type !== 'null');
    if (nonNull.length === 1 && branches.length !== nonNull.length) {
      const { anyOf: _drop, ...rest } = source;
      return stripUnsupported({ ...nonNull[0], ...rest, nullable: true });
    }
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'additionalProperties' || key === '$schema' || key === 'default') continue;
    if (key === 'format' && typeof value === 'string' && !ALLOWED_STRING_FORMATS.has(value)) continue;
    out[key] = stripUnsupported(value);
  }
  return out;
}
