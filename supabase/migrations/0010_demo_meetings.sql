-- =============================================================================
-- Invora 0010 — demo-booking calendar
--
-- This is Vertex Infotech's OWN "book a demo" calendar on the marketing site
-- (invora.app/book-demo), not a per-customer feature — so unlike every other
-- table in this schema, nothing here is scoped by business_id. There is
-- exactly one calendar connection and one set of weekly availability
-- windows, both managed from the admin portal (/admin/meetings).
-- =============================================================================

-- A singleton in practice — enforced by application logic (the connect flow
-- always upserts onto this fixed id) rather than a table-level constraint,
-- since Postgres has no clean native "at most one row" check.
create table public.demo_calendar_connection (
  id                    uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  google_refresh_token  text not null,
  google_email          text,
  connected_by          uuid references auth.users(id) on delete set null,
  connected_at          timestamptz not null default now()
);

-- Weekly recurring availability, in IST — minute-of-day so "9:00 AM" survives
-- DST-less India without any timezone-math surprises. weekday: 0 = Sunday.
create table public.demo_availability_windows (
  id            uuid primary key default gen_random_uuid(),
  weekday       smallint not null check (weekday between 0 and 6),
  start_minute  smallint not null check (start_minute >= 0 and start_minute < 1440),
  end_minute    smallint not null check (end_minute > start_minute and end_minute <= 1440),
  created_at    timestamptz not null default now()
);

create index demo_availability_windows_weekday_idx on public.demo_availability_windows(weekday);

-- Default availability: every day of the week, all 24 hours, IST (0 to 1440
-- minutes — 1440 is the maximum this column allows, i.e. the very end of the
-- day). Adjustable any time from /admin/meetings.
insert into public.demo_availability_windows (weekday, start_minute, end_minute)
select weekday, 0, 1440
from generate_series(0, 6) as weekday;

create table public.demo_bookings (
  id               uuid primary key default gen_random_uuid(),
  visitor_name     text not null,
  visitor_email    citext not null,
  company          text,
  notes            text,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  google_event_id  text,
  meet_link        text,
  status           text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  -- The Meet link isn't shown at booking time — deliberately, so it arrives
  -- close to the meeting instead of sitting unused in an inbox for days. Set
  -- by /api/cron/demo-reminders once the reminder email actually goes out.
  reminder_sent_at timestamptz,
  created_at       timestamptz not null default now()
);

create index demo_bookings_starts_at_idx on public.demo_bookings(starts_at) where status = 'confirmed';
create index demo_bookings_reminder_pending_idx on public.demo_bookings(starts_at)
  where status = 'confirmed' and reminder_sent_at is null;

-- ---------------------------------------------------------------------------
-- RLS: staff-only. The public booking page and its two API routes never read
-- these directly with a user's session — they go through the admin
-- (service-role) client, same as every other public/token-gated route in
-- this codebase, since a demo visitor has no Supabase session at all.
-- ---------------------------------------------------------------------------
alter table public.demo_calendar_connection   enable row level security;
alter table public.demo_availability_windows  enable row level security;
alter table public.demo_bookings              enable row level security;

create policy "demo_calendar_connection staff only" on public.demo_calendar_connection
  for all using (public.is_staff()) with check (public.is_staff());

create policy "demo_availability_windows staff only" on public.demo_availability_windows
  for all using (public.is_staff()) with check (public.is_staff());

create policy "demo_bookings staff only" on public.demo_bookings
  for all using (public.is_staff()) with check (public.is_staff());
