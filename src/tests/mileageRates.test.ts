import { describe, it, expect } from 'vitest';
import { seededMileageRates, effectiveRate, rateForDate, validateRatePeriod } from '../domain/mileageRates';
import { estimateMileage } from '../domain/aggregation';
import { makeShift } from './factories';
import type { MileageRate } from '../domain/types';

const SEED = seededMileageRates();

describe('effective-dated rate resolution', () => {
  it('2026-06-30 uses 0.725 and 2026-07-01 uses 0.760 (the split boundary)', () => {
    expect(rateForDate('2026-06-30', SEED)).toBe(0.725);
    expect(rateForDate('2026-07-01', SEED)).toBe(0.76);
  });

  it('picks the entry with the latest effective start date', () => {
    expect(effectiveRate('2022-08-01', SEED)?.ratePerMile).toBe(0.625);
    expect(effectiveRate('2022-03-01', SEED)?.ratePerMile).toBe(0.585);
  });

  it('returns null when no rate covers the date (miles will be unpriced)', () => {
    expect(effectiveRate('2000-01-01', SEED)).toBeNull();
    expect(effectiveRate('2099-01-01', SEED)).toBeNull();
  });

  it('a user override with the same start date beats the seed deterministically', () => {
    const override: MileageRate = {
      id: 'user-1',
      startDate: '2026-07-01',
      endDate: '2026-12-31',
      ratePerMile: 0.9,
      label: 'My override',
      source: 'User added',
      seeded: false,
    };
    const rate = effectiveRate('2026-08-01', [...SEED, override]);
    expect(rate?.seeded).toBe(false);
    expect(rate?.ratePerMile).toBe(0.9);
  });
});

describe('mixed-period mileage estimate', () => {
  it('prices each shift by its own date and aggregates', () => {
    const shifts = [
      makeShift({ date: '2026-06-30', startOdometer: 0, endOdometer: 100 }), // 100 mi @ 0.725 = 72.50
      makeShift({ date: '2026-07-01', startOdometer: 0, endOdometer: 100 }), // 100 mi @ 0.760 = 76.00
    ];
    const est = estimateMileage(shifts, SEED);
    expect(est.estimateCents).toBe(7250 + 7600);
    expect(est.pricedMiles).toBe(200);
    expect(est.unpricedMiles).toBe(0);
    expect(est.byPeriod).toHaveLength(2);
  });

  it('reports unpriced miles instead of inventing a rate', () => {
    const shifts = [makeShift({ date: '2005-01-01', startOdometer: 0, endOdometer: 50 })];
    const est = estimateMileage(shifts, SEED);
    expect(est.estimateCents).toBe(0);
    expect(est.unpricedMiles).toBe(50);
  });

  it('does not prematurely round each shift (aggregate has no drift)', () => {
    // 3 shifts of 33 miles @ 0.655 = 21.615 each -> 64.845 -> 6485 cents when summed first
    const shifts = [
      makeShift({ date: '2023-02-01', startOdometer: 0, endOdometer: 33 }),
      makeShift({ date: '2023-02-08', startOdometer: 0, endOdometer: 33 }),
      makeShift({ date: '2023-02-15', startOdometer: 0, endOdometer: 33 }),
    ];
    const est = estimateMileage(shifts, SEED);
    expect(est.estimateCents).toBe(Math.round(99 * 0.655 * 100)); // 6485
  });
});

describe('rate period validation', () => {
  it('rejects reversed dates and non-positive rates', () => {
    expect(validateRatePeriod({ startDate: '2027-06-01', endDate: '2027-01-01', ratePerMile: 0.8 })).toContain(
      'End date cannot be before the start date.',
    );
    expect(validateRatePeriod({ startDate: '2027-01-01', endDate: null, ratePerMile: 0 }).length).toBeGreaterThan(0);
    expect(validateRatePeriod({ startDate: '2027-01-01', endDate: null, ratePerMile: 0.8 })).toHaveLength(0);
  });
});
