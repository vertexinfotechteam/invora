import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * SERVICE ROLE CLIENT — bypasses RLS entirely.
 *
 * Legitimate callers, and only these:
 *   • /api/webhooks/*   — acting on a signature-verified provider event
 *   • /api/cron/*       — acting on behalf of the whole platform
 *   • /api/admin/*      — after requireAdmin() has already passed
 *   • /q/[token], /i/[token] — public document views, which have no session
 *     and must therefore scope by the share token instead of by RLS
 *
 * Anywhere else, use createSupabaseServerClient() so RLS does the scoping.
 *
 * Deliberately untyped against lib/types/database.ts — see the comment in
 * lib/supabase/client.ts for why.
 */
let cached: SupabaseClient | null = null;

export function createSupabaseAdminClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-invora-client': 'service-role' } },
  });
  return cached;
}
