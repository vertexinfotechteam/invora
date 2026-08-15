'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { FLASH_COOKIE, type FlashPayload } from '@/lib/flash-shared';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

/**
 * Mounted once in the root layout, alongside <Toaster/>. Reads a one-shot
 * toast queued server-side by lib/flash.ts right before a redirect — see
 * that file for why a toast can't just be fired from the component that
 * triggered the action.
 *
 * Keyed on `pathname`: the root layout persists across client-side
 * navigations in the App Router (it does not remount), so an effect with an
 * empty dependency array would only ever run once per full page load, not
 * once per redirect. Re-running when the path changes is what makes this
 * fire after every navigation that actually set the cookie, and do nothing
 * on the ones that didn't.
 */
export function FlashToast() {
  const pathname = usePathname();

  React.useEffect(() => {
    const raw = readCookie(FLASH_COOKIE);
    if (!raw) return;
    clearCookie(FLASH_COOKIE);

    try {
      const payload = JSON.parse(raw) as FlashPayload;
      toast[payload.kind](payload.message);
    } catch {
      // Malformed cookie — nothing worth showing, and definitely not a crash.
    }
  }, [pathname]);

  return null;
}
