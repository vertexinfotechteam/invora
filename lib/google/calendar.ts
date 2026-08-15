import 'server-only';

import { google } from 'googleapis';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/app-url';

/**
 * SERVER ONLY. Google Calendar access for the "book a demo" feature.
 *
 * This reuses the SAME OAuth client (Client ID/Secret) as "Sign in with
 * Google" — but it is a *separate* OAuth flow from Supabase Auth, because
 * Supabase Auth's own session doesn't durably persist a third-party
 * provider's refresh token across logins the way this needs (a token that
 * outlives any admin's login session, since bookings must keep working
 * whether or not the connecting admin is currently signed in). The refresh
 * token this flow captures is stored once, server-side, in
 * demo_calendar_connection — never sent to the browser.
 */

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // The origin is always resolvable now (lib/app-url.ts falls back to the
  // Vercel-provided domain), so only the two Google credentials can be missing.
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, `${appUrl()}/api/admin/calendar/callback`);
}

/** Step 1 of the connect flow: where /api/admin/calendar/connect redirects to. */
export function buildGoogleAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline', // required to receive a refresh_token
    prompt: 'consent', // required every time, or a re-connect silently reuses the old grant with no new refresh_token
    scope: SCOPES,
    state,
  });
}

/** Step 2: /api/admin/calendar/callback exchanges the code for tokens. */
export async function exchangeGoogleAuthCode(code: string): Promise<{ refreshToken: string; email: string | null }> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Remove Invora from https://myaccount.google.com/permissions and try connecting again.',
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: client, version: 'v2' });
  const { data: profile } = await oauth2.userinfo.get().catch(() => ({ data: { email: null } }));

  return { refreshToken: tokens.refresh_token, email: profile.email ?? null };
}

const DEMO_CONNECTION_ID = '00000000-0000-0000-0000-000000000001';

async function getAuthorizedClient() {
  const admin = createSupabaseAdminClient();
  const { data: connection } = await admin
    .from('demo_calendar_connection')
    .select('google_refresh_token')
    .eq('id', DEMO_CONNECTION_ID)
    .maybeSingle();

  if (!connection) return null;

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: connection.google_refresh_token });
  return client;
}

export interface BusyInterval {
  start: string;
  end: string;
}

/** Busy blocks already on the connected calendar — bookings must avoid these
 * in addition to avoiding other confirmed demo_bookings rows. */
export async function getBusyIntervals(timeMinIso: string, timeMaxIso: string): Promise<BusyInterval[]> {
  const client = await getAuthorizedClient();
  if (!client) return [];

  const calendar = google.calendar({ version: 'v3', auth: client });
  const { data } = await calendar.freebusy.query({
    requestBody: { timeMin: timeMinIso, timeMax: timeMaxIso, items: [{ id: 'primary' }] },
  });

  const busy = data.calendars?.primary?.busy ?? [];
  return busy
    .filter((slot): slot is { start: string; end: string } => Boolean(slot.start && slot.end))
    .map((slot) => ({ start: slot.start, end: slot.end }));
}

export interface CreatedMeeting {
  eventId: string;
  meetLink: string | null;
}

/** Creates the calendar event with an auto-generated Meet link and emails
 * both the connected calendar's owner and the visitor via Google's own
 * invite (`sendUpdates: 'all'`) — on top of, not instead of, our own
 * branded confirmation email sent separately. */
export async function createMeetEvent(input: {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  attendeeEmail: string;
  attendeeName: string;
}): Promise<CreatedMeeting> {
  const client = await getAuthorizedClient();
  if (!client) throw new Error('No Google Calendar is connected.');

  const calendar = google.calendar({ version: 'v3', auth: client });
  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    sendUpdates: 'all',
    conferenceDataVersion: 1,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startIso },
      end: { dateTime: input.endIso },
      attendees: [{ email: input.attendeeEmail, displayName: input.attendeeName }],
      conferenceData: {
        createRequest: {
          requestId: `invora-demo-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  return {
    eventId: data.id ?? '',
    meetLink: data.hangoutLink ?? data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri ?? null,
  };
}

export async function cancelMeetEvent(eventId: string): Promise<void> {
  const client = await getAuthorizedClient();
  if (!client) return;

  const calendar = google.calendar({ version: 'v3', auth: client });
  await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'all' }).catch((error) => {
    // The event may already be gone (deleted directly in Google Calendar) —
    // that's the same end state as a successful cancellation, not a failure.
    console.error('[invora:calendar] event delete failed (continuing)', error);
  });
}

export async function isCalendarConnected(): Promise<{ connected: boolean; email: string | null }> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('demo_calendar_connection')
    .select('google_email')
    .eq('id', DEMO_CONNECTION_ID)
    .maybeSingle();

  return { connected: Boolean(data), email: data?.google_email ?? null };
}

export { DEMO_CONNECTION_ID };
