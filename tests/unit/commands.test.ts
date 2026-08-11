import { describe, expect, it } from 'vitest';

import { applyCommandPlan, type CommandDocumentState } from '@/lib/ai/commands';
import type { CommandPlan } from '@/lib/ai/schemas';

/**
 * The command bar's safety property, tested directly:
 *
 *   The model supplies an intent and a percentage. It never supplies an amount.
 *   Our code applies the parameters and computeTotals produces every figure.
 */

const state: CommandDocumentState = {
  taxMode: 'exclusive',
  docDiscountPct: 0,
  lines: [
    { name: 'Design', qty: 1, rate_paise: 100_000, discount_pct: 0, tax_rate: 18, unit: 'project' },
    { name: 'Development', qty: 1, rate_paise: 200_000, discount_pct: 0, tax_rate: 18, unit: 'project' },
  ],
};

const plan = (overrides: Partial<CommandPlan>): CommandPlan => ({
  intent: 'unsupported',
  reasoningSummary: 'test',
  scope: 'document',
  lineIndex: null,
  percent: null,
  field: 'none',
  instruction: '',
  targetLanguage: null,
  itemName: null,
  itemQty: null,
  touchesMoney: false,
  ...overrides,
});

describe('applyCommandPlan', () => {
  it('applies a document discount and recomputes the total itself', () => {
    const result = applyCommandPlan(
      state,
      plan({ intent: 'set_document_discount', percent: 5, touchesMoney: true }),
    );

    expect(result.applied).toBe(true);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.next.docDiscountPct).toBe(5);

    // ₹3,000 − 5% = ₹2,850, +18% tax = ₹3,363
    expect(result.before.totalPaise).toBe(354_000);
    expect(result.after.totalPaise).toBe(336_300);
    expect(result.totalDeltaPaise).toBe(-17_700);
  });

  it('applies a discount to a single identified line', () => {
    const result = applyCommandPlan(
      state,
      plan({ intent: 'set_line_discount', scope: 'line', lineIndex: 1, percent: 10, touchesMoney: true }),
    );

    expect(result.next.lines[0]?.discount_pct).toBe(0);
    expect(result.next.lines[1]?.discount_pct).toBe(10);
  });

  it('applies a discount to every line when the scope says so', () => {
    const result = applyCommandPlan(
      state,
      plan({ intent: 'set_line_discount', scope: 'all_lines', percent: 15, touchesMoney: true }),
    );
    expect(result.next.lines.every((line) => line.discount_pct === 15)).toBe(true);
  });

  it('changes tax rates across the document', () => {
    const result = applyCommandPlan(
      state,
      plan({ intent: 'set_tax_rate', scope: 'all_lines', percent: 5, touchesMoney: true }),
    );
    expect(result.next.lines.every((line) => line.tax_rate === 5)).toBe(true);
    expect(result.after.taxPaise).toBe(15_000);
  });

  it('adds a line item at zero rate — the model never sets a price', () => {
    const result = applyCommandPlan(
      state,
      plan({ intent: 'add_line_item', itemName: 'Training', itemQty: 2, touchesMoney: true }),
    );

    expect(result.next.lines).toHaveLength(3);
    expect(result.next.lines[2]).toMatchObject({ name: 'Training', qty: 2, rate_paise: 0 });
    // Adding a zero-rate line cannot change the total.
    expect(result.totalDeltaPaise).toBe(0);
  });

  it('removes an identified line', () => {
    const result = applyCommandPlan(
      state,
      plan({ intent: 'remove_line_item', scope: 'line', lineIndex: 0, touchesMoney: true }),
    );
    expect(result.next.lines).toHaveLength(1);
    expect(result.next.lines[0]?.name).toBe('Development');
  });

  it('refuses rather than guessing when no line matches', () => {
    const result = applyCommandPlan(
      state,
      plan({ intent: 'set_line_discount', scope: 'line', lineIndex: 99, percent: 10 }),
    );
    expect(result.applied).toBe(false);
    expect(result.next).toBe(state);
    expect(result.reason).toMatch(/line item/i);
  });

  it('refuses when a percentage is missing', () => {
    const result = applyCommandPlan(state, plan({ intent: 'set_document_discount', percent: null }));
    expect(result.applied).toBe(false);
  });

  it('refuses an unsupported intent and changes nothing', () => {
    const result = applyCommandPlan(state, plan({ intent: 'unsupported' }));
    expect(result.applied).toBe(false);
    expect(result.after.totalPaise).toBe(result.before.totalPaise);
  });

  it('treats text edits as needing no confirmation and no recomputation', () => {
    const result = applyCommandPlan(
      state,
      plan({ intent: 'edit_text', field: 'scope', instruction: 'more formal' }),
    );
    expect(result.applied).toBe(true);
    expect(result.requiresConfirmation).toBe(false);
    expect(result.totalDeltaPaise).toBe(0);
  });

  it('clamps an out-of-range percentage rather than trusting it', () => {
    const result = applyCommandPlan(
      state,
      plan({ intent: 'set_document_discount', percent: 500, touchesMoney: true }),
    );
    expect(result.next.docDiscountPct).toBe(100);
    expect(result.after.totalPaise).toBe(0);
  });

  it('never mutates the state it was given', () => {
    const snapshot = JSON.stringify(state);
    applyCommandPlan(state, plan({ intent: 'set_document_discount', percent: 25 }));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
