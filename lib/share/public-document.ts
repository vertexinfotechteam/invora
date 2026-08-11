import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { hashToken, isWellFormedToken } from '@/lib/share/tokens';
import { recordDocumentEvent } from '@/lib/events';
import type { DocumentType } from '@/lib/types/database';

export interface PublicDocument {
  docType: DocumentType;
  doc: Record<string, unknown> & {
    id: string;
    business_id: string;
    number: string;
    status: string;
    currency: string;
    total_paise: number;
  };
  items: {
    name: string;
    description: string | null;
    unit: string;
    qty: number;
    rate_paise: number;
    discount_pct: number;
    tax_rate: number;
    line_total_paise: number;
  }[];
  business: {
    name: string;
    legal_name: string | null;
    logo_url: string | null;
    email: string | null;
    phone: string | null;
    gstin: string | null;
    brand_color: string;
    city: string | null;
    state: string | null;
    upi_id: string | null;
  };
  customer: { name: string; company: string | null } | null;
}

/**
 * Resolves a public token to a document, and records the first view.
 *
 * Returns null for a bad, revoked or expired token — the caller renders the
 * same "not available" page for all three, because telling a scanner which one
 * it hit is information it should not have.
 */
export async function resolvePublicDocument(
  token: string,
  expectedType: DocumentType,
): Promise<PublicDocument | null> {
  if (!isWellFormedToken(token)) return null;

  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from('share_links')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  const expired = link?.expires_at ? new Date(link.expires_at) < new Date() : false;
  if (!link || link.revoked_at || expired || link.doc_type !== expectedType) return null;

  const table = expectedType === 'quotation' ? 'quotations' : 'invoices';
  const itemsTable = expectedType === 'quotation' ? 'quotation_items' : 'invoice_items';
  const fk = expectedType === 'quotation' ? 'quotation_id' : 'invoice_id';

  const { data: doc } = await admin.from(table).select('*').eq('id', link.doc_id).maybeSingle();
  if (!doc) return null;

  const [{ data: items }, { data: business }, { data: customer }] = await Promise.all([
    admin.from(itemsTable).select('*').eq(fk, doc.id).order('position'),
    admin
      .from('businesses')
      .select('name, legal_name, logo_url, email, phone, gstin, brand_color, city, state, upi_id')
      .eq('id', doc.business_id)
      .single(),
    doc.customer_id
      ? admin.from('customers').select('name, company').eq('id', doc.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!business) return null;

  // First view flips sent -> viewed and lands on the owner's timeline. This is
  // the "did they actually open it?" signal, so it fires once, on first load.
  const firstView = !link.viewed_at;
  await admin
    .from('share_links')
    .update({
      viewed_at: link.viewed_at ?? new Date().toISOString(),
      view_count: (link.view_count ?? 0) + 1,
    })
    .eq('id', link.id);

  if (firstView) {
    if (doc.status === 'sent') {
      await admin
        .from(table)
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', doc.id);
      doc.status = 'viewed';
    }

    await recordDocumentEvent({
      businessId: doc.business_id,
      docType: expectedType,
      docId: doc.id,
      event: 'viewed',
      actor: 'customer',
    });
  }

  return {
    docType: expectedType,
    doc: doc as PublicDocument['doc'],
    items: (items ?? []).map((item) => ({
      name: item.name,
      description: item.description,
      unit: item.unit,
      qty: Number(item.qty),
      rate_paise: item.rate_paise,
      discount_pct: Number(item.discount_pct),
      tax_rate: Number(item.tax_rate),
      line_total_paise: item.line_total_paise,
    })),
    business,
    customer: (customer as { name: string; company: string | null } | null) ?? null,
  };
}
