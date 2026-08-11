-- =============================================================================
-- Invora 0006 — Row Level Security
--
-- Every business-scoped table gets the same shape:
--   using      (business_id = current_business_id())
--   with check (business_id = current_business_id())
--
-- tests/integration/rls.test.ts asserts that business A reads zero rows of
-- business B. That test is the highest-value security test in the product.
-- =============================================================================

alter table public.app_users        enable row level security;
alter table public.businesses       enable row level security;
alter table public.customers        enable row level security;
alter table public.products         enable row level security;
alter table public.quotations       enable row level security;
alter table public.quotation_items  enable row level security;
alter table public.invoices         enable row level security;
alter table public.invoice_items    enable row level security;
alter table public.payments         enable row level security;
alter table public.share_links      enable row level security;
alter table public.document_events  enable row level security;
alter table public.plans            enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.usage_counters   enable row level security;
alter table public.ai_usage_logs    enable row level security;
alter table public.webhook_events   enable row level security;
alter table public.admin_audit_log  enable row level security;
alter table public.email_log        enable row level security;

-- ---------------------------------------------------------------------------
-- app_users — you can see and rename yourself; you cannot promote yourself.
-- ---------------------------------------------------------------------------
create policy "app_users self read" on public.app_users
  for select using (user_id = auth.uid() or public.is_staff());

create policy "app_users self update" on public.app_users
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = (select role from public.app_users where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- businesses — owner only.
-- ---------------------------------------------------------------------------
create policy "businesses owner read" on public.businesses
  for select using (owner_user_id = auth.uid() or public.is_staff());

create policy "businesses owner update" on public.businesses
  for update using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Business-scoped tables.
-- ---------------------------------------------------------------------------
create policy "customers own business" on public.customers
  for all using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "products own business" on public.products
  for all using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "quotations own business" on public.quotations
  for all using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "quotation_items own business" on public.quotation_items
  for all using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "invoices own business" on public.invoices
  for all using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "invoice_items own business" on public.invoice_items
  for all using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "payments own business" on public.payments
  for all using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "share_links own business" on public.share_links
  for all using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "document_events own business read" on public.document_events
  for select using (business_id = public.current_business_id());

create policy "document_events own business insert" on public.document_events
  for insert with check (business_id = public.current_business_id());

create policy "email_log own business read" on public.email_log
  for select using (business_id = public.current_business_id());

-- ---------------------------------------------------------------------------
-- Billing surface — readable by the owner, writable only by the service role
-- (i.e. by a verified Razorpay webhook or a cron job).
-- ---------------------------------------------------------------------------
create policy "plans readable" on public.plans
  for select using (true);

create policy "subscriptions own read" on public.subscriptions
  for select using (business_id = public.current_business_id() or public.is_staff());

create policy "usage own read" on public.usage_counters
  for select using (business_id = public.current_business_id() or public.is_staff());

create policy "ai_usage own read" on public.ai_usage_logs
  for select using (business_id = public.current_business_id() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Operator-only tables: no policy at all. With RLS enabled and zero permissive
-- policies, anon/authenticated see nothing; only the service role reaches them.
-- (webhook_events, admin_audit_log)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Storage buckets for logos and signatures.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('branding', 'branding', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create policy "branding public read" on storage.objects
  for select using (bucket_id = 'branding');

-- Files live under <business_id>/..., so the first path segment is the tenant key.
create policy "branding owner write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.current_business_id()::text
  );

create policy "branding owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.current_business_id()::text
  );

create policy "branding owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.current_business_id()::text
  );
