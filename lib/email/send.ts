import 'server-only';

import { Resend } from 'resend';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { DocumentType } from '@/lib/types/database';

let cached: Resend | null = null;

function getResend(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

export interface SendEmailInput {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
  /** Bookkeeping for email_log. */
  businessId?: string | null;
  template: string;
  docType?: DocumentType | null;
  docId?: string | null;
}

export interface SendEmailResult {
  sent: boolean;
  providerId?: string;
  error?: string;
}

/**
 * Sends and records. Every send writes an email_log row so "did the reminder
 * actually go out?" is answerable without opening the Resend dashboard.
 *
 * With no RESEND_API_KEY configured (local dev), the message is logged to the
 * console and recorded as `skipped` rather than throwing — so the rest of the
 * flow is still testable.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getResend();
  const from = process.env.EMAIL_FROM ?? 'Invora <onboarding@resend.dev>';
  const admin = createSupabaseAdminClient();

  if (!resend) {
    console.info(`[invora:email] RESEND_API_KEY not set — would send "${input.subject}" to ${input.to}`);
    await recordLog(input, 'skipped', null, 'RESEND_API_KEY not configured');
    return { sent: false, error: 'email_not_configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? process.env.EMAIL_REPLY_TO,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
      })),
    });

    if (error) {
      await recordLog(input, 'failed', null, error.message);
      return { sent: false, error: error.message };
    }

    await recordLog(input, 'sent', data?.id ?? null);
    return { sent: true, providerId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown email error';
    console.error('[invora:email] send failed', error);
    await recordLog(input, 'failed', null, message);
    return { sent: false, error: message };
  }

  async function recordLog(
    payload: SendEmailInput,
    status: string,
    providerId: string | null,
    errorText?: string,
  ) {
    try {
      await admin.from('email_log').insert({
        business_id: payload.businessId ?? null,
        to_email: payload.to,
        template: payload.template,
        subject: payload.subject,
        doc_type: payload.docType ?? null,
        doc_id: payload.docId ?? null,
        provider_id: providerId,
        status,
        error: errorText ?? null,
      });
    } catch (logError) {
      console.error('[invora:email] failed to write email_log row', logError);
    }
  }
}
