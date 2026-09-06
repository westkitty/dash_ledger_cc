/**
 * Weekly record-completeness review.
 *
 * This is NOT a tax-compliance score. It surfaces records that look incomplete
 * or internally inconsistent so the user can decide what to do.
 */

import type { Expense, MileageRate, Receipt, Shift, WeekKey } from './types';
import { mondayOf } from './dates';
import { computeMileage, checkContinuity } from './mileage';
import { effectiveRate } from './mileageRates';
import { shiftDuration } from './duration';
import { taxClassForCategory } from './expenses';

export type IssueSeverity = 'warn' | 'info';

export interface CompletenessIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  /** Optional deep-link target within the app (hash route without leading #). */
  href?: string;
}

export function weekCompleteness(
  weekKey: WeekKey,
  allShifts: Shift[],
  allExpenses: Expense[],
  allReceipts: Receipt[],
  rates: MileageRate[],
  implausibleMiles = 400,
): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];
  const shifts = allShifts.filter((s) => s.weekKey === weekKey || mondayOf(s.date) === weekKey);
  const expenses = allExpenses.filter((e) => mondayOf(e.date) === weekKey);
  const receipts = allReceipts.filter((r) => r.date !== null && mondayOf(r.date) === weekKey);

  for (const s of shifts) {
    if (s.status === 'active') {
      issues.push({
        code: 'active-dash',
        severity: 'warn',
        message: `An active dash from ${s.date} is still open in this week.`,
        href: `/dash/${s.id}`,
      });
      continue;
    }
    const m = computeMileage(s.startOdometer, s.endOdometer, implausibleMiles);
    if (m.status === 'missing') {
      issues.push({
        code: 'missing-odometer',
        severity: 'warn',
        message: `Dash on ${s.date} is missing an odometer reading, so its business mileage cannot be calculated.`,
        href: `/dash/${s.id}`,
      });
    } else if (m.status === 'reversed') {
      issues.push({
        code: 'reversed-odometer',
        severity: 'warn',
        message: `Dash on ${s.date} has an ending odometer below its starting odometer.`,
        href: `/dash/${s.id}`,
      });
    } else if (m.status === 'suspicious') {
      issues.push({
        code: 'suspicious-mileage',
        severity: 'warn',
        message: `Dash on ${s.date} recorded ${m.miles} business miles — above the ${implausibleMiles}-mile check. Verify it.`,
        href: `/dash/${s.id}`,
      });
    }

    const cont = checkContinuity(allShifts, s.vehicleId, s.date, s.startOdometer, s.id);
    if (cont.hasGap && cont.gap !== null) {
      issues.push({
        code: 'continuity-gap',
        severity: 'info',
        message: `Dash on ${s.date}: ${Math.abs(cont.gap)} mi ${cont.gap > 0 ? 'gap after' : 'overlap with'} the previous ${s.vehicleLabel} reading. Those miles are not counted as business mileage.`,
        href: `/dash/${s.id}`,
      });
    }

    if (m.status === 'ok' || m.status === 'suspicious') {
      const miles = m.miles ?? 0;
      if (miles > 0 && !effectiveRate(s.date, rates)) {
        issues.push({
          code: 'no-rate',
          severity: 'info',
          message: `Dash on ${s.date} has ${miles} business miles with no configured mileage rate — those miles are unpriced.`,
          href: '/settings',
        });
      }
    }

    const dur = shiftDuration(s.startTime, s.endTime);
    if (!dur.known) {
      issues.push({
        code: 'incomplete-time',
        severity: 'info',
        message: `Dash on ${s.date} is missing a start or end time, so hourly metrics for this week are incomplete.`,
        href: `/dash/${s.id}`,
      });
    }
  }

  for (const e of expenses) {
    if (!e.receiptId) {
      issues.push({
        code: 'expense-no-receipt',
        severity: 'info',
        message: `Expense "${e.merchant || e.category}" on ${e.date} has no linked receipt.`,
        href: `/expense/${e.id}`,
      });
    }
    if ((e.taxClass || taxClassForCategory(e.category)) === 'REVIEW') {
      issues.push({
        code: 'expense-review',
        severity: 'warn',
        message: `Expense "${e.merchant || e.category}" on ${e.date} is still classified Review / Unsure.`,
        href: `/expense/${e.id}`,
      });
    }
  }

  for (const r of receipts) {
    if (r.status === 'Inbox') {
      issues.push({
        code: 'receipt-inbox',
        severity: 'warn',
        message: `Receipt from ${r.date ?? r.capturedAt.slice(0, 10)} is still in the Inbox and unclassified.`,
        href: `/receipts/${r.id}`,
      });
    }
    if (r.imageProcessingError) {
      issues.push({
        code: 'receipt-image-warning',
        severity: 'info',
        message: `Receipt from ${r.date ?? r.capturedAt.slice(0, 10)}: image optimisation failed but the original was preserved.`,
        href: `/receipts/${r.id}`,
      });
    }
  }

  return issues;
}
