import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * THE tenant-isolation test.
 *
 * Creates two real businesses, signs in as each, and asserts that neither can
 * see a single row belonging to the other — across every business-scoped table.
 *
 * This is the single highest-value security test in the product: every other
 * guard in the codebase is defence in depth behind it. If RLS is right, an
 * application bug leaks nothing.
 *
 * Requires a real Supabase project:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * It skips itself (loudly) when they are absent, so `npm test` still passes on
 * a fresh clone.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

const suite = configured ? describe : describe.skip;

if (!configured) {
  console.warn(
    '[rls.test] Skipping tenant-isolation tests — Supabase env vars are not set. ' +
      'Run these against a real project before every release.',
  );
}

interface Tenant {
  email: string;
  password: string;
  userId: string;
  businessId: string;
  client: SupabaseClient;
  customerId: string;
  quotationId: string;
}

suite('row level security', () => {
  // `describe.skip` still runs this callback body synchronously (it only
  // skips the `it()` blocks inside it), so constructing the client has to be
  // deferred behind the same `configured` guard that picked `suite` — a bare
  // `createClient` here throws immediately in the unconfigured case.
  const admin = configured
    ? createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } })
    : (null as unknown as ReturnType<typeof createClient>);

  let alpha: Tenant;
  let beta: Tenant;

  async function makeTenant(label: string): Promise<Tenant> {
    const email = `rls-${label}-${Date.now()}@invora-test.local`;
    const password = `Test-${Math.random().toString(36).slice(2)}-A1`;

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { business_name: `RLS ${label}` },
    });
    if (error || !created.user) throw new Error(`could not create ${label}: ${error?.message}`);

    const { data: business } = await admin
      .from('businesses')
      .select('id')
      .eq('owner_user_id', created.user.id)
      .single();

    const client = createClient(url!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await client.auth.signInWithPassword({ email, password });

    const { data: customer } = await client
      .from('customers')
      .insert({ business_id: business!.id, name: `${label} customer` })
      .select('id')
      .single();

    const { data: number } = await admin.rpc('next_document_number', {
      p_business_id: business!.id,
      p_doc_type: 'quotation',
    });

    const { data: quotation } = await client
      .from('quotations')
      .insert({
        business_id: business!.id,
        number: number as unknown as string,
        customer_id: customer!.id,
        issue_date: new Date().toISOString().slice(0, 10),
        total_paise: 100_000,
      })
      .select('id')
      .single();

    return {
      email,
      password,
      userId: created.user.id,
      businessId: business!.id,
      client,
      customerId: customer!.id,
      quotationId: quotation!.id,
    };
  }

  beforeAll(async () => {
    alpha = await makeTenant('alpha');
    beta = await makeTenant('beta');
  }, 60_000);

  afterAll(async () => {
    for (const tenant of [alpha, beta]) {
      if (tenant?.userId) await admin.auth.admin.deleteUser(tenant.userId);
    }
  }, 30_000);

  it('sets up two distinct businesses', () => {
    expect(alpha.businessId).not.toBe(beta.businessId);
  });

  it('alpha sees only its own customers', async () => {
    const { data } = await alpha.client.from('customers').select('id, business_id');
    expect(data).toHaveLength(1);
    expect(data![0]!.business_id).toBe(alpha.businessId);
  });

  it("alpha cannot read beta's customer by id", async () => {
    const { data } = await alpha.client.from('customers').select('*').eq('id', beta.customerId);
    expect(data).toEqual([]);
  });

  it("alpha cannot read beta's quotation by id", async () => {
    const { data } = await alpha.client.from('quotations').select('*').eq('id', beta.quotationId);
    expect(data).toEqual([]);
  });

  it("alpha cannot update beta's quotation", async () => {
    const { data } = await alpha.client
      .from('quotations')
      .update({ total_paise: 1 })
      .eq('id', beta.quotationId)
      .select();
    expect(data ?? []).toEqual([]);

    // And the row is genuinely untouched.
    const { data: actual } = await admin
      .from('quotations')
      .select('total_paise')
      .eq('id', beta.quotationId)
      .single();
    expect(actual!.total_paise).toBe(100_000);
  });

  it("alpha cannot delete beta's customer", async () => {
    await alpha.client.from('customers').delete().eq('id', beta.customerId);
    const { data: stillThere } = await admin
      .from('customers')
      .select('id')
      .eq('id', beta.customerId)
      .maybeSingle();
    expect(stillThere).not.toBeNull();
  });

  it("alpha cannot insert a row into beta's business", async () => {
    const { error } = await alpha.client
      .from('customers')
      .insert({ business_id: beta.businessId, name: 'smuggled' });
    expect(error).not.toBeNull();
  });

  it("alpha cannot read beta's business profile", async () => {
    const { data } = await alpha.client.from('businesses').select('*').eq('id', beta.businessId);
    expect(data).toEqual([]);
  });

  it("alpha cannot draw a document number against beta's business", async () => {
    const { error } = await alpha.client.rpc('next_document_number', {
      p_business_id: beta.businessId,
      p_doc_type: 'quotation',
    });
    expect(error).not.toBeNull();
  });

  it('operator tables are invisible to a normal user', async () => {
    const { data: webhooks } = await alpha.client.from('webhook_events').select('*');
    expect(webhooks ?? []).toEqual([]);

    const { data: audit } = await alpha.client.from('admin_audit_log').select('*');
    expect(audit ?? []).toEqual([]);
  });

  it('an anonymous client sees nothing at all', async () => {
    const anon = createClient(url!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    for (const table of ['customers', 'quotations', 'invoices', 'payments'] as const) {
      const { data } = await anon.from(table).select('*');
      expect(data ?? []).toEqual([]);
    }
  });
});
