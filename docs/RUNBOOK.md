# Runbook

Operational procedures for Invora. Written for whoever is on call, including future-you at 2am.

## Key rotation

### `SUPABASE_SERVICE_ROLE_KEY`
1. Supabase dashboard → Settings → API → regenerate.
2. Update the env var in every environment (local `.env.local`, Vercel Preview, Vercel Production).
3. Redeploy. The old key stops working the instant it is regenerated — there is no grace period,
   so do this during a low-traffic window.

### `ANTHROPIC_API_KEY`
1. Create a new key in the Anthropic console with the same spend limit as the old one.
2. Update the env var, redeploy, confirm one AI request succeeds (Assistant page → draft a message).
3. Revoke the old key.

### `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`
1. Rotating `RAZORPAY_KEY_SECRET` breaks checkout signature verification (`/api/payments/verify`)
   and order creation until the env var is updated — do this back-to-back, not key-then-wait.
2. Rotating `RAZORPAY_WEBHOOK_SECRET` requires updating it on **both** the Razorpay dashboard
   webhook config and the env var at the same moment, or deliveries in between will 400.
3. After rotating either, replay a recent webhook delivery from the Razorpay dashboard's webhook
   log and confirm it returns 200.

### `SHARE_LINK_SECRET`
Rotating this **invalidates every public quotation/invoice link currently in a customer's inbox.**
Only rotate on suspected compromise, and warn support first — the fallout is "my link stopped
working," not a security incident on the customer's end.

### `CRON_SECRET`
Update the env var and the Vercel Cron configuration (or whatever calls the cron routes)
together. Verify with `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/overdue`.

## Webhook replay

If `admin_audit_log` reconciliation (`/admin/reconcile`) shows an unprocessed or failed webhook
event:

1. Open the Razorpay dashboard → Webhooks → find the delivery → "Resend".
2. Razorpay resends with the same `x-razorpay-event-id`. The `webhook_events` unique index means
   this is always safe to do — a duplicate becomes a no-op, not a double-processed payment.
3. If it fails again, check the `error` column on the `webhook_events` row for the exception
   message, and check Sentry for the stack trace at that timestamp.

## Refund handling

Invora does not process refunds — the money moves through Razorpay directly.

1. Issue the refund from the Razorpay dashboard (Payments → find the payment → Refund).
2. Invora has no automatic reaction to a refund webhook today. Manually record the adjustment:
   go to the invoice → if the refund was partial, there is currently no "negative payment" UI —
   contact engineering to insert a correcting entry directly, or issue a credit note as a new
   negative-total invoice (documented limitation; V2 should add a proper refund flow).
3. Note the refund in the invoice's notes field so the timeline reflects it.

## Restore drill

Run this against a **staging** Supabase project, never production, at least once per quarter.

1. Supabase dashboard → Database → Backups → pick a point-in-time.
2. Restore into a new project (do not overwrite the one you are testing against).
3. Point a local `.env.local` at the restored project's credentials.
4. Verify: sign in as a known test user, open a known quotation, confirm totals match what you
   expect, confirm RLS still isolates (`npm test -- tests/integration/rls.test.ts` against it).
5. Record the actual restore time achieved — that number is what you tell people during a real
   incident, not the vendor's SLA.

## Incident contacts

| Role | Contact |
|---|---|
| Engineering on-call | *(fill in before launch)* |
| Supabase support | supabase.com/dashboard/support (paid plans get priority) |
| Razorpay support | dashboard.razorpay.com → Support (payments are time-sensitive; call, don't email) |
| Anthropic status | status.anthropic.com |
| Domain / DNS | *(registrar login owner — fill in)* |

## Common incidents

**AI routes returning 402 for everyone.** Check `usage_counters` — if a cron job double-fired
`usage-reset`, counters may have been zeroed incorrectly. Query
`select * from usage_counters where period_start > now() - interval '1 day' order by created_at desc`
and compare against `subscriptions.current_period_start`.

**Invoices stuck as "sent" despite being paid.** Almost always a webhook processing failure —
check `/admin/reconcile` first. If the `payments` row exists but `invoices.status` didn't move,
the `payments_recalc_invoice` trigger may have been dropped by a bad migration; verify with
`\d+ payments` in `psql` that the trigger is present.

**PDF generation timing out.** `@react-pdf/renderer` on a 40+ line document with embedded images
(large logo) is the usual cause. Check the image size on the business's logo — recommend under
200KB. `vercel.json` sets `maxDuration: 60` for PDF routes; if that is still not enough, the
business likely needs to compress their logo.

**Emails not sending, no error visible.** Check `email_log.status` — `skipped` means
`RESEND_API_KEY` is unset in that environment; `failed` has the provider error in the `error`
column.
