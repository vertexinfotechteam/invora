import type { CookieOptions } from '@supabase/ssr';

/**
 * Strips persistence from a Supabase auth cookie so it behaves as a true
 * browser *session* cookie — cleared when the browser itself closes, not
 * just when the tab does.
 *
 * By default @supabase/ssr sets `maxAge`/`expires` on these cookies (tracking
 * the refresh token's own long lifetime), so closing and reopening the
 * browser — or a laptop sleep/restart that doesn't kill the browser process —
 * silently signs the user back in with no prompt. Dropping those two fields
 * is the whole fix: the cookie still works for as long as the browser stays
 * open (reloads, new tabs, navigation), it just doesn't survive the browser
 * actually closing.
 */
export function asSessionCookie(options: CookieOptions): CookieOptions {
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest;
}
