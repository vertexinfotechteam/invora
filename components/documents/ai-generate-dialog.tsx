'use client';

import * as React from 'react';
import { AlertCircle, Info, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { AI_ENABLED } from '@/lib/ai/enabled';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/misc';
import type { QuotationDraft } from '@/lib/ai/schemas';

const EXAMPLES = [
  'Website redesign for a Pune manufacturer — 8 pages, design plus build, 6 weeks.',
  'Monthly bookkeeping retainer for a 12-person agency, including GST filing support.',
  'Two-day on-site Power BI training for 15 staff, materials included.',
];

/**
 * The "Generate with AI" flow.
 *
 * Two things worth noticing:
 *   • Pricing is off by default. The switch makes it an explicit choice, and
 *     the copy says plainly that a suggested rate is a suggestion.
 *   • The dialog hands the draft back to the editor. Nothing is saved until
 *     the user saves, so a bad draft costs a credit and nothing else.
 */
export function AiGenerateDialog({
  open,
  onOpenChange,
  customerId,
  onDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  onDraft: (draft: QuotationDraft, includePricing: boolean) => void;
}) {
  const [brief, setBrief] = React.useState('');
  const [includePricing, setIncludePricing] = React.useState(false);
  const [tone, setTone] = React.useState<'professional' | 'friendly' | 'concise'>('professional');
  const [language, setLanguage] = React.useState('English');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          customer_id: customerId,
          include_pricing: includePricing,
          tone,
          language,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'The assistant could not complete that request.');
        return;
      }

      onDraft(payload.draft as QuotationDraft, includePricing);
      toast.success('Draft ready — review before sending.', {
        description: payload.meta?.cacheHit ? 'Served with a cached prompt.' : undefined,
      });
      onOpenChange(false);
      setBrief('');
    } catch {
      setError('We could not reach the assistant. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  // After the hooks, so hook order is unchanged when the flag flips.
  if (!AI_ENABLED) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate a quotation
          </DialogTitle>
          <DialogDescription>
            Describe the job the way you would to a colleague. Invora drafts the line items, scope,
            deliverables, exclusions and terms.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <Field
          label="What is the job?"
          htmlFor="ai-brief"
          hint={`${brief.length}/6000 characters`}
          required
        >
          <Textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value.slice(0, 6000))}
            placeholder="e.g. Redesign and rebuild the website for a Pune-based manufacturer. Eight pages, new brand direction, CMS so their team can edit. Six weeks."
            rows={5}
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setBrief(example)}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {example.slice(0, 48)}…
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tone" htmlFor="ai-tone">
            <select
              value={tone}
              onChange={(event) => setTone(event.target.value as typeof tone)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
            </select>
          </Field>

          <Field label="Language" htmlFor="ai-language">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {['English', 'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Bengali'].map(
                (option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ),
              )}
            </select>
          </Field>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-3">
          <div>
            <p className="text-sm font-medium">Suggest rates too</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Off by default. When on, suggestions appear as chips you click to accept — nothing
              enters a price field on its own.
            </p>
          </div>
          <Switch
            checked={includePricing}
            onCheckedChange={setIncludePricing}
            aria-label="Suggest rates"
          />
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Uses one AI credit. Failed and refused requests are refunded automatically.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={generate} loading={pending} disabled={brief.trim().length < 20}>
            <Sparkles className="h-4 w-4" />
            Generate draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
