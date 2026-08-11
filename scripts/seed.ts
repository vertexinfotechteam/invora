/**
 * Demo data seeder.
 *
 * Populates the business belonging to SEED_USER_EMAIL (an account you have
 * already signed up through the UI) with a handful of customers, catalog
 * items and documents, so a fresh local install has something to look at.
 *
 * Usage:
 *   SEED_USER_EMAIL=you@example.com npm run seed
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { computeTotals } from '../lib/calc/totals';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedEmail = process.env.SEED_USER_EMAIL;

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.');
  process.exit(1);
}
if (!seedEmail) {
  console.error('Set SEED_USER_EMAIL to the account you signed up with, e.g.:');
  console.error('  SEED_USER_EMAIL=you@example.com npm run seed');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log(`Looking up business for ${seedEmail}…`);

  const { data: users, error: userError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (userError) throw userError;

  const user = users.users.find((candidate) => candidate.email === seedEmail);
  if (!user) {
    console.error(`No user found with email ${seedEmail}. Sign up through the app first.`);
    process.exit(1);
  }

  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('id, currency, default_tax_rate')
    .eq('owner_user_id', user.id)
    .single();
  if (businessError || !business) throw businessError ?? new Error('No business found for that user.');

  console.log(`Seeding business ${business.id}…`);

  // --- Customers -------------------------------------------------------
  const customerRows = [
    { name: 'Ananya Rao', company: 'Rao Manufacturing Pvt Ltd', email: 'ananya@raomfg.example', city: 'Pune', state: 'Maharashtra', gstin: '27AAAPZ1234C1Z5' },
    { name: 'Karthik Iyer', company: 'Iyer & Co Consulting', email: 'karthik@iyerco.example', city: 'Bengaluru', state: 'Karnataka' },
    { name: 'Fatima Sheikh', company: 'Sheikh Retail Group', email: 'fatima@sheikhretail.example', city: 'Mumbai', state: 'Maharashtra' },
  ].map((row) => ({ ...row, business_id: business.id, country: 'IN' }));

  const { data: customers, error: customerError } = await admin
    .from('customers')
    .insert(customerRows)
    .select('id, name, company');
  if (customerError) throw customerError;
  console.log(`  ${customers.length} customers`);

  // --- Catalog -----------------------------------------------------------
  const productRows = [
    { name: 'UI/UX design', unit: 'screen', default_price_paise: 6000_00, tax_rate: 18, description: 'Screen design including one revision round.' },
    { name: 'Frontend development', unit: 'day', default_price_paise: 8000_00, tax_rate: 18, description: 'React/Next.js implementation.' },
    { name: 'Monthly retainer', unit: 'month', default_price_paise: 25000_00, tax_rate: 18, description: 'Ongoing support and small enhancements.' },
  ].map((row) => ({ ...row, business_id: business.id, default_discount_pct: 0 }));

  const { error: productError } = await admin.from('products').insert(productRows);
  if (productError) throw productError;
  console.log(`  ${productRows.length} catalog items`);

  // --- A quotation ---------------------------------------------------------
  const customer = customers[0];
  if (!customer) throw new Error('No customer was created to attach the demo quotation to.');
  const lines = [
    { qty: 8, ratePaise: 6000_00, discountPct: 0, taxRatePct: 18 },
    { qty: 12, ratePaise: 8000_00, discountPct: 5, taxRatePct: 18 },
  ];
  const totals = computeTotals(lines, 0, { taxMode: 'exclusive', roundTo: 'none' });

  const { data: quoteNumber } = await admin.rpc('next_document_number', {
    p_business_id: business.id,
    p_doc_type: 'quotation',
  });

  const { data: quote, error: quoteError } = await admin
    .from('quotations')
    .insert({
      business_id: business.id,
      customer_id: customer.id,
      number: quoteNumber,
      title: 'Website redesign',
      status: 'sent',
      issue_date: new Date().toISOString().slice(0, 10),
      valid_until: new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10),
      currency: business.currency,
      tax_mode: 'exclusive',
      doc_discount_pct: 0,
      subtotal_paise: totals.subtotalPaise,
      discount_paise: totals.discountPaise,
      tax_paise: totals.taxPaise,
      total_paise: totals.totalPaise,
      tax_breakup: totals.taxBreakup,
      scope: 'Redesign of the marketing website and rebuild of the frontend in Next.js.',
      deliverables: '• Eight designed screens\n• Responsive frontend build\n• Deployment to production',
      exclusions: '• Content writing\n• Ongoing hosting beyond 30 days\n• Third-party licence fees',
      payment_terms: '50% advance, 50% on completion.',
      created_by: user.id,
    })
    .select('id')
    .single();
  if (quoteError) throw quoteError;

  await admin.from('quotation_items').insert(
    lines.map((line, index) => ({
      business_id: business.id,
      quotation_id: quote.id,
      position: index,
      name: index === 0 ? 'UI/UX design' : 'Frontend development',
      unit: index === 0 ? 'screen' : 'day',
      qty: line.qty,
      rate_paise: line.ratePaise,
      discount_pct: line.discountPct,
      tax_rate: line.taxRatePct,
      line_total_paise: totals.lines[index]!.lineTotalPaise,
    })),
  );
  console.log(`  1 quotation (${quoteNumber})`);

  // --- A paid invoice --------------------------------------------------
  const invoiceLines = [{ qty: 1, ratePaise: 25000_00, discountPct: 0, taxRatePct: 18 }];
  const invoiceTotals = computeTotals(invoiceLines, 0, { taxMode: 'exclusive', roundTo: 'none' });

  const { data: invoiceNumber } = await admin.rpc('next_document_number', {
    p_business_id: business.id,
    p_doc_type: 'invoice',
  });

  const secondCustomer = customers[1] ?? customer;

  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .insert({
      business_id: business.id,
      customer_id: secondCustomer.id,
      number: invoiceNumber,
      title: 'Retainer — this month',
      status: 'sent',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10),
      currency: business.currency,
      tax_mode: 'exclusive',
      doc_discount_pct: 0,
      subtotal_paise: invoiceTotals.subtotalPaise,
      discount_paise: invoiceTotals.discountPaise,
      tax_paise: invoiceTotals.taxPaise,
      total_paise: invoiceTotals.totalPaise,
      tax_breakup: invoiceTotals.taxBreakup,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (invoiceError) throw invoiceError;

  await admin.from('invoice_items').insert({
    business_id: business.id,
    invoice_id: invoice.id,
    position: 0,
    name: 'Monthly retainer',
    unit: 'month',
    qty: 1,
    rate_paise: 25000_00,
    discount_pct: 0,
    tax_rate: 18,
    line_total_paise: invoiceTotals.lines[0]!.lineTotalPaise,
  });
  console.log(`  1 invoice (${invoiceNumber})`);

  console.log('\nDone. Sign in and check the dashboard.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
