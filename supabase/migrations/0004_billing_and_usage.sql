-- =============================================================================
-- Invora 0004 — plans, subscriptions, metering, AI cost audit, admin trail
-- =============================================================================

create table public.plans (
  code            text primary key,
  name            text not null,
  description     text,
  price_paise     bigint not null default 0 check (price_paise >= 0),
  interval        text not null default 'month' check (interval in ('month', 'year')),
  doc_limit       integer not null check (doc_limit >= 0),
  ai_credit_limit integer not null check (ai_credit_limit >= 0),
  features        jsonb not null default '{}'::jsonb,
  is_public       boolean not null default true,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now()
);

create table public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null unique references public.businesses(id) on delete cascade,
  plan_code               text not null references public.plans(code),
  status                  subscription_status not null default 'active',

  current_period_start    timestamptz not null default now(),
  current_period_end      timestamptz not null default (now() + interval '1 month'),
  cancel_at_period_end    boolean not null default false,
  cancelled_at            timestamptz,

  razorpay_subscription_id text unique,
  razorpay_customer_id     text,

  -- Manual overrides an admin can grant, applied on top of the plan allowance.
  bonus_doc_limit         integer not null default 0 check (bonus_doc_limit >= 0),
  bonus_ai_credits        integer not null default 0 check (bonus_ai_credits >= 0),

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index subscriptions_status_idx on public.subscriptions(status, current_period_end);

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- usage_counters — one row per business per billing period. Rows are never
-- overwritten on reset; a new period gets a new row, so history is auditable.
-- ---------------------------------------------------------------------------
create table public.usage_counters (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  period_start    timestamptz not null,
  period_end      timestamptz not null,
  docs_used       integer not null default 0 check (docs_used >= 0),
  ai_credits_used integer not null default 0 check (ai_credits_used >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint usage_counters_period_unique unique (business_id, period_start)
);

create index usage_counters_current_idx on public.usage_counters(business_id, period_end desc);

create trigger usage_counters_updated_at before update on public.usage_counters
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_usage_logs — one row per AI request, success or failure. This is both the
-- cost ledger and the audit trail.
-- ---------------------------------------------------------------------------
create table public.ai_usage_logs (
  id                    bigserial primary key,
  business_id           uuid references public.businesses(id) on delete set null,
  user_id               uuid references auth.users(id) on delete set null,

  feature               text not null,
  model                 text not null,
  input_tokens          integer not null default 0,
  output_tokens         integer not null default 0,
  cache_read_tokens     integer not null default 0,
  cache_creation_tokens integer not null default 0,
  estimated_cost_usd    numeric(12,6) not null default 0,
  latency_ms            integer not null default 0,

  status                ai_call_status not null default 'ok',
  error_code            text,
  stop_reason           text,
  credit_charged        boolean not null default false,
  meta                  jsonb not null default '{}'::jsonb,

  created_at            timestamptz not null default now()
);

create index ai_usage_business_idx on public.ai_usage_logs(business_id, created_at desc);
create index ai_usage_feature_idx  on public.ai_usage_logs(feature, created_at desc);
create index ai_usage_status_idx   on public.ai_usage_logs(status, created_at desc) where status <> 'ok';

-- ---------------------------------------------------------------------------
-- webhook_events — the UNIQUE index on event_id *is* the idempotency guarantee.
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  id           bigserial primary key,
  provider     text not null default 'razorpay',
  event_id     text not null,
  event_type   text,
  payload      jsonb not null,
  status       webhook_status not null default 'received',
  error        text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,

  constraint webhook_events_provider_event_unique unique (provider, event_id)
);

create index webhook_events_status_idx on public.webhook_events(status, received_at desc);

-- ---------------------------------------------------------------------------
-- admin_audit_log — every mutating admin action, with a mandatory reason.
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id            bigserial primary key,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action        text not null,
  target_type   text not null,
  target_id     text,
  reason        text not null check (length(trim(reason)) >= 5),
  before        jsonb,
  after         jsonb,
  ip            inet,
  created_at    timestamptz not null default now()
);

create index admin_audit_admin_idx  on public.admin_audit_log(admin_user_id, created_at desc);
create index admin_audit_target_idx on public.admin_audit_log(target_type, target_id, created_at desc);

-- ---------------------------------------------------------------------------
-- email_log — deliverability + "did the reminder actually go out?"
-- ---------------------------------------------------------------------------
create table public.email_log (
  id          bigserial primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  to_email    citext not null,
  template    text not null,
  subject     text,
  doc_type    document_type,
  doc_id      uuid,
  provider_id text,
  status      text not null default 'sent',
  error       text,
  created_at  timestamptz not null default now()
);

create index email_log_business_idx on public.email_log(business_id, created_at desc);
