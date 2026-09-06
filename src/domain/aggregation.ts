/**
 * Pure aggregation of shifts / expenses / receipts into weekly and yearly
 * summaries. All money is integer cents. Currency is rounded only at the output
 * boundary; per-shift mileage estimates are summed in dollars before rounding.
 */

import type { Expense, MileageRate, Receipt, Shift, TaxClass, WeekKey } from './types';
import { grossIncomeCents, sumCents } from './money';
import { computeMileage, countableBusinessMiles } from './mileage';
import { effectiveRate } from './mileageRates';
import { shiftDuration } from './duration';
import { taxClassForCategory } from './expenses';
import { mondayOf, weekRange, isWeekTemporallyComplete, yearOf, todayLocalDate } from './dates';

export interface ExpenseBuckets {
  totalCents: number;
  vehicleActualCents: number;
  mileageAddonCents: number;
  parkingCents: number;
  tollsCents: number;
  nonVehicleBusinessCents: number;
  reviewCents: number;
  reviewCount: number;
  count: number;
}

export function bucketExpenses(expenses: Expense[]): ExpenseBuckets {
  const b: ExpenseBuckets = {
    totalCents: 0,
    vehicleActualCents: 0,
    mileageAddonCents: 0,
    parkingCents: 0,
    tollsCents: 0,
    nonVehicleBusinessCents: 0,
    reviewCents: 0,
    reviewCount: 0,
    count: expenses.length,
  };
  for (const e of expenses) {
    const cls: TaxClass = e.taxClass || taxClassForCategory(e.category);
    b.totalCents += e.amountCents;
    if (cls === 'VEHICLE_ACTUAL') b.vehicleActualCents += e.amountCents;
    else if (cls === 'MILEAGE_ADDON') {
      b.mileageAddonCents += e.amountCents;
      if (/parking/i.test(e.category)) b.parkingCents += e.amountCents;
      else if (/toll/i.test(e.category)) b.tollsCents += e.amountCents;
    } else if (cls === 'NON_VEHICLE_BUSINESS') b.nonVehicleBusinessCents += e.amountCents;
    else {
      b.reviewCents += e.amountCents;
      b.reviewCount += 1;
    }
  }
  return b;
}

export interface MileageEstimate {
  /** Rounded currency estimate, in cents. */
  estimateCents: number;
  /** Miles priced by at least one rate. */
  pricedMiles: number;
  /** Miles with no configured rate — NOT priced. */
  unpricedMiles: number;
  /** Breakdown keyed by rate label / effective period. */
  byPeriod: Array<{ key: string; label: string; ratePerMile: number; miles: number; estimateCents: number }>;
}

/**
 * Standard-mileage planning estimate for a set of completed shifts.
 * Each shift is priced by the rate effective on its own date. Vehicle
 * actual-expense records are NEVER added here.
 */
export function estimateMileage(shifts: Shift[], rates: MileageRate[], implausibleMiles?: number): MileageEstimate {
  const periodMap = new Map<string, { label: string; ratePerMile: number; miles: number; dollars: number }>();
  let pricedMiles = 0;
  let unpricedMiles = 0;
  let totalDollars = 0;

  for (const s of shifts) {
    if (s.status !== 'completed') continue;
    const miles = countableBusinessMiles(s, implausibleMiles);
    if (miles <= 0) continue;
    const rate = effectiveRate(s.date, rates);
    if (!rate) {
      unpricedMiles += miles;
      continue;
    }
    pricedMiles += miles;
    const dollars = miles * rate.ratePerMile;
    totalDollars += dollars;
    const key = rate.id;
    const prev = periodMap.get(key) ?? { label: rate.label, ratePerMile: rate.ratePerMile, miles: 0, dollars: 0 };
    prev.miles += miles;
    prev.dollars += dollars;
    periodMap.set(key, prev);
  }

  const byPeriod = [...periodMap.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      ratePerMile: v.ratePerMile,
      miles: v.miles,
      estimateCents: Math.round(v.dollars * 100),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    estimateCents: Math.round(totalDollars * 100),
    pricedMiles,
    unpricedMiles,
    byPeriod,
  };
}

export interface TimeTotals {
  /** Sum of known shift hours. */
  knownHours: number;
  /** Completed shifts that are missing a start or end time. */
  shiftsMissingTime: number;
  completedShifts: number;
  /** Only true when every completed shift has a valid duration. */
  timeComplete: boolean;
}

export function timeTotals(shifts: Shift[]): TimeTotals {
  let knownHours = 0;
  let shiftsMissingTime = 0;
  let completedShifts = 0;
  for (const s of shifts) {
    if (s.status !== 'completed') continue;
    completedShifts += 1;
    const d = shiftDuration(s.startTime, s.endTime);
    if (d.known && d.hours !== null) knownHours += d.hours;
    else shiftsMissingTime += 1;
  }
  return {
    knownHours,
    shiftsMissingTime,
    completedShifts,
    timeComplete: completedShifts > 0 && shiftsMissingTime === 0,
  };
}

export interface WeekSummary {
  weekKey: WeekKey;
  monday: string;
  sunday: string;
  temporallyComplete: boolean;
  shiftCount: number;
  completedShiftCount: number;
  activeShiftCount: number;
  appEarningsCents: number;
  cashTipsCents: number;
  grossIncomeCents: number;
  businessMiles: number;
  mileage: MileageEstimate;
  expenses: ExpenseBuckets;
  /** gross income - ALL tracked expenses. A cash figure, not taxable profit. */
  netCashAfterExpensesCents: number;
  time: TimeTotals;
  /** null unless time data is complete enough to be meaningful. */
  grossPerHourCents: number | null;
  grossPerBusinessMileCents: number | null;
  receiptCount: number;
  unresolvedReceiptCount: number;
}

export function summariseWeek(
  weekKey: WeekKey,
  allShifts: Shift[],
  allExpenses: Expense[],
  allReceipts: Receipt[],
  rates: MileageRate[],
  implausibleMiles?: number,
  today: string = todayLocalDate(),
): WeekSummary {
  const { monday, sunday } = weekRange(weekKey);
  const shifts = allShifts.filter((s) => s.weekKey === weekKey || mondayOf(s.date) === weekKey);
  const expenses = allExpenses.filter((e) => mondayOf(e.date) === weekKey);
  const receipts = allReceipts.filter((r) => r.date !== null && mondayOf(r.date) === weekKey);

  const completed = shifts.filter((s) => s.status === 'completed');
  const active = shifts.filter((s) => s.status === 'active');

  const appEarningsCents = sumCents(completed.map((s) => s.appEarningsCents));
  const cashTipsCents = sumCents(completed.map((s) => s.cashTipsCents));
  const gross = grossIncomeCents(appEarningsCents, cashTipsCents);

  const businessMiles = completed.reduce((acc, s) => acc + countableBusinessMiles(s, implausibleMiles), 0);
  const mileage = estimateMileage(completed, rates, implausibleMiles);
  const buckets = bucketExpenses(expenses);
  const time = timeTotals(shifts);

  const grossPerHourCents =
    time.timeComplete && time.knownHours > 0 ? Math.round(gross / time.knownHours) : null;
  const grossPerBusinessMileCents = businessMiles > 0 ? Math.round(gross / businessMiles) : null;

  return {
    weekKey,
    monday,
    sunday,
    temporallyComplete: isWeekTemporallyComplete(weekKey, today),
    shiftCount: shifts.length,
    completedShiftCount: completed.length,
    activeShiftCount: active.length,
    appEarningsCents,
    cashTipsCents,
    grossIncomeCents: gross,
    businessMiles,
    mileage,
    expenses: buckets,
    netCashAfterExpensesCents: gross - buckets.totalCents,
    time,
    grossPerHourCents,
    grossPerBusinessMileCents,
    receiptCount: receipts.length,
    unresolvedReceiptCount: receipts.filter((r) => r.status === 'Inbox').length,
  };
}

export interface YearSummary {
  year: number;
  shiftCount: number;
  completedShiftCount: number;
  appEarningsCents: number;
  cashTipsCents: number;
  grossIncomeCents: number;
  businessMiles: number;
  mileage: MileageEstimate;
  expenses: ExpenseBuckets;
  reviewedWeeks: number;
  completedWeeks: number;
  receiptCount: number;
  linkedReceiptCount: number;
  unresolvedReceiptCount: number;
  unresolvedRecordCount: number;
}

export function summariseYear(
  year: number,
  allShifts: Shift[],
  allExpenses: Expense[],
  allReceipts: Receipt[],
  reviewedWeekKeys: Set<string>,
  rates: MileageRate[],
  implausibleMiles?: number,
  today: string = todayLocalDate(),
): YearSummary {
  const shifts = allShifts.filter((s) => yearOf(s.date) === year);
  const expenses = allExpenses.filter((e) => yearOf(e.date) === year);
  const receipts = allReceipts.filter((r) => r.date !== null && yearOf(r.date) === year);
  const completed = shifts.filter((s) => s.status === 'completed');

  const appEarningsCents = sumCents(completed.map((s) => s.appEarningsCents));
  const cashTipsCents = sumCents(completed.map((s) => s.cashTipsCents));
  const gross = grossIncomeCents(appEarningsCents, cashTipsCents);
  const businessMiles = completed.reduce((acc, s) => acc + countableBusinessMiles(s, implausibleMiles), 0);
  const mileage = estimateMileage(completed, rates, implausibleMiles);
  const buckets = bucketExpenses(expenses);

  // Weeks of this year that are temporally complete, and which of those are reviewed.
  const weekKeys = new Set<string>();
  for (const s of shifts) weekKeys.add(mondayOf(s.date));
  let completedWeeks = 0;
  let reviewedWeeks = 0;
  for (const wk of weekKeys) {
    if (isWeekTemporallyComplete(wk, today)) completedWeeks += 1;
    if (reviewedWeekKeys.has(wk)) reviewedWeeks += 1;
  }

  const activeCount = shifts.filter((s) => s.status === 'active').length;
  const reviewExpenseCount = expenses.filter(
    (e) => (e.taxClass || taxClassForCategory(e.category)) === 'REVIEW',
  ).length;
  const inboxReceiptCount = receipts.filter((r) => r.status === 'Inbox').length;
  const missingOdoCount = completed.filter((s) => computeMileage(s.startOdometer, s.endOdometer).status === 'missing').length;

  return {
    year,
    shiftCount: shifts.length,
    completedShiftCount: completed.length,
    appEarningsCents,
    cashTipsCents,
    grossIncomeCents: gross,
    businessMiles,
    mileage,
    expenses: buckets,
    reviewedWeeks,
    completedWeeks,
    receiptCount: receipts.length,
    linkedReceiptCount: receipts.filter((r) => r.expenseId !== null).length,
    unresolvedReceiptCount: inboxReceiptCount,
    unresolvedRecordCount: activeCount + reviewExpenseCount + inboxReceiptCount + missingOdoCount,
  };
}

export interface AnnualOdometerResult {
  hasData: boolean;
  annualVehicleMiles: number | null;
  status: 'ok' | 'missing' | 'reversed' | 'inconsistent';
  businessUsePercentage: number | null;
  message: string | null;
}

export function annualOdometerResult(
  startOdometer: number | null,
  endOdometer: number | null,
  businessMiles: number,
): AnnualOdometerResult {
  if (
    startOdometer === null ||
    endOdometer === null ||
    !Number.isFinite(startOdometer) ||
    !Number.isFinite(endOdometer)
  ) {
    return { hasData: false, annualVehicleMiles: null, status: 'missing', businessUsePercentage: null, message: null };
  }
  const annualVehicleMiles = endOdometer - startOdometer;
  if (annualVehicleMiles < 0) {
    return {
      hasData: true,
      annualVehicleMiles,
      status: 'reversed',
      businessUsePercentage: null,
      message: 'Annual ending odometer is below the beginning odometer. Check the readings.',
    };
  }
  if (annualVehicleMiles === 0) {
    return {
      hasData: true,
      annualVehicleMiles: 0,
      status: 'missing',
      businessUsePercentage: null,
      message: 'Annual odometer readings are equal — no vehicle miles to compare against.',
    };
  }
  if (businessMiles > annualVehicleMiles) {
    return {
      hasData: true,
      annualVehicleMiles,
      status: 'inconsistent',
      businessUsePercentage: null,
      message:
        'Recorded business miles exceed total annual vehicle miles. This data is inconsistent — no business-use percentage is shown.',
    };
  }
  return {
    hasData: true,
    annualVehicleMiles,
    status: 'ok',
    businessUsePercentage: (businessMiles / annualVehicleMiles) * 100,
    message: null,
  };
}

export interface ActualExpensePlanning {
  available: boolean;
  businessUsePercentage: number | null;
  vehicleActualCents: number;
  allocatedVehicleExpensesCents: number | null;
  parkingCents: number;
  tollsCents: number;
}

/** Organisational planning aid only — not tax advice. */
export function actualExpensePlanning(
  buckets: ExpenseBuckets,
  odo: AnnualOdometerResult,
): ActualExpensePlanning {
  const pct = odo.status === 'ok' ? odo.businessUsePercentage : null;
  return {
    available: pct !== null,
    businessUsePercentage: pct,
    vehicleActualCents: buckets.vehicleActualCents,
    allocatedVehicleExpensesCents: pct !== null ? Math.round((buckets.vehicleActualCents * pct) / 100) : null,
    parkingCents: buckets.parkingCents,
    tollsCents: buckets.tollsCents,
  };
}

export interface StatementReconciliation {
  hasStatement: boolean;
  statementTotalCents: number | null;
  recordedAppEarningsCents: number;
  cashTipsCents: number;
  totalLedgerGrossCents: number;
  statementDeltaCents: number | null;
}

export function reconcileStatement(
  statementTotalCents: number | null,
  recordedAppEarningsCents: number,
  cashTipsCents: number,
): StatementReconciliation {
  return {
    hasStatement: statementTotalCents !== null,
    statementTotalCents,
    recordedAppEarningsCents,
    cashTipsCents,
    totalLedgerGrossCents: recordedAppEarningsCents + cashTipsCents,
    statementDeltaCents: statementTotalCents !== null ? statementTotalCents - recordedAppEarningsCents : null,
  };
}
