'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/misc';
import * as yup from 'yup';

const emailFormat = yup.string().trim().email();
function isValidEmail(value: string): boolean {
  return emailFormat.isValidSync(value);
}

export function SendDialog({
  docType,
  docId,
  docNumber,
  defaultTo,
  businessName,
}: {
  docType: 'quotation' | 'invoice';
  docId: string;
  docNumber: string;
  defaultTo: string;
  businessName: string;
}) {
  const router = useRouter();
  const isQuote = docType === 'quotation';

  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);
  const [to, setTo] = React.useState(defaultTo);
  const [subject, setSubject] = React.useState(
    `${isQuote ? 'Quotation' : 'Invoice'} ${docNumber} from ${businessName}`,
  );
  const [message, setMessage] = React.useState(
    isQuote
      ? `Thank you for the opportunity. Please find our quotation attached — the full breakdown is also viewable online using the button below.\n\nDo let me know if you would like anything adjusted.`
      : `Please find attached our invoice for the work completed. You can view it and pay online using the button below.\n\nThank you for your business.`,
  );
  const [attachPdf, setAttachPdf] = React.useState(true);

  async function draftWithAi() {
    setDrafting(true);
    try {
      const response = await fetch('/api/ai/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: isQuote ? 'reminder' : 'reminder',
          invoice_id: isQuote ? undefined : docId,
          instruction: `Write a short covering message to accompany ${isQuote ? 'a quotation' : 'an invoice'} being sent for the first time. Warm, professional, no pressure.`,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'Could not draft a message.');
        return;
      }
      if (payload.message?.body) {
        setMessage(payload.message.body);
        if (payload.message.subject) setSubject(payload.message.subject);
      }
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    setPending(true);
    try {
      const response = await fetch('/api/documents/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          doc_id: docId,
          to,
          subject,
          message,
          attach_pdf: attachPdf,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'The email could not be sent.');
        return;
      }

      toast.success(`Sent to ${to}.`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" />
        Send
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send {isQuote ? 'quotation' : 'invoice'} {docNumber}
            </DialogTitle>
            <DialogDescription>
              The email includes a private view link. Sending also moves a draft to “sent”.
            </DialogDescription>
          </DialogHeader>

          <Field label="To" htmlFor="send-to" error={to && !isValidEmail(to) ? 'Enter a valid email address.' : undefined} required>
            <Input
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="client@company.com"
              invalid={Boolean(to) && !isValidEmail(to)}
            />
          </Field>

          <Field label="Subject" htmlFor="send-subject" required>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </Field>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="send-message" className="text-sm font-medium">
                Message
              </label>
              <Button variant="ghost" size="sm" onClick={draftWithAi} loading={drafting}>
                <Sparkles className="h-3.5 w-3.5" />
                Draft with AI
              </Button>
            </div>
            <Textarea
              id="send-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
            <div>
              <p className="text-sm font-medium">Attach the PDF</p>
              <p className="text-xs text-muted-foreground">
                Most clients forward the attachment internally, so leave this on unless you have a
                reason not to.
              </p>
            </div>
            <Switch checked={attachPdf} onCheckedChange={setAttachPdf} aria-label="Attach PDF" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={send} loading={pending} disabled={!isValidEmail(to)}>
              <Send className="h-4 w-4" />
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
