-- =============================================================================
-- Invora 0011 — contact form inbox
--
-- Until now a /contact submission was *only* emailed, to CONTACT_EMAIL or the
-- hardcoded support@invora.app fallback. Nothing was stored. If the mailbox did
-- not exist, or email was not configured at all, the visitor still saw
-- "Message sent" and the message was gone with no trace anywhere.
--
-- Like demo bookings (0010), this is Vertex Infotech's own inbox rather than a
-- per-customer feature, so nothing here is scoped by business_id. Read from the
-- admin portal at /admin/messages.
-- =============================================================================

create table public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  message      text not null,
  -- Whether the notification email actually left the building. Lets the admin
  -- list flag "stored but not emailed" instead of quietly implying both worked.
  email_sent   boolean not null default false,
  -- Best-effort, for spotting a flood from one source. Not used for anything
  -- user-facing and never shown to visitors.
  client_ip    text,
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index contact_messages_unhandled_idx on public.contact_messages (created_at desc)
  where handled_at is null;

alter table public.contact_messages enable row level security;

-- No policy is defined on purpose: with RLS enabled and no policy, every role
-- that goes through PostgREST (anon and authenticated) is denied outright. The
-- contact form writes with the service-role key, which bypasses RLS, and the
-- admin portal reads the same way. A signed-in customer must never be able to
-- read Vertex Infotech's support inbox, and this is the strictest way to say so.
revoke all on public.contact_messages from anon, authenticated;

comment on table public.contact_messages is
  'Marketing-site contact submissions. Service-role access only; read via /admin/messages.';
