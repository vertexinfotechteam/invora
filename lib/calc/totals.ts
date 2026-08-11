/**
 * Invora — deterministic money engine.
 *
 * RULES OF THIS FILE (do not relax them):
 *   1. Pure. No I/O, no AI, no database, no `Date`, no randomness.
 *   2. All money is integer paise. Intermediates are BigInt nano-paise.
 *   3. Rounding happens once per reported figure, half-up, at the very end.
 *   4. The AI never calls into here with a number it invented — a suggested
 *      rate becomes a `ratePaise` only after a human clicks "Use".
 *
 * Why nano-paise: quantities carry 3 decimals and percentages carry 2, so a
 * naive float pipeline drifts. Scaling to 1e9 keeps every intermediate exact
 * enough that the only visible rounding is the one we perform deliberately.
 */

const NANO = 1_000_000_000n; // nano-paise per paise
const PCT = 10_000n; // percentages are carried as basis-points × 100 (100% = 10000)

export type TaxMode = 'exclusive' | 'inclusive';
export type RoundingMode = 'none' | 'unit';

export type LineInput = {
  /** Supports decimals, e.g. 2.5 hours. Up to 3 decimal places. */
  qty: number;
  /** Unit rate in integer paise. */
  ratePaise: number;
  /** 0–100. Applied to this line only. */
  discountPct: number;
  /** 0, 5, 12, 18, 28 … in percent. */
  taxRatePct: number;
};

export type LineTotals = {
  /** qty × rate, before any discount. */
  grossPaise: number;
  /** Value removed by this line's own discount. */
  lineDiscountPaise: number;
  /** gross − lineDiscount. This is the number printed in the line-item row. */
  lineTotalPaise: number;
  /** Share of the document-level discount attributed to this line. */
  docDiscountPaise: number;
  /** Taxable value after both discounts. */
  taxablePaise: number;
  /** Tax charged on this line. */
  taxPaise: number;
};

export type TaxBucket = {
  ratePct: number;
  taxablePaise: number;
  taxPaise: number;
};

export type Totals = {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  taxBreakup: TaxBucket[];
  lines: LineTotals[];
};

export type TotalsOptions = {
  taxMode: TaxMode;
  /** 'unit' rounds the grand total to the nearest whole rupee. */
  roundTo: RoundingMode;
};

export const DEFAULT_TOTALS_OPTIONS: TotalsOptions = { taxMode: 'exclusive', roundTo: 'none' };

/** Half-up division for BigInt, correct for negative numerators too. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('divRound: division by zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n * 2n + d) / (d * 2n);
  return negative ? -q : q;
}

function nanoToPaise(nano: bigint): number {
  return Number(divRound(nano, NANO));
}

/** Percentages arrive as JS numbers; carry them as integers to avoid 0.1+0.2. */
function toPctUnits(pct: number): bigint {
  assertFinite(pct, 'percentage');
  const clamped = Math.min(100, Math.max(0, pct));
  return BigInt(Math.round(clamped * 100));
}

/** Quantities carry 3 decimals; 2.5 → 2500 thousandths. */
function toQtyThousandths(qty: number): bigint {
  assertFinite(qty, 'quantity');
  if (qty < 0) throw new RangeError('quantity must not be negative');
  return BigInt(Math.round(qty * 1000));
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be a finite number`);
}

function assertIntegerPaise(value: number, label: string): void {
  assertFinite(value, label);
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer number of paise (got ${value})`);
  }
  if (value < 0) throw new RangeError(`${label} must not be negative`);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} exceeds the safe integer range`);
}

/**
 * The single source of truth for every currency figure Invora displays,
 * prints, stores or charges.
 *
 * Order of operations:
 *   per line  → gross
 *             → minus line discount
 *             → minus a proportional share of the document discount
 *             → tax, computed per tax-rate bucket (GST needs the breakup)
 *   document  → round each reported figure once, half-up
 *             → optional round-off of the grand total to the nearest rupee
 */
export function computeTotals(
  lines: readonly LineInput[],
  docDiscountPct = 0,
  options: TotalsOptions = DEFAULT_TOTALS_OPTIONS,
): Totals {
  const docPct = toPctUnits(docDiscountPct);
  const docKeep = PCT - docPct;
  const inclusive = options.taxMode === 'inclusive';

  type Row = {
    grossNano: bigint;
    lineDiscountNano: bigint;
    netNano: bigint; // after line discount, before doc discount
    docDiscountNano: bigint;
    taxableNano: bigint;
    taxNano: bigint;
    ratePct: number;
  };

  const rows: Row[] = lines.map((line) => {
    assertIntegerPaise(line.ratePaise, 'ratePaise');
    const qtyThousandths = toQtyThousandths(line.qty);
    const linePct = toPctUnits(line.discountPct);
    const taxPct = toPctUnits(line.taxRatePct);

    // qty(1e-3) × rate(paise) × 1e6 == exact nano-paise.
    const grossNano = qtyThousandths * BigInt(line.ratePaise) * 1_000_000n;
    const netNano = (grossNano * (PCT - linePct)) / PCT;
    const lineDiscountNano = grossNano - netNano;

    const afterDocNano = (netNano * docKeep) / PCT;
    const docDiscountNano = netNano - afterDocNano;

    let taxableNano: bigint;
    let taxNano: bigint;
    if (inclusive) {
      // The rate already contains the tax: strip it back out.
      taxableNano = divRound(afterDocNano * PCT, PCT + taxPct);
      taxNano = afterDocNano - taxableNano;
    } else {
      taxableNano = afterDocNano;
      taxNano = divRound(afterDocNano * taxPct, PCT);
    }

    return {
      grossNano,
      lineDiscountNano,
      netNano,
      docDiscountNano,
      taxableNano,
      taxNano,
      ratePct: Math.min(100, Math.max(0, line.taxRatePct)),
    };
  });

  // ---- Tax buckets. The PDF must show tax per rate, and the buckets must sum
  // ---- to the header figure — so the header figure is defined as that sum.
  const bucketMap = new Map<string, { ratePct: number; taxableNano: bigint; taxNano: bigint }>();
  for (const row of rows) {
    const key = row.ratePct.toFixed(2);
    const bucket = bucketMap.get(key) ?? { ratePct: row.ratePct, taxableNano: 0n, taxNano: 0n };
    bucket.taxableNano += row.taxableNano;
    bucket.taxNano += row.taxNano;
    bucketMap.set(key, bucket);
  }

  const taxBreakup: TaxBucket[] = [...bucketMap.values()]
    .sort((a, b) => a.ratePct - b.ratePct)
    .map((bucket) => ({
      ratePct: bucket.ratePct,
      taxablePaise: nanoToPaise(bucket.taxableNano),
      taxPaise: nanoToPaise(bucket.taxNano),
    }));

  const subtotalNano = rows.reduce((sum, row) => sum + (inclusive ? stripTax(row) : row.netNano), 0n);
  const discountNano = rows.reduce((sum, row) => sum + row.docDiscountNano, 0n);

  const subtotalPaise = nanoToPaise(subtotalNano);
  const discountPaise = inclusive
    ? nanoToPaise(rows.reduce((sum, row) => sum + stripTaxOf(row.docDiscountNano, row.ratePct), 0n))
    : nanoToPaise(discountNano);
  const taxPaise = taxBreakup.reduce((sum, bucket) => sum + bucket.taxPaise, 0);

  const preRoundTotal = subtotalPaise - discountPaise + taxPaise;
  const totalPaise = options.roundTo === 'unit' ? roundToNearestRupee(preRoundTotal) : preRoundTotal;
  const roundOffPaise = totalPaise - preRoundTotal;

  const lineTotals: LineTotals[] = rows.map((row) => ({
    grossPaise: nanoToPaise(row.grossNano),
    lineDiscountPaise: nanoToPaise(row.lineDiscountNano),
    lineTotalPaise: nanoToPaise(row.netNano),
    docDiscountPaise: nanoToPaise(row.docDiscountNano),
    taxablePaise: nanoToPaise(row.taxableNano),
    taxPaise: nanoToPaise(row.taxNano),
  }));

  return {
    subtotalPaise,
    discountPaise,
    taxPaise,
    roundOffPaise,
    totalPaise,
    taxBreakup,
    lines: lineTotals,
  };

  /** In inclusive mode the printed subtotal is the tax-exclusive value. */
  function stripTax(row: Row): bigint {
    return divRound(row.netNano * PCT, PCT + toPctUnits(row.ratePct));
  }
  function stripTaxOf(nano: bigint, ratePct: number): bigint {
    return divRound(nano * PCT, PCT + toPctUnits(ratePct));
  }
}

function roundToNearestRupee(paise: number): number {
  return Math.round(paise / 100) * 100;
}

/**
 * The stored `line_total_paise` for a single row. Kept as a named export so the
 * editor, the PDF and the database writer can never disagree about it.
 */
export function computeLineTotalPaise(line: LineInput): number {
  const [first] = computeTotals([line], 0, DEFAULT_TOTALS_OPTIONS).lines;
  return first?.lineTotalPaise ?? 0;
}

/** Invariant used by the property test and asserted before every write. */
export function totalsAreConsistent(totals: Totals): boolean {
  const bucketSum = totals.taxBreakup.reduce((sum, bucket) => sum + bucket.taxPaise, 0);
  return (
    bucketSum === totals.taxPaise &&
    totals.subtotalPaise - totals.discountPaise + totals.taxPaise + totals.roundOffPaise ===
      totals.totalPaise
  );
}
