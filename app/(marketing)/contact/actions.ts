'use server';

import { headers } from 'next/headers';
import { enforceRateLimit } from '@/lib/guards/rate-limit';
import { fieldErrors } from '@/lib/validation/common';
import { contactSchema } from '@/lib/validation/schemas';
import { checkEmailDeliverable } from '@/lib/validation/email-address';
import { sendEmail } from '@/lib/email/send';
import { contactFormEmail } from '@/lib/email/templates';

export interface FormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

async function clientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return list.get('x-real-ip') ?? 'unknown';
}

export async function submitContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
    company_website: formData.get('company_website'),
  });

  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) };
  }

  // Honeypot: a real visitor never fills this hidden field in. Report success
  // without sending anything, so the bot has no signal to adapt to.
  if (parsed.data.company_website) {
    return { ok: true, message: "Thanks — we'll get back to you soon." };
  }

  try {
    await enforceRateLimit('contact', await clientIp());
  } catch {
    return { ok: false, message: 'Too many messages sent from here. Please wait a bit and try again.' };
  }

  // A reply-to we cannot actually reply to makes the whole message useless.
  const deliverable = await checkEmailDeliverable(parsed.data.email);
  if (!deliverable.ok) {
    return { ok: false, errors: { email: deliverable.reason } };
  }

  const to = process.env.CONTACT_EMAIL || 'support@invora.app';
  const mail = contactFormEmail({
    name: parsed.data.name,
    email: parsed.data.email,
    message: parsed.data.message,
  });

  const result = await sendEmail({
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: parsed.data.email,
    template: 'contact_form',
  });

  // "Not configured" is expected in local dev (logged to the console instead)
  // and still counts as success from the visitor's point of view. An actual
  // provider failure should tell them to try another way to reach us.
  if (!result.sent && result.error !== 'email_not_configured') {
    return {
      ok: false,
      message: 'Could not send your message. Please try again, or email us directly.',
    };
  }

  return { ok: true, message: "Thanks — we'll get back to you within a business day." };
}
