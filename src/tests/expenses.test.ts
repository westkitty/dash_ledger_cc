import { describe, it, expect } from 'vitest';
import { taxClassForCategory, isKnownCategory } from '../domain/expenses';
import { bucketExpenses, estimateMileage } from '../domain/aggregation';
import { seededMileageRates } from '../domain/mileageRates';
import { makeExpense, makeShift } from './factories';

describe('expense tax-treatment classes', () => {
  it('maps known categories to the right class', () => {
    expect(taxClassForCategory('Fuel')).toBe('VEHICLE_ACTUAL');
    expect(taxClassForCategory('Insurance')).toBe('VEHICLE_ACTUAL');
    expect(taxClassForCategory('Parking')).toBe('MILEAGE_ADDON');
    expect(taxClassForCategory('Tolls')).toBe('MILEAGE_ADDON');
    expect(taxClassForCategory('Phone / Data')).toBe('NON_VEHICLE_BUSINESS');
  });

  it('unknown or empty category defaults to REVIEW', () => {
    expect(taxClassForCategory('Something weird')).toBe('REVIEW');
    expect(taxClassForCategory('')).toBe('REVIEW');
    expect(taxClassForCategory(null)).toBe('REVIEW');
    expect(isKnownCategory('Fuel')).toBe(true);
    expect(isKnownCategory('Nope')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(taxClassForCategory('fuel')).toBe('VEHICLE_ACTUAL');
    expect(taxClassForCategory('  PARKING ')).toBe('MILEAGE_ADDON');
  });
});

describe('standard-mileage estimate never absorbs vehicle actual-expense records', () => {
  it('fuel and insurance are bucketed as VEHICLE_ACTUAL and excluded from the mileage estimate', () => {
    const expenses = [
      makeExpense({ category: 'Fuel', taxClass: 'VEHICLE_ACTUAL', amountCents: 6000 }),
      makeExpense({ category: 'Insurance', taxClass: 'VEHICLE_ACTUAL', amountCents: 12000 }),
      makeExpense({ category: 'Parking', taxClass: 'MILEAGE_ADDON', amountCents: 500 }),
      makeExpense({ category: 'Tolls', taxClass: 'MILEAGE_ADDON', amountCents: 275 }),
    ];
    const b = bucketExpenses(expenses);
    expect(b.vehicleActualCents).toBe(18000);
    expect(b.parkingCents).toBe(500);
    expect(b.tollsCents).toBe(275);
    expect(b.mileageAddonCents).toBe(775);

    // The mileage estimate is purely miles * rate — expenses are not an input at all.
    const est = estimateMileage([makeShift({ startOdometer: 0, endOdometer: 100, date: '2026-02-01' })], seededMileageRates());
    expect(est.estimateCents).toBe(Math.round(100 * 0.725 * 100));
  });

  it('REVIEW-class expenses are counted separately', () => {
    const b = bucketExpenses([makeExpense({ category: 'Review / Unsure', taxClass: 'REVIEW', amountCents: 999 })]);
    expect(b.reviewCents).toBe(999);
    expect(b.reviewCount).toBe(1);
    expect(b.vehicleActualCents).toBe(0);
  });
});
