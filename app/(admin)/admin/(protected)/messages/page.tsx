import type { Metadata } from 'next';
import { AlertTriangle, Check, Inbox, Mail, RotateCcw } from 'lucide-react';

import { requireAdmin } from '@/lib/guards/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/utils';
import { setMessageHandledAction } from './actions';

export const metadata: Metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  email_sent: boolean;
  handled_at: string | null;
  created_at: string;
}

/**
 * The contact-form inbox.
 *
 * Reads straight from the table rather than from a mailbox, so a message is
 * visible here whether or not the notification email was delivered — which is
 * the whole reason contact_messages exists (see migration 0011).
 */
export default async function AdminMessagesPage() {
  await requireAdmin();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('contact_messages')
    .select('id, name, email, message, email_sent, handled_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const messages = (data ?? []) as ContactMessage[];
  const open = messages.filter((row) => !row.handled_at);
  const undelivered = messages.filter((row) => !row.email_sent);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Everything submitted through the contact form on the marketing site.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {open.length} open · {messages.length} total
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Could not load messages. If this table does not exist yet, apply migration{' '}
            <code className="rounded bg-muted px-1">0011_contact_messages.sql</code>.
          </span>
        </div>
      ) : null}

      {undelivered.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            {undelivered.length} of these never went out by email — set{' '}
            <code className="rounded bg-muted px-1">CONTACT_EMAIL</code> to a real inbox and check
            the mail provider. They are safe here either way.
          </span>
        </div>
      ) : null}

      {messages.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
          <Inbox className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-medium">No messages yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Anything sent through the contact form will appear here, even if the notification email
            fails.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {messages.map((row) => (
          <article
            key={row.id}
            className={`rounded-lg border p-4 ${
              row.handled_at ? 'border-border bg-muted/30' : 'border-border'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {row.name}{' '}
                  <a
                    href={`mailto:${row.email}`}
                    className="text-sm font-normal text-primary underline-offset-4 hover:underline"
                  >
                    {row.email}
                  </a>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(row.created_at)}
                  {!row.email_sent ? ' · not emailed' : ''}
                  {row.handled_at ? ' · handled' : ''}
                </p>
              </div>

              <form action={setMessageHandledAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="handled" value={row.handled_at ? 'false' : 'true'} />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  {row.handled_at ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reopen
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Mark handled
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* whitespace-pre-wrap: the visitor's line breaks are part of what
                they wrote, and collapsing them makes longer messages unreadable. */}
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{row.message}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
