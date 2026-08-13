/**
 * TEMPORARY exploratory test — exercises the book-a-demo slot maths and the
 * POST /api/meetings/book guard rails with Google Calendar + Supabase mocked,
 * so the flow can be verified while no real calendar is connected.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const google = vi.hoisted(() => ({
  isCalendarConnected: vi.fn(async () => ({ connected: true, email: 'demo@vertex.test' })),
  getBusyIntervals: vi.fn(async () => [] as { start: string; end: string }[]),
  createMeetEvent: vi.fn(async () => ({ eventId: 'evt_1', meetLink: 'https://meet.google.com/abc-defg-hij' })),
}));

const db = vi.hoisted(() => ({
  windows: [] as { start_minute: number; end_minute: number }[],
  bookings: [] as { starts_at: string; ends_at: string }[],
  inserted: [] as Record<string, unknown>[],
}));

const emails = vi.hoisted(() => ({ sent: [] as { to: string; template?: string }[] }));

vi.mock('@/lib/google/calendar', () => ({
  isCalendarConnected: google.isCalendarConnected,
  getBusyIntervals: google.getBusyIntervals,
  createMeetEvent: google.createMeetEvent,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      Object.assign(chain, {
        select: self,
        eq: self,
        lt: self,
        gt: self,
        insert: async (row: Record<string, unknown>) => {
          db.inserted.push({ table, ...row });
          return { error: null };
        },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve({
            data: table === 'demo_availability_windows' ? db.windows : db.bookings,
            error: null,
          }).then(resolve, reject),
      });
      return chain;
    },
  }),
}));

vi.mock('@/lib/guards/rate-limit', () => ({
  enforceRateLimit: vi.fn(async () => undefined),
  clientIp: () => '127.0.0.1',
}));

vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn(async (input: { to: string; template?: string }) => {
    emails.sent.push({ to: input.to, template: input.template });
    return { ok: true };
  }),
}));

import { computeAvailableSlots } from '@/lib/meetings/availability';

const MONDAY = '2027-01-04'; // far enough out that the 2-hour notice rule never bites

function reset() {
  vi.clearAllMocks();
  db.windows = [{ start_minute: 540, end_minute: 720 }]; // 09:00–12:00 IST
  db.bookings = [];
  db.inserted = [];
  emails.sent = [];
  google.isCalendarConnected.mockResolvedValue({ connected: true, email: 'demo@vertex.test' });
  google.getBusyIntervals.mockResolvedValue([]);
}

describe('computeAvailableSlots', () => {
  beforeEach(reset);

  it('returns 30-minute slots across the configured IST window', async () => {
    const slots = await computeAvailableSlots(MONDAY);
    expect(slots).toHaveLength(6);
    // 09:00 IST == 03:30 UTC
    expect(slots[0].startIso).toBe('2027-01-04T03:30:00.000Z');
    expect(slots[0].endIso).toBe('2027-01-04T04:00:00.000Z');
    expect(slots.at(-1)?.startIso).toBe('2027-01-04T06:00:00.000Z'); // 11:30 IST
  });

  it('returns nothing when no calendar is connected', async () => {
    google.isCalendarConnected.mockResolvedValue({ connected: false, email: null });
    expect(await computeAvailableSlots(MONDAY)).toEqual([]);
  });

  it('drops slots that clash with an existing confirmed booking', async () => {
    db.bookings = [{ starts_at: '2027-01-04T04:30:00.000Z', ends_at: '2027-01-04T05:00:00.000Z' }];
    const slots = await computeAvailableSlots(MONDAY);
    expect(slots).toHaveLength(5);
    expect(slots.map((s) => s.startIso)).not.toContain('2027-01-04T04:30:00.000Z');
  });

  it('drops slots that clash with a busy block on the Google calendar', async () => {
    google.getBusyIntervals.mockResolvedValue([
      { start: '2027-01-04T03:45:00.000Z', end: '2027-01-04T04:15:00.000Z' },
    ]);
    const slots = await computeAvailableSlots(MONDAY);
    // Straddles both the 03:30 and 04:00 slots.
    expect(slots.map((s) => s.startIso)).toEqual([
      '2027-01-04T04:30:00.000Z',
      '2027-01-04T05:00:00.000Z',
      '2027-01-04T05:30:00.000Z',
      '2027-01-04T06:00:00.000Z',
    ]);
  });

  it('enforces the 2-hour minimum notice', async () => {
    const nowIst = new Date(Date.now() + 5.5 * 3600_000);
    const today = nowIst.toISOString().slice(0, 10);
    db.windows = [{ start_minute: 0, end_minute: 1440 }]; // 24h, like the seeded default
    const slots = await computeAvailableSlots(today);
    const earliest = Date.now() + 120 * 60_000;
    expect(slots.every((s) => Date.parse(s.startIso) >= earliest)).toBe(true);
  });

  it('rejects a malformed date', async () => {
    expect(await computeAvailableSlots('04-01-2027')).toEqual([]);
  });
});

describe('POST /api/meetings/book', () => {
  beforeEach(reset);

  async function post(body: unknown) {
    const { POST } = await import('@/app/api/meetings/book/route');
    const request = new Request('http://localhost:3000/api/meetings/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);
    return { status: response.status, json: await response.json() };
  }

  const valid = {
    name: 'Asha Patel',
    email: 'asha@example.com',
    company: 'Patel Interiors',
    notes: 'Mostly interested in GST invoices.',
    startIso: '2027-01-04T04:30:00.000Z',
  };

  it('books a free slot: creates the Meet event, stores the row, emails both sides', async () => {
    const { status, json } = await post(valid);

    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.whenFormatted).toContain('Monday');

    expect(google.createMeetEvent).toHaveBeenCalledOnce();
    const event = google.createMeetEvent.mock.calls[0][0] as Record<string, string>;
    expect(event.summary).toBe('Invora demo — Asha Patel (Patel Interiors)');
    expect(event.endIso).toBe('2027-01-04T05:00:00.000Z'); // 30 minutes

    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0]).toMatchObject({
      table: 'demo_bookings',
      visitor_email: 'asha@example.com',
      status: 'confirmed',
      meet_link: 'https://meet.google.com/abc-defg-hij',
    });

    expect(emails.sent.map((e) => e.template)).toEqual([
      'demo_booking_confirmation',
      'demo_booking_admin_notification',
    ]);
    expect(emails.sent[0].to).toBe('asha@example.com');
  });

  it('409s when the slot was taken between fetching availability and submitting', async () => {
    db.bookings = [{ starts_at: '2027-01-04T04:30:00.000Z', ends_at: '2027-01-04T05:00:00.000Z' }];
    const { status, json } = await post(valid);

    expect(status).toBe(409);
    expect(json.error.message).toMatch(/just taken/i);
    expect(google.createMeetEvent).not.toHaveBeenCalled();
    expect(db.inserted).toHaveLength(0);
  });

  it('409s when no calendar is connected', async () => {
    google.isCalendarConnected.mockResolvedValue({ connected: false, email: null });
    const { status, json } = await post(valid);
    expect(status).toBe(409);
    expect(json.error.message).toMatch(/temporarily unavailable/i);
  });

  it('rejects a slot outside the availability window', async () => {
    const { status } = await post({ ...valid, startIso: '2027-01-04T18:00:00.000Z' }); // 23:30 IST
    expect(status).toBe(409);
    expect(db.inserted).toHaveLength(0);
  });

  it('silently absorbs a honeypot submission', async () => {
    const { status, json } = await post({ ...valid, company_website: 'http://spam.tld' });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(google.createMeetEvent).not.toHaveBeenCalled();
    expect(db.inserted).toHaveLength(0);
    expect(emails.sent).toHaveLength(0);
  });

  it('validates the form', async () => {
    const { status, json } = await post({ name: '', email: 'nope', startIso: 'soon' });
    expect(status).toBe(400);
    expect(Object.keys(json.error.details)).toEqual(expect.arrayContaining(['name', 'email', 'startIso']));
  });
});
