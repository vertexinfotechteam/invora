import { NextResponse, type NextRequest } from 'next/server';

import { badRequest, conflict, withApiErrors } from '@/lib/guards/errors';
import { clientIp, enforceRateLimit } from '@/lib/guards/rate-limit';
import { fieldErrors } from '@/lib/validation/common';
import { bookDemoSchema } from '@/lib/validation/schemas';
import { checkEmailDeliverable } from '@/lib/validation/email-address';
import { computeAvailableSlots, SLOT_MINUTES } from '@/lib/meetings/availability';
import { createMeetEvent, isCalendarConnected } from '@/lib/google/calendar';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { demoBookingAdminNotificationEmail, demoBookingEmail } from '@/lib/email/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/meetings/book — public, unauthenticated.
 *
 * The requested slot is re-verified against computeAvailableSlots just
 * before booking, not trusted from the client — the availability list a
 * visitor fetched moments earlier could already be stale if someone else
 * booked the same slot in between.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  await enforceRateLimit('contact', `meetings-book:${clientIp(request)}`);

  const parsed = bookDemoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw badRequest('Check the form.', fieldErrors(parsed.error));
  const input = parsed.data;

  // Honeypot — report success without doing anything, so a bot gets no signal.
  if (input.company_website) {
    return NextResponse.json({ ok: true });
  }

  // The whole point of the booking is the invite and the Meet link that follow
  // it — hold a slot for an address that cannot receive either and the slot is
  // simply lost.
  const deliverable = await checkEmailDeliverable(input.email);
  if (!deliverable.ok) {
    throw badRequest('Check the form.', { email: deliverable.reason });
  }

  const startMs = Date.parse(input.startIso);
  if (!Number.isFinite(startMs)) throw badRequest('Choose a time slot.');
  const dateIso = new Date(startMs + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10); // IST calendar date

  const openSlots = await computeAvailableSlots(dateIso);
  const stillOpen = openSlots.some((slot) => slot.startIso === input.startIso);
  if (!stillOpen) {
    throw conflict('That slot was just taken. Please pick another time.');
  }

  const endIso = new Date(startMs + SLOT_MINUTES * 60_000).toISOString();

  // A disconnected calendar no longer refuses the booking. The slot is still
  // held in demo_bookings and the team is still notified by email below —
  // turning a visitor away because *our* integration is down loses the lead
  // for a reason that has nothing to do with them. The Meet link is simply
  // created later, by hand, when there is no calendar to create it now.
  const { connected } = await isCalendarConnected();

  const meeting = connected
    ? await createMeetEvent({
        summary: `Invora demo — ${input.name}${input.company ? ` (${input.company})` : ''}`,
        description: input.notes || 'Booked via the Invora website.',
        startIso: input.startIso,
        endIso,
        attendeeEmail: input.email,
        attendeeName: input.name,
      })
    : null;

  const admin = createSupabaseAdminClient();
  await admin.from('demo_bookings').insert({
    visitor_name: input.name,
    visitor_email: input.email,
    company: input.company ?? null,
    notes: input.notes ?? null,
    starts_at: input.startIso,
    ends_at: endIso,
    google_event_id: meeting?.eventId || null,
    meet_link: meeting?.meetLink ?? null,
    status: 'confirmed',
  });

  const whenFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(startMs));

  const mail = demoBookingEmail({ name: input.name, whenFormatted });
  const adminMail = demoBookingAdminNotificationEmail({
    visitorName: input.name,
    visitorEmail: input.email,
    company: input.company ?? null,
    notes: input.notes ?? null,
    whenFormatted,
  });

  // Sent one after the other, not in parallel. Every SMTP provider throttles
  // bursts — Mailtrap's free tier rejects the second of two simultaneous sends
  // outright ("550 Too many emails per second"), and Gmail is only more
  // forgiving, not immune. In parallel that failure is silent and arbitrary:
  // whichever loses the race is dropped, so either the visitor gets no
  // confirmation or nobody is told a demo was booked. Sequential costs about a
  // second on a request that already took several.
  //
  // sendEmail never throws — it records the outcome in email_log and returns
  // {sent:false}. So the second send always runs even if the first failed, and
  // a mail problem never fails a booking that is already confirmed in the
  // database.
  await sendEmail({
    to: input.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    template: 'demo_booking_confirmation',
  });

  await sendEmail({
    to: process.env.CONTACT_EMAIL || 'support@invora.app',
    subject: adminMail.subject,
    html: adminMail.html,
    text: adminMail.text,
    replyTo: input.email,
    template: 'demo_booking_admin_notification',
  });

  // The client words its confirmation differently when no invite went out, so
  // it never promises a calendar invite that was never created.
  return NextResponse.json({ ok: true, whenFormatted, inviteSent: Boolean(meeting) });
});
