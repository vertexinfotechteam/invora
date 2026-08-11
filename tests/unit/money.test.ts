import { describe, expect, it } from 'vitest';
import { amountInWordsIndian, formatPaise, parseAmountToPaise } from '@/lib/money';

describe('formatPaise', () => {
  it('formats rupees with two decimals', () => {
    expect(formatPaise(123456)).toMatch(/1,234\.56/);
  });

  it('renders zero rather than an empty string', () => {
    expect(formatPaise(0)).toMatch(/0\.00/);
  });
});

describe('parseAmountToPaise', () => {
  it('parses a plain number', () => {
    expect(parseAmountToPaise('1200')).toBe(120000);
  });

  it('parses decimals and strips symbols and separators', () => {
    expect(parseAmountToPaise('₹1,234.56')).toBe(123456);
    expect(parseAmountToPaise('1 234.5')).toBe(123450);
  });

  it('returns null for anything that is not a number', () => {
    expect(parseAmountToPaise('')).toBeNull();
    expect(parseAmountToPaise('abc')).toBeNull();
    expect(parseAmountToPaise('.')).toBeNull();
  });

  it('rounds to the nearest paise', () => {
    expect(parseAmountToPaise('10.005')).toBe(1001);
  });
});

describe('amountInWordsIndian', () => {
  it('uses the Indian numbering system', () => {
    expect(amountInWordsIndian(25_000_000)).toBe('Rupees Two Lakh Fifty Thousand Only');
    expect(amountInWordsIndian(10_000_000_00)).toBe('Rupees One Crore Only');
  });

  it('includes paise when there are any', () => {
    expect(amountInWordsIndian(123_45)).toBe(
      'Rupees One Hundred Twenty Three and Forty Five Paise Only',
    );
  });

  it('handles zero', () => {
    expect(amountInWordsIndian(0)).toBe('Rupees Zero Only');
  });

  it('handles a negative amount, for credit notes', () => {
    expect(amountInWordsIndian(-500_00)).toBe('Minus Rupees Five Hundred Only');
  });

  it('handles the teens correctly', () => {
    expect(amountInWordsIndian(17_00)).toBe('Rupees Seventeen Only');
    expect(amountInWordsIndian(115_00)).toBe('Rupees One Hundred Fifteen Only');
  });
});
