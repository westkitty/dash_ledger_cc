import { describe, it, expect } from 'vitest';
import {
  legacyDollarsToCents,
  resolveMoneyField,
  isBlockingMoneyStatus,
} from '../services/import/legacyMoney';
import { formatCents } from '../domain/money';

describe('legacyDollarsToCents', () => {
  it('converts ordinary two-decimal amounts exactly', () => {
    expect(legacyDollarsToCents(96.5)).toBe(9650);
    expect(legacyDollarsToCents(84.5)).toBe(8450);
    expect(legacyDollarsToCents(12)).toBe(1200);
    expect(legacyDollarsToCents(40.25)).toBe(4025);
    expect(legacyDollarsToCents(0)).toBe(0);
    expect(legacyDollarsToCents(12345.67)).toBe(1234567);
  });

  it('is not defeated by binary floating point', () => {
    // 0.145 * 100 === 14.499999999999998 in IEEE-754, which Math.round makes 14.
    expect(0.145 * 100).toBeLessThan(14.5);
    expect(legacyDollarsToCents(0.145)).toBe(15);
    expect(legacyDollarsToCents(1.005)).toBe(101);
    expect(legacyDollarsToCents(8.165)).toBe(817);
  });

  it('handles negative amounts', () => {
    expect(legacyDollarsToCents(-3.2)).toBe(-320);
    expect(legacyDollarsToCents(-0.01)).toBe(-1);
  });

  it('returns null rather than a substitute for unusable input', () => {
    expect(legacyDollarsToCents(undefined)).toBeNull();
    expect(legacyDollarsToCents(null)).toBeNull();
    expect(legacyDollarsToCents('96.50')).toBeNull();
    expect(legacyDollarsToCents(NaN)).toBeNull();
    expect(legacyDollarsToCents(Infinity)).toBeNull();
    expect(legacyDollarsToCents(1e15)).toBeNull();
  });
});

describe('resolveMoneyField — the hybrid A/B database classes', () => {
  it('A-only: dollars are converted', () => {
    const r = resolveMoneyField('appEarningsCents', 96.5, undefined);
    expect(r.status).toBe('legacy-only');
    expect(r.cents).toBe(9650);
  });

  it('B-only: cents are taken as-is', () => {
    const r = resolveMoneyField('appEarningsCents', undefined, 9650);
    expect(r.status).toBe('canonical-only');
    expect(r.cents).toBe(9650);
  });

  it('both present and equivalent: resolves without ambiguity', () => {
    const r = resolveMoneyField('appEarningsCents', 96.5, 9650);
    expect(r.status).toBe('agreed');
    expect(r.cents).toBe(9650);
    expect(isBlockingMoneyStatus(r.status)).toBe(false);
  });

  it('both present and conflicting: refuses to choose, keeps both', () => {
    const r = resolveMoneyField('appEarningsCents', 96.5, 4200);
    expect(r.status).toBe('conflict');
    expect(r.cents).toBeNull(); // neither value is silently adopted
    expect(r.legacyDollars).toBe(96.5);
    expect(r.legacyAsCents).toBe(9650);
    expect(r.canonicalCents).toBe(4200);
    expect(isBlockingMoneyStatus(r.status)).toBe(true);
  });

  it('absent: missing stays missing and never becomes zero', () => {
    for (const [legacy, canonical] of [
      [undefined, undefined],
      [null, null],
      ['', ''],
    ] as const) {
      const r = resolveMoneyField('appEarningsCents', legacy, canonical);
      expect(r.status).toBe('absent');
      expect(r.cents).toBeNull();
      expect(r.cents).not.toBe(0);
    }
  });

  it('distinguishes an explicit zero from an absent value', () => {
    const explicit = resolveMoneyField('cashTipsCents', 0, undefined);
    expect(explicit.status).toBe('legacy-only');
    expect(explicit.cents).toBe(0);

    const absent = resolveMoneyField('cashTipsCents', undefined, undefined);
    expect(absent.cents).toBeNull();
  });

  it('reports malformed values instead of coercing them', () => {
    expect(resolveMoneyField('amountCents', 'lots', undefined).status).toBe('invalid');
    expect(resolveMoneyField('amountCents', undefined, 96.5).status).toBe('invalid'); // non-integer cents
    expect(resolveMoneyField('amountCents', undefined, NaN).status).toBe('invalid');
    expect(resolveMoneyField('amountCents', 96.5, NaN).status).toBe('invalid');
    for (const bad of ['lots', 96.5, NaN]) {
      expect(resolveMoneyField('amountCents', undefined, bad).cents).toBeNull();
    }
  });
});

describe('$96.50 regression — pure conversion layer', () => {
  it('turns the original record\'s dollars into exactly 9650 cents, never 0', () => {
    const appEarnings = resolveMoneyField('appEarningsCents', 84.5, undefined);
    const cashTips = resolveMoneyField('cashTipsCents', 12, undefined);
    const gross = (appEarnings.cents ?? 0) + (cashTips.cents ?? 0);

    expect(gross).toBe(9650);
    expect(gross).not.toBe(0);
    expect(formatCents(gross)).toBe('$96.50');
    expect(formatCents(gross)).not.toBe('$0.00');
  });
});
