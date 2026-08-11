# Database schema

Source of truth: `supabase/migrations/*.sql`, applied in numeric order. This file is a map, not a
copy — when they disagree, the migrations are correct and this file is stale.

```
0001_extensions_and_types.sql   pg_trgm, pgcrypto, citext; every enum type; set_updated_at()
0002_core_tables.sql            app_users, businesses, customers, products
0003_documents.sql              quotations, invoices, line items, payments, share_links, document_events
0004_billing_and_usage.sql      plans, subscriptions, usage_counters, ai_usage_logs, webhook_events, admin_audit_log, email_log
0005_functions_and_triggers.sql handle_new_user, next_document_number, payment recalculation, metering, quote→invoice conversion
0006_rls_policies.sql           row level security on every business-scoped table + storage policies
0007_seed_plans.sql             free / premium_monthly / premium_yearly rows
0008_admin_views.sql            reporting views for the operator dashboard
```

## The money rule

Every monetary column is `bigint ... _paise`. There is no `numeric` or `float` money column
anywhere in the schema, and there must never be one. `lib/calc/totals.ts` is the only code
permitted to compute a total; every write goes through `lib/documents/service.ts`.

`invoices.balance_paise` is a **generated column** (`total_paise − amount_paid_paise`) — there is
no code path that can write it directly, which is what makes "balance never drifts from paid" true
by construction rather than by discipline.

## Multi-tenancy

Every business-scoped table carries `business_id uuid not null references businesses(id)`.
`public.current_business_id()` (SECURITY DEFINER, STABLE) resolves the caller's business from
`auth.uid()`, and every RLS policy is the same shape:

```sql
using (business_id = public.current_business_id())
with check (business_id = public.current_business_id())
```

`tests/integration/rls.test.ts` is what proves this actually holds — it creates two real tenants
and asserts neither can read, write, or delete a single row belonging to the other.

## Document numbering

`next_document_number(business_id, doc_type)` does:

```sql
update businesses set next_quote_no = next_quote_no + 1 where id = $1
returning quote_prefix, next_quote_no - 1;
```

The `UPDATE ... RETURNING` takes a row lock on the `businesses` row for the transaction's
duration, so two concurrent requests serialize and draw different numbers. Numbers are **never**
generated in application code — every insert path calls this function first.

## Metering

`usage_counters` holds one row per `(business_id, period_start)`. Rows are never overwritten on
reset — a new period gets a new row, so usage history is a permanent audit trail.

`consume_ai_credits` / `consume_document_quota` are single `UPDATE` statements with the limit
check in the `WHERE` clause:

```sql
update usage_counters
   set ai_credits_used = ai_credits_used + 1
 where business_id = $1 and ai_credits_used + 1 <= $2
returning *;
```

Two parallel tabs cannot both slip past the limit, because the database serializes the two
updates and only one can satisfy the `WHERE` clause once the counter is at the ceiling. The AI
pipeline reserves a credit before calling Anthropic and releases it (`release_ai_credits`) if the
call fails — net effect: only successful requests are charged.

## Payment state

`payments_recalc_invoice` (trigger, `AFTER INSERT OR UPDATE OR DELETE ON payments`) is the only
writer of `invoices.amount_paid_paise` and `invoices.status`. It sums every payment row for the
invoice and derives the status (`paid` / `partially_paid` / `overdue` / `sent` / `viewed`). No
application code ever sets these columns directly — `tests/integration/webhook.test.ts` and the
manual-payment route both rely on this trigger, not on their own arithmetic.

## Idempotency

`webhook_events` has `UNIQUE (provider, event_id)`. That index **is** the idempotency guarantee —
a replayed Razorpay delivery hits a unique-violation on insert, the handler returns 200 immediately,
and no further work happens. See `app/api/webhooks/razorpay/route.ts`.

## Storage

One bucket, `branding`, public-read, tenant-scoped write. Objects are keyed
`<business_id>/<file>`, and the write/update/delete policies check that the first path segment
matches `current_business_id()` — so a business cannot write into another tenant's folder even by
constructing the path by hand.

## Regenerating `lib/types/database.ts`

There is no codegen step yet — `lib/types/database.ts` is hand-maintained. **If you add or change
a column in a migration, update the matching interface in the same commit.** `npm run typecheck`
is what catches drift between the two.
