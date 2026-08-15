/**
 * Master on/off switch for the document AI features — quotation generation,
 * the rewrite/translate button, and the editing command bar.
 *
 * Set `NEXT_PUBLIC_AI_ENABLED=false` to turn them off; anything else (including
 * the variable being absent) leaves them on, so an environment that never sets
 * it behaves exactly as before.
 *
 * Deliberately one variable read from both sides. The `NEXT_PUBLIC_` prefix
 * makes it readable in the client components that hide the entry points, and
 * server code reads the same value, so the buttons and the routes behind them
 * can never disagree about whether the feature is live.
 *
 * The entry points disappearing is a courtesy, not the enforcement: each route
 * checks this itself, because a hidden button is not a disabled endpoint.
 *
 * Out of scope by design: the public support chat on the marketing site and the
 * payment-message drafter, which are separate features with their own costs.
 */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED !== 'false';

/** Shown to anyone who reaches a disabled feature anyway. */
export const AI_DISABLED_MESSAGE =
  'AI features are temporarily switched off. Everything else works as usual.';
