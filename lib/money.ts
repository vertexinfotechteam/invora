/**
 * Display-layer money helpers. Formatting only — never arithmetic.
 * All arithmetic belongs in lib/calc/totals.ts.
 */

export const PAISE_PER_UNIT = 100;

export function formatPaise(
  paise: number,
  currency = 'INR',
  locale = 'en-IN',
  options: { withSymbol?: boolean; compact?: boolean } = {},
): string {
  const { withSymbol = true, compact = false } = options;
  const amount = paise / PAISE_PER_UNIT;

  return new Intl.NumberFormat(locale, {
    style: withSymbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: 2,
    notation: compact ? 'compact' : 'standard',
  }).format(amount);
}

/** Parses "1,234.50" / "₹1234.5" / "1234" into integer paise. Returns null on garbage. */
export function parseAmountToPaise(input: string): number | null {
  const cleaned = input.replace(/[^\d.-]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * PAISE_PER_UNIT);
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const tens = TENS[Math.floor(n / 10)] ?? '';
  const ones = ONES[n % 10] ?? '';
  return ones ? `${tens} ${ones}` : tens;
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/**
 * Indian numbering ("Two Lakh Fifty Thousand"). Printed on invoices because
 * Indian buyers expect the amount in words next to the grand total.
 */
export function amountInWordsIndian(paise: number, currency = 'INR'): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / PAISE_PER_UNIT);
  const fraction = abs % PAISE_PER_UNIT;

  const unitName = currency === 'INR' ? 'Rupees' : currency;
  const fractionName = currency === 'INR' ? 'Paise' : 'Cents';

  const words = rupeesToWords(rupees);
  const parts = [negative ? 'Minus' : '', unitName, words || 'Zero'].filter(Boolean);
  if (fraction > 0) parts.push('and', twoDigits(fraction), fractionName);
  parts.push('Only');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function rupeesToWords(value: number): string {
  if (value === 0) return 'Zero';

  const crore = Math.floor(value / 10_000_000);
  const lakh = Math.floor((value % 10_000_000) / 100_000);
  const thousand = Math.floor((value % 100_000) / 1000);
  const rest = value % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${rupeesToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

export function formatPercent(pct: number): string {
  return `${Number(pct.toFixed(2))}%`;
}

export function formatQty(qty: number): string {
  return Number(qty.toFixed(3)).toString();
}
