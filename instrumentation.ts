/**
 * Sentry initialisation.
 *
 * Guarded on the DSN so a fresh clone with an empty .env.local boots cleanly
 * instead of failing at startup on a monitoring dependency.
 */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import('@sentry/nextjs');

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    // Financial documents pass through these requests; never ship their bodies.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.data) delete event.request.data;
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
}

export async function onRequestError(
  ...args: Parameters<NonNullable<typeof import('@sentry/nextjs')['captureRequestError']>>
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
}
