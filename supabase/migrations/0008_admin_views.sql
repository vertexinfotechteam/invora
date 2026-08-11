-- =============================================================================
-- Invora 0008 — reporting views
--
-- These are read exclusively through the service-role client from /api/admin/*
-- and the owner's own reports page (which filters by business_id first).
-- =============================================================================

-- Daily revenue actually received, by business.
create or replace view public.v_revenue_daily as
select
  p.business_id,
  date_trunc('day', p.paid_at)::date as day,
  sum(p.amount_paise)::bigint        as amount_paise,
  count(*)::integer                  as payment_count
from public.payments p
group by 1, 2;

-- Document activity per business per day.
create or replace view public.v_document_activity_daily as
select business_id, day, doc_type, event, count(*)::integer as event_count
from (
  select business_id, date_trunc('day', created_at)::date as day, doc_type, event
    from public.document_events
) e
group by 1, 2, 3, 4;

-- AI spend rollup — reconciled against the Anthropic console in the admin panel.
create or replace view public.v_ai_cost_daily as
select
  business_id,
  date_trunc('day', created_at)::date as day,
  model,
  count(*)::integer                   as requests,
  sum(input_tokens)::bigint           as input_tokens,
  sum(output_tokens)::bigint          as output_tokens,
  sum(cache_read_tokens)::bigint      as cache_read_tokens,
  sum(estimated_cost_usd)             as cost_usd
from public.ai_usage_logs
group by 1, 2, 3;

-- Outstanding receivables per business.
create or replace view public.v_receivables as
select
  business_id,
  sum(balance_paise) filter (where status in ('sent','viewed','partially_paid','overdue'))::bigint as outstanding_paise,
  sum(balance_paise) filter (where status = 'overdue')::bigint                                     as overdue_paise,
  count(*) filter (where status = 'overdue')::integer                                              as overdue_count
from public.invoices
group by 1;

-- MRR by plan, counted from active subscriptions.
create or replace view public.v_mrr_by_plan as
select
  s.plan_code,
  count(*)::integer as subscribers,
  (count(*) * case when p.interval = 'year' then p.price_paise / 12 else p.price_paise end)::bigint as mrr_paise
from public.subscriptions s
join public.plans p on p.code = s.plan_code
where s.status = 'active' and p.price_paise > 0
group by s.plan_code, p.price_paise, p.interval;

-- Views inherit RLS from their base tables when created by a non-superuser and
-- accessed through PostgREST; belt-and-braces, revoke anon entirely.
revoke all on public.v_revenue_daily, public.v_document_activity_daily,
               public.v_ai_cost_daily, public.v_receivables, public.v_mrr_by_plan
  from anon;
