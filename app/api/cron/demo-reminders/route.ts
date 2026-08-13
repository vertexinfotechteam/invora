import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/guards/cron';
import { withApiErrors } from '@/lib/guards/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { demoReminderEmail } from '@/lib/email/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REMINDER_LEAD_MINUTES = 120;
// Half the cron's own run interval either side of the 2-hour mark, so every
// booking is caught by exactly one run regardless of exactly when in its
// 15-minute window the cron fires — see vercel.json ("*/15 * * * *").
const WINDOW_MINUTES = 15;

/**
 * GET /api/cron/demo-reminders — every 15 minutes.
 *
 * The Meet link is deliberately withheld from the immediate booking
 * confirmation (lib/email/templates.ts demoBookingEmail) and only sent here,
 * close to the meeting — this is that send.
 */
export const GET = withApiErrors(async (request: NextRequest) => {
  requireCronAuth(request);

  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const windowStart = new Date(now + (REMINDER_LEAD_MINUTES - WINDOW_MINUTES) * 60_000).toISOString();
  const windowEnd = new Date(now + (REMINDER_LEAD_MINUTES + WINDOW_MINUTES) * 60_000).toISOString();

  const { data: due } = await admin
    .from('demo_bookings')
    .select('id, visitor_name, visitor_email, starts_at, meet_link')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('starts_at', windowStart)
    .lte('starts_at', windowEnd);

  const bookings = due ?? [];
  let sent = 0;

  for (const booking of bookings) {
    if (!booking.meet_link) continue; // nothing to send if the calendar event never got a link

    const whenFormatted = new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(booking.starts_at));

    const mail = demoReminderEmail({
      name: booking.visitor_name,
      whenFormatted: `${whenFormatted} IST`,
      meetLink: booking.meet_link,
    });

    const result = await sendEmail({
      to: booking.visitor_email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      template: 'demo_booking_reminder',
    });

    // Marked sent even if the provider isn't configured (sendEmail logs it
    // as 'skipped' in that case) — retrying every 15 minutes for the rest of
    // the window would just resend the same already-accounted-for email.
    if (result.sent || result.error === 'email_not_configured') {
      await admin.from('demo_bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', booking.id);
      sent += 1;
    }
  }

  return NextResponse.json({ checked: bookings.length, sent });
});
