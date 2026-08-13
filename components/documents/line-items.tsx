'use client';

import * as React from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { computeTotals, type TaxMode } from '@/lib/calc/totals';
import { formatPaise, parseAmountToPaise } from '@/lib/money';
import { cn } from '@/lib/utils';
import { emptyLine, type EditorLine, type ProductOption } from '@/components/documents/types';

const TAX_PRESETS = [0, 5, 12, 18, 28];

/**
 * Keyboard-first line-item editor.
 *
 * Tab moves cell to cell (native). Enter on the last row appends a new one and
 * focuses it, so a five-line quotation never needs the mouse.
 *
 * Below `md` the table becomes a stack of cards — a six-column financial table
 * squeezed into 375px is unusable, and pretending otherwise is worse than
 * changing the layout.
 */
export function LineItemsEditor({
  lines,
  onChange,
  taxMode,
  currency,
  products,
  defaultTaxRate,
}: {
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
  taxMode: TaxMode;
  currency: string;
  products: ProductOption[];
  defaultTaxRate: number;
}) {
  const lastNameRef = React.useRef<HTMLInputElement>(null);
  const shouldFocusLast = React.useRef(false);

  React.useEffect(() => {
    if (shouldFocusLast.current) {
      lastNameRef.current?.focus();
      shouldFocusLast.current = false;
    }
  }, [lines.length]);

  const perLine = React.useMemo(
    () =>
      computeTotals(
        lines.map((line) => ({
          qty: line.qty,
          ratePaise: line.rate_paise,
          discountPct: line.discount_pct,
          taxRatePct: line.tax_rate,
        })),
        0,
        { taxMode, roundTo: 'none' },
      ).lines,
    [lines, taxMode],
  );

  function update(index: number, patch: Partial<EditorLine>) {
    onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    shouldFocusLast.current = true;
    onChange([...lines, emptyLine(defaultTaxRate)]);
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, position) => position !== index));
  }

  function applyProduct(index: number, productId: string) {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return;
    update(index, {
      product_id: product.id,
      name: product.name,
      description: product.description ?? '',
      unit: product.unit,
      rate_paise: product.default_price_paise,
      tax_rate: product.tax_rate,
      discount_pct: product.default_discount_pct,
      hsn_sac: product.hsn_sac ?? '',
    });
  }

  function onNameKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'Enter' && index === lines.length - 1) {
      event.preventDefault();
      addLine();
    }
  }

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Line items</h2>
        <span className="text-xs text-muted-foreground">
          {taxMode === 'inclusive' ? 'Rates include tax' : 'Rates exclude tax'}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        {/*
          table-fixed: with auto layout, a browser sizes a column from its
          cells' *minimum content width* — an empty/short-value Item input
          could get sized down to almost nothing while the other, explicitly
          `w-*`-sized columns hold their ground, which is exactly the
          collapsed-to-a-sliver Item box this was producing. Fixed layout
          uses only the widths declared on this header row and splits
          whatever's left evenly across undeclared columns (just Item here),
          so its width is deterministic and never collapses.
        */}
        <table className="w-full min-w-[1080px] table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-2 py-2" aria-label="Reorder handle" />
              <th className="px-2 py-2 font-medium">Item</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
              <th className="w-28 px-2 py-2 font-medium">Unit</th>
              <th className="w-32 px-2 py-2 text-right font-medium">Rate</th>
              <th className="w-28 px-2 py-2 text-right font-medium">Disc %</th>
              <th className="w-24 px-2 py-2 text-right font-medium">Tax %</th>
              <th className="w-32 px-2 py-2 text-right font-medium">Amount</th>
              <th className="w-10 px-2 py-2" aria-label="Remove" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line, index) => (
              <tr key={line.key} className="align-top">
                <td className="px-2 py-2 text-muted-foreground">
                  <GripVertical className="mt-2 h-4 w-4" aria-hidden />
                </td>
                <td className="px-2 py-2">
                  <Input
                    ref={index === lines.length - 1 ? lastNameRef : undefined}
                    value={line.name}
                    onChange={(event) => update(index, { name: event.target.value })}
                    onKeyDown={(event) => onNameKeyDown(event, index)}
                    placeholder="What are you charging for?"
                    aria-label={`Line ${index + 1} name`}
                  />
                  <Input
                    value={line.description}
                    onChange={(event) => update(index, { description: event.target.value })}
                    placeholder="Description (optional)"
                    aria-label={`Line ${index + 1} description`}
                    className="mt-1 h-8 border-dashed text-xs"
                  />
                  {products.length > 0 ? (
                    <select
                      value=""
                      onChange={(event) => applyProduct(index, event.target.value)}
                      aria-label={`Fill line ${index + 1} from catalog`}
                      className="mt-1 h-7 w-full rounded-md border border-dashed border-input bg-transparent px-2 text-xs text-muted-foreground"
                    >
                      <option value="">Fill from catalog…</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    value={line.qty}
                    onChange={(event) => update(index, { qty: clampQty(Number(event.target.value)) })}
                    className="text-right tabular"
                    aria-label={`Line ${index + 1} quantity`}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={line.unit}
                    onChange={(event) => update(index, { unit: event.target.value })}
                    aria-label={`Line ${index + 1} unit`}
                  />
                </td>
                <td className="px-2 py-2">
                  <RateInput
                    valuePaise={line.rate_paise}
                    onChangePaise={(paise) => update(index, { rate_paise: paise })}
                    label={`Line ${index + 1} rate`}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={line.discount_pct}
                    onChange={(event) =>
                      update(index, { discount_pct: clampPercent(Number(event.target.value)) })
                    }
                    className="text-right tabular"
                    aria-label={`Line ${index + 1} discount percent`}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    value={line.tax_rate}
                    onChange={(event) => update(index, { tax_rate: Number(event.target.value) })}
                    aria-label={`Line ${index + 1} tax rate`}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-right text-sm tabular"
                  >
                    {[...new Set([...TAX_PRESETS, line.tax_rate])]
                      .sort((a, b) => a - b)
                      .map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-right">
                  <span className="inline-block pt-2 text-sm font-medium tabular">
                    {formatPaise(perLine[index]?.lineTotalPaise ?? 0, currency)}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    aria-label={`Remove line ${index + 1}`}
                    className="mt-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border md:hidden">
        {lines.map((line, index) => (
          <div key={line.key} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
              <button
                type="button"
                onClick={() => removeLine(index)}
                disabled={lines.length === 1}
                aria-label={`Remove line ${index + 1}`}
                className="rounded-md p-1 text-muted-foreground disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <Input
              value={line.name}
              onChange={(event) => update(index, { name: event.target.value })}
              placeholder="What are you charging for?"
              aria-label={`Line ${index + 1} name`}
            />
            <Input
              value={line.description}
              onChange={(event) => update(index, { description: event.target.value })}
              placeholder="Description (optional)"
              aria-label={`Line ${index + 1} description`}
              className="text-xs"
            />

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                Qty
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={line.qty}
                  onChange={(event) => update(index, { qty: clampQty(Number(event.target.value)) })}
                  className="mt-1 tabular"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Unit
                <Input
                  value={line.unit}
                  onChange={(event) => update(index, { unit: event.target.value })}
                  className="mt-1"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Rate
                <RateInput
                  valuePaise={line.rate_paise}
                  onChangePaise={(paise) => update(index, { rate_paise: paise })}
                  label={`Line ${index + 1} rate`}
                  className="mt-1"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Tax
                <select
                  value={line.tax_rate}
                  onChange={(event) => update(index, { tax_rate: Number(event.target.value) })}
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm tabular"
                >
                  {[...new Set([...TAX_PRESETS, line.tax_rate])]
                    .sort((a, b) => a - b)
                    .map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <p className="text-right text-sm font-medium tabular">
              {formatPaise(perLine[index]?.lineTotalPaise ?? 0, currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-3">
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="h-4 w-4" />
          Add line
        </Button>
        <span className="ml-3 text-xs text-muted-foreground">
          Press Enter on the last row to add another.
        </span>
      </div>
    </div>
  );
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** computeTotals throws on a negative quantity — the input's `min={0}` alone
 * does not block typed negative values, so this is the real guard. */
function clampQty(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/**
 * Rupees in the box, paise in the state.
 *
 * Keeps a local string so typing "1200." does not get normalised out from
 * under the cursor, but only ever emits integer paise upward.
 */
function RateInput({
  valuePaise,
  onChangePaise,
  label,
  className,
}: {
  valuePaise: number;
  onChangePaise: (paise: number) => void;
  label: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = draft ?? (valuePaise === 0 ? '' : (valuePaise / 100).toString());

  return (
    <Input
      inputMode="decimal"
      value={display}
      aria-label={label}
      placeholder="0.00"
      className={cn('text-right tabular', className)}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const paise = parseAmountToPaise(next);
        onChangePaise(paise === null ? 0 : Math.max(0, paise));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
