import type { Metadata } from 'next';
import { CalendarCheck, CalendarX, Trash2, Video } from 'lucide-react';

import { requireAdmin } from '@/lib/guards/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isCalendarConnected } from '@/lib/google/calendar';
import { formatDateTime } from '@/lib/utils';
import { addAvailabilityWindowAction, cancelBookingAction, removeAvailabilityWindowAction } from './actions';

export const metadata: Metadata = { title: 'Demo meetings' };
export const dynamic = 'force-dynamic';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function minutesToLabel(minute: number): string {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(mins).padStart(2, '0')} ${period}`;
}

export default async function AdminMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar_connected?: string; calendar_error?: string }>;
}) {
  await requireAdmin();
  const { calendar_connected, calendar_error } = await searchParams;

  const admin = createSupabaseAdminClient();
  const [{ connected, email }, { data: windows }, { data: bookings }] = await Promise.all([
    isCalendarConnected(),
    admin
      .from('demo_availability_windows')
      .select('id, weekday, start_minute, end_minute')
      .order('weekday')
      .order('start_minute'),
    admin
      .from('demo_bookings')
      .select('id, visitor_name, visitor_email, company, starts_at, meet_link, status')
      .eq('status', 'confirmed')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(50),
  ]);

  const windowsByDay = new Map<number, { id: string; start_minute: number; end_minute: number }[]>();
  for (const window of windows ?? []) {
    const list = windowsByDay.get(window.weekday) ?? [];
    list.push(window);
    windowsByDay.set(window.weekday, list);
  }

  console.log('[DEBUG] admin/meetings about to render');
  return (
    <div className="space-y-6">
      <p>DEBUG STATIC TEST OK</p>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Demo meetings</h1>
        <p className="text-sm text-muted-foreground">
          The calendar behind /book-demo on the marketing site — weekly availability, Google
          Calendar connection, and upcoming bookings.
        </p>
      </div>

      {calendar_connected ? (
        <div className="card-surface flex items-center gap-3 border-success/30 bg-success/[0.04] p-4 text-sm">
          <CalendarCheck className="h-5 w-5 text-success" />
          Google Calendar connected.
        </div>
      ) : null}
      {calendar_error ? (
        <div className="card-surface flex items-center gap-3 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <CalendarX className="h-5 w-5" />
          Could not connect Google Calendar ({calendar_error}). Try again.
        </div>
      ) : null}

      <section className="card-surface p-5">
        <h2 className="text-sm font-semibold">Google Calendar connection</h2>
        {connected ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Connected as <span className="font-medium text-foreground">{email ?? 'unknown account'}</span>.
              Bookings create events with a Meet link on this calendar.
            </p>
            <form action="/api/admin/calendar/disconnect" method="post">
              <button
                type="submit"
                className="rounded-lg border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5"
              >
                Disconnect
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              No calendar connected — /book-demo shows no available slots until this is set up.
            </p>
            <a
              href="/api/admin/calendar/connect"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Connect Google Calendar
            </a>
          </div>
        )}
      </section>

      <section className="card-surface p-5">
        <h2 className="text-sm font-semibold">Weekly availability (IST)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Not currently applied — /book-demo offers every 30-minute slot, around the clock, minus
          anything already booked or busy on the connected calendar. These windows are kept for
          when hours are reintroduced.
        </p>
        <div className="mt-4 space-y-4">
          {WEEKDAYS.map((label, weekday) => (
            <div key={weekday} className="flex flex-wrap items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
              <p className="w-24 shrink-0 pt-1.5 text-sm font-medium">{label}</p>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {(windowsByDay.get(weekday) ?? []).map((window) => (
                  <span
                    key={window.id}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
                  >
                    {minutesToLabel(window.start_minute)} – {minutesToLabel(window.end_minute)}
                    <form action={removeAvailabilityWindowAction.bind(null, window.id)}>
                      <button type="submit" aria-label="Remove window" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </form>
                  </span>
                ))}

                <form action={addAvailabilityWindowAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="weekday" value={weekday} />
                  <input
                    type="time"
                    name="startTime"
                    required
                    defaultValue="09:00"
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="time"
                    name="endTime"
                    required
                    defaultValue="17:00"
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    + Add
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Upcoming bookings</h2>
        {bookings?.length ? (
          <ul className="divide-y divide-border">
            {bookings.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {booking.visitor_name}
                    {booking.company ? ` · ${booking.company}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {booking.visitor_email} · {formatDateTime(booking.starts_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {booking.meet_link ? (
                    <a
                      href={booking.meet_link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Meet
                    </a>
                  ) : null}
                  <form action={cancelBookingAction.bind(null, booking.id)}>
                    <button type="submit" className="text-xs text-muted-foreground hover:text-destructive">
                      Cancel
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No upcoming bookings.</p>
        )}
      </section>
    </div>
  );
}
