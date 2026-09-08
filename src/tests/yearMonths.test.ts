/**
 * Phase 5 — per-month year drill-down aggregation.
 */

import { describe, expect, it } from 'vitest';
import { summariseYearByMonth } from '../domain/aggregation';
import { makeShift, makeExpense } from './factories';

describe('summariseYearByMonth', () => {
  it('always returns 12 rows, months 1..12', () => {
    const rows = summariseYearByMonth(2026, [], []);
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(rows.every((r) => r.dashCount === 0 && r.grossIncomeCents === 0)).toBe(true);
  });

  it('buckets completed dashes and expenses into the right month', () => {
    const rows = summariseYearByMonth(
      2026,
      [
        makeShift({ date: '2026-03-04', appEarningsCents: 9650, cashTipsCents: 350, startOdometer: 0, endOdometer: 100 }),
        makeShift({ date: '2026-03-20', appEarningsCents: 5000, cashTipsCents: 0, startOdometer: 100, endOdometer: 140 }),
        makeShift({ date: '2026-07-01', appEarningsCents: 8000, cashTipsCents: 0, startOdometer: 140, endOdometer: 200 }),
      ],
      [makeExpense({ date: '2026-03-10', amountCents: 4200 })],
    );
    const mar = rows[2];
    expect(mar.dashCount).toBe(2);
    expect(mar.grossIncomeCents).toBe(9650 + 350 + 5000);
    expect(mar.businessMiles).toBe(140);
    expect(mar.trackedExpensesCents).toBe(4200);
    expect(rows[6].dashCount).toBe(1);
    expect(rows[0].dashCount).toBe(0);
  });

  it('ignores other years and active dashes', () => {
    const rows = summariseYearByMonth(
      2026,
      [
        makeShift({ date: '2025-03-04', appEarningsCents: 5000 }),
        makeShift({ date: '2026-03-04', status: 'active', appEarningsCents: 5000, endOdometer: null }),
      ],
      [makeExpense({ date: '2025-03-10', amountCents: 4200 })],
    );
    expect(rows.every((r) => r.dashCount === 0 && r.trackedExpensesCents === 0)).toBe(true);
  });
});
