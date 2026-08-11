import 'server-only';

/**
 * SERVER ONLY.
 *
 * GEMINI_API_KEY must never reach a client bundle — same rule as
 * lib/ai/client.ts, enforced by the same no-restricted-imports entry in
 * .eslintrc.json.
 *
 * Scope: this powers only the public support-chat widget
 * (app/api/ai/support-chat). Every AI feature inside the product itself
 * (quotation generation, rewriting, translation, the command bar) stays on
 * Claude via lib/ai/client.ts — the "Powered by Claude" marketing copy
 * describes those, not this.
 *
 * A plain fetch against the REST API rather than the Google SDK: one call
 * site doesn't justify a new dependency.
 */

// An alias Google keeps pointed at their current flash-tier model, not a
// pinned version — pinned Gemini model ids get retired every few months
// (gemini-2.0-flash 404s as of 2026-08), and -latest is what survives that.
const GEMINI_MODEL = 'gemini-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiTurn {
  role: 'user' | 'model';
  content: string;
}

export interface GeminiResult {
  reply: string;
  model: string;
  finishReason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export async function callGemini(systemPrompt: string, turns: GeminiTurn[]): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] })),
      generationConfig: { maxOutputTokens: 500 },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const candidate = payload.candidates?.[0];
  const reply: string =
    candidate?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? '';

  return {
    reply,
    model: GEMINI_MODEL,
    finishReason: candidate?.finishReason ?? null,
    usage: {
      input_tokens: payload.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}
