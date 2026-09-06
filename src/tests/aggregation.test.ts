import { describe, it, expect } from 'vitest';
import {
  summariseWeek,
  summariseYear,
  annualOdometerResult,
  actualExpensePlanning,
  reconcileStatement,
  bucketExpenses,
} from '../domain/aggregation';
import { seededMileageRates } from '../domain/mileageRates';
import { makeShift, makeExpense, makeReceipt } from './factories';

const RATES = seededMileageRates();

describe('weekly aggregation', () => {
  const shifts = [
    makeShift({ date: '2026-01-05', appEarningsCents: 8000, cashTipsCents: 2500, startOdometer: 0, endOdometer: 100, startTime: '10:00', endTime: '15:00' }),
    makeShift({ date: '2026-01-07', appEarningsCents: 4000, cashTipsCents: 0, startOdometer: 100, endOdometer: 150, startTime: '11:00', endTime: '13:00' }),
  ];
  const expenses = [
    makeExpense({ date: '2026-01-06', category: 'Fuel', taxClass: 'VEHICLE_ACTUAL', amountCents: 3000 }),
    makeExpense({ date: '2026-01-06', category: 'Parking', taxClass: 'MILEAGE_ADDON', amountCents: 500 }),
  ];
  const receipts = [makeReceipt({ date: '2026-01-06', status: 'Inbox' })];

  it('sums income, tips, miles and expenses for the Mon–Sun week', () => {
    const w = summariseWeek('2026-01-05', shifts, expenses, receipts, RATES, 400, '2026-02-01');
    expect(w.appEarningsCents).toBe(12000);
    expect(w.cashTipsCents).toBe(2500);
    expect(w.grossIncomeCents).toBe(14500);
    expect(w.businessMiles).toBe(150);
    expect(w.expenses.totalCents).toBe(3500);
    expect(w.expenses.vehicleActualCents).toBe(3000);
    expect(w.expenses.parkingCents).toBe(500);
    expect(w.netCashAfterExpensesCents).toBe(14500 - 3500);
    expect(w.receiptCount).toBe(1);
    expect(w.unresolvedReceiptCount).toBe(1);
  });

  it('prices mileage by effective rate (150 mi @ 0.725 in early 2026)', () => {
    const w = summariseWeek('2026-01-05', shifts, expenses, receipts, RATES, 400, '2026-02-01');
    expect(w.mileage.estimateCents).toBe(Math.round(150 * 0.725 * 100));
    expect(w.mileage.unpricedMiles).toBe(0);
  });

  it('suppresses gross/hour until every completed shift has valid time data', () => {
    const withMissing = [...shifts, makeShift({ date: '2026-01-08', startTime: null, endTime: null, appEarningsCents: 5000 })];
    const w = summariseWeek('2026-01-05', withMissing, [], [], RATES, 400, '2026-02-01');
    expect(w.time.timeComplete).toBe(false);
    expect(w.time.shiftsMissingTime).toBe(1);
    expect(w.grossPerHourCents).toBeNull();
  });

  it('computes gross/hour when time data is complete', () => {
    const w = summariseWeek('2026-01-05', shifts, [], [], RATES, 400, '2026-02-01');
    // 7 known hours, gross 14500 (10500 + 4000) -> ~2071 cents/hr
    expect(w.time.knownHours).toBe(7);
    expect(w.grossIncomeCents).toBe(14500);
    expect(w.grossPerHourCents).toBe(Math.round(14500 / 7));
  });

  it('marks current-week boundaries via temporallyComplete', () => {
    expect(summariseWeek('2026-01-05', [], [], [], RATES, 400, '2026-01-08').temporallyComplete).toBe(false);
    expect(summariseWeek('2026-01-05', [], [], [], RATES, 400, '2026-01-20').temporallyComplete).toBe(true);
  });
});

describe('yearly aggregation', () => {
  it('rolls weeks and records up into a year summary', () => {
    const shifts = [
      makeShift({ date: '2026-01-05', appEarningsCents: 10000, startOdometer: 0, endOdometer: 100 }),
      makeShift({ date: '2026-07-02', appEarningsCents: 20000, startOdometer: 0, endOdometer: 100 }),
      makeShift({ date: '2025-06-01', appEarningsCents: 9999, startOdometer: 0, endOdometer: 10 }),
    ];
    const y = summariseYear(2026, shifts, [], [], new Set(['2026-01-05']), RATES, 400, '2027-01-01');
    expect(y.completedShiftCount).toBe(2);
    expect(y.appEarningsCents).toBe(30000);
    expect(y.businessMiles).toBe(200);
    // 100 mi @ 0.725 + 100 mi @ 0.76
    expect(y.mileage.estimateCents).toBe(7250 + 7600);
    expect(y.reviewedWeeks).toBe(1);
    expect(y.completedWeeks).toBe(2);
  });

  it('counts unresolved records (active dash, review expense, inbox receipt, missing odo)', () => {
    const shifts = [
      makeShift({ date: '2026-03-02', status: 'active', startOdometer: 0, endOdometer: null }),
      makeShift({ date: '2026-03-03', startOdometer: 100, endOdometer: null }),
    ];
    const expenses = [makeExpense({ date: '2026-03-04', category: 'Review / Unsure', taxClass: 'REVIEW' })];
    const receipts = [makeReceipt({ date: '2026-03-05', status: 'Inbox' })];
    const y = summariseYear(2026, shifts, expenses, receipts, new Set(), RATES, 400, '2026-04-01');
    expect(y.unresolvedRecordCount).toBeGreaterThanOrEqual(3);
  });
});

describe('annual odometer & business use', () => {
  it('normal annual mileage and percentage', () => {
    const r = annualOdometerResult(10000, 25000, 6000);
    expect(r.annualVehicleMiles).toBe(15000);
    expect(r.businessUsePercentage).toBeCloseTo(40);
    expect(r.status).toBe('ok');
  });

  it('reversed annual odometer is flagged, not clamped', () => {
    const r = annualOdometerResult(25000, 10000, 100);
    expect(r.status).toBe('reversed');
    expect(r.businessUsePercentage).toBeNull();
  });

  it('business miles exceeding total annual miles is flagged inconsistent', () => {
    const r = annualOdometerResult(10000, 12000, 5000);
    expect(r.status).toBe('inconsistent');
    expect(r.businessUsePercentage).toBeNull();
  });

  it('missing readings -> no data, no fabricated percentage', () => {
    expect(annualOdometerResult(null, 20000, 100).hasData).toBe(false);
  });
});

describe('actual-expense planning comparison', () => {
  it('allocates vehicle actual expenses by business-use % and keeps parking/tolls separate', () => {
    const buckets = bucketExpenses([
      makeExpense({ category: 'Fuel', taxClass: 'VEHICLE_ACTUAL', amountCents: 100000 }),
      makeExpense({ category: 'Parking', taxClass: 'MILEAGE_ADDON', amountCents: 1000 }),
      makeExpense({ category: 'Tolls', taxClass: 'MILEAGE_ADDON', amountCents: 500 }),
    ]);
    const odo = annualOdometerResult(0, 10000, 4000); // 40%
    const p = actualExpensePlanning(buckets, odo);
    expect(p.available).toBe(true);
    expect(p.allocatedVehicleExpensesCents).toBe(40000);
    expect(p.parkingCents).toBe(1000);
    expect(p.tollsCents).toBe(500);
  });

  it('unavailable without valid odometer data', () => {
    const p = actualExpensePlanning(bucketExpenses([]), annualOdometerResult(null, null, 0));
    expect(p.available).toBe(false);
    expect(p.allocatedVehicleExpensesCents).toBeNull();
  });
});

describe('statement / 1099 reconciliation', () => {
  it('compares statement to recorded app earnings and keeps cash tips separate', () => {
    const r = reconcileStatement(500000, 480000, 30000);
    expect(r.recordedAppEarningsCents).toBe(480000);
    expect(r.cashTipsCents).toBe(30000);
    expect(r.totalLedgerGrossCents).toBe(510000);
    expect(r.statementDeltaCents).toBe(20000);
  });

  it('no statement -> null delta, nothing fabricated', () => {
    const r = reconcileStatement(null, 480000, 30000);
    expect(r.hasStatement).toBe(false);
    expect(r.statementDeltaCents).toBeNull();
  });
});
