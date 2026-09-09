/**
 * Phase 8 — unified "needs review" surface (evidence-backed gain).
 *
 * Aggregates actionable unresolved items across the whole ledger, not just the
 * current week. Purely derived; never mutates a record.
 */

import { describe, expect, it } from 'vitest';
import { pendingReview } from '../domain/completeness';
import { seededMileageRates } from '../domain/mileageRates';
import { makeShift, makeExpense, makeReceipt } from './factories';

const RATES = seededMileageRates();

describe('pendingReview', () => {
  it('is empty for a clean ledger', () => {
    const s = makeShift({
      date: '2026-01-06',
      startOdometer: 1000,
      endOdometer: 1100,
      startTime: '09:00',
      endTime: '14:00',
    });
    const e = makeExpense({ date: '2026-01-07', category: 'Fuel', taxClass: 'VEHICLE_ACTUAL', receiptId: 'r1' });
    const r = makeReceipt({ date: '2026-01-07', status: 'Classified', imageProcessingError: null });
    expect(pendingReview([s], [e], [r], RATES, 400)).toEqual([]);
  });

  it('collects actionable items from multiple different weeks', () => {
    const janActive = makeShift({ id: 'a', status: 'active', date: '2026-01-06', endOdometer: null });
    const febReversed = makeShift({ id: 'b', date: '2026-02-10', startOdometer: 500, endOdometer: 400 });
    const marSuspicious = makeShift({ id: 'c', date: '2026-03-09', startOdometer: 0, endOdometer: 900 });
    const reviewExpense = makeExpense({ id: 'e', date: '2026-02-11', category: 'Review / Unsure', taxClass: 'REVIEW', receiptId: 'x' });
    const inboxReceipt = makeReceipt({ id: 'r', date: '2026-03-10', status: 'Inbox' });

    const issues = pendingReview(
      [janActive, febReversed, marSuspicious],
      [reviewExpense],
      [inboxReceipt],
      RATES,
      400,
    );
    const codes = issues.map((i) => i.code).sort();
    expect(codes).toContain('active-dash');
    expect(codes).toContain('reversed-odometer');
    expect(codes).toContain('suspicious-mileage');
    expect(codes).toContain('expense-review');
    expect(codes).toContain('receipt-inbox');
    // every item is deep-linked
    expect(issues.every((i) => typeof i.href === 'string' && i.href.length > 0)).toBe(true);
    // warnings sort ahead of info
    const firstInfo = issues.findIndex((i) => i.severity === 'info');
    const lastWarn = issues.map((i) => i.severity).lastIndexOf('warn');
    if (firstInfo !== -1) expect(lastWarn).toBeLessThan(firstInfo);
  });

  it('does not include purely informational notes like continuity gaps or missing receipts', () => {
    // A completed dash with a continuity gap but otherwise fine, and an expense with no receipt.
    const prior = makeShift({ id: 'p', date: '2026-01-05', vehicleId: 'v', startOdometer: 100, endOdometer: 200 });
    const gap = makeShift({ id: 'g', date: '2026-01-08', vehicleId: 'v', startOdometer: 250, endOdometer: 300, startTime: '09:00', endTime: '12:00' });
    const noReceipt = makeExpense({ id: 'n', date: '2026-01-09', category: 'Fuel', taxClass: 'VEHICLE_ACTUAL', receiptId: null });
    const issues = pendingReview([prior, gap], [noReceipt], [], RATES, 400);
    expect(issues.map((i) => i.code)).not.toContain('continuity-gap');
    expect(issues.map((i) => i.code)).not.toContain('expense-no-receipt');
    expect(issues.map((i) => i.code)).not.toContain('incomplete-time');
  });

  it('reports a suspicious dash without altering it', () => {
    const s = makeShift({ date: '2026-04-06', startOdometer: 0, endOdometer: 950 });
    const issues = pendingReview([s], [], [], RATES, 400);
    expect(issues.some((i) => i.code === 'suspicious-mileage')).toBe(true);
    expect(s.endOdometer).toBe(950);
  });

  it('surfaces an undated inbox receipt', () => {
    const r = makeReceipt({ id: 'u', date: null, status: 'Inbox' });
    const issues = pendingReview([], [], [r], RATES, 400);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('receipt-inbox');
    expect(issues[0].href).toBe('/receipts/u');
  });
});
