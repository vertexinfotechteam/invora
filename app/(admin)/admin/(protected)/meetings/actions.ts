'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/guards/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { cancelMeetEvent } from '@/lib/google/calendar';

const windowSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time'),
});

/** Regex-validated by windowSchema before this is ever called, so the split
 * always yields exactly two numeric parts. */
function toMinutes(hhmm: string): number {
  const parts = hhmm.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

export async function addAvailabilityWindowAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = windowSchema.safeParse({
    weekday: formData.get('weekday'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
  });

  if (parsed.success) {
    const startMinute = toMinutes(parsed.data.startTime);
    const endMinute = toMinutes(parsed.data.endTime);

    if (endMinute > startMinute) {
      const admin = createSupabaseAdminClient();
      await admin.from('demo_availability_windows').insert({
        weekday: parsed.data.weekday,
        start_minute: startMinute,
        end_minute: endMinute,
      });
    }
  }

  revalidatePath('/admin/meetings');
}

export async function removeAvailabilityWindowAction(windowId: string): Promise<void> {
  await requireAdmin();

  const admin = createSupabaseAdminClient();
  await admin.from('demo_availability_windows').delete().eq('id', windowId);

  revalidatePath('/admin/meetings');
}

export async function cancelBookingAction(bookingId: string): Promise<void> {
  await requireAdmin();

  const admin = createSupabaseAdminClient();
  const { data: booking } = await admin
    .from('demo_bookings')
    .select('google_event_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (booking?.google_event_id) {
    await cancelMeetEvent(booking.google_event_id);
  }

  await admin.from('demo_bookings').update({ status: 'cancelled' }).eq('id', bookingId);

  revalidatePath('/admin/meetings');
}
