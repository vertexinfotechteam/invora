/**
 * Constants shared between lib/flash.ts (server-only) and
 * components/flash-toast.tsx (client). Kept in their own file, with no
 * `server-only` import, so the client component can import the cookie name
 * and payload shape without pulling in server code.
 */
export const FLASH_COOKIE = 'invora_flash';

export type FlashKind = 'success' | 'error' | 'warning' | 'info';

export interface FlashPayload {
  kind: FlashKind;
  message: string;
}
