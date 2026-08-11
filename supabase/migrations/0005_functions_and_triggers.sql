-- =============================================================================
-- Invora 0005 — server-side business logic that must not live in JavaScript
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Identity helpers.  SECURITY DEFINER + STABLE so RLS policies can call them
-- without recursing into the very tables they protect.
-- ---------------------------------------------------------------------------
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id from public.businesses b where b.owner_user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users u
    where u.user_id = auth.uid()
      and u.role = 'admin'
      and u.suspended_at is null
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users u
    where u.user_id = auth.uid()
      and u.role in ('admin', 'support')
      and u.suspended_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- New-user bootstrap: app_users + businesses + free subscription + first usage
-- period, all in the one transaction that creates the auth user.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  insert into public.app_users (user_id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', ''), '')
  )
  on conflict (user_id) do nothing;

  insert into public.businesses (owner_user_id, name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'business_name', ''), ''),
    new.email
  )
  on conflict (owner_user_id) do nothing
  returning id into v_business_id;

  if v_business_id is null then
    select id into v_business_id from public.businesses where owner_user_id = new.id;
  end if;

  insert into public.subscriptions (business_id, plan_code, status, current_period_start, current_period_end)
  values (v_business_id, 'free', 'active', date_trunc('day', now()), date_trunc('day', now()) + interval '1 month')
  on conflict (business_id) do nothing;

  insert into public.usage_counters (business_id, period_start, period_end)
  values (v_business_id, date_trunc('day', now()), date_trunc('day', now()) + interval '1 month')
  on conflict (business_id, period_start) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Document numbering.
--
-- The UPDATE ... RETURNING takes a row-level lock on the businesses row for the
-- duration of the transaction, so two concurrent creations serialise and get
-- different numbers.  Never generate numbers in application code.
-- ---------------------------------------------------------------------------
create or replace function public.next_document_number(
  p_business_id uuid,
  p_doc_type    document_type
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_no     integer;
  v_pad    smallint;
begin
  -- A signed-in caller may only draw numbers for their own business.
  if auth.uid() is not null and p_business_id is distinct from public.current_business_id() then
    raise exception 'not authorised for business %', p_business_id
      using errcode = '42501';
  end if;

  if p_doc_type = 'quotation' then
    update public.businesses
       set next_quote_no = next_quote_no + 1
     where id = p_business_id
    returning quote_prefix, next_quote_no - 1, number_padding
      into v_prefix, v_no, v_pad;
  else
    update public.businesses
       set next_invoice_no = next_invoice_no + 1
     where id = p_business_id
    returning invoice_prefix, next_invoice_no - 1, number_padding
      into v_prefix, v_no, v_pad;
  end if;

  if v_no is null then
    raise exception 'business % not found', p_business_id using errcode = 'P0002';
  end if;

  return coalesce(v_prefix, '') || lpad(v_no::text, coalesce(v_pad, 4), '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Invoice payment state.  amount_paid_paise is always the sum of payment rows;
-- balance_paise is a generated column derived from it.  Status is recomputed
-- from those two facts — never hand-edited.
-- ---------------------------------------------------------------------------
create or replace function public.recalc_invoice_payment_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
  v_paid       bigint;
  v_inv        public.invoices%rowtype;
  v_status     invoice_status;
begin
  select coalesce(sum(amount_paise), 0) into v_paid
    from public.payments where invoice_id = v_invoice_id;

  select * into v_inv from public.invoices where id = v_invoice_id for update;
  if not found then
    return coalesce(new, old);
  end if;

  if v_inv.status = 'draft' or v_inv.status = 'cancelled' then
    v_status := v_inv.status;
  elsif v_inv.total_paise > 0 and v_paid >= v_inv.total_paise then
    v_status := 'paid';
  elsif v_paid > 0 then
    v_status := 'partially_paid';
  elsif v_inv.due_date is not null and v_inv.due_date < current_date then
    v_status := 'overdue';
  elsif v_inv.viewed_at is not null then
    v_status := 'viewed';
  else
    v_status := 'sent';
  end if;

  update public.invoices
     set amount_paid_paise = v_paid,
         status            = v_status,
         paid_at           = case when v_status = 'paid' then coalesce(v_inv.paid_at, now()) else null end
   where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

create trigger payments_recalc_invoice
  after insert or update or delete on public.payments
  for each row execute function public.recalc_invoice_payment_state();

-- ---------------------------------------------------------------------------
-- Metering.
--
-- ensure_usage_period() rolls the counter row forward lazily so a business that
-- has been idle for two months still meters correctly on its next request.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_usage_period(p_business_id uuid)
returns public.usage_counters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.usage_counters%rowtype;
  v_sub  public.subscriptions%rowtype;
begin
  select * into v_sub from public.subscriptions where business_id = p_business_id;
  if not found then
    raise exception 'no subscription for business %', p_business_id using errcode = 'P0002';
  end if;

  select * into v_row
    from public.usage_counters
   where business_id = p_business_id
     and period_start = v_sub.current_period_start;

  if not found then
    insert into public.usage_counters (business_id, period_start, period_end)
    values (p_business_id, v_sub.current_period_start, v_sub.current_period_end)
    on conflict (business_id, period_start) do update set period_end = excluded.period_end
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- Returns the effective allowance for a business: plan limits + admin bonuses.
create or replace function public.effective_limits(p_business_id uuid)
returns table (doc_limit integer, ai_credit_limit integer, plan_code text)
language sql
stable
security definer
set search_path = public
as $$
  select p.doc_limit + s.bonus_doc_limit,
         p.ai_credit_limit + s.bonus_ai_credits,
         p.code
    from public.subscriptions s
    join public.plans p on p.code = s.plan_code
   where s.business_id = p_business_id;
$$;

-- Atomically reserve N AI credits.  Returns false when the allowance is spent.
-- Two parallel tabs cannot both slip past the limit: the guard lives in the
-- WHERE clause of a single UPDATE statement.
create or replace function public.consume_ai_credits(p_business_id uuid, p_amount integer default 1)
returns table (allowed boolean, used integer, allowance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_row   public.usage_counters%rowtype;
  v_used  integer;
begin
  perform public.ensure_usage_period(p_business_id);
  select l.ai_credit_limit into v_limit from public.effective_limits(p_business_id) l;

  update public.usage_counters uc
     set ai_credits_used = uc.ai_credits_used + p_amount
   where uc.business_id = p_business_id
     and uc.period_end > now()
     and uc.ai_credits_used + p_amount <= v_limit
  returning * into v_row;

  if found then
    return query select true, v_row.ai_credits_used, v_limit;
  end if;

  select uc.ai_credits_used into v_used
    from public.usage_counters uc
   where uc.business_id = p_business_id and uc.period_end > now();

  return query select false, coalesce(v_used, 0), v_limit;
end;
$$;

-- Give a reserved credit back when the provider call fails.  Reserve-then-release
-- is what makes the limit safe under concurrency while still only *net* charging
-- for successful requests.
create or replace function public.release_ai_credits(p_business_id uuid, p_amount integer default 1)
returns void
language sql
security definer
set search_path = public
as $$
  update public.usage_counters
     set ai_credits_used = greatest(0, ai_credits_used - p_amount)
   where business_id = p_business_id and period_end > now();
$$;

create or replace function public.consume_document_quota(p_business_id uuid, p_amount integer default 1)
returns table (allowed boolean, used integer, allowance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_row   public.usage_counters%rowtype;
  v_used  integer;
begin
  perform public.ensure_usage_period(p_business_id);
  select l.doc_limit into v_limit from public.effective_limits(p_business_id) l;

  update public.usage_counters uc
     set docs_used = uc.docs_used + p_amount
   where uc.business_id = p_business_id
     and uc.period_end > now()
     and uc.docs_used + p_amount <= v_limit
  returning * into v_row;

  if found then
    return query select true, v_row.docs_used, v_limit;
  end if;

  select uc.docs_used into v_used
    from public.usage_counters uc
   where uc.business_id = p_business_id and uc.period_end > now();

  return query select false, coalesce(v_used, 0), v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convert an accepted quotation into an invoice, copying items and totals to
-- the paise.  Done in SQL so the copy is atomic with the number draw.
-- ---------------------------------------------------------------------------
create or replace function public.convert_quotation_to_invoice(p_quotation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q         public.quotations%rowtype;
  v_invoice   uuid;
  v_number    text;
  v_due_days  smallint;
begin
  select * into v_q from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'quotation % not found', p_quotation_id using errcode = 'P0002';
  end if;

  if auth.uid() is not null and v_q.business_id is distinct from public.current_business_id() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if v_q.converted_invoice_id is not null then
    return v_q.converted_invoice_id;
  end if;

  select invoice_due_days into v_due_days from public.businesses where id = v_q.business_id;
  v_number := public.next_document_number(v_q.business_id, 'invoice');

  insert into public.invoices (
    business_id, customer_id, quotation_id, number, title, status,
    issue_date, due_date, currency, tax_mode, doc_discount_pct,
    subtotal_paise, discount_paise, tax_paise, total_paise, tax_breakup,
    notes, scope, payment_terms, terms, created_by
  ) values (
    v_q.business_id, v_q.customer_id, v_q.id, v_number, v_q.title, 'draft',
    current_date, current_date + coalesce(v_due_days, 15), v_q.currency, v_q.tax_mode, v_q.doc_discount_pct,
    v_q.subtotal_paise, v_q.discount_paise, v_q.tax_paise, v_q.total_paise, v_q.tax_breakup,
    v_q.notes, v_q.scope, v_q.payment_terms, v_q.terms, auth.uid()
  )
  returning id into v_invoice;

  insert into public.invoice_items (
    business_id, invoice_id, product_id, position, name, description, unit,
    qty, rate_paise, discount_pct, tax_rate, hsn_sac, line_total_paise
  )
  select business_id, v_invoice, product_id, position, name, description, unit,
         qty, rate_paise, discount_pct, tax_rate, hsn_sac, line_total_paise
    from public.quotation_items
   where quotation_id = v_q.id
   order by position;

  update public.quotations set converted_invoice_id = v_invoice where id = v_q.id;

  insert into public.document_events (business_id, doc_type, doc_id, event, actor, actor_id, meta)
  values (v_q.business_id, 'quotation', v_q.id, 'converted', 'user', auth.uid(),
          jsonb_build_object('invoice_id', v_invoice, 'invoice_number', v_number)),
         (v_q.business_id, 'invoice', v_invoice, 'created', 'user', auth.uid(),
          jsonb_build_object('from_quotation', v_q.number));

  return v_invoice;
end;
$$;
