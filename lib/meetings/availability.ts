import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getBusyIntervals, isCalendarConnected } from '@/lib/google/calendar';

/**
 * Computes open 30-minute demo-call slots for a given IST calendar date.
 *
 * A slot is open when it (a) falls inside a configured weekly availability
 * window, (b) doesn't overlap an existing confirmed demo_bookings row, (c)
 * doesn't overlap a busy block on the connected Google Calendar (catching
 * events booked directly in Google, outside Invora entirely), and (d) is at
 * least MIN_NOTICE_MINUTES from now — nobody should be able to book a slot
 * that starts in the next five minutes.
 */

const SLOT_MINUTES = 30;
const MIN_NOTICE_MINUTES = 120;

export interface Slot {
  startIso: string;
  endIso: string;
}

/** Day-of-week for a plain "YYYY-MM-DD" calendar date — deliberately anchored
 * at noon UTC so the ±5:30 IST offset can never push it across a day
 * boundary; a calendar date's weekday isn't timezone-dependent in the first
 * place, this just keeps the arithmetic safe. */
function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00Z`).getUTCDay();
}

/** Converts "this many minutes into `dateIso`, read as an IST calendar day" to a UTC instant. */
function istMinuteToUtc(dateIso: string, minute: number): number {
  return Date.parse(`${dateIso}T00:00:00+05:30`) + minute * 60_000;
}

export async function computeAvailableSlots(dateIso: string): Promise<Slot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return [];

  // No connected calendar means no slot could actually be booked — showing
  // "open" slots that would 409 on submit is worse than showing none.
  const { connected } = await isCalendarConnected();
  if (!connected) return [];

  const admin = createSupabaseAdminClient();
  const weekday = weekdayOf(dateIso);

  const { data: windows } = await admin
    .from('demo_availability_windows')
    .select('start_minute, end_minute')
    .eq('weekday', weekday);

  if (!windows || windows.length === 0) return [];

  const dayStartMs = istMinuteToUtc(dateIso, 0);
  const dayEndMs = istMinuteToUtc(dateIso, 1440);
  const dayStartIso = new Date(dayStartMs).toISOString();
  const dayEndIso = new Date(dayEndMs).toISOString();

  const [{ data: bookings }, busy] = await Promise.all([
    admin
      .from('demo_bookings')
      .select('starts_at, ends_at')
      .eq('status', 'confirmed')
      .lt('starts_at', dayEndIso)
      .gt('ends_at', dayStartIso),
    getBusyIntervals(dayStartIso, dayEndIso),
  ]);

  const blocked = [
    ...(bookings ?? []).map((row) => ({ start: row.starts_at, end: row.ends_at })),
    ...busy,
  ].map((row) => ({ start: Date.parse(row.start), end: Date.parse(row.end) }));

  const earliestStartMs = Date.now() + MIN_NOTICE_MINUTES * 60_000;
  const slots: Slot[] = [];

  for (const window of windows) {
    for (let minute = window.start_minute; minute + SLOT_MINUTES <= window.end_minute; minute += SLOT_MINUTES) {
      const startMs = istMinuteToUtc(dateIso, minute);
      const endMs = startMs + SLOT_MINUTES * 60_000;
      if (startMs < earliestStartMs) continue;
      if (blocked.some((busySlot) => startMs < busySlot.end && endMs > busySlot.start)) continue;
      slots.push({ startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() });
    }
  }

  return slots;
}

export { SLOT_MINUTES };
