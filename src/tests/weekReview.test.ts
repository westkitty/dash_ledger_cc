/**
 * Phase 4 — weekly review workflow.
 *
 * Focus on behaviour not already covered by dates.test / aggregation.test:
 *  - a closed week is not frozen; editing a record in it makes the review stale;
 *  - completeness reporting surfaces the right unresolved items;
 *  - suspicious mileage is reported as "verify", never overwritten.
 */

import { describe, expect, it } from 'vitest';
import { weekChangedSinceReview, weekCompleteness } from '../domain/completeness';
import { seededMileageRates } from '../domain/mileageRates';
import { makeShift, makeExpense, makeReceipt } from './factories';
import type { WeeklyClosure } from '../domain/types';

const WK = '2026-01-05'; // a Monday
const RATES = seededMileageRates();

function closure(over: Partial<WeeklyClosure> = {}): WeeklyClosure {
  return { weekKey: WK, reviewedAt: '2026-01-12T10:00:00.000Z', reopenedAt: null, note: '', ...over };
}

describe('weekChangedSinceReview', () => {
  it('no closure -> never stale', () => {
    const r = weekChangedSinceReview(null, [makeShift({ date: '2026-01-06' })], [], []);
    expect(r).toEqual({ stale: false, changedCount: 0 });
  });

  it('records untouched since review -> not stale', () => {
    const s = makeShift({ date: '2026-01-06', updatedAt: '2026-01-08T00:00:00.000Z' });
    expect(weekChangedSinceReview(closure(), [s], [], []).stale).toBe(false);
  });

  it('a shift edited after review makes the week stale and is counted', () => {
    const s = makeShift({ date: '2026-01-06', updatedAt: '2026-01-20T00:00:00.000Z' });
    const e = makeExpense({ date: '2026-01-07', updatedAt: '2026-01-21T00:00:00.000Z' });
    const r = weekChangedSinceReview(closure(), [s], [e], []);
    expect(r.stale).toBe(true);
    expect(r.changedCount).toBe(2);
  });

  it('a change in a different week does not make this week stale', () => {
    const s = makeShift({ date: '2026-02-02', updatedAt: '2026-02-10T00:00:00.000Z' });
    expect(weekChangedSinceReview(closure(), [s], [], []).stale).toBe(false);
  });

  it('a receipt with a null date is ignored', () => {
    const rec = makeReceipt({ date: null, updatedAt: '2026-01-20T00:00:00.000Z' });
    expect(weekChangedSinceReview(closure(), [], [], [rec]).changedCount).toBe(0);
  });
});

describe('weekCompleteness surfacing', () => {
  it('reports suspicious mileage as a verify item, never altering the value', () => {
    const s = makeShift({ date: '2026-01-06', startOdometer: 0, endOdometer: 900 });
    const issues = weekCompleteness(WK, [s], [], [], RATES, 400);
    const sus = issues.find((i) => i.code === 'suspicious-mileage');
    expect(sus).toBeDefined();
    expect(sus!.severity).toBe('warn');
    expect(sus!.message).toContain('900');
    // The shift object is untouched.
    expect(s.endOdometer).toBe(900);
  });

  it('reports an unpriced-mileage info item when no rate covers the date', () => {
    const s = makeShift({ date: '1990-01-01', startOdometer: 100, endOdometer: 150 });
    const issues = weekCompleteness('1990-01-01', [s], [], [], RATES, 400);
    expect(issues.some((i) => i.code === 'no-rate' && i.severity === 'info')).toBe(true);
  });

  it('reports an inbox receipt and a REVIEW expense as things to resolve', () => {
    const inbox = makeReceipt({ date: '2026-01-07', status: 'Inbox' });
    const rev = makeExpense({ date: '2026-01-07', category: 'Review / Unsure', taxClass: 'REVIEW', receiptId: 'x' });
    const issues = weekCompleteness(WK, [], [rev], [inbox], RATES, 400);
    expect(issues.some((i) => i.code === 'receipt-inbox')).toBe(true);
    expect(issues.some((i) => i.code === 'expense-review')).toBe(true);
  });

  it('a fully complete week produces no issues', () => {
    const s = makeShift({
      date: '2026-01-06',
      startOdometer: 1000,
      endOdometer: 1100,
      startTime: '09:00',
      endTime: '14:00',
    });
    const e = makeExpense({ date: '2026-01-07', category: 'Fuel', taxClass: 'VEHICLE_ACTUAL', receiptId: 'r1' });
    const r = makeReceipt({ date: '2026-01-07', status: 'Classified', imageProcessingError: null });
    expect(weekCompleteness(WK, [s], [e], [r], RATES, 400)).toEqual([]);
  });
});
