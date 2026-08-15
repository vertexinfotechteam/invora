'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Globe, Loader2, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Reveal } from '@/components/marketing/reveal';

interface Slot {
  startIso: string;
  endIso: string;
}

const MONTHS_AHEAD = 6;

/** IT-hub countries — value is the IANA zone actually used for formatting;
 * label is what a visitor recognizes. Availability itself is always defined
 * in IST server-side; this only changes how times are *displayed*. */
const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India — IST' },
  { value: 'America/New_York', label: 'USA — Eastern (New York)' },
  { value: 'America/Chicago', label: 'USA — Central (Chicago)' },
  { value: 'America/Denver', label: 'USA — Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'USA — Pacific (San Francisco)' },
  { value: 'Europe/Berlin', label: 'Germany — Berlin' },
  { value: 'America/Toronto', label: 'Canada — Toronto' },
  { value: 'America/Vancouver', label: 'Canada — Vancouver' },
  { value: 'Pacific/Auckland', label: 'New Zealand — Auckland' },
  { value: 'Europe/London', label: 'United Kingdom — London' },
  { value: 'Europe/Dublin', label: 'Ireland — Dublin' },
  { value: 'Australia/Sydney', label: 'Australia — Sydney' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Dubai', label: 'UAE — Dubai' },
  { value: 'Asia/Tokyo', label: 'Japan — Tokyo' },
  { value: 'Europe/Amsterdam', label: 'Netherlands — Amsterdam' },
];

function detectDefaultTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONES.some((tz) => tz.value === detected) ? detected : 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/** Today, as an IST calendar date — the same anchor lib/meetings/availability.ts uses. */
function todayIstIso(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> [year, month (1-indexed), day] — all three groups are
 * guaranteed by the regex-shaped callers, so this is a parse, not a guess. */
function parseIso(iso: string): [number, number, number] {
  const parts = iso.split('-');
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

function addMonthsIso(iso: string, months: number): string {
  const [year, month, day] = parseIso(iso);
  const d = new Date(Date.UTC(year, month - 1 + months, day));
  return d.toISOString().slice(0, 10);
}

function formatSlotTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));
}

function localHour(iso: string, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(
    new Date(iso),
  );
  return Number(formatted);
}

const DAY_PERIODS = [
  { label: 'Morning', from: 5, to: 12 },
  { label: 'Afternoon', from: 12, to: 17 },
  { label: 'Evening', from: 17, to: 21 },
  { label: 'Night', from: 21, to: 5 }, // wraps past midnight
] as const;

/** Groups a full day's slots (now up to 48 of them, 24h at 30-min steps)
 * into Morning/Afternoon/Evening/Night by *local* hour in the visitor's
 * chosen timezone — scanning 48 flat buttons for the right time is exactly
 * the "where's my slot" problem this avoids. */
function groupSlotsByPeriod(slots: Slot[], timeZone: string): { label: string; slots: Slot[] }[] {
  return DAY_PERIODS.map((period) => ({
    label: period.label,
    slots: slots.filter((slot) => {
      const hour = localHour(slot.startIso, timeZone);
      return period.from < period.to ? hour >= period.from && hour < period.to : hour >= period.from || hour < period.to;
    }),
  })).filter((group) => group.slots.length > 0);
}

interface CalendarDay {
  iso: string;
  day: number;
  disabled: boolean;
}

/** A single month grid, IST-anchored (see the note this renders to the
 * visitor) — 6 months out from today, nothing before today selectable. */
function buildMonthGrid(year: number, month: number, minIso: string, maxIso: string): (CalendarDay | null)[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay();

  const cells: (CalendarDay | null)[] = Array.from({ length: leadingBlanks }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    cells.push({ iso, day, disabled: iso < minIso || iso > maxIso });
  }

  return cells;
}

export function BookDemoFlow() {
  const minIso = React.useMemo(todayIstIso, []);
  const maxIso = React.useMemo(() => addMonthsIso(minIso, MONTHS_AHEAD), [minIso]);

  const [viewIso, setViewIso] = React.useState(minIso);
  const [selectedDate, setSelectedDate] = React.useState(minIso);
  const [timezone, setTimezone] = React.useState(detectDefaultTimezone);

  const [slots, setSlots] = React.useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(true);
  const [selectedSlot, setSelectedSlot] = React.useState<Slot | null>(null);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState<{ whenFormatted: string; inviteSent: boolean } | null>(null);
  const honeypotRef = React.useRef<HTMLInputElement>(null);

  const slotGroups = React.useMemo(() => groupSlotsByPeriod(slots ?? [], timezone), [slots, timezone]);

  const [viewYear, viewMonth] = parseIso(viewIso);
  const grid = React.useMemo(
    () => buildMonthGrid(viewYear, viewMonth - 1, minIso, maxIso),
    [viewYear, viewMonth, minIso, maxIso],
  );
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${viewIso}T00:00:00Z`),
  );
  const canGoPrev = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01` > minIso.slice(0, 7).concat('-01');
  const canGoNext = addMonthsIso(`${viewYear}-${String(viewMonth).padStart(2, '0')}-01`, 1) <= maxIso;

  React.useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);

    fetch(`/api/meetings/availability?date=${selectedDate}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setSlots(payload.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/meetings/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company: company || undefined,
          notes: notes || undefined,
          startIso: selectedSlot.startIso,
          company_website: honeypotRef.current?.value || undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'Could not book that slot.');
        return;
      }

      setConfirmed({ whenFormatted: payload.whenFormatted, inviteSent: Boolean(payload.inviteSent) });
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <Reveal variant="scale" className="card-surface space-y-3 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h2 className="text-lg font-semibold">You&apos;re booked</h2>
        <p className="text-sm text-muted-foreground">
          {confirmed.whenFormatted} on Google Meet.{' '}
          {confirmed.inviteSent
            ? `A calendar invite is on its way to ${email}.`
            : `We've got your request and emailed the team — we'll confirm at ${email}.`}
        </p>
        <p className="mx-auto flex max-w-xs items-start gap-2 rounded-lg bg-accent p-3 text-left text-xs text-accent-foreground">
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          We&apos;ll email the Google Meet link about 2 hours before the meeting starts — no need to
          hunt for it now.
        </p>
      </Reveal>
    );
  }

  return (
    <Reveal className="card-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Choose a day
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => canGoPrev && setViewIso(addMonthsIso(viewIso, -1))}
            disabled={!canGoPrev}
            aria-label="Previous month"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-medium">{monthLabel}</p>
          <button
            type="button"
            onClick={() => canGoNext && setViewIso(addMonthsIso(viewIso, 1))}
            disabled={!canGoNext}
            aria-label="Next month"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase text-muted-foreground">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, index) =>
            cell ? (
              <button
                key={cell.iso}
                type="button"
                disabled={cell.disabled}
                onClick={() => setSelectedDate(cell.iso)}
                className={`aspect-square rounded-md text-sm transition-colors ${
                  cell.disabled
                    ? 'cursor-not-allowed text-muted-foreground/30'
                    : cell.iso === selectedDate
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : 'hover:bg-secondary'
                }`}
              >
                {cell.day}
              </button>
            ) : (
              <span key={`blank-${index}`} />
            ),
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Dates shown in India Standard Time</p>
      </div>

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Choose a time ({TIMEZONES.find((tz) => tz.value === timezone)?.label ?? timezone})
        </p>
        {loadingSlots ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking availability…
          </p>
        ) : slotGroups.length > 0 ? (
          <div className="max-h-72 space-y-4 overflow-y-auto rounded-lg border border-border p-3">
            {slotGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {group.slots.map((slot) => (
                    <button
                      key={slot.startIso}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                        selectedSlot?.startIso === slot.startIso
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      {formatSlotTime(slot.startIso, timezone)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No open slots that day. Try another date, or{' '}
            <Link href="/contact?topic=demo" className="text-primary underline-offset-4 hover:underline">
              send us a message
            </Link>{' '}
            and we&apos;ll find a time.
          </p>
        )}
      </div>

      {selectedSlot ? (
        <form onSubmit={submit} className="mt-6 space-y-4 border-t border-border pt-6">
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" htmlFor="demo-name" required>
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Work email" htmlFor="demo-email" required>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
          </div>
          <Field label="Business name" htmlFor="demo-company" hint="Optional">
            <Input value={company} onChange={(event) => setCompany(event.target.value)} />
          </Field>
          <Field label="Anything specific you'd like covered?" htmlFor="demo-notes" hint="Optional">
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>

          {/* Honeypot — hidden from real visitors via CSS, not just off-screen. */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="demo_company_website">Company website</label>
            <input
              ref={honeypotRef}
              id="demo_company_website"
              name="company_website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-accent p-3 text-xs text-accent-foreground">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            We&apos;ll email your Google Meet link about 2 hours before the meeting starts.
          </p>

          <Button type="submit" className="w-full" loading={submitting} disabled={!name || !email}>
            Confirm {formatSlotTime(selectedSlot.startIso, timezone)} on {selectedDate}
          </Button>
        </form>
      ) : null}
    </Reveal>
  );
}
