'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client. Uses the anon key, so every query it makes is filtered by RLS.
 * There is deliberately no way to reach the service role from here.
 *
 * Deliberately untyped against lib/types/database.ts: the Database generic
 * fights Supabase's join/embed inference across this codebase's many `select`
 * calls and collapses results to `never`. Every call site already casts its
 * result to the specific shape it expects, so this loses nothing at runtime —
 * only an extra layer of compile-time checking that was actively wrong.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
