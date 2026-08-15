/**
 * The canonical public origin for this deployment, without a trailing slash.
 *
 * Used for anything that has to name the site from the server: verification and
 * password-reset links, share links, receipt emails, the Google OAuth redirect
 * URI, canonical/OG metadata, robots.txt and the sitemap.
 *
 * Resolution order, and why:
 *
 * 1. `NEXT_PUBLIC_APP_URL` — the operator's explicit answer, always wins.
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` — the project's stable production domain.
 * 3. `VERCEL_URL` — this specific deployment's URL; correct on previews, and it
 *    changes every deploy, so it is only a fallback for the stable domain.
 * 4. localhost, for `npm run dev` with an empty .env.local.
 *
 * The `Host` header is deliberately *not* consulted. It is caller-controlled, so
 * trusting it would let an attacker request a password reset for someone else's
 * address and have the emailed link point at a host they own. Both `VERCEL_*`
 * variables are injected by the platform rather than the request, so they carry
 * no such risk.
 *
 * This never throws. It previously did when nothing was configured, which took
 * down sign-up, password reset and the Google Calendar connect flow entirely
 * rather than merely making their links point somewhere unhelpful.
 */
function normalize(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function appUrl(): string {
  const configured = normalize(process.env.NEXT_PUBLIC_APP_URL ?? '');
  if (configured) return configured;

  const production = normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '');
  if (production) return production;

  const deployment = normalize(process.env.VERCEL_URL ?? '');
  if (deployment) return deployment;

  return 'http://localhost:3000';
}

/**
 * True when the origin had to fall back to localhost — i.e. neither
 * `NEXT_PUBLIC_APP_URL` nor the Vercel-provided domains were available. Callers
 * that email a link to a third party use this to skip sending something the
 * recipient could never open.
 */
export function appUrlIsPlaceholder(): boolean {
  return appUrl() === 'http://localhost:3000' && process.env.NODE_ENV === 'production';
}
