/**
 * Browser-side Sentry initialisation.
 *
 * Without this file the SDK is never initialised in the browser, so the
 * `Sentry.captureException(error)` in app/error.tsx silently did nothing while
 * the page told the user "The error has been reported automatically." Client
 * exceptions — which is most of what a user actually sees — reached no one.
 *
 * Guarded on the DSN, like instrumentation.ts, so a clone with an empty
 * .env.local boots cleanly rather than failing on a monitoring dependency.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    // Financial documents are on screen when these fire; never ship their contents.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.data) delete event.request.data;
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
}
