'use client';

import * as React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

/**
 * Accept or decline, with no account.
 *
 * The typed name is the acknowledgement. The server pairs it with a timestamp,
 * the request IP and the user agent, and that quartet is what makes the
 * acceptance defensible months later.
 */
export function QuoteDecision({
  token,
  status,
  canRespond,
  acceptedByName,
  businessName,
}: {
  token: string;
  status: string;
  canRespond: boolean;
  acceptedByName: string | null;
  businessName: string;
}) {
  const [decision, setDecision] = React.useState<'accept' | 'reject' | null>(null);
  const [name, setName] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<'accepted' | 'rejected' | null>(null);

  const settled = done ?? (status === 'accepted' ? 'accepted' : status === 'rejected' ? 'rejected' : null);

  async function submit() {
    if (!decision) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/share/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, decision, signed_name: name, comment: comment || undefined }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'We could not record your response.');
        return;
      }
      setDone(payload.status);
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (settled) {
    const accepted = settled === 'accepted';
    return (
      <div
        className={`card-surface mt-6 flex items-start gap-3 p-6 ${
          accepted ? 'border-success/40 bg-success/[0.04]' : 'border-border'
        }`}
      >
        {accepted ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
        ) : (
          <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">
            {accepted ? 'Quotation accepted' : 'Quotation declined'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {accepted
              ? `Thank you. ${businessName} has been notified and will be in touch with next steps.`
              : `${businessName} has been notified. If this was a mistake, reply to their email and they can send a revised version.`}
          </p>
          {acceptedByName ? (
            <p className="mt-2 text-xs text-muted-foreground">Signed as {acceptedByName}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="card-surface mt-6 flex items-start gap-3 border-warning/40 bg-warning/10 p-6">
        <Clock className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-amber-900">This quotation has expired</p>
          <p className="mt-1 text-sm text-amber-800">
            Prices and availability may have changed. Contact {businessName} for an updated
            quotation.
          </p>
        </div>
      </div>
    );
  }

  if (!canRespond) return null;

  return (
    <div className="card-surface mt-6 p-6">
      <h2 className="text-base font-semibold">Your decision</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Accepting is a commercial acknowledgement. We record your name, the time, and your browser
        details as a record for both sides.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setDecision('accept')}
          aria-pressed={decision === 'accept'}
          className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
            decision === 'accept'
              ? 'border-success bg-success/10 text-success'
              : 'border-border hover:border-success/50'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Accept this quotation
        </button>

        <button
          type="button"
          onClick={() => setDecision('reject')}
          aria-pressed={decision === 'reject'}
          className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
            decision === 'reject'
              ? 'border-destructive bg-destructive/5 text-destructive'
              : 'border-border hover:border-destructive/40'
          }`}
        >
          <XCircle className="h-4 w-4" />
          Decline
        </button>
      </div>

      {decision ? (
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Field
            label="Your full name"
            htmlFor="signed-name"
            hint="Typing your name here acts as your signature."
            required
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Priya Sharma"
              autoComplete="name"
            />
          </Field>

          <Field
            label={decision === 'accept' ? 'Anything to add? (optional)' : 'Reason (optional)'}
            htmlFor="decision-comment"
          >
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder={
                decision === 'accept'
                  ? 'e.g. please start from the 1st of next month'
                  : 'e.g. going with another supplier this time'
              }
            />
          </Field>

          <Button
            onClick={submit}
            loading={pending}
            disabled={name.trim().length < 2}
            variant={decision === 'accept' ? 'success' : 'destructive'}
            className="w-full sm:w-auto"
          >
            {decision === 'accept' ? 'Accept quotation' : 'Decline quotation'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
