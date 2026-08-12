import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

/**
 * SERVER ONLY.
 *
 * ANTHROPIC_API_KEY must never reach a client bundle. The ESLint
 * no-restricted-imports rule in .eslintrc.json blocks importing this module
 * from app/(app)/** and components/**; `npm run lint` is what enforces it.
 */
let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  cached = new Anthropic({
    // 4 minutes: a high-effort Opus 5 quotation can legitimately think for a while.
    timeout: 240_000,
    maxRetries: 2,
  });
  return cached;
}

export interface ClaudeChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeChatResult {
  reply: string;
  model: string;
  finishReason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

const CHAT_MODEL = 'claude-haiku-4-5';

/** Plain (non-structured) conversational completion — the Claude-side twin of
 * callGemini in lib/ai/gemini-client.ts, used where a feature only needs free
 * text back (the public support-chat widget) rather than a schema-validated
 * object. */
export async function callClaudeChat(systemPrompt: string, turns: ClaudeChatTurn[]): Promise<ClaudeChatResult> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 500,
    system: systemPrompt,
    messages: turns.map((turn) => ({ role: turn.role, content: turn.content })),
  });

  const reply = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');

  return {
    reply,
    model: response.model,
    finishReason: response.stop_reason,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
