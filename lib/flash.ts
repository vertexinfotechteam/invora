import 'server-only';

import { cookies } from 'next/headers';
import { FLASH_COOKIE, type FlashKind } from '@/lib/flash-shared';

/**
 * Queues a toast to show on whichever page the browser lands on next.
 *
 * Most mutations in this app end in `redirect()` — save a customer, sign in,
 * sign out, convert a quotation. `redirect()` throws a special value that
 * unmounts the calling component immediately, so there is never a resolved
 * "success" state left for a client component to react to; a toast fired
 * from the component that called the action would never run.
 *
 * The fix is a one-shot cookie: set it here, immediately before `redirect()`,
 * and <FlashToast/> (mounted once in the root layout) reads and clears it on
 * the very next page it renders. 15 seconds covers any redirect chain; it's
 * read-once-and-cleared regardless; and no page anyone lands on shows a stale
 * toast because the cookie is simply gone by the following navigation.
 */
export async function setFlashToast(kind: FlashKind, message: string): Promise<void> {
  const store = await cookies();
  store.set(FLASH_COOKIE, JSON.stringify({ kind, message }), {
    maxAge: 15,
    path: '/',
    sameSite: 'lax',
  });
}
