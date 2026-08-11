-- =============================================================================
-- Invora 0002 — identity, business profile, customers, products
-- =============================================================================

-- ---------------------------------------------------------------------------
-- app_users: role flags layered on top of auth.users.
-- Admin access is decided here, never by a claim the browser can forge.
-- ---------------------------------------------------------------------------
create table public.app_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        citext not null,
  full_name    text,
  role         app_role not null default 'user',
  suspended_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index app_users_role_idx on public.app_users(role) where role <> 'user';

-- ---------------------------------------------------------------------------
-- businesses: one per owner. Everything else hangs off business_id.
-- ---------------------------------------------------------------------------
create table public.businesses (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid not null unique references auth.users(id) on delete cascade,

  name              text not null default '',
  legal_name        text,
  logo_url          text,
  signature_url     text,
  email             citext,
  phone             text,
  website           text,

  address_line1     text,
  address_line2     text,
  city              text,
  state             text,
  postal_code       text,
  country           text not null default 'IN',

  gstin             text,
  pan               text,

  currency          char(3) not null default 'INR',
  locale            text not null default 'en-IN',
  timezone          text not null default 'Asia/Kolkata',

  quote_prefix      text not null default 'QT-',
  invoice_prefix    text not null default 'INV-',
  next_quote_no     integer not null default 1 check (next_quote_no > 0),
  next_invoice_no   integer not null default 1 check (next_invoice_no > 0),
  number_padding    smallint not null default 4 check (number_padding between 1 and 8),

  default_tax_rate      numeric(5,2) not null default 18.00 check (default_tax_rate >= 0 and default_tax_rate <= 100),
  default_tax_mode      tax_mode not null default 'exclusive',
  default_payment_terms text not null default 'Payment due within 15 days of invoice date.',
  default_terms         text,
  default_notes         text,
  quote_validity_days   smallint not null default 15 check (quote_validity_days > 0),
  invoice_due_days      smallint not null default 15 check (invoice_due_days >= 0),

  bank_account_name text,
  bank_account_no   text,
  bank_ifsc         text,
  bank_name         text,
  upi_id            text,

  brand_color       text not null default '#4F46E5',
  pdf_template      text not null default 'classic',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,

  name          text not null check (length(trim(name)) > 0),
  company       text,
  email         citext,
  phone         text,
  gstin         text,

  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  postal_code   text,
  country       text default 'IN',

  notes         text,
  archived_at   timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index customers_business_idx  on public.customers(business_id) where archived_at is null;
create index customers_created_idx   on public.customers(business_id, created_at desc);
create index customers_name_trgm_idx on public.customers using gin (name gin_trgm_ops);
create index customers_company_trgm_idx on public.customers using gin (coalesce(company, '') gin_trgm_ops);

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products (catalog of reusable products / services)
-- ---------------------------------------------------------------------------
create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,

  name                 text not null check (length(trim(name)) > 0),
  description          text,
  sku                  text,
  unit                 text not null default 'unit',
  default_price_paise  bigint not null default 0 check (default_price_paise >= 0),
  tax_rate             numeric(5,2) not null default 18.00 check (tax_rate >= 0 and tax_rate <= 100),
  default_discount_pct numeric(5,2) not null default 0 check (default_discount_pct >= 0 and default_discount_pct <= 100),
  hsn_sac              text,

  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index products_business_idx  on public.products(business_id) where archived_at is null;
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
