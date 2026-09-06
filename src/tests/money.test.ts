import { describe, it, expect } from 'vitest';
import {
  parseMoneyToCents,
  formatCents,
  addCents,
  subCents,
  grossIncomeCents,
  centsToPlainString,
} from '../domain/money';

describe('money parsing and formatting', () => {
  it('parses common currency shapes to integer cents', () => {
    expect(parseMoneyToCents('$84.50')).toBe(8450);
    expect(parseMoneyToCents('84.5')).toBe(8450);
    expect(parseMoneyToCents('84')).toBe(8400);
    expect(parseMoneyToCents('1,234.56')).toBe(123456);
    expect(parseMoneyToCents(' 5 ')).toBe(500);
    expect(parseMoneyToCents('-3.20')).toBe(-320);
    expect(parseMoneyToCents(5)).toBe(500);
  });

  it('treats blank / unparseable input deliberately as null (missing), not 0 or NaN', () => {
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('   ')).toBeNull();
    expect(parseMoneyToCents(null)).toBeNull();
    expect(parseMoneyToCents(undefined)).toBeNull();
    expect(parseMoneyToCents('abc')).toBeNull();
    expect(parseMoneyToCents('.')).toBeNull();
  });

  it('formats cents back to grouped currency', () => {
    expect(formatCents(8450)).toBe('$84.50');
    expect(formatCents(500)).toBe('$5.00');
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(-320)).toBe('-$3.20');
    expect(formatCents(null)).toBe('—');
    expect(formatCents(320, { sign: true })).toBe('+$3.20');
  });

  it('plain string form for CSV', () => {
    expect(centsToPlainString(8450)).toBe('84.50');
    expect(centsToPlainString(null)).toBe('');
    expect(centsToPlainString(-5)).toBe('-0.05');
  });
});

describe('money arithmetic', () => {
  it('80 + 25 = 105', () => {
    expect(grossIncomeCents(8000, 2500)).toBe(10500);
  });
  it('null operands are treated as zero deliberately', () => {
    expect(addCents(8000, null, undefined, 2000)).toBe(10000);
    expect(grossIncomeCents(5000, null)).toBe(5000);
    expect(grossIncomeCents(null, null)).toBe(0);
    expect(subCents(10000, null)).toBe(10000);
    expect(subCents(10000, 2500)).toBe(7500);
  });
});
