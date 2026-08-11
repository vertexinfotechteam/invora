import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Request-scoped client for Server Components, Server Actions and route
 * handlers. Still the anon key — RLS applies. Use this for anything acting
 * *as the signed-in user*.
 *
 * Deliberately untyped against lib/types/database.ts — see the comment in
 * lib/supabase/client.ts for why.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies are
            // read-only. The middleware refresh path handles the write.
          }
        },
      },
    },
  );
}
