/**
 * Transactional email bodies.
 *
 * Hand-rolled HTML rather than a component library: these render inside Gmail,
 * Outlook and a dozen mobile clients, so the safest thing is a single centred
 * table with inline styles and a plain-text alternative for every message.
 *
 * Everything interpolated here is escaped — a customer-supplied company name
 * must never be able to inject markup into an email we send on their behalf.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface LayoutOptions {
  brandColor: string;
  businessName: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

function layout(options: LayoutOptions): string {
  const { brandColor, businessName, preheader, bodyHtml, ctaLabel, ctaUrl, footerNote } = options;

  const cta =
    ctaLabel && ctaUrl
      ? `<tr><td style="padding:8px 32px 28px 32px;">
           <a href="${escapeHtml(ctaUrl)}"
              style="display:inline-block;background:${escapeHtml(brandColor)};color:#ffffff;
                     text-decoration:none;padding:12px 22px;border-radius:8px;
                     font-weight:600;font-size:15px;">${escapeHtml(ctaLabel)}</a>
         </td></tr>`
      : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(businessName)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;
                box-shadow:0 1px 3px rgba(15,23,42,.08);">
    <tr><td style="height:4px;background:${escapeHtml(brandColor)};"></td></tr>
    <tr><td style="padding:28px 32px 4px 32px;">
      <p style="margin:0;font-size:13px;color:#64748b;font-weight:600;letter-spacing:.4px;">
        ${escapeHtml(businessName)}
      </p>
    </td></tr>
    <tr><td style="padding:8px 32px 20px 32px;color:#0f172a;font-size:15px;line-height:1.6;">
      ${bodyHtml}
    </td></tr>
    ${cta}
    <tr><td style="padding:0 32px 26px 32px;color:#94a3b8;font-size:12px;line-height:1.5;">
      ${footerNote ? `${escapeHtml(footerNote)}<br><br>` : ''}
      Sent with Invora by Vertex Infotech.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export interface DocumentEmailInput {
  businessName: string;
  brandColor: string;
  customerName: string;
  docLabel: string;
  docNumber: string;
  amountFormatted: string;
  dueOrValidLabel: string;
  dueOrValidDate?: string | null;
  message: string;
  viewUrl: string;
}

export function documentEmail(input: DocumentEmailInput): { subject: string; html: string; text: string } {
  const subject = `${input.docLabel} ${input.docNumber} from ${input.businessName}`;

  const detail = input.dueOrValidDate
    ? `<tr><td style="padding:4px 0;color:#64748b;">${escapeHtml(input.dueOrValidLabel)}</td>
       <td style="padding:4px 0;text-align:right;">${escapeHtml(input.dueOrValidDate)}</td></tr>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Hi ${escapeHtml(input.customerName)},</p>
    <p style="margin:0 0 18px 0;white-space:pre-line;">${escapeHtml(input.message)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:#f8fafc;border-radius:10px;padding:14px 16px;font-size:14px;">
      <tr><td style="padding:4px 0;color:#64748b;">${escapeHtml(input.docLabel)}</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(input.docNumber)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Amount</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(input.amountFormatted)}</td></tr>
      ${detail}
    </table>`;

  const text = [
    `Hi ${input.customerName},`,
    '',
    input.message,
    '',
    `${input.docLabel}: ${input.docNumber}`,
    `Amount: ${input.amountFormatted}`,
    input.dueOrValidDate ? `${input.dueOrValidLabel}: ${input.dueOrValidDate}` : '',
    '',
    `View online: ${input.viewUrl}`,
    '',
    `— ${input.businessName}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    text,
    html: layout({
      brandColor: input.brandColor,
      businessName: input.businessName,
      preheader: `${input.docLabel} ${input.docNumber} — ${input.amountFormatted}`,
      bodyHtml,
      ctaLabel: `View ${input.docLabel.toLowerCase()}`,
      ctaUrl: input.viewUrl,
      footerNote: 'This link is private. Please do not forward it.',
    }),
  };
}

export interface ReminderEmailInput {
  businessName: string;
  brandColor: string;
  customerName: string;
  docNumber: string;
  amountFormatted: string;
  dueDate?: string | null;
  overdue: boolean;
  message: string;
  payUrl: string;
}

export function reminderEmail(input: ReminderEmailInput) {
  const subject = input.overdue
    ? `Overdue: invoice ${input.docNumber} from ${input.businessName}`
    : `Reminder: invoice ${input.docNumber} from ${input.businessName}`;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Hi ${escapeHtml(input.customerName)},</p>
    <p style="margin:0 0 18px 0;white-space:pre-line;">${escapeHtml(input.message)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:${input.overdue ? '#fef2f2' : '#f8fafc'};border-radius:10px;padding:14px 16px;font-size:14px;">
      <tr><td style="padding:4px 0;color:#64748b;">Invoice</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(input.docNumber)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Balance due</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(input.amountFormatted)}</td></tr>
      ${input.dueDate ? `<tr><td style="padding:4px 0;color:#64748b;">Due</td><td style="padding:4px 0;text-align:right;">${escapeHtml(input.dueDate)}</td></tr>` : ''}
    </table>`;

  const text = [
    `Hi ${input.customerName},`,
    '',
    input.message,
    '',
    `Invoice ${input.docNumber} — balance ${input.amountFormatted}`,
    input.dueDate ? `Due ${input.dueDate}` : '',
    '',
    `Pay or view: ${input.payUrl}`,
    '',
    `— ${input.businessName}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    text,
    html: layout({
      brandColor: input.brandColor,
      businessName: input.businessName,
      preheader: `Invoice ${input.docNumber} — ${input.amountFormatted} outstanding`,
      bodyHtml,
      ctaLabel: 'View and pay',
      ctaUrl: input.payUrl,
    }),
  };
}

export interface ReceiptEmailInput {
  businessName: string;
  brandColor: string;
  customerName: string;
  docNumber: string;
  amountFormatted: string;
  balanceFormatted: string;
  paidOn: string;
  method: string;
  viewUrl: string;
}

export function receiptEmail(input: ReceiptEmailInput) {
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Hi ${escapeHtml(input.customerName)},</p>
    <p style="margin:0 0 18px 0;">Thank you — we have recorded your payment.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:#f0fdf4;border-radius:10px;padding:14px 16px;font-size:14px;">
      <tr><td style="padding:4px 0;color:#64748b;">Invoice</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(input.docNumber)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Amount received</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(input.amountFormatted)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Method</td>
          <td style="padding:4px 0;text-align:right;">${escapeHtml(input.method)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Date</td>
          <td style="padding:4px 0;text-align:right;">${escapeHtml(input.paidOn)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Balance remaining</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(input.balanceFormatted)}</td></tr>
    </table>`;

  return {
    subject: `Payment received for invoice ${input.docNumber}`,
    text: `Hi ${input.customerName},\n\nThank you — we have recorded your payment of ${input.amountFormatted} for invoice ${input.docNumber} on ${input.paidOn} (${input.method}).\nBalance remaining: ${input.balanceFormatted}.\n\nView: ${input.viewUrl}\n\n— ${input.businessName}`,
    html: layout({
      brandColor: input.brandColor,
      businessName: input.businessName,
      preheader: `Payment of ${input.amountFormatted} received`,
      bodyHtml,
      ctaLabel: 'View invoice',
      ctaUrl: input.viewUrl,
    }),
  };
}

export function quoteDecisionEmail(input: {
  businessName: string;
  brandColor: string;
  quoteNumber: string;
  customerLabel: string;
  accepted: boolean;
  signedName: string;
  comment?: string | null;
  manageUrl: string;
}) {
  const verb = input.accepted ? 'accepted' : 'declined';
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">
      <strong>${escapeHtml(input.customerLabel)}</strong> has ${verb} quotation
      <strong>${escapeHtml(input.quoteNumber)}</strong>.
    </p>
    <p style="margin:0 0 14px 0;color:#64748b;">Signed as: ${escapeHtml(input.signedName)}</p>
    ${input.comment ? `<p style="margin:0 0 14px 0;white-space:pre-line;">“${escapeHtml(input.comment)}”</p>` : ''}
    ${input.accepted ? '<p style="margin:0;">You can convert it to an invoice in one click.</p>' : ''}`;

  return {
    subject: `Quotation ${input.quoteNumber} was ${verb}`,
    text: `${input.customerLabel} has ${verb} quotation ${input.quoteNumber}.\nSigned as: ${input.signedName}\n${input.comment ?? ''}\n\nOpen: ${input.manageUrl}`,
    html: layout({
      brandColor: input.accepted ? '#16a34a' : input.brandColor,
      businessName: input.businessName,
      preheader: `Quotation ${input.quoteNumber} ${verb}`,
      bodyHtml,
      ctaLabel: 'Open quotation',
      ctaUrl: input.manageUrl,
    }),
  };
}

/**
 * Internal notification for a marketing-site contact form submission — this
 * is not a tenant-branded email, so it skips `layout()` and uses a plain,
 * self-contained template instead.
 */
export function contactFormEmail(input: { name: string; email: string; message: string }) {
  const { name, email, message } = input;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>New contact form submission</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;
                box-shadow:0 1px 3px rgba(15,23,42,.08);">
    <tr><td style="height:4px;background:#4F46E5;"></td></tr>
    <tr><td style="padding:28px 32px 4px 32px;">
      <p style="margin:0;font-size:13px;color:#64748b;font-weight:600;letter-spacing:.4px;">
        NEW CONTACT FORM SUBMISSION
      </p>
    </td></tr>
    <tr><td style="padding:12px 32px 8px 32px;color:#0f172a;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 4px 0;"><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p style="margin:0 0 16px 0;">
        <strong>Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#4F46E5;">${escapeHtml(email)}</a>
      </p>
      <p style="margin:0 0 6px 0;color:#64748b;font-size:13px;font-weight:600;">Message</p>
      <p style="margin:0;white-space:pre-line;">${escapeHtml(message)}</p>
    </td></tr>
    <tr><td style="padding:20px 32px 26px 32px;color:#94a3b8;font-size:12px;line-height:1.5;">
      Sent from the Invora contact form. Reply-to is set to the sender's address.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = `New contact form submission\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;

  return {
    subject: `Contact form: ${name}`,
    html,
    text,
  };
}

/**
 * Sent immediately after booking a demo call — deliberately WITHOUT the Meet
 * link. `demoReminderEmail` below carries the link and goes out ~2 hours
 * before the meeting instead (app/api/cron/demo-reminders/route.ts); this
 * one just confirms the time. Not tenant-branded, same reasoning as
 * contactFormEmail — this is Vertex Infotech's own calendar, not any
 * customer's.
 */
export function demoBookingEmail(input: { name: string; whenFormatted: string }) {
  const { name, whenFormatted } = input;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Invora demo is booked</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;
                box-shadow:0 1px 3px rgba(15,23,42,.08);">
    <tr><td style="height:4px;background:#4F46E5;"></td></tr>
    <tr><td style="padding:28px 32px 4px 32px;">
      <p style="margin:0;font-size:13px;color:#64748b;font-weight:600;letter-spacing:.4px;">INVORA · DEMO BOOKED</p>
    </td></tr>
    <tr><td style="padding:12px 32px 8px 32px;color:#0f172a;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px 0;">You're booked for a 30-minute walkthrough of Invora on <strong>${escapeHtml(whenFormatted)}</strong>, on Google Meet.</p>
      <p style="margin:0 0 16px 0;color:#64748b;">We'll email the Google Meet link about 2 hours before the meeting starts — no need to hunt for it now. A calendar invite from Google is on its way separately.</p>
      <p style="margin:0;color:#64748b;font-size:13px;">Need to reschedule? Just reply to this email.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = `Your Invora demo is booked\n\nHi ${name},\n\nYou're booked for a 30-minute walkthrough of Invora on ${whenFormatted}, on Google Meet.\n\nWe'll email the Google Meet link about 2 hours before the meeting starts — no need to hunt for it now. A calendar invite from Google is on its way separately.\n\nNeed to reschedule? Just reply to this email.`;

  return {
    subject: `Your Invora demo — ${whenFormatted}`,
    html,
    text,
  };
}

/** Sent ~2 hours before the meeting, by app/api/cron/demo-reminders — this
 * is the one that actually carries the Meet link. */
export function demoReminderEmail(input: { name: string; whenFormatted: string; meetLink: string }) {
  const { name, whenFormatted, meetLink } = input;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Invora demo starts soon</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;
                box-shadow:0 1px 3px rgba(15,23,42,.08);">
    <tr><td style="height:4px;background:#4F46E5;"></td></tr>
    <tr><td style="padding:28px 32px 4px 32px;">
      <p style="margin:0;font-size:13px;color:#64748b;font-weight:600;letter-spacing:.4px;">INVORA · STARTING SOON</p>
    </td></tr>
    <tr><td style="padding:12px 32px 28px 32px;color:#0f172a;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 20px 0;">Your Invora demo is coming up: <strong>${escapeHtml(whenFormatted)}</strong>.</p>
      <p style="margin:0;">
        <a href="${escapeHtml(meetLink)}" style="display:inline-block;background:#4F46E5;color:#ffffff;
           text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">
          Join on Google Meet
        </a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = `Your Invora demo starts soon\n\nHi ${name},\n\nYour Invora demo is coming up: ${whenFormatted}.\n\nJoin on Google Meet: ${meetLink}`;

  return {
    subject: `Starting soon — your Invora demo at ${whenFormatted}`,
    html,
    text,
  };
}

/** Sent to Vertex Infotech (CONTACT_EMAIL) the moment someone books a demo —
 * the only way the team otherwise learns of a new booking is checking the
 * connected Google Calendar or /admin/meetings by hand. */
export function demoBookingAdminNotificationEmail(input: {
  visitorName: string;
  visitorEmail: string;
  company: string | null;
  notes: string | null;
  whenFormatted: string;
}) {
  const { visitorName, visitorEmail, company, notes, whenFormatted } = input;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>New demo booked</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;
                box-shadow:0 1px 3px rgba(15,23,42,.08);">
    <tr><td style="height:4px;background:#4F46E5;"></td></tr>
    <tr><td style="padding:28px 32px 4px 32px;">
      <p style="margin:0;font-size:13px;color:#64748b;font-weight:600;letter-spacing:.4px;">NEW DEMO BOOKED</p>
    </td></tr>
    <tr><td style="padding:12px 32px 8px 32px;color:#0f172a;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 4px 0;"><strong>When:</strong> ${escapeHtml(whenFormatted)}</p>
      <p style="margin:0 0 4px 0;"><strong>Name:</strong> ${escapeHtml(visitorName)}</p>
      <p style="margin:0 0 4px 0;">
        <strong>Email:</strong> <a href="mailto:${escapeHtml(visitorEmail)}" style="color:#4F46E5;">${escapeHtml(visitorEmail)}</a>
      </p>
      ${company ? `<p style="margin:0 0 4px 0;"><strong>Business:</strong> ${escapeHtml(company)}</p>` : ''}
      ${notes ? `<p style="margin:16px 0 6px 0;color:#64748b;font-size:13px;font-weight:600;">Notes</p><p style="margin:0;white-space:pre-line;">${escapeHtml(notes)}</p>` : ''}
    </td></tr>
    <tr><td style="padding:16px 32px 26px 32px;color:#94a3b8;font-size:12px;line-height:1.5;">
      Already on your connected Google Calendar. Manage bookings at /admin/meetings.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = `New demo booked\n\nWhen: ${whenFormatted}\nName: ${visitorName}\nEmail: ${visitorEmail}\n${company ? `Business: ${company}\n` : ''}${notes ? `\nNotes:\n${notes}\n` : ''}\nAlready on your connected Google Calendar. Manage bookings at /admin/meetings.`;

  return {
    subject: `New demo booked — ${visitorName}, ${whenFormatted}`,
    html,
    text,
  };
}
