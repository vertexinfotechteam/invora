import { computeTotals, type LineInput, type TaxMode, type Totals } from '@/lib/calc/totals';
import type { CommandPlan } from '@/lib/ai/schemas';

/**
 * The deterministic half of the AI command bar.
 *
 * The model classifies the instruction and hands back parameters. This module
 * applies them, and `computeTotals` recomputes every figure. At no point does a
 * number produced by the model land in a money field: the model supplies a
 * *percentage* and an *index*, and our code does the arithmetic.
 */

export interface CommandLine {
  name: string;
  qty: number;
  rate_paise: number;
  discount_pct: number;
  tax_rate: number;
  unit: string;
  description?: string | null;
}

export interface CommandDocumentState {
  lines: CommandLine[];
  docDiscountPct: number;
  taxMode: TaxMode;
}

export interface CommandApplyResult {
  applied: boolean;
  /** Why we refused, when `applied` is false. */
  reason?: string;
  next: CommandDocumentState;
  before: Totals;
  after: Totals;
  /** Positive means the customer now owes more. */
  totalDeltaPaise: number;
  /** True when the user must click Apply before anything changes. */
  requiresConfirmation: boolean;
  /** Human-readable summary rendered above the diff. */
  summary: string;
}

function toCalcLines(lines: CommandLine[]): LineInput[] {
  return lines.map((line) => ({
    qty: line.qty,
    ratePaise: line.rate_paise,
    discountPct: line.discount_pct,
    taxRatePct: line.tax_rate,
  }));
}

function clampPercent(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

export function applyCommandPlan(
  state: CommandDocumentState,
  plan: CommandPlan,
): CommandApplyResult {
  const before = computeTotals(toCalcLines(state.lines), state.docDiscountPct, {
    taxMode: state.taxMode,
    roundTo: 'none',
  });

  const next: CommandDocumentState = {
    lines: state.lines.map((line) => ({ ...line })),
    docDiscountPct: state.docDiscountPct,
    taxMode: state.taxMode,
  };

  const refuse = (reason: string): CommandApplyResult => ({
    applied: false,
    reason,
    next: state,
    before,
    after: before,
    totalDeltaPaise: 0,
    requiresConfirmation: false,
    summary: reason,
  });

  const percent = clampPercent(plan.percent);
  const index = plan.lineIndex;
  const lineExists = typeof index === 'number' && index >= 0 && index < next.lines.length;

  switch (plan.intent) {
    case 'set_document_discount': {
      if (percent === null) return refuse('No discount percentage was recognised in that command.');
      next.docDiscountPct = percent;
      break;
    }

    case 'set_line_discount': {
      if (percent === null) return refuse('No discount percentage was recognised in that command.');
      if (plan.scope === 'all_lines') {
        next.lines = next.lines.map((line) => ({ ...line, discount_pct: percent }));
      } else if (lineExists) {
        next.lines[index]!.discount_pct = percent;
      } else {
        return refuse('That command did not clearly identify a line item.');
      }
      break;
    }

    case 'set_tax_rate': {
      if (percent === null) return refuse('No tax rate was recognised in that command.');
      if (plan.scope === 'line') {
        if (!lineExists) return refuse('That command did not clearly identify a line item.');
        next.lines[index]!.tax_rate = percent;
      } else {
        next.lines = next.lines.map((line) => ({ ...line, tax_rate: percent }));
      }
      break;
    }

    case 'add_line_item': {
      if (!plan.itemName) return refuse('No item name was recognised in that command.');
      next.lines = [
        ...next.lines,
        {
          name: plan.itemName,
          description: null,
          unit: 'unit',
          qty: plan.itemQty && plan.itemQty > 0 ? plan.itemQty : 1,
          // Deliberately zero. The user enters the price; the model never does.
          rate_paise: 0,
          discount_pct: 0,
          tax_rate: next.lines[0]?.tax_rate ?? 0,
        },
      ];
      break;
    }

    case 'remove_line_item': {
      if (!lineExists) return refuse('That command did not clearly identify a line item to remove.');
      next.lines = next.lines.filter((_, position) => position !== index);
      break;
    }

    case 'edit_text':
    case 'translate':
      // Wording changes touch no figures; the client routes these to
      // /api/ai/rewrite and shows a text diff.
      return {
        applied: true,
        next: state,
        before,
        after: before,
        totalDeltaPaise: 0,
        requiresConfirmation: false,
        summary: plan.reasoningSummary,
      };

    case 'unsupported':
    default:
      return refuse(
        'I could not confidently map that to an edit. Try naming the field or the line item, e.g. "give 5% discount" or "set tax to 18% on the design line".',
      );
  }

  const after = computeTotals(toCalcLines(next.lines), next.docDiscountPct, {
    taxMode: next.taxMode,
    roundTo: 'none',
  });

  return {
    applied: true,
    next,
    before,
    after,
    totalDeltaPaise: after.totalPaise - before.totalPaise,
    // Anything that moves money requires an explicit click.
    requiresConfirmation: true,
    summary: plan.reasoningSummary,
  };
}
