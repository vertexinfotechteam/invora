import { describe, expect, it } from 'vitest';

import {
  computeLineTotalPaise,
  computeTotals,
  totalsAreConsistent,
  type LineInput,
} from '@/lib/calc/totals';

/**
 * The money engine's test suite.
 *
 * This is the file that decides whether Invora can be trusted with an invoice.
 * It aims at 100% branch coverage and finishes with a property test asserting
 * the accounting identity across thousands of random documents.
 */

const line = (overrides: Partial<LineInput> = {}): LineInput => ({
  qty: 1,
  ratePaise: 100_00,
  discountPct: 0,
  taxRatePct: 0,
  ...overrides,
});

describe('computeTotals — basics', () => {
  it('returns zeroes for an empty document', () => {
    const totals = computeTotals([], 0);
    expect(totals).toMatchObject({
      subtotalPaise: 0,
      discountPaise: 0,
      taxPaise: 0,
      totalPaise: 0,
      roundOffPaise: 0,
    });
    expect(totals.taxBreakup).toEqual([]);
    expect(totals.lines).toEqual([]);
  });

  it('multiplies quantity by rate', () => {
    const totals = computeTotals([line({ qty: 3, ratePaise: 250_00 })]);
    expect(totals.subtotalPaise).toBe(750_00);
    expect(totals.totalPaise).toBe(750_00);
  });

  it('handles a zero-quantity line without producing NaN', () => {
    const totals = computeTotals([line({ qty: 0, ratePaise: 999_99 })]);
    expect(totals.subtotalPaise).toBe(0);
    expect(totals.totalPaise).toBe(0);
    expect(totals.lines[0]?.lineTotalPaise).toBe(0);
  });

  it('handles a zero-rate line', () => {
    const totals = computeTotals([line({ qty: 5, ratePaise: 0, taxRatePct: 18 })]);
    expect(totals.totalPaise).toBe(0);
    expect(totals.taxPaise).toBe(0);
  });

  it('supports fractional quantities to three decimals', () => {
    // 2.5 hours at ₹1,200 = ₹3,000
    const totals = computeTotals([line({ qty: 2.5, ratePaise: 1200_00 })]);
    expect(totals.subtotalPaise).toBe(3000_00);

    // 0.333 days at ₹9,000 = ₹2,997
    const thirds = computeTotals([line({ qty: 0.333, ratePaise: 9000_00 })]);
    expect(thirds.subtotalPaise).toBe(2997_00);
  });
});

describe('computeTotals — discounts', () => {
  it('applies a line discount', () => {
    const totals = computeTotals([line({ ratePaise: 1000_00, discountPct: 10 })]);
    expect(totals.subtotalPaise).toBe(900_00);
    expect(totals.lines[0]?.lineDiscountPaise).toBe(100_00);
  });

  it('applies a 100% line discount, leaving nothing to charge', () => {
    const totals = computeTotals([line({ ratePaise: 5000_00, discountPct: 100, taxRatePct: 18 })]);
    expect(totals.subtotalPaise).toBe(0);
    expect(totals.taxPaise).toBe(0);
    expect(totals.totalPaise).toBe(0);
  });

  it('applies a document discount proportionally across lines', () => {
    const totals = computeTotals(
      [line({ ratePaise: 1000_00 }), line({ ratePaise: 3000_00 })],
      10,
    );
    expect(totals.subtotalPaise).toBe(4000_00);
    expect(totals.discountPaise).toBe(400_00);
    expect(totals.totalPaise).toBe(3600_00);
    // Proportional: the ₹3,000 line absorbs three quarters of the discount.
    expect(totals.lines[0]?.docDiscountPaise).toBe(100_00);
    expect(totals.lines[1]?.docDiscountPaise).toBe(300_00);
  });

  it('compounds a line discount with a document discount', () => {
    // 1000 − 20% = 800; 800 − 50% = 400
    const totals = computeTotals([line({ ratePaise: 1000_00, discountPct: 20 })], 50);
    expect(totals.subtotalPaise).toBe(800_00);
    expect(totals.discountPaise).toBe(400_00);
    expect(totals.totalPaise).toBe(400_00);
  });

  it('clamps out-of-range percentages instead of producing nonsense', () => {
    const over = computeTotals([line({ ratePaise: 1000_00, discountPct: 150 })]);
    expect(over.subtotalPaise).toBe(0);

    const under = computeTotals([line({ ratePaise: 1000_00, discountPct: -50 })]);
    expect(under.subtotalPaise).toBe(1000_00);

    const overDoc = computeTotals([line({ ratePaise: 1000_00 })], 150);
    expect(overDoc.totalPaise).toBe(0);
  });
});

describe('computeTotals — tax', () => {
  it('adds exclusive tax on top of the net amount', () => {
    const totals = computeTotals([line({ ratePaise: 1000_00, taxRatePct: 18 })]);
    expect(totals.subtotalPaise).toBe(1000_00);
    expect(totals.taxPaise).toBe(180_00);
    expect(totals.totalPaise).toBe(1180_00);
  });

  it('strips inclusive tax back out of the rate', () => {
    // ₹1,180 inclusive of 18% == ₹1,000 + ₹180
    const totals = computeTotals([line({ ratePaise: 1180_00, taxRatePct: 18 })], 0, {
      taxMode: 'inclusive',
      roundTo: 'none',
    });
    expect(totals.subtotalPaise).toBe(1000_00);
    expect(totals.taxPaise).toBe(180_00);
    expect(totals.totalPaise).toBe(1180_00);
  });

  it('applies a document discount correctly in inclusive mode', () => {
    const totals = computeTotals([line({ ratePaise: 1180_00, taxRatePct: 18 })], 10, {
      taxMode: 'inclusive',
      roundTo: 'none',
    });
    expect(totals.subtotalPaise).toBe(1000_00);
    expect(totals.discountPaise).toBe(100_00);
    expect(totals.taxPaise).toBe(162_00);
    expect(totals.totalPaise).toBe(1062_00);
  });

  it('buckets mixed tax rates and the buckets sum to the header figure', () => {
    const totals = computeTotals([
      line({ ratePaise: 1000_00, taxRatePct: 5 }),
      line({ ratePaise: 2000_00, taxRatePct: 18 }),
      line({ ratePaise: 3000_00, taxRatePct: 18 }),
      line({ ratePaise: 4000_00, taxRatePct: 0 }),
    ]);

    expect(totals.taxBreakup).toEqual([
      { ratePct: 0, taxablePaise: 4000_00, taxPaise: 0 },
      { ratePct: 5, taxablePaise: 1000_00, taxPaise: 50_00 },
      { ratePct: 18, taxablePaise: 5000_00, taxPaise: 900_00 },
    ]);

    const bucketSum = totals.taxBreakup.reduce((sum, bucket) => sum + bucket.taxPaise, 0);
    expect(bucketSum).toBe(totals.taxPaise);
    expect(totals.totalPaise).toBe(10_000_00 + 950_00);
  });

  it('merges lines that share a rate into one bucket', () => {
    const totals = computeTotals([
      line({ ratePaise: 100_00, taxRatePct: 12 }),
      line({ ratePaise: 200_00, taxRatePct: 12 }),
    ]);
    expect(totals.taxBreakup).toHaveLength(1);
    expect(totals.taxBreakup[0]?.taxablePaise).toBe(300_00);
  });
});

describe('computeTotals — rounding', () => {
  it('rounds half up at the paise boundary', () => {
    // 1 paise taxed at 50% is exactly half a paise, which must round up.
    expect(computeTotals([line({ ratePaise: 1, taxRatePct: 50 })]).taxPaise).toBe(1);

    // 0.5 of a 1-paise line is also exactly half a paise.
    expect(computeTotals([line({ qty: 0.5, ratePaise: 1 })]).subtotalPaise).toBe(1);

    // Just below the boundary rounds down.
    expect(computeTotals([line({ qty: 0.499, ratePaise: 1 })]).subtotalPaise).toBe(0);
  });

  it('rounds the grand total to the nearest rupee when asked', () => {
    const up = computeTotals([line({ ratePaise: 1000_51 })], 0, {
      taxMode: 'exclusive',
      roundTo: 'unit',
    });
    expect(up.totalPaise).toBe(1001_00);
    expect(up.roundOffPaise).toBe(49);

    const down = computeTotals([line({ ratePaise: 1000_49 })], 0, {
      taxMode: 'exclusive',
      roundTo: 'unit',
    });
    expect(down.totalPaise).toBe(1000_00);
    expect(down.roundOffPaise).toBe(-49);
  });

  it('reports a zero round-off when the total is already whole', () => {
    const totals = computeTotals([line({ ratePaise: 500_00 })], 0, {
      taxMode: 'exclusive',
      roundTo: 'unit',
    });
    expect(totals.roundOffPaise).toBe(0);
  });
});

describe('computeTotals — guard rails', () => {
  it('rejects a non-integer rate', () => {
    expect(() => computeTotals([line({ ratePaise: 100.5 })])).toThrow(/integer number of paise/);
  });

  it('rejects a negative rate', () => {
    expect(() => computeTotals([line({ ratePaise: -1 })])).toThrow(/must not be negative/);
  });

  it('rejects a negative quantity', () => {
    expect(() => computeTotals([line({ qty: -1 })])).toThrow(/must not be negative/);
  });

  it('rejects non-finite input', () => {
    expect(() => computeTotals([line({ qty: Number.NaN })])).toThrow(/finite/);
    expect(() => computeTotals([line({ ratePaise: Number.POSITIVE_INFINITY })])).toThrow(/finite/);
    expect(() => computeTotals([line({ discountPct: Number.NaN })])).toThrow(/finite/);
  });

  it('rejects a rate beyond the safe integer range', () => {
    expect(() => computeTotals([line({ ratePaise: Number.MAX_SAFE_INTEGER + 2 })])).toThrow();
  });
});

describe('computeTotals — realistic documents', () => {
  it('handles a ₹0 invoice', () => {
    const totals = computeTotals([line({ qty: 1, ratePaise: 0, taxRatePct: 18 })]);
    expect(totals.totalPaise).toBe(0);
    expect(totalsAreConsistent(totals)).toBe(true);
  });

  it('handles very large values without precision loss', () => {
    // ₹9,99,99,999.99 at 18%
    const totals = computeTotals([line({ ratePaise: 999_999_999 * 100 + 99, taxRatePct: 18 })]);
    expect(totals.subtotalPaise).toBe(99_999_999_999);
    // 99,999,999,999 × 18% = 17,999,999,999.82 → half-up → 18,000,000,000
    expect(totals.taxPaise).toBe(18_000_000_000);
    expect(totalsAreConsistent(totals)).toBe(true);
  });

  it('handles a 40-line document, as the PDF acceptance test does', () => {
    const lines = Array.from({ length: 40 }, (_, index) =>
      line({
        qty: 1 + (index % 5) * 0.5,
        ratePaise: (1000 + index * 137) * 100,
        discountPct: index % 3 === 0 ? 5 : 0,
        taxRatePct: [0, 5, 12, 18, 28][index % 5]!,
      }),
    );

    const totals = computeTotals(lines, 7.5);
    expect(totals.lines).toHaveLength(40);
    expect(totalsAreConsistent(totals)).toBe(true);
    expect(totals.totalPaise).toBeGreaterThan(0);
  });
});

describe('computeLineTotalPaise', () => {
  it('matches the line total the full engine produces', () => {
    const input = line({ qty: 2.5, ratePaise: 1234_56, discountPct: 12.5 });
    expect(computeLineTotalPaise(input)).toBe(computeTotals([input]).lines[0]?.lineTotalPaise);
  });
});

describe('property: the accounting identity always holds', () => {
  it('subtotal − discount + tax + roundOff === total, for 3,000 random documents', () => {
    // A deterministic PRNG so a failure is reproducible from the seed.
    let seed = 0x1234_5678;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7fff_ffff;
      return seed / 0x7fff_ffff;
    };
    const pick = <T,>(values: T[]): T => values[Math.floor(random() * values.length)]!;

    for (let iteration = 0; iteration < 3000; iteration += 1) {
      const lineCount = 1 + Math.floor(random() * 12);
      const lines: LineInput[] = Array.from({ length: lineCount }, () => ({
        qty: Math.round(random() * 10_000) / 1000,
        ratePaise: Math.floor(random() * 5_000_00),
        discountPct: Math.round(random() * 100 * 100) / 100,
        taxRatePct: pick([0, 5, 12, 18, 28]),
      }));

      const docDiscount = Math.round(random() * 100 * 100) / 100;
      const options = {
        taxMode: pick(['exclusive', 'inclusive'] as const),
        roundTo: pick(['none', 'unit'] as const),
      };

      const totals = computeTotals(lines, docDiscount, options);

      expect(
        totalsAreConsistent(totals),
        `identity broke at iteration ${iteration}: ${JSON.stringify({ lines, docDiscount, options, totals })}`,
      ).toBe(true);

      expect(totals.subtotalPaise).toBeGreaterThanOrEqual(0);
      expect(totals.taxPaise).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(totals.totalPaise)).toBe(true);
    }
  });
});
