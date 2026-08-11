# Invora

AI-assisted quotation and invoicing SaaS for service businesses — built by **Vertex Infotech**.

Describe a job in one sentence, get a client-ready quotation. Convert it to an invoice in one
click. Get paid through Razorpay. The AI drafts the words; a single tested TypeScript module
computes every number that ever appears on a document.

> This project is set up to **run locally**. There is no deployment step here — `npm run dev` is
> the whole story.

## Stack

Next.js 15 (App Router, TypeScript) · Tailwind + Radix primitives · Supabase (Postgres, Auth,
Storage, RLS) · Anthropic Claude (`@anthropic-ai/sdk`) behind server-only routes · Razorpay
(Orders, Subscriptions, Webhooks) · `@react-pdf/renderer` · Resend · Upstash Redis · Sentry · Zod ·
Vitest + Playwright.

## Run it locally

### 1. Prerequisites

- Node.js ≥ 20.11
- A [Supabase](https://supabase.com) project (free tier is enough for local dev)
- Optional for full functionality: an [Anthropic API key](https://console.anthropic.com), a
  [Razorpay](https://razorpay.com) test account, a [Resend](https://resend.com) key, an
  [Upstash](https://upstash.com) Redis database. The app runs and the core CRUD flows work without
  any of these — they gate AI, payments, email and rate limiting respectively.

### 2. Install

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in at minimum `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase
dashboard → Project Settings → API), `SUPABASE_SERVICE_ROLE_KEY` (same page — **server only,
never commit it**), and generate two local secrets:

```bash
openssl rand -hex 32   # SHARE_LINK_SECRET
openssl rand -hex 32   # CRON_SECRET
```

Full reference for every variable, what it gates, and where to get it: [`docs/ENV.md`](docs/ENV.md).

### 4. Set up the database

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if you don't have it, then either
link to your hosted project and push:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

or, if you prefer a fully local Postgres via Docker:

```bash
supabase start
supabase db reset
```

This runs every file in `supabase/migrations/` in order — schema, RLS policies, and the seeded
`plans` table. See [`docs/SCHEMA.md`](docs/SCHEMA.md) for what each migration does.

### 5. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. Sign up — a business profile, a free subscription, and the first
usage-metering period are all created for you in one transaction (`handle_new_user` in migration
`0005`).

### 6. Optional: seed demo data

```bash
npm run seed
```

Populates the account whose email matches `SEED_USER_EMAIL` (see `scripts/seed.ts`) with sample
customers, catalog items, and documents, so the dashboard has something to show immediately.

## What works without the optional services

| Missing env var | What's disabled | What still works |
|---|---|---|
| `ANTHROPIC_API_KEY` | `/api/ai/*` return a clean 500 | Every manual create/edit/send/pay flow |
| `RAZORPAY_*` | Online checkout | Manual payment recording, everything else |
| `RESEND_API_KEY` | Emails are logged, not sent (`email_log.status = 'skipped'`) | Everything else — check the console for what would have been sent |
| `UPSTASH_REDIS_REST_URL` | Rate limiting is skipped in development (fails open) | Everything |
| `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring | Everything |

## Testing

```bash
npm test              # unit + integration (Vitest)
npm run test:coverage # lib/calc/totals.ts is held to 100% branch coverage
npm run test:e2e      # Playwright — needs `npm run dev` running in another terminal
```

`tests/integration/rls.test.ts` needs real Supabase credentials (it creates two live tenants and
proves neither can read the other's data) — it skips itself with a warning if
`SUPABASE_SERVICE_ROLE_KEY` is absent. Run it against a project before trusting the isolation
model.

## Project layout

```
app/
  (marketing)/     landing, pricing, legal — public
  (auth)/          login, signup, password reset
  (app)/           the authenticated product — dashboard, documents, settings
  (admin)/admin/   operator panel, separately guarded
  q/[token]/       public quotation view + accept/decline — no login
  i/[token]/       public invoice view + pay — no login
  api/             every route handler: ai, pdf, payments, webhooks, cron, admin
lib/
  calc/totals.ts   the money engine — pure, 100%-covered, the one place totals are computed
  ai/              Anthropic client, prompts, structured-output schemas, the AI pipeline
  guards/          auth, rate limiting, feature gates, quota — the mandatory pipeline
  pdf/             three PDF templates, all fed by one data loader
  razorpay/        signature verification, client
  supabase/        browser / server / admin clients — the admin one is service-role and server-only
  documents/       the single service that writes a quotation or invoice
components/        ui primitives, app shell, document editor, public-facing views, admin
supabase/migrations/  numbered SQL, applied in order
tests/             unit, integration, e2e
docs/              ENV.md, SCHEMA.md, RUNBOOK.md
```

## The non-negotiables (see `IMPLEMENTATION_PLAN.txt` for the full rationale)

1. **AI never computes money.** `lib/calc/totals.ts` is the only module that produces a total; a
   model-suggested rate renders as a chip the user must click to accept.
2. **All money is integer paise.** No float or `numeric` column ever holds an amount.
3. **Every AI route runs auth → rate limit → credit check → provider call → log, in that order.**
4. **Subscription state changes only from a verified Razorpay webhook.** A browser redirect shows
   an optimistic state and changes nothing.
5. **RLS on every table.** `tests/integration/rls.test.ts` is the test that proves it.
6. **No fake UI.** Every list ships loading, empty, error and populated states.

---

Powered by Vertex Infotech.
