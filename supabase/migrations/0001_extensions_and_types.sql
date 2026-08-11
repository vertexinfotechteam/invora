-- =============================================================================
-- Invora 0001 — extensions, enums, shared helpers
-- =============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid(), digest()
create extension if not exists "pg_trgm";       -- fuzzy global search
create extension if not exists "citext";        -- case-insensitive email

-- ---------------------------------------------------------------------------
-- Enumerated types.  Kept as enums (not free text) so an invalid status is a
-- database error rather than a silent data-quality problem.
-- ---------------------------------------------------------------------------
create type app_role            as enum ('user', 'support', 'admin');
create type quotation_status    as enum ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired');
create type invoice_status      as enum ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled');
create type document_type       as enum ('quotation', 'invoice');
create type payment_method      as enum ('cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other');
create type payment_source      as enum ('manual', 'razorpay');
create type subscription_status as enum ('active', 'past_due', 'halted', 'cancelled', 'expired', 'pending');
create type tax_mode            as enum ('exclusive', 'inclusive');
create type ai_call_status      as enum ('ok', 'error', 'refusal', 'rate_limited', 'credit_exhausted', 'too_large');
create type webhook_status      as enum ('received', 'processed', 'failed', 'ignored');

create type document_event_kind as enum (
  'created', 'edited', 'sent', 'viewed', 'accepted', 'rejected',
  'expired', 'converted', 'payment_recorded', 'paid', 'reminder_sent', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Generic BEFORE UPDATE trigger keeping updated_at honest.';
