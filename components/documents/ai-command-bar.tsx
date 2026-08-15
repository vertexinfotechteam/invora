'use client';

import * as React from 'react';
import { ArrowRight, Check, Loader2, Sparkles, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPaise } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { TaxMode } from '@/lib/calc/totals';
import type { EditorLine } from '@/components/documents/types';
import { AI_ENABLED } from '@/lib/ai/enabled';

interface Preview {
  applied: boolean;
  reason: string | null;
  summary: string;
  requiresConfirmation: boolean;
  totalDeltaPaise: number;
  before: { subtotalPaise: number; discountPaise: number; taxPaise: number; totalPaise: number };
  after: { subtotalPaise: number; discountPaise: number; taxPaise: number; totalPaise: number };
  nextLines: {
    name: string;
    qty: number;
    rate_paise: number;
    discount_pct: number;
    tax_rate: number;
    unit: string;
    description?: string | null;
  }[];
  nextDocDiscountPct: number;
}

const SUGGESTIONS = ['Give 5% discount', 'Add GST 18% to everything', 'Make the scope more formal'];

/**
 * The command bar.
 *
 * The model classifies; the server recomputes with the same engine the editor
 * uses; this component renders the diff. Nothing changes until Apply — and for
 * anything that moves money, Apply is the only path.
 */
export function AiCommandBar({
  docType,
  docId,
  lines,
  docDiscountPct,
  taxMode,
  onApply,
  disabled,
}: {
  docType: 'quotation' | 'invoice';
  docId: string | null;
  lines: EditorLine[];
  docDiscountPct: number;
  taxMode: TaxMode;
  onApply: (next: { lines: EditorLine[]; docDiscountPct: number }) => void;
  disabled?: boolean;
}) {
  const [command, setCommand] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(event?: React.FormEvent) {
    event?.preventDefault();
    if (!docId) {
      toast.info('Save the document once before using commands.');
      return;
    }

    setPending(true);
    setError(null);
    setPreview(null);

    try {
      const response = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          doc_id: docId,
          command,
          // What's on screen right now — not what was last autosaved — so an
          // edit made in the last couple of seconds is never silently
          // reverted when a command applies on top of it.
          lines: lines.map((line) => ({
            name: line.name,
            description: line.description,
            unit: line.unit,
            qty: line.qty,
            rate_paise: line.rate_paise,
            discount_pct: line.discount_pct,
            tax_rate: line.tax_rate,
          })),
          doc_discount_pct: docDiscountPct,
          tax_mode: taxMode,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'That command could not be interpreted.');
        return;
      }

      setPreview(payload.preview as Preview);
    } catch {
      setError('We could not reach the assistant.');
    } finally {
      setPending(false);
    }
  }

  function apply() {
    if (!preview?.applied) return;

    // Re-key against existing lines so React keeps focus and row identity.
    const nextLines: EditorLine[] = preview.nextLines.map((line, index) => ({
      key: lines[index]?.key ?? `line-${Math.random().toString(36).slice(2, 10)}`,
      product_id: lines[index]?.product_id ?? null,
      name: line.name,
      description: line.description ?? lines[index]?.description ?? '',
      unit: line.unit,
      qty: line.qty,
      rate_paise: line.rate_paise,
      discount_pct: line.discount_pct,
      tax_rate: line.tax_rate,
      hsn_sac: lines[index]?.hsn_sac ?? '',
    }));

    onApply({ lines: nextLines, docDiscountPct: preview.nextDocDiscountPct });
    setPreview(null);
    setCommand('');
    toast.success('Applied. Remember to save.');
  }

  const delta = preview?.totalDeltaPaise ?? 0;

  // After the hooks, so hook order is unchanged when the flag flips.
  if (!AI_ENABLED) return null;

  return (
    <div className="card-surface overflow-hidden">
      <form onSubmit={run} className="flex items-center gap-2 p-3">
        <Sparkles className="ml-1 h-4 w-4 shrink-0 text-primary" />
        <Input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder='Try "give 5% discount" or "add GST 18%"'
          aria-label="AI command"
          disabled={disabled || pending}
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="sm" loading={pending} disabled={disabled || command.trim().length < 2}>
          Interpret
        </Button>
      </form>

      {!preview && !error && !pending ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setCommand(suggestion)}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {pending ? (
        <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Working out what you meant…
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 border-t border-border bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="border-t border-border">
          <div className="flex items-start gap-2 bg-accent/60 px-4 py-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-accent-foreground">{preview.summary}</p>
          </div>

          {!preview.applied ? (
            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground">{preview.reason}</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPreview(null)}>
                Dismiss
              </Button>
            </div>
          ) : (
            <>
              {preview.requiresConfirmation ? (
                <div className="space-y-2 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Before → after
                  </p>
                  <DiffRow label="Subtotal" before={preview.before.subtotalPaise} after={preview.after.subtotalPaise} />
                  <DiffRow label="Discount" before={preview.before.discountPaise} after={preview.after.discountPaise} />
                  <DiffRow label="Tax" before={preview.before.taxPaise} after={preview.after.taxPaise} />
                  <DiffRow label="Total" before={preview.before.totalPaise} after={preview.after.totalPaise} strong />

                  <p
                    className={cn(
                      'mt-2 rounded-md px-3 py-2 text-sm font-medium',
                      delta === 0
                        ? 'bg-muted text-muted-foreground'
                        : delta > 0
                          ? 'bg-success/10 text-success'
                          : 'bg-destructive/10 text-destructive',
                    )}
                  >
                    {delta === 0
                      ? 'The total does not change.'
                      : `The total ${delta > 0 ? 'increases' : 'decreases'} by ${formatPaise(Math.abs(delta))}.`}
                  </p>
                </div>
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  This is a wording change. Use the rewrite tool on the field you want to change.
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
                  <X className="h-3.5 w-3.5" />
                  Discard
                </Button>
                {preview.requiresConfirmation ? (
                  <Button size="sm" onClick={apply}>
                    <Check className="h-3.5 w-3.5" />
                    Apply change
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DiffRow({
  label,
  before,
  after,
  strong,
}: {
  label: string;
  before: number;
  after: number;
  strong?: boolean;
}) {
  const changed = before !== after;
  return (
    <div className={cn('flex items-center justify-between text-sm', strong && 'font-semibold')}>
      <span className={cn(!strong && 'text-muted-foreground')}>{label}</span>
      <span className="flex items-center gap-2 tabular">
        <span className={cn(changed && 'text-muted-foreground line-through')}>
          {formatPaise(before)}
        </span>
        {changed ? (
          <>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span>{formatPaise(after)}</span>
          </>
        ) : null}
      </span>
    </div>
  );
}
