-- =============================================================================
-- Invora 0003 — quotations, invoices, line items, payments, share links, events
--
-- Money rule: every monetary column is BIGINT paise. No numeric, no float.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- quotations
-- ---------------------------------------------------------------------------
create table public.quotations (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,
  customer_id          uuid references public.customers(id) on delete restrict,

  number               text not null,
  title                text,
  status               quotation_status not null default 'draft',

  issue_date           date not null default current_date,
  valid_until          date,

  currency             char(3) not null default 'INR',
  tax_mode             tax_mode not null default 'exclusive',
  doc_discount_pct     numeric(5,2) not null default 0 check (doc_discount_pct >= 0 and doc_discount_pct <= 100),

  subtotal_paise       bigint not null default 0,
  discount_paise       bigint not null default 0,
  tax_paise            bigint not null default 0,
  total_paise          bigint not null default 0,
  tax_breakup          jsonb not null default '[]'::jsonb,

  notes                text,
  scope                text,
  deliverables         text,
  exclusions           text,
  payment_terms        text,
  terms                text,

  converted_invoice_id uuid,
  sent_at              timestamptz,
  viewed_at            timestamptz,
  responded_at         timestamptz,
  accepted_by_name     text,
  accepted_ip          inet,
  accepted_user_agent  text,

  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint quotations_number_unique unique (business_id, number),
  constraint quotations_totals_nonneg check (
    subtotal_paise >= 0 and discount_paise >= 0 and tax_paise >= 0 and total_paise >= 0
  )
);

create index quotations_business_status_idx on public.quotations(business_id, status, issue_date desc);
create index quotations_customer_idx        on public.quotations(business_id, customer_id);
create index quotations_number_trgm_idx     on public.quotations using gin (number gin_trgm_ops);
create index quotations_expiry_idx          on public.quotations(valid_until)
  where status in ('sent', 'viewed');

create trigger quotations_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- invoices
--
-- balance_paise is a GENERATED column: it cannot drift from total - paid,
-- because there is no code path that can write it.
-- ---------------------------------------------------------------------------
create table public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  customer_id        uuid references public.customers(id) on delete restrict,
  quotation_id       uuid references public.quotations(id) on delete set null,

  number             text not null,
  title              text,
  status             invoice_status not null default 'draft',

  issue_date         date not null default current_date,
  due_date           date,

  currency           char(3) not null default 'INR',
  tax_mode           tax_mode not null default 'exclusive',
  doc_discount_pct   numeric(5,2) not null default 0 check (doc_discount_pct >= 0 and doc_discount_pct <= 100),

  subtotal_paise     bigint not null default 0,
  discount_paise     bigint not null default 0,
  tax_paise          bigint not null default 0,
  total_paise        bigint not null default 0,
  tax_breakup        jsonb not null default '[]'::jsonb,

  amount_paid_paise  bigint not null default 0 check (amount_paid_paise >= 0),
  balance_paise      bigint generated always as (total_paise - amount_paid_paise) stored,

  notes              text,
  scope              text,
  payment_terms      text,
  terms              text,

  sent_at            timestamptz,
  viewed_at          timestamptz,
  paid_at            timestamptz,
  last_reminder_at   timestamptz,

  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint invoices_number_unique unique (business_id, number),
  constraint invoices_totals_nonneg check (
    subtotal_paise >= 0 and discount_paise >= 0 and tax_paise >= 0 and total_paise >= 0
  )
);

alter table public.quotations
  add constraint quotations_converted_invoice_fk
  foreign key (converted_invoice_id) references public.invoices(id) on delete set null;

create index invoices_business_status_idx on public.invoices(business_id, status, issue_date desc);
create index invoices_customer_idx        on public.invoices(business_id, customer_id);
create index invoices_number_trgm_idx     on public.invoices using gin (number gin_trgm_ops);
create index invoices_overdue_idx         on public.invoices(due_date)
  where status in ('sent', 'viewed', 'partially_paid');

create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- line items — identical shape for both document types
-- ---------------------------------------------------------------------------
create table public.quotation_items (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  quotation_id     uuid not null references public.quotations(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,

  position         integer not null default 0,
  name             text not null,
  description      text,
  unit             text not null default 'unit',
  qty              numeric(14,3) not null default 1 check (qty >= 0),
  rate_paise       bigint not null default 0 check (rate_paise >= 0),
  discount_pct     numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  tax_rate         numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  hsn_sac          text,
  line_total_paise bigint not null default 0 check (line_total_paise >= 0),

  created_at       timestamptz not null default now()
);

create index quotation_items_doc_idx on public.quotation_items(quotation_id, position);

create table public.invoice_items (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  invoice_id       uuid not null references public.invoices(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,

  position         integer not null default 0,
  name             text not null,
  description      text,
  unit             text not null default 'unit',
  qty              numeric(14,3) not null default 1 check (qty >= 0),
  rate_paise       bigint not null default 0 check (rate_paise >= 0),
  discount_pct     numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  tax_rate         numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  hsn_sac          text,
  line_total_paise bigint not null default 0 check (line_total_paise >= 0),

  created_at       timestamptz not null default now()
);

create index invoice_items_doc_idx on public.invoice_items(invoice_id, position);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  invoice_id          uuid not null references public.invoices(id) on delete cascade,

  amount_paise        bigint not null check (amount_paise > 0),
  paid_at             timestamptz not null default now(),
  method              payment_method not null default 'bank_transfer',
  source              payment_source not null default 'manual',
  reference           text,
  notes               text,

  razorpay_order_id   text,
  razorpay_payment_id text unique,

  recorded_by         uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index payments_invoice_idx  on public.payments(invoice_id, paid_at desc);
create index payments_business_idx on public.payments(business_id, paid_at desc);

-- ---------------------------------------------------------------------------
-- share_links — public, login-free document access.
-- Only the SHA-256 hash of the token is stored; the raw token exists only in
-- the URL we hand to the customer.
-- ---------------------------------------------------------------------------
create table public.share_links (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  doc_type    document_type not null,
  doc_id      uuid not null,

  token_hash  text not null unique,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  viewed_at   timestamptz,
  view_count  integer not null default 0,

  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index share_links_doc_idx on public.share_links(doc_type, doc_id);

-- ---------------------------------------------------------------------------
-- document_events — the activity timeline behind every document
-- ---------------------------------------------------------------------------
create table public.document_events (
  id          bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  doc_type    document_type not null,
  doc_id      uuid not null,
  event       document_event_kind not null,
  actor       text not null default 'system',
  actor_id    uuid references auth.users(id) on delete set null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index document_events_doc_idx      on public.document_events(doc_type, doc_id, created_at desc);
create index document_events_business_idx on public.document_events(business_id, created_at desc);
