'use client';

import * as React from 'react';
import { ArrowRight, Languages, TriangleAlert, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { AI_ENABLED } from '@/lib/ai/enabled';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Action = 'professionalize' | 'shorten' | 'expand' | 'fix_grammar' | 'translate';

const ACTIONS: { value: Action; label: string }[] = [
  { value: 'professionalize', label: 'Make it professional' },
  { value: 'shorten', label: 'Shorten' },
  { value: 'expand', label: 'Add detail' },
  { value: 'fix_grammar', label: 'Fix grammar' },
  { value: 'translate', label: 'Translate' },
];

const LANGUAGES = ['Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Bengali', 'English'];

/**
 * Rewrite-in-place, with a before/after diff.
 *
 * The integrity check the server performs — did every number, date, currency
 * amount and document reference survive? — is surfaced here as a warning
 * rather than silently discarded, because on a translation it is the single
 * most likely thing to go wrong.
 */
export function RewriteButton({
  value,
  onResult,
}: {
  value: string;
  onResult: (next: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [action, setAction] = React.useState<Action>('professionalize');
  const [language, setLanguage] = React.useState('Hindi');
  const [result, setResult] = React.useState<{ text: string; changeSummary: string } | null>(null);
  const [missing, setMissing] = React.useState<string[]>([]);

  const disabled = value.trim().length === 0;

  async function run() {
    setPending(true);
    setResult(null);
    setMissing([]);

    try {
      const response = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: value,
          action,
          target_language: action === 'translate' ? language : undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'The rewrite could not be completed.');
        return;
      }

      setResult(payload.result);
      setMissing(payload.integrity?.missingTokens ?? []);
    } catch {
      toast.error('We could not reach the assistant.');
    } finally {
      setPending(false);
    }
  }

  // Placed after the hooks so hook order is unchanged when the flag flips.
  // Nothing to show beside a field the user can still edit by hand.
  if (!AI_ENABLED) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
      >
        <Wand2 className="h-3 w-3" />
        Rewrite
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Rewrite this passage</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAction(option.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  action === option.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {action === 'translate' ? (
            <label className="flex items-center gap-2 text-sm">
              <Languages className="h-4 w-4 text-muted-foreground" />
              Translate into
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {LANGUAGES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Before
              </p>
              <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-lg border border-border bg-muted/40 p-3 text-sm">
                {value}
              </div>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                After
                <ArrowRight className="h-3 w-3" />
              </p>
              <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-lg border border-primary/30 bg-accent/50 p-3 text-sm">
                {result?.text ?? (
                  <span className="text-muted-foreground">Run the rewrite to see the result.</span>
                )}
              </div>
            </div>
          </div>

          {result ? (
            <p className="text-xs text-muted-foreground">{result.changeSummary}</p>
          ) : null}

          {missing.length > 0 ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-amber-800"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                These values from the original are missing in the rewrite:{' '}
                <strong>{missing.join(', ')}</strong>. Check the result carefully before applying.
              </span>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={run} loading={pending}>
              <Wand2 className="h-4 w-4" />
              {result ? 'Try again' : 'Rewrite'}
            </Button>
            <Button
              disabled={!result}
              onClick={() => {
                if (!result) return;
                onResult(result.text);
                setOpen(false);
                setResult(null);
                toast.success('Applied.');
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
