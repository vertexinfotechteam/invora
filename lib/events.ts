import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { DocumentEventKind, DocumentType, Json } from '@/lib/types/database';

export interface RecordEventInput {
  businessId: string;
  docType: DocumentType;
  docId: string;
  event: DocumentEventKind;
  actor?: string;
  actorId?: string | null;
  meta?: Record<string, Json>;
}

/**
 * Appends to the document timeline.
 *
 * Uses the service-role client because some legitimate writers have no session:
 * the public accept/reject page, the Razorpay webhook, and the nightly cron.
 * Every call still passes an explicit businessId, so the row is scoped.
 */
export async function recordDocumentEvent(input: RecordEventInput): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from('document_events').insert({
      business_id: input.businessId,
      doc_type: input.docType,
      doc_id: input.docId,
      event: input.event,
      actor: input.actor ?? 'system',
      actor_id: input.actorId ?? null,
      meta: input.meta ?? {},
    });
  } catch (error) {
    // The timeline is an audit convenience; never fail the user's action for it.
    console.error('[invora:events] failed to record document event', error);
  }
}

export async function listDocumentEvents(docType: DocumentType, docId: string, limit = 50) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('document_events')
    .select('*')
    .eq('doc_type', docType)
    .eq('doc_id', docId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}

export const EVENT_LABELS: Record<DocumentEventKind, string> = {
  created: 'Created',
  edited: 'Edited',
  sent: 'Sent to customer',
  viewed: 'Viewed by customer',
  accepted: 'Accepted',
  rejected: 'Declined',
  expired: 'Expired',
  converted: 'Converted to invoice',
  payment_recorded: 'Payment recorded',
  paid: 'Paid in full',
  reminder_sent: 'Reminder sent',
  cancelled: 'Cancelled',
};
