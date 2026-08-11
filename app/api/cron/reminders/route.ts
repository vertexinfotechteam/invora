import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/guards/cron';
import { withApiErrors } from '@/lib/guards/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { hasFeature } from '@/lib/guards/features';
import { recordDocumentEvent } from '@/lib/events';
import { sendEmail } from '@/lib/email/send';
import { reminderEmail } from '@/lib/email/templates';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { buildShareUrl, generateShareToken } from '@/lib/share/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Days after the due date on which an automatic chase goes out. */
const OVERDUE_LADDER = [1, 7, 14, 30];
/** Days before the due date for the courtesy reminder. */
const PRE_DUE_DAYS = 3;
const MIN_HOURS_BETWEEN_REMINDERS = 48;

/**
 * GET /api/cron/reminders — daily.
 *
 * Scheduled reminders are a Premium feature, so the plan is checked per
 * business before anything is sent. Free-plan owners send reminders by hand
 * from the invoice page.
 */
export const GET = withApiErrors(async (request: NextRequest) => {
  requireCronAuth(request);

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: candidates } = await admin
    .from('invoices')
    .select(
      'id, business_id, number, currency, balance_paise, due_date, status, last_reminder_at, customer_id',
    )
    .gt('balance_paise', 0)
    .in('status', ['sent', 'viewed', 'partially_paid', 'overdue'])
    .not('due_date', 'is', null)
    .limit(500);

  let sent = 0;
  let skipped = 0;

  for (const invoice of candidates ?? []) {
    const dueDate = invoice.due_date!;
    const daysPastDue = daysBetween(dueDate, today);
    const isDueSoon = daysPastDue === -PRE_DUE_DAYS;
    const isOverdueStep = OVERDUE_LADDER.includes(daysPastDue);

    if (!isDueSoon && !isOverdueStep) {
      skipped += 1;
      continue;
    }

    if (invoice.last_reminder_at) {
      const hours = (now.getTime() - new Date(invoice.last_reminder_at).getTime()) / 3_600_000;
      if (hours < MIN_HOURS_BETWEEN_REMINDERS) {
        skipped += 1;
        continue;
      }
    }

    if (!(await hasFeature(invoice.business_id, 'scheduled_reminders'))) {
      skipped += 1;
      continue;
    }

    const [{ data: customer }, { data: business }] = await Promise.all([
      invoice.customer_id
        ? admin.from('customers').select('name, email').eq('id', invoice.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from('businesses')
        .select('name, brand_color')
        .eq('id', invoice.business_id)
        .maybeSingle(),
    ]);

    if (!customer?.email) {
      skipped += 1;
      continue;
    }

    const payUrl = await ensureShareUrl(invoice.id, invoice.business_id);
    const overdue = daysPastDue > 0;

    const message = overdue
      ? `Our records show invoice ${invoice.number} is now ${daysPastDue} day${daysPastDue === 1 ? '' : 's'} past its due date, with ${formatPaise(invoice.balance_paise, invoice.currency)} outstanding. If the payment is already on its way, please ignore this note — otherwise you can settle it using the link below.`
      : `A friendly reminder that invoice ${invoice.number} is due on ${formatDate(dueDate)}. You can view it and pay online using the link below.`;

    const mail = reminderEmail({
      businessName: business?.name || 'Your supplier',
      brandColor: business?.brand_color || '#4F46E5',
      customerName: customer.name,
      docNumber: invoice.number,
      amountFormatted: formatPaise(invoice.balance_paise, invoice.currency),
      dueDate: formatDate(dueDate),
      overdue,
      message,
      payUrl,
    });

    const result = await sendEmail({
      to: customer.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      businessId: invoice.business_id,
      template: overdue ? 'overdue_reminder' : 'due_reminder',
      docType: 'invoice',
      docId: invoice.id,
    });

    if (!result.sent) {
      skipped += 1;
      continue;
    }

    await admin
      .from('invoices')
      .update({ last_reminder_at: now.toISOString() })
      .eq('id', invoice.id);

    await recordDocumentEvent({
      businessId: invoice.business_id,
      docType: 'invoice',
      docId: invoice.id,
      event: 'reminder_sent',
      actor: 'system',
      meta: { overdue, days_past_due: daysPastDue },
    });

    sent += 1;
  }

  return NextResponse.json({ sent, skipped });
});

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Reuses a live share link where one exists, otherwise mints one. */
async function ensureShareUrl(invoiceId: string, businessId: string): Promise<string> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('share_links')
    .select('id, expires_at')
    .eq('doc_type', 'invoice')
    .eq('doc_id', invoiceId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const stillValid = existing?.expires_at ? new Date(existing.expires_at) > new Date() : false;
  if (existing && stillValid) {
    // The raw token is not recoverable from its hash, so a reminder for an
    // existing link mints a fresh one and revokes the old.
    await admin.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('id', existing.id);
  }

  const { token, tokenHash } = generateShareToken();
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 60);

  await admin.from('share_links').insert({
    business_id: businessId,
    doc_type: 'invoice',
    doc_id: invoiceId,
    token_hash: tokenHash,
    expires_at: expires.toISOString(),
  });

  return buildShareUrl('invoice', token);
}
