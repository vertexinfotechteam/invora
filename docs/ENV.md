# Environment variables

Every variable Invora reads, where to get it, and whether it reaches the browser.

**The rule:** only `NEXT_PUBLIC_*` variables are bundled into client JavaScript.
Everything else is server-only. Verify with:

```bash
grep -rn "process.env" app components lib --include=*.tsx --include=*.ts | grep -v NEXT_PUBLIC
```

Every hit must be inside `app/api/**`, `lib/server/**`, a file with `import 'server-only'`,
a server action (`'use server'`), or `middleware.ts`.

---

## App

| Variable | Public | Required | Where it comes from |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ | Yes | Your deployment URL, no trailing slash. Used to build share links and auth callbacks. Wrong value here means emailed links point at the wrong host. |
| `NEXT_PUBLIC_APP_NAME` | ✅ | No | Defaults to `Invora`. |
| `NODE_ENV` | — | Auto | Set by the platform. |

## Supabase

Dashboard → Project Settings → API.

| Variable | Public | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Yes | Project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Yes | Browser-safe. Every query it makes is filtered by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Yes | **Bypasses RLS.** Only `lib/supabase/admin.ts` may read it. Leaking this leaks every tenant's data. |
| `SUPABASE_DB_URL` | ❌ | Migrations only | Direct Postgres connection for the Supabase CLI. Not read at runtime. |

## Anthropic

console.anthropic.com → API Keys. **Set a monthly spend limit on the key before going live.**

| Variable | Public | Required | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ❌ | For AI features | Read only by `lib/ai/client.ts`. |

## Gemini

aistudio.google.com/apikey.

| Variable | Public | Required | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | ❌ | For AI features (if not using Anthropic) | Automatic fallback for every AI feature — `lib/ai/provider.ts` picks Anthropic if `ANTHROPIC_API_KEY` is set, otherwise this. Set at least one of the two, or AI routes return a clean "not configured" error. |

## Google Calendar (book-a-demo)

console.cloud.google.com → APIs & Services → Credentials. This is a **separate** OAuth flow from
"Sign in with Google" (`lib/google/calendar.ts`, not Supabase Auth) — the sign-in Client ID/Secret
live in Supabase's dashboard, these live here. The same Google Cloud project and OAuth client can
be reused for both, but two extra steps are required beyond what sign-in needs:

1. Enable the **Google Calendar API** for the project (APIs & Services → Library) — holding OAuth
   credentials alone does not enable the API.
2. Add `<NEXT_PUBLIC_APP_URL>/api/admin/calendar/callback` as an authorized redirect URI on the
   OAuth client (in addition to Supabase's own callback URI used for sign-in).

| Variable | Public | Required | Notes |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | ❌ | For /book-demo | From the Google Cloud OAuth client. |
| `GOOGLE_CLIENT_SECRET` | ❌ | For /book-demo | From the Google Cloud OAuth client. Treat like a password. |

Without these two set, an admin visiting `/admin/meetings` and clicking "Connect Google Calendar"
gets a clean 500 rather than a broken redirect — `lib/google/calendar.ts` checks for both up front.

## Razorpay

dashboard.razorpay.com → Settings → API Keys. KYC takes 2–5 working days — start it in week one.

| Variable | Public | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | ✅ | For payments | Used by `checkout.js` in the browser. Safe to expose by design. |
| `RAZORPAY_KEY_ID` | ❌ | For payments | Same value; kept separate so server code never depends on a public var. |
| `RAZORPAY_KEY_SECRET` | ❌ | For payments | Signs orders and verifies checkout callbacks. |
| `RAZORPAY_WEBHOOK_SECRET` | ❌ | For payments | Set when you create the webhook. **Different from the key secret.** Verifies `x-razorpay-signature`. |
| `RAZORPAY_PLAN_ID_PREMIUM_MONTHLY` | ❌ | For subscriptions | Created in the Razorpay dashboard under Subscriptions → Plans. |
| `RAZORPAY_PLAN_ID_PREMIUM_YEARLY` | ❌ | For subscriptions | As above. |

**Webhook setup.** Settings → Webhooks → Add. URL `https://<your-domain>/api/webhooks/razorpay`.
Subscribe to: `payment.captured`, `payment.failed`, `order.paid`, `subscription.activated`,
`subscription.charged`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`.

## Email (Resend)

resend.com → API Keys. Domain verification needs SPF and DKIM DNS records — allow a day.

| Variable | Public | Required | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | ❌ | For sending | Without it, sends are skipped and logged as `skipped` in `email_log` — the rest of the flow still works locally. |
| `EMAIL_FROM` | ❌ | For sending | `Invora <invoices@yourdomain.com>`. Must be on a verified domain. |
| `EMAIL_REPLY_TO` | ❌ | No | Falls back to the business's own email. |
| `CONTACT_EMAIL` | ❌ | No | Where `/contact` form submissions are sent. Defaults to `support@invora.app` if unset. The submitter's address is set as reply-to, so replying from your inbox goes straight to them. |

## Rate limiting (Upstash)

console.upstash.com → create a Redis database → REST API.

| Variable | Public | Required | Notes |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | ❌ | **In production** | |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | **In production** | |

Without these, `enforceRateLimit` fails **open in development** and **closed in production** —
an unmetered AI endpoint is a billing incident waiting to happen.

## Monitoring (Sentry)

| Variable | Public | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | ✅ | No | Absent means monitoring is silently disabled; nothing else breaks. |
| `SENTRY_AUTH_TOKEN` | ❌ | No | Build-time source-map upload only. |

## Secrets you generate

```bash
openssl rand -hex 32
```

| Variable | Public | Required | Notes |
|---|---|---|---|
| `SHARE_LINK_SECRET` | ❌ | Yes | HMAC key for public document tokens. Must be ≥ 32 characters. **Rotating it invalidates every share link in circulation.** |
| `CRON_SECRET` | ❌ | Yes | Guards `/api/cron/*`. Vercel Cron sends it as `Authorization: Bearer`. Without it, a stranger can trigger your reminder emails. |

---

## Per-environment setup on Vercel

Set every variable separately for **Preview** and **Production**.

| | Preview | Production |
|---|---|---|
| Razorpay keys | `rzp_test_*` | `rzp_live_*` |
| Supabase project | A separate staging project | Production project |
| Anthropic key | A key with a low spend cap | Production key with a monthly cap |
| `NEXT_PUBLIC_APP_URL` | The preview URL | The custom domain |

A live Razorpay key on a preview deployment means a test click charges a real card. Keep them apart.

## Pre-launch checklist

- [ ] `.env*` is git-ignored, and `gitleaks detect` passes in CI
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` appear only under `app/api/**` and `lib/**` server modules
- [ ] `npm run build` then grep the `.next/static` bundle for the first 8 characters of each secret — zero hits
- [ ] Razorpay webhook created and its secret stored
- [ ] Resend domain verified (SPF + DKIM green)
- [ ] Upstash configured in production
- [ ] `SHARE_LINK_SECRET` and `CRON_SECRET` generated fresh per environment
- [ ] Rotation procedure in `docs/RUNBOOK.md` read by whoever is on call
