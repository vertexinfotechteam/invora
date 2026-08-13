import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getBusyIntervals } from '@/lib/google/calendar';

/**
 * Computes open 30-minute demo-call slots for a given IST calendar date.
 *
 * The day is open around the clock. A slot is offered unless it (a) overlaps
 * an existing confirmed demo_bookings row, (b) overlaps a busy block on the
 * connected Google Calendar (catching events booked directly in Google,
 * outside Invora entirely), or (c) starts less than MIN_NOTICE_MINUTES from
 * now — the confirmation promises the Meet link two hours ahead of the call,
 * so a slot that starts sooner than that cannot keep the promise.
 *
 * Neither a connected calendar nor a configured weekly window is required to
 * *offer* a slot. Both were previously hard prerequisites, which meant every
 * date in the picker read "No open slots that day" whenever the calendar was
 * disconnected. A booking that lands without a calendar still reaches the team
 * by email, which is what the admin notification is for.
 */

const SLOT_MINUTES = 30;
const MIN_NOTICE_MINUTES = 120;
const MINUTES_IN_DAY = 1440;

export interface Slot {
  startIso: string;
  endIso: string;
}

/** Converts "this many minutes into `dateIso`, read as an IST calendar day" to a UTC instant. */
function istMinuteToUtc(dateIso: string, minute: number): number {
  return Date.parse(`${dateIso}T00:00:00+05:30`) + minute * 60_000;
}

export async function computeAvailableSlots(dateIso: string): Promise<Slot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return [];

  const admin = createSupabaseAdminClient();

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

  for (let minute = 0; minute + SLOT_MINUTES <= MINUTES_IN_DAY; minute += SLOT_MINUTES) {
    const startMs = istMinuteToUtc(dateIso, minute);
    const endMs = startMs + SLOT_MINUTES * 60_000;
    if (startMs < earliestStartMs) continue;
    if (blocked.some((busySlot) => startMs < busySlot.end && endMs > busySlot.start)) continue;
    slots.push({ startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() });
  }

  return slots;
}

export { SLOT_MINUTES };
