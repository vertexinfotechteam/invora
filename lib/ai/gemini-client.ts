import 'server-only';

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

async function requestGemini(body: Record<string, unknown>): Promise<RawGeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

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
): Promise<GeminiJsonResult> {
  const result = await requestGemini({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: { maxOutputTokens, responseMimeType: 'application/json' },
  });

  return { text: result.text, model: GEMINI_MODEL, finishReason: result.finishReason, usage: result.usage };
}
