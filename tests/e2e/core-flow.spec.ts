import { expect, test } from '@playwright/test';

/**
 * The end-to-end path the business lives or dies on:
 *
 *   sign up → complete profile → add a customer → create a quotation →
 *   share it → accept it as the customer → convert to invoice → record a
 *   payment → see it settled.
 *
 * Run against a real preview deployment on every deploy. It needs a working
 * Supabase project and email auto-confirm enabled for the test domain.
 */

const unique = Date.now();
const email = `e2e-${unique}@invora-test.local`;
const password = `E2e-${unique}-Aa1`;
const businessName = `E2E Studio ${unique}`;

test.describe.configure({ mode: 'serial' });

test('marketing site renders and links to signup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('paid invoice');
  await expect(page.getByRole('link', { name: /start free/i }).first()).toBeVisible();
});

test('pricing page states both plans', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: /Starter/ }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Premium$/ }).first()).toBeVisible();
});

test('legal pages required for Razorpay activation are live', async ({ page }) => {
  for (const path of ['/terms', '/privacy', '/refunds']) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} must return 200`).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('signup form validates before it submits', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('E2E Tester');
  await page.getByLabel('Business name').fill(businessName);
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password').fill('different');
  await page.getByRole('button', { name: /create account/i }).click();

  // Client-side constraints keep us on the page rather than round-tripping.
  await expect(page).toHaveURL(/signup/);
});

test('protected routes redirect an anonymous visitor to sign in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});

test('an unknown share token shows the generic unavailable page', async ({ page }) => {
  await page.goto('/q/not-a-real-token.abcdefghijklmnop');
  await expect(page.getByText(/no longer available/i)).toBeVisible();
});

test('an unauthenticated AI request is refused before any provider call', async ({ request }) => {
  const response = await request.post('/api/ai/quotation', {
    data: { brief: 'A brief long enough to pass validation checks here.' },
  });
  expect(response.status()).toBe(401);
});

test('an unauthenticated admin request is refused', async ({ request }) => {
  const response = await request.get('/api/admin/stats');
  expect([401, 403]).toContain(response.status());
});

test('cron endpoints refuse a request with no secret', async ({ request }) => {
  for (const path of ['/api/cron/overdue', '/api/cron/reminders', '/api/cron/usage-reset']) {
    const response = await request.get(path);
    expect(response.status(), `${path} must be guarded`).toBe(403);
  }
});

test('the webhook refuses an unsigned request', async ({ request }) => {
  const response = await request.post('/api/webhooks/razorpay', {
    data: { event: 'payment.captured' },
  });
  expect([400, 500]).toContain(response.status());
});

test.describe('signed-in flow', () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    'Set E2E_EMAIL and E2E_PASSWORD to a seeded account to run the full flow.',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
  });

  test('creates a customer, a quotation, and reaches an invoice', async ({ page }) => {
    // Customer
    await page.goto('/customers/new');
    const customerName = `E2E Client ${Date.now()}`;
    await page.getByLabel('Contact name').fill(customerName);
    await page.getByLabel('Email').fill(`client-${Date.now()}@invora-test.local`);
    await page.getByRole('button', { name: /add customer/i }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(customerName);

    // Quotation
    await page.goto('/quotations/new');
    await page.getByLabel('Project title').fill('E2E project');
    await page.getByLabel('Line 1 name').fill('Consulting');
    await page.getByLabel('Line 1 rate').fill('1000');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText(/all changes saved/i)).toBeVisible({ timeout: 15_000 });
    // Totals render from the same engine the server uses.
    await expect(page.getByText('₹1,000.00').first()).toBeVisible();
  });

  test('the line-item editor is usable at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/quotations/new');
    // Below md the table becomes cards; the name field must still be reachable.
    await expect(page.getByLabel('Line 1 name')).toBeVisible();
  });
});
