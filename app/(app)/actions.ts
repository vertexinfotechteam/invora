'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireBusiness } from '@/lib/guards/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { saveInvoice, saveQuotation } from '@/lib/documents/service';
import { recordDocumentEvent } from '@/lib/events';
import { ApiError } from '@/lib/guards/errors';
import { requireDocumentQuota } from '@/lib/guards/quota';
import { fieldErrors } from '@/lib/validation/common';
import {
  businessBankSchema,
  businessBrandingSchema,
  businessDefaultsSchema,
  businessProfileSchema,
  customerSchema,
  invoiceSchema,
  productSchema,
  quotationSchema,
} from '@/lib/validation/schemas';
import type { DocumentType } from '@/lib/types/database';

export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: Record<string, unknown>;
}

/** Turns thrown ApiErrors (402 quota, 403 feature) into a form message. */
async function guarded<T>(fn: () => Promise<T>): Promise<{ result?: T; state?: ActionState }> {
  try {
    return { result: await fn() };
  } catch (error) {
    if (error instanceof ApiError) {
      return { state: { ok: false, message: error.message, data: error.details as never } };
    }
    // A redirect() inside an action throws — let it through untouched.
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error('[invora:action]', error);
    return { state: { ok: false, message: 'Something went wrong. Please try again.' } };
  }
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export async function saveCustomerAction(
  customerId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { business } = await requireBusiness();
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  let targetId = customerId;

  if (customerId) {
    const { error } = await supabase
      .from('customers')
      .update(parsed.data)
      .eq('id', customerId)
      .eq('business_id', business.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { data, error } = await supabase
      .from('customers')
      .insert({ ...parsed.data, business_id: business.id })
      .select('id')
      .single();
    if (error || !data) return { ok: false, message: error?.message ?? 'Could not save the customer.' };
    targetId = data.id;
  }

  revalidatePath('/customers');
  redirect(`/customers/${targetId}`);
}

export async function archiveCustomerAction(customerId: string): Promise<void> {
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  await supabase
    .from('customers')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', customerId)
    .eq('business_id', business.id);

  revalidatePath('/customers');
  redirect('/customers');
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
export async function saveProductAction(
  productId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { business } = await requireBusiness();

  const raw = Object.fromEntries(formData);
  const parsed = productSchema.safeParse({
    ...raw,
    default_price_paise: Number(raw.default_price_paise ?? 0),
    tax_rate: Number(raw.tax_rate ?? 0),
    default_discount_pct: Number(raw.default_discount_pct ?? 0),
  });

  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();

  if (productId) {
    const { error } = await supabase
      .from('products')
      .update(parsed.data)
      .eq('id', productId)
      .eq('business_id', business.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase
      .from('products')
      .insert({ ...parsed.data, business_id: business.id });
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath('/products');
  redirect('/products');
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export interface SaveDocumentResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  id?: string;
  number?: string;
  totals?: { subtotalPaise: number; discountPaise: number; taxPaise: number; totalPaise: number };
}

/**
 * Called by the editor's autosave and by the explicit Save button.
 *
 * Note what is NOT accepted from the client: any total. The payload carries
 * line items and percentages; computeTotals produces every figure that is
 * written.
 */
export async function saveDocumentAction(
  docType: DocumentType,
  docId: string | null,
  payload: unknown,
): Promise<SaveDocumentResult> {
  const { user, business } = await requireBusiness();

  if (docType === 'quotation') {
    const parsed = quotationSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, message: 'Some fields need attention.', errors: fieldErrors(parsed.error) };
    }

    const { result, state } = await guarded(() =>
      saveQuotation({ businessId: business.id, userId: user.id, quotationId: docId, input: parsed.data }),
    );
    if (state) return state;

    revalidatePath('/quotations');
    return {
      ok: true,
      id: result!.id,
      number: result!.number,
      totals: {
        subtotalPaise: result!.totals.subtotalPaise,
        discountPaise: result!.totals.discountPaise,
        taxPaise: result!.totals.taxPaise,
        totalPaise: result!.totals.totalPaise,
      },
    };
  }

  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: 'Some fields need attention.', errors: fieldErrors(parsed.error) };
  }

  const { result, state } = await guarded(() =>
    saveInvoice({ businessId: business.id, userId: user.id, invoiceId: docId, input: parsed.data }),
  );
  if (state) return state;

  revalidatePath('/invoices');
  return {
    ok: true,
    id: result!.id,
    number: result!.number,
    totals: {
      subtotalPaise: result!.totals.subtotalPaise,
      discountPaise: result!.totals.discountPaise,
      taxPaise: result!.totals.taxPaise,
      totalPaise: result!.totals.totalPaise,
    },
  };
}

export async function convertQuotationAction(quotationId: string): Promise<void> {
  const { business } = await requireBusiness();
  const admin = createSupabaseAdminClient();

  const { data: quote } = await admin
    .from('quotations')
    .select('business_id')
    .eq('id', quotationId)
    .maybeSingle();

  if (!quote || quote.business_id !== business.id) redirect('/quotations');

  const { data: invoiceId, error } = await admin.rpc('convert_quotation_to_invoice', {
    p_quotation_id: quotationId,
  });

  if (error || !invoiceId) {
    console.error('[convertQuotationAction] rpc failed', { quotationId, error });
    redirect(`/quotations/${quotationId}?error=convert_failed`);
  }

  revalidatePath('/invoices');
  revalidatePath('/quotations');
  redirect(`/invoices/${invoiceId as unknown as string}`);
}

export async function duplicateDocumentAction(
  docType: DocumentType,
  docId: string,
): Promise<void> {
  const { user, business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const table = docType === 'quotation' ? 'quotations' : 'invoices';
  const itemsTable = docType === 'quotation' ? 'quotation_items' : 'invoice_items';
  const fk = docType === 'quotation' ? 'quotation_id' : 'invoice_id';

  // Duplicating mints a brand-new document just like Save does — it must be
  // metered the same way, or the monthly document allowance is bypassed by
  // repeatedly duplicating a single draft instead of creating new ones.
  try {
    await requireDocumentQuota(business.id, 1);
  } catch (error) {
    if (error instanceof ApiError) redirect(`/${table}/${docId}?error=quota_exceeded`);
    throw error;
  }

  const [{ data: source }, { data: items }] = await Promise.all([
    supabase.from(table).select('*').eq('id', docId).maybeSingle(),
    supabase.from(itemsTable).select('*').eq(fk, docId).order('position'),
  ]);

  if (!source) redirect(`/${table}`);

  const { data: number } = await admin.rpc('next_document_number', {
    p_business_id: business.id,
    p_doc_type: docType,
  });

  const {
    id: _id,
    number: _number,
    status: _status,
    created_at: _createdAt,
    updated_at: _updatedAt,
    sent_at: _sentAt,
    viewed_at: _viewedAt,
    ...rest
  } = source as Record<string, unknown> & { id: string };

  // quotations and invoices don't share these columns — mixing them into one
  // clone object made every duplicate insert fail with an unknown-column error,
  // for quotations and invoices alike, since PostgREST rejects a payload key
  // that isn't a real column on the target table.
  const resetFields: Record<string, unknown> =
    docType === 'invoice'
      ? { paid_at: null, amount_paid_paise: 0, last_reminder_at: null }
      : {
          converted_invoice_id: null,
          responded_at: null,
          accepted_by_name: null,
          accepted_ip: null,
          accepted_user_agent: null,
        };

  const clone: Record<string, unknown> = {
    ...rest,
    business_id: business.id,
    number: number as unknown as string,
    status: 'draft',
    created_by: user.id,
    ...resetFields,
  };
  // balance_paise is generated on invoices; it cannot be written.
  delete clone.balance_paise;

  const { data: created, error } = await supabase
    .from(table)
    .insert(clone as never)
    .select('id')
    .single();

  if (error || !created) {
    console.error('[duplicateDocumentAction] insert failed', { docType, docId, error });
    redirect(`/${table}/${docId}?error=duplicate_failed`);
  }

  if (items?.length) {
    await supabase.from(itemsTable).insert(
      items.map((item) => {
        const { id: _itemId, created_at: _itemCreated, ...itemRest } = item as Record<string, unknown>;
        return { ...itemRest, [fk]: created.id, business_id: business.id };
      }) as never,
    );
  }

  await recordDocumentEvent({
    businessId: business.id,
    docType,
    docId: created.id,
    event: 'created',
    actor: 'user',
    actorId: user.id,
    meta: { duplicated_from: docId },
  });

  revalidatePath(`/${table}`);
  redirect(`/${table}/${created.id}`);
}

export async function deleteDraftAction(docType: DocumentType, docId: string): Promise<void> {
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();
  const table = docType === 'quotation' ? 'quotations' : 'invoices';

  // Drafts only. A sent document is a financial record and gets cancelled,
  // never deleted.
  await supabase
    .from(table)
    .delete()
    .eq('id', docId)
    .eq('business_id', business.id)
    .eq('status', 'draft');

  revalidatePath(`/${table}`);
  redirect(`/${table}`);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
async function updateBusiness(
  values: Record<string, unknown>,
  paths: string[],
): Promise<ActionState> {
  const { business } = await requireBusiness();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from('businesses').update(values).eq('id', business.id);
  if (error) return { ok: false, message: error.message };

  for (const path of paths) revalidatePath(path);
  return { ok: true, message: 'Saved.' };
}

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = businessProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }
  return updateBusiness(parsed.data, ['/settings/profile', '/dashboard']);
}

export async function saveDefaultsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = businessDefaultsSchema.safeParse({
    ...raw,
    default_tax_rate: Number(raw.default_tax_rate ?? 18),
  });
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }
  return updateBusiness(parsed.data, ['/settings/defaults']);
}

export async function saveBrandingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = businessBrandingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }

  // Premium templates are gated on the server; the picker hiding them is only
  // a convenience.
  const { business } = await requireBusiness();
  const { assertTemplateAllowed } = await import('@/lib/guards/features');
  const { state } = await guarded(() => assertTemplateAllowed(business.id, parsed.data.pdf_template));
  if (state) return state;

  return updateBusiness(parsed.data, ['/settings/branding']);
}

export async function saveBankAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = businessBankSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }
  return updateBusiness(parsed.data, ['/settings/profile']);
}
