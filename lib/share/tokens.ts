import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Public document links.
 *
 * A token is `<random>.<hmac>`:
 *   • `random` is 32 bytes of CSPRNG output — the actual secret.
 *   • `hmac` is an HMAC-SHA256 of that random value under SHARE_LINK_SECRET,
 *     truncated to 16 bytes. It lets us reject a forged or corrupted token in
 *     constant time without touching the database, which keeps /q/[token] from
 *     becoming a database-load amplifier for a scanner.
 *
 * Only the SHA-256 hash of the full token is stored. A database leak therefore
 * does not hand the attacker working links.
 */

const TOKEN_BYTES = 32;
const SIGNATURE_BYTES = 16;

function secret(): string {
  const value = process.env.SHARE_LINK_SECRET;
  if (!value || value.length < 32) {
    throw new Error('SHARE_LINK_SECRET must be set to at least 32 characters (openssl rand -hex 32).');
  }
  return value;
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function sign(random: string): string {
  return base64url(createHmac('sha256', secret()).update(random).digest().subarray(0, SIGNATURE_BYTES));
}

export interface GeneratedToken {
  /** Goes in the URL. Shown to the user once and never stored in plaintext. */
  token: string;
  /** Goes in share_links.token_hash. */
  tokenHash: string;
}

export function generateShareToken(): GeneratedToken {
  const random = base64url(randomBytes(TOKEN_BYTES));
  const token = `${random}.${sign(random)}`;
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cheap structural + signature check. Does not prove the link still exists. */
export function isWellFormedToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [random, signature] = parts;
  if (!random || !signature) return false;
  if (random.length < 40 || signature.length < 16) return false;

  try {
    const expected = Buffer.from(sign(random));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function buildShareUrl(docType: 'quotation' | 'invoice', token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const prefix = docType === 'quotation' ? 'q' : 'i';
  return `${base.replace(/\/$/, '')}/${prefix}/${token}`;
}
