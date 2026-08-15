'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, CloudOff, Loader2, Save, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { LineItemsEditor } from '@/components/documents/line-items';
import { AiGenerateDialog } from '@/components/documents/ai-generate-dialog';
import { AiCommandBar } from '@/components/documents/ai-command-bar';
import { RewriteButton } from '@/components/documents/rewrite-button';
import { computeTotals } from '@/lib/calc/totals';
import { formatPaise, formatPercent } from '@/lib/money';
import { amountInWordsIndian } from '@/lib/money';
import { debounce } from '@/lib/utils';
import { saveDocumentAction } from '@/app/(app)/actions';
import { documentTopLevelSchema, validateDocumentLines } from '@/lib/validation/yup-schemas';
import * as yup from 'yup';
import {
  emptyLine,
  toPayload,
  type CustomerOption,
  type EditorLine,
  type EditorState,
  type ProductOption,
} from '@/components/documents/types';
import type { QuotationDraft } from '@/lib/ai/schemas';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function DocumentEditor({
  docType,
  docId: initialDocId,
  initialState,
  customers,
  products,
  defaultTaxRate,
  readOnly = false,
  openAiOnMount = false,
}: {
  docType: 'quotation' | 'invoice';
  docId: string | null;
  initialState: EditorState;
  customers: CustomerOption[];
  products: ProductOption[];
  defaultTaxRate: number;
  readOnly?: boolean;
  openAiOnMount?: boolean;
}) {
  const router = useRouter();
  const [docId, setDocId] = React.useState(initialDocId);
  const [state, setState] = React.useState<EditorState>(initialState);
  const [status, setStatus] = React.useState<SaveStatus>('idle');
  const [dirty, setDirty] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [aiOpen, setAiOpen] = React.useState(openAiOnMount);
  const [suggestions, setSuggestions] = React.useState<Record<string, number>>({});

  const isQuote = docType === 'quotation';

  const totals = React.useMemo(
    () =>
      computeTotals(
        state.items.map((line) => ({
          qty: line.qty,
          ratePaise: line.rate_paise,
          discountPct: line.discount_pct,
          taxRatePct: line.tax_rate,
        })),
        state.doc_discount_pct,
        { taxMode: state.tax_mode, roundTo: 'none' },
      ),
    [state.items, state.doc_discount_pct, state.tax_mode],
  );

  // ---- persistence -------------------------------------------------------

  const save = React.useCallback(
    async (silent: boolean) => {
      if (readOnly) return;

      // Checked here only for the explicit Save click, not silent autosave —
      // interrupting autosave with a toast every couple of seconds while
      // someone is mid-edit (e.g. the date field is briefly empty between
      // keystrokes) would be worse than just letting autosave quietly skip
      // and the explicit Save surface the real problem. Server-side Zod
      // validation still runs on every save either way; this only saves an
      // avoidable round trip on the common failure (no line items yet, a
      // malformed date) for someone who clicked Save on purpose.
      if (!silent) {
        try {
          documentTopLevelSchema.validateSync(
            { title: state.title, issue_date: state.issue_date },
            { abortEarly: false },
          );
        } catch (validationError) {
          if (validationError instanceof yup.ValidationError) {
            const fieldErrors: Record<string, string> = {};
            for (const issue of validationError.inner.length ? validationError.inner : [validationError]) {
              const key = issue.path ?? '_form';
              if (!fieldErrors[key]) fieldErrors[key] = issue.message;
            }
            setErrors(fieldErrors);
            setStatus('error');
            toast.error(Object.values(fieldErrors)[0] ?? 'Please fix the highlighted fields.');
            return;
          }
        }

        const lineError = validateDocumentLines(
          state.items.map((line) => ({ name: line.name, qty: line.qty, rate_paise: line.rate_paise })),
        );
        if (lineError) {
          setStatus('error');
          toast.error(lineError);
          return;
        }
      }

      setStatus('saving');

      const result = await saveDocumentAction(docType, docId, toPayload(state, docType));

      if (!result.ok) {
        setStatus('error');
        setErrors(result.errors ?? {});
        if (!silent || result.message) {
          toast.error(result.message ?? 'Could not save.', {
            description: result.errors
              ? Object.values(result.errors).slice(0, 2).join(' ')
              : undefined,
          });
        }
        return;
      }

      setErrors({});
      setStatus('saved');
      setDirty(false);

      if (!docId && result.id) {
        setDocId(result.id);
        // Swap the URL from /new to the real id without losing editor state.
        window.history.replaceState(null, '', `/${docType}s/${result.id}`);
      }
      if (!silent) {
        toast.success(`Saved ${result.number ?? ''}`.trim());
        router.refresh();
      }
    },
    [docType, docId, state, readOnly, router],
  );

  const autosave = React.useMemo(() => debounce(() => void save(true), 2000), [save]);

  React.useEffect(() => {
    if (!dirty || readOnly) return;
    autosave();
    return () => autosave.cancel();
  }, [state, dirty, autosave, readOnly]);

  // A hard tab-close with unsaved edits should cost the browser's confirm
  // dialog, not the user's work.
  React.useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function patch(next: Partial<EditorState>) {
    setState((current) => ({ ...current, ...next }));
    setDirty(true);
  }

  function setLines(lines: EditorLine[]) {
    // Suggestions are keyed by the line's own stable `key`, not its array
    // position, precisely so a removal or reorder cannot leave a chip
    // pointing at the wrong row — but a *removed* line's key needs its
    // suggestion dropped explicitly, or the chip lingers forever offering a
    // price for a line that no longer exists.
    const remainingKeys = new Set(lines.map((line) => line.key));
    setSuggestions((current) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [key, paise] of Object.entries(current)) {
        if (remainingKeys.has(key)) {
          next[key] = paise;
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
    patch({ items: lines });
  }

  // ---- AI ----------------------------------------------------------------

  function applyDraft(draft: QuotationDraft, includePricing: boolean) {
    const nextSuggestions: Record<string, number> = {};

    const lines: EditorLine[] = draft.lineItems.map((item) => {
      const line = {
        ...emptyLine(defaultTaxRate),
        name: item.name,
        description: item.description,
        unit: item.unit || 'unit',
        qty: Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 1,
        // Note the zero: a suggested rate never lands in the field. It waits
        // as a chip until the user clicks "Use".
        rate_paise: 0,
      };
      if (includePricing && typeof item.suggestedRatePaise === 'number') {
        nextSuggestions[line.key] = item.suggestedRatePaise;
      }
      return line;
    });

    setSuggestions(nextSuggestions);
    patch({
      title: draft.title || state.title,
      items: lines,
      scope: draft.scope,
      deliverables: draft.deliverables.map((entry) => `• ${entry}`).join('\n'),
      exclusions: [
        ...draft.exclusions.map((entry) => `• ${entry}`),
        ...(draft.assumptions.length
          ? ['', 'Assumptions:', ...draft.assumptions.map((entry) => `• ${entry}`)]
          : []),
      ].join('\n'),
      payment_terms: draft.paymentTerms,
      notes: draft.notes,
      terms: draft.termsAndConditions,
    });
  }

  function applySuggestedRate(key: string) {
    const paise = suggestions[key];
    if (paise === undefined) return;
    // No line is removed here, only patched in place, so setLines's own
    // key-cleanup pass is a no-op — go through it anyway for the single
    // code path that keeps `state.items` and `dirty` in sync.
    setLines(state.items.map((line) => (line.key === key ? { ...line, rate_paise: paise } : line)));
    setSuggestions((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  // ---- render ------------------------------------------------------------

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveIndicator status={status} dirty={dirty} readOnly={readOnly} />

        <div className="flex flex-wrap gap-2">
          {isQuote && !readOnly ? (
            <Button variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </Button>
          ) : null}
          <Button onClick={() => void save(false)} loading={status === 'saving'} disabled={readOnly}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      {!readOnly ? (
        <AiCommandBar
          docType={docType}
          docId={docId}
          lines={state.items}
          docDiscountPct={state.doc_discount_pct}
          taxMode={state.tax_mode}
          disabled={readOnly}
          onApply={({ lines, docDiscountPct }) => {
            setState((current) => ({ ...current, items: lines, doc_discount_pct: docDiscountPct }));
            setDirty(true);
          }}
        />
      ) : null}

      {/* Capped so the form does not sprawl across a wide monitor, but never
          below the line-items table's own 1080px minimum — narrower than that
          and the table starts scrolling sideways. */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="space-y-5">
          <section className="card-surface space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" htmlFor="customer" error={errors.customer_id}>
                <select
                  value={state.customer_id ?? ''}
                  onChange={(event) => patch({ customer_id: event.target.value || null })}
                  disabled={readOnly}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select a customer…</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company ? `${customer.company} — ${customer.name}` : customer.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Project title" htmlFor="title" error={errors.title}>
                <Input
                  value={state.title}
                  onChange={(event) => patch({ title: event.target.value })}
                  placeholder="Website redesign"
                  disabled={readOnly}
                />
              </Field>

              <Field label="Issue date" htmlFor="issue_date" error={errors.issue_date} required>
                <Input
                  type="date"
                  value={state.issue_date}
                  onChange={(event) => patch({ issue_date: event.target.value })}
                  disabled={readOnly}
                />
              </Field>

              <Field
                label={isQuote ? 'Valid until' : 'Due date'}
                htmlFor="secondary_date"
                error={errors.valid_until ?? errors.due_date}
              >
                <Input
                  type="date"
                  value={state.secondary_date}
                  onChange={(event) => patch({ secondary_date: event.target.value })}
                  disabled={readOnly}
                />
              </Field>
            </div>
          </section>

          {Object.keys(suggestions).length > 0 ? (
            <div className="rounded-lg border border-primary/30 bg-accent p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-accent-foreground">
                <Wand2 className="h-4 w-4" />
                Suggested rates
              </p>
              <p className="mt-1 text-xs text-accent-foreground/80">
                These are the assistant&apos;s estimates. Nothing is applied until you click Use.
              </p>
              <ul className="mt-3 space-y-1.5">
                {Object.entries(suggestions).map(([key, paise]) => {
                  const lineIndex = state.items.findIndex((line) => line.key === key);
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {state.items[lineIndex]?.name || `Line ${lineIndex + 1}`}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-medium tabular">{formatPaise(paise, state.currency)}</span>
                        <Button size="sm" variant="outline" onClick={() => applySuggestedRate(key)}>
                          Use
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setSuggestions((current) => {
                              const next = { ...current };
                              delete next[key];
                              return next;
                            })
                          }
                        >
                          Ignore
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <LineItemsEditor
            lines={state.items}
            onChange={setLines}
            taxMode={state.tax_mode}
            currency={state.currency}
            products={products}
            defaultTaxRate={defaultTaxRate}
          />

          {/* Sits directly under the lines it totals. As a right-hand column
              it was easy to miss: on a wide screen the numbers ended up far
              from the rates that produced them, and as soon as the layout
              stacked it fell below the whole Details section — six textareas
              of scrolling away from the amounts. Right-aligned and capped in
              width, the way a printed invoice reads. */}
          <div className="space-y-4 sm:ml-auto sm:w-full sm:max-w-sm">
            <section className="card-surface p-5">
              <h2 className="text-sm font-semibold">Totals</h2>

              <div className="mt-4 space-y-3">
                <Field label="Tax mode" htmlFor="tax_mode">
                  <select
                    value={state.tax_mode}
                    onChange={(event) =>
                      patch({ tax_mode: event.target.value as EditorState['tax_mode'] })
                    }
                    disabled={readOnly}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="exclusive">Tax added to rates</option>
                    <option value="inclusive">Rates include tax</option>
                  </select>
                </Field>

                <Field label="Document discount %" htmlFor="doc_discount">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={state.doc_discount_pct}
                    onChange={(event) =>
                      patch({
                        doc_discount_pct: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                      })
                    }
                    disabled={readOnly}
                    className="text-right tabular"
                  />
                </Field>
              </div>

              <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                <Row
                  // Inclusive mode: subtotalPaise is tax-exclusive, so it will
                  // never equal the sum of the (tax-inclusive) per-line
                  // amounts shown in the table above — labelled accordingly so
                  // it doesn't read as a math error.
                  label={state.tax_mode === 'inclusive' ? 'Taxable value' : 'Subtotal'}
                  value={formatPaise(totals.subtotalPaise, state.currency)}
                />
                {totals.discountPaise > 0 ? (
                  <Row
                    label={`Discount (${formatPercent(state.doc_discount_pct)})`}
                    value={`− ${formatPaise(totals.discountPaise, state.currency)}`}
                  />
                ) : null}
                {totals.taxBreakup
                  .filter((bucket) => bucket.taxPaise > 0)
                  .map((bucket) => (
                    <Row
                      key={bucket.ratePct}
                      label={`Tax @ ${formatPercent(bucket.ratePct)}`}
                      value={formatPaise(bucket.taxPaise, state.currency)}
                    />
                  ))}
                <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular">{formatPaise(totals.totalPaise, state.currency)}</dd>
                </div>
              </dl>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {amountInWordsIndian(totals.totalPaise, state.currency)}
              </p>
            </section>

            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              Every figure here is computed by Invora&apos;s calculation engine from your quantities
              and rates — the same engine the PDF and the payment page use.
            </p>
          </div>

          <section className="card-surface space-y-4 p-5">
            <h2 className="text-sm font-semibold">Details</h2>

            {isQuote ? (
              <>
                <LongField
                  label="Scope of work"
                  value={state.scope}
                  onChange={(value) => patch({ scope: value })}
                  readOnly={readOnly}
                  rows={4}
                />
                <LongField
                  label="Deliverables"
                  value={state.deliverables}
                  onChange={(value) => patch({ deliverables: value })}
                  readOnly={readOnly}
                  rows={4}
                />
                <LongField
                  label="Exclusions & assumptions"
                  value={state.exclusions}
                  onChange={(value) => patch({ exclusions: value })}
                  readOnly={readOnly}
                  rows={4}
                  hint="The most commercially useful section of a quotation. Name what is not included."
                />
              </>
            ) : (
              <LongField
                label="What this invoice covers"
                value={state.scope}
                onChange={(value) => patch({ scope: value })}
                readOnly={readOnly}
                rows={3}
              />
            )}

            <LongField
              label="Payment terms"
              value={state.payment_terms}
              onChange={(value) => patch({ payment_terms: value })}
              readOnly={readOnly}
              rows={3}
            />
            <LongField
              label="Notes"
              value={state.notes}
              onChange={(value) => patch({ notes: value })}
              readOnly={readOnly}
              rows={3}
            />
            <LongField
              label="Terms & conditions"
              value={state.terms}
              onChange={(value) => patch({ terms: value })}
              readOnly={readOnly}
              rows={5}
            />
          </section>
        </div>

      </div>

      {isQuote ? (
        <AiGenerateDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          customerId={state.customer_id}
          onDraft={applyDraft}
        />
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function LongField({
  label,
  value,
  onChange,
  readOnly,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  rows?: number;
  hint?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {!readOnly ? <RewriteButton value={value} onResult={onChange} /> : null}
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        disabled={readOnly}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SaveIndicator({
  status,
  dirty,
  readOnly,
}: {
  status: SaveStatus;
  dirty: boolean;
  readOnly: boolean;
}) {
  if (readOnly) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CloudOff className="h-4 w-4" />
        Read-only
      </p>
    );
  }

  if (status === 'saving') {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Saving…
      </p>
    );
  }

  if (status === 'error') {
    return (
      <p className="flex items-center gap-1.5 text-sm text-destructive">
        <CloudOff className="h-4 w-4" />
        Not saved — fix the highlighted fields
      </p>
    );
  }

  if (dirty) {
    return <p className="text-sm text-muted-foreground">Unsaved changes · autosaving…</p>;
  }

  if (status === 'saved') {
    return (
      <p className="flex items-center gap-1.5 text-sm text-success">
        <Check className="h-4 w-4" />
        All changes saved
      </p>
    );
  }

  return <p className="text-sm text-muted-foreground">Draft</p>;
}
