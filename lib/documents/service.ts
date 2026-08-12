import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { computeTotals, totalsAreConsistent, type LineInput } from '@/lib/calc/totals';
import { requireDocumentQuota } from '@/lib/guards/quota';
import { recordDocumentEvent } from '@/lib/events';
import { badRequest, notFound } from '@/lib/guards/errors';
import type { InvoiceInput, LineItemInput, QuotationInput } from '@/lib/validation/schemas';
import type { DocumentType } from '@/lib/types/database';

/**
 * The one path that writes a document.
 *
 * Both the human editor and the AI-assisted flow funnel through here, so the
 * totals stored in the database are always the output of computeTotals — never
 * a number that arrived from the browser, and never a number a model produced.
 */

function toCalcLines(items: LineItemInput[]): LineInput[] {
  return items.map((item) => ({
    qty: item.qty,
    ratePaise: item.rate_paise,
    discountPct: item.discount_pct,
    taxRatePct: item.tax_rate,
  }));
}

/**
 * The database's foreign keys (customer_id, quotation_id, product_id) only
 * check that the referenced row exists *somewhere* — not that it belongs to
 * the business making the request. Without this, a payload built by hand
 * (the editor UI never offers another tenant's id, but the server action
 * accepts whatever JSON it is given) could permanently link this document to
 * another business's customer/quotation/product. `supabase` here is the
 * RLS-scoped client, so a row that exists but belongs to someone else reads
 * back as not-found — exactly like it not existing at all.
 */
async function verifyOwned(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: 'customers' | 'quotations' | 'products',
  id: string,
): Promise<boolean> {
  const { data } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
  return Boolean(data);
}

export interface SaveResult {
  id: string;
  number: string;
  totals: ReturnType<typeof computeTotals>;
}

export async function saveQuotation(params: {
  businessId: string;
  userId: string;
  quotationId: string | null;
  input: QuotationInput;
}): Promise<SaveResult> {
  const { businessId, userId, quotationId, input } = params;
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const totals = computeTotals(toCalcLines(input.items), input.doc_discount_pct, {
    taxMode: input.tax_mode,
    roundTo: 'none',
  });

  if (!totalsAreConsistent(totals)) {
    // Defensive: this can only fire if computeTotals itself regressed.
    throw badRequest('Totals failed their internal consistency check. Nothing was saved.');
  }

  if (input.customer_id && !(await verifyOwned(supabase, 'customers', input.customer_id))) {
    throw badRequest('That customer could not be found.');
  }

  let id = quotationId;
  let number: string;

  if (!id) {
    // Metered on creation, not on every autosave.
    await requireDocumentQuota(businessId, 1);

    const { data: drawn, error: numberError } = await admin.rpc('next_document_number', {
      p_business_id: businessId,
      p_doc_type: 'quotation' as DocumentType,
    });
    if (numberError || !drawn) throw badRequest('Could not allocate a quotation number.');
    number = drawn as unknown as string;

    const { data, error } = await supabase
      .from('quotations')
      .insert({
        business_id: businessId,
        number,
        customer_id: input.customer_id ?? null,
        title: input.title ?? null,
        issue_date: input.issue_date,
        valid_until: input.valid_until ?? null,
        currency: input.currency,
        tax_mode: input.tax_mode,
        doc_discount_pct: input.doc_discount_pct,
        subtotal_paise: totals.subtotalPaise,
        discount_paise: totals.discountPaise,
        tax_paise: totals.taxPaise,
        total_paise: totals.totalPaise,
        tax_breakup: totals.taxBreakup,
        notes: input.notes ?? null,
        scope: input.scope ?? null,
        deliverables: input.deliverables ?? null,
        exclusions: input.exclusions ?? null,
        payment_terms: input.payment_terms ?? null,
        terms: input.terms ?? null,
        created_by: userId,
      })
      .select('id, number')
      .single();

    if (error || !data) throw badRequest(error?.message ?? 'Could not create the quotation.');
    id = data.id as string;
    number = data.number;

    await recordDocumentEvent({
      businessId,
      docType: 'quotation',
      docId: id,
      event: 'created',
      actor: 'user',
      actorId: userId,
    });
  } else {
    const { data, error } = await supabase
      .from('quotations')
      .update({
        customer_id: input.customer_id ?? null,
        title: input.title ?? null,
        issue_date: input.issue_date,
        valid_until: input.valid_until ?? null,
        currency: input.currency,
        tax_mode: input.tax_mode,
        doc_discount_pct: input.doc_discount_pct,
        subtotal_paise: totals.subtotalPaise,
        discount_paise: totals.discountPaise,
        tax_paise: totals.taxPaise,
        total_paise: totals.totalPaise,
        tax_breakup: totals.taxBreakup,
        notes: input.notes ?? null,
        scope: input.scope ?? null,
        deliverables: input.deliverables ?? null,
        exclusions: input.exclusions ?? null,
        payment_terms: input.payment_terms ?? null,
        terms: input.terms ?? null,
      })
      .eq('id', id)
      .eq('business_id', businessId)
      .select('id, number')
      .single();

    if (error || !data) throw notFound('Quotation not found.');
    number = data.number;
  }

  await replaceItems('quotation_items', 'quotation_id', id, businessId, input.items, totals);

  return { id, number, totals };
}

export async function saveInvoice(params: {
  businessId: string;
  userId: string;
  invoiceId: string | null;
  input: InvoiceInput;
}): Promise<SaveResult> {
  const { businessId, userId, invoiceId, input } = params;
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const totals = computeTotals(toCalcLines(input.items), input.doc_discount_pct, {
    taxMode: input.tax_mode,
    roundTo: 'none',
  });

  if (!totalsAreConsistent(totals)) {
    throw badRequest('Totals failed their internal consistency check. Nothing was saved.');
  }

  if (input.customer_id && !(await verifyOwned(supabase, 'customers', input.customer_id))) {
    throw badRequest('That customer could not be found.');
  }
  if (input.quotation_id && !(await verifyOwned(supabase, 'quotations', input.quotation_id))) {
    throw badRequest('That quotation could not be found.');
  }

  let id = invoiceId;
  let number: string;

  if (!id) {
    await requireDocumentQuota(businessId, 1);

    const { data: drawn, error: numberError } = await admin.rpc('next_document_number', {
      p_business_id: businessId,
      p_doc_type: 'invoice' as DocumentType,
    });
    if (numberError || !drawn) throw badRequest('Could not allocate an invoice number.');
    number = drawn as unknown as string;

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        business_id: businessId,
        number,
        customer_id: input.customer_id ?? null,
        quotation_id: input.quotation_id ?? null,
        title: input.title ?? null,
        issue_date: input.issue_date,
        due_date: input.due_date ?? null,
        currency: input.currency,
        tax_mode: input.tax_mode,
        doc_discount_pct: input.doc_discount_pct,
        subtotal_paise: totals.subtotalPaise,
        discount_paise: totals.discountPaise,
        tax_paise: totals.taxPaise,
        total_paise: totals.totalPaise,
        tax_breakup: totals.taxBreakup,
        notes: input.notes ?? null,
        scope: input.scope ?? null,
        payment_terms: input.payment_terms ?? null,
        terms: input.terms ?? null,
        created_by: userId,
      })
      .select('id, number')
      .single();

    if (error || !data) throw badRequest(error?.message ?? 'Could not create the invoice.');
    id = data.id as string;
    number = data.number;

    await recordDocumentEvent({
      businessId,
      docType: 'invoice',
      docId: id,
      event: 'created',
      actor: 'user',
      actorId: userId,
    });
  } else {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        customer_id: input.customer_id ?? null,
        title: input.title ?? null,
        issue_date: input.issue_date,
        due_date: input.due_date ?? null,
        currency: input.currency,
        tax_mode: input.tax_mode,
        doc_discount_pct: input.doc_discount_pct,
        subtotal_paise: totals.subtotalPaise,
        discount_paise: totals.discountPaise,
        tax_paise: totals.taxPaise,
        total_paise: totals.totalPaise,
        tax_breakup: totals.taxBreakup,
        notes: input.notes ?? null,
        scope: input.scope ?? null,
        payment_terms: input.payment_terms ?? null,
        terms: input.terms ?? null,
      })
      .eq('id', id)
      .eq('business_id', businessId)
      .select('id, number')
      .single();

    if (error || !data) throw notFound('Invoice not found.');
    number = data.number;
  }

  await replaceItems('invoice_items', 'invoice_id', id, businessId, input.items, totals);

  return { id, number, totals };
}

/**
 * Line items are replaced wholesale on save. Reconciling row-by-row buys
 * nothing here — the editor sends the full array every time — and a diff
 * algorithm is one more place for a line to silently vanish.
 *
 * Insert-then-delete, not delete-then-insert, and both errors are checked:
 * `position` is only indexed (not unique), so the new and old rows for the
 * same document can coexist for the moment between the two calls without a
 * constraint conflict. That ordering means a failed insert leaves the
 * previous items completely untouched — no possible data loss — and a failed
 * delete (rare) surfaces as a thrown error instead of silently leaving
 * duplicate rows behind the way the reverse order would.
 */
async function replaceItems(
  table: 'quotation_items' | 'invoice_items',
  fk: 'quotation_id' | 'invoice_id',
  docId: string,
  businessId: string,
  items: LineItemInput[],
  totals: ReturnType<typeof computeTotals>,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // Same cross-tenant concern as customer_id/quotation_id above: verify every
  // referenced product actually belongs to this business (via the RLS-scoped
  // client) before it can be linked to a line item. A product_id that fails
  // this — someone else's, or already deleted — is dropped rather than
  // failing the whole save, the same tolerance the DB's own `on delete set
  // null` gives a legitimately-removed product.
  const requestedProductIds = [...new Set(items.map((item) => item.product_id).filter((id): id is string => Boolean(id)))];
  let ownedProductIds = new Set<string>();
  if (requestedProductIds.length > 0) {
    const { data: owned } = await supabase.from('products').select('id').in('id', requestedProductIds);
    ownedProductIds = new Set((owned ?? []).map((row) => row.id as string));
  }

  let newIds: string[] = [];

  if (items.length > 0) {
    const rows = items.map((item, index) => ({
      business_id: businessId,
      [fk]: docId,
      product_id: item.product_id && ownedProductIds.has(item.product_id) ? item.product_id : null,
      position: index,
      name: item.name,
      description: item.description ?? null,
      unit: item.unit,
      qty: item.qty,
      rate_paise: item.rate_paise,
      discount_pct: item.discount_pct,
      tax_rate: item.tax_rate,
      hsn_sac: item.hsn_sac ?? null,
      // Stored from the engine's output, never from the client payload.
      line_total_paise: totals.lines[index]?.lineTotalPaise ?? 0,
    }));

    const { data, error } = await supabase.from(table).insert(rows as never).select('id');
    if (error) throw badRequest(`Could not save line items: ${error.message}`);
    newIds = (data ?? []).map((row) => (row as { id: string }).id);
  }

  let deleteQuery = supabase.from(table).delete().eq(fk, docId).eq('business_id', businessId);
  if (newIds.length > 0) deleteQuery = deleteQuery.not('id', 'in', `(${newIds.join(',')})`);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw badRequest(`Could not remove the previous line items: ${deleteError.message}`);
}

/** Loads a document plus its items, scoped by RLS. */
export async function loadDocument(docType: DocumentType, docId: string) {
  const supabase = await createSupabaseServerClient();
  const table = docType === 'quotation' ? 'quotations' : 'invoices';
  const itemsTable = docType === 'quotation' ? 'quotation_items' : 'invoice_items';
  const fk = docType === 'quotation' ? 'quotation_id' : 'invoice_id';

  const [{ data: doc }, { data: items }] = await Promise.all([
    supabase.from(table).select('*, customers(*)').eq('id', docId).maybeSingle(),
    supabase.from(itemsTable).select('*').eq(fk, docId).order('position', { ascending: true }),
  ]);

  if (!doc) throw notFound('Document not found.');
  return { doc, items: items ?? [] };
}
