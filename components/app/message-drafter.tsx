'use client';

import * as React from 'react';
import { Check, Copy, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

const KINDS = [
  { value: 'reminder', label: 'Polite reminder' },
  { value: 'overdue_reminder', label: 'Overdue chase' },
  { value: 'thank_you', label: 'Thank you' },
] as const;

/**
 * A standalone drafter for the messages that surround an invoice.
 *
 * It deliberately does not know about a specific invoice, so it cannot restate
 * an amount. When you draft from an invoice page instead, the real figures are
 * injected server-side as facts the model must repeat verbatim.
 */
export function MessageDrafter() {
  const [kind, setKind] = React.useState<(typeof KINDS)[number]['value']>('reminder');
  const [instruction, setInstruction] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [draft, setDraft] = React.useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function generate() {
    setPending(true);
    try {
      const response = await fetch('/api/ai/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, instruction: instruction || 'Draft a standard message.' }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'Could not draft that message.');
        return;
      }
      setDraft(payload.message);
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!draft) return;
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    setCopied(true);
    toast.success('Copied.');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="card-surface p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareText className="h-4 w-4 text-primary" />
        Draft a payment message
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        For sending by hand. To include the real invoice number and balance, draft from the invoice
        page instead — those figures are injected as facts rather than remembered.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {KINDS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setKind(option.value)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              kind === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Field
          label="Anything specific to mention?"
          htmlFor="drafter-instruction"
          hint="Optional. e.g. “they asked for an extra week”, or “this is the third reminder”."
        >
          <Textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={2}
          />
        </Field>
      </div>

      <Button onClick={generate} loading={pending} className="mt-3">
        Draft message
      </Button>

      {draft ? (
        <div className="mt-4 space-y-2 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Subject
          </p>
          <p className="text-sm font-medium">{draft.subject}</p>

          <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Body
          </p>
          <p className="whitespace-pre-line text-sm">{draft.body}</p>

          <Button variant="outline" size="sm" onClick={copy} className="mt-2">
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </Button>
        </div>
      ) : null}
    </section>
  );
}
