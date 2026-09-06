/**
 * Effective-dated standard business mileage rate system.
 *
 * The seeded table below is REFERENCE / ESTIMATE data — dollars per mile — not a
 * statement that any user is eligible to claim these rates. Users may add
 * future or custom effective-dated periods; the app never fetches rates online.
 */

import type { MileageRate, LocalDate } from './types';
import { compareLocalDate, isValidLocalDate } from './dates';

interface SeedRow {
  start: LocalDate;
  end: LocalDate;
  rate: number;
}

const SEED_ROWS: SeedRow[] = [
  { start: '2011-01-01', end: '2011-06-30', rate: 0.51 },
  { start: '2011-07-01', end: '2011-12-31', rate: 0.555 },
  { start: '2012-01-01', end: '2012-12-31', rate: 0.555 },
  { start: '2013-01-01', end: '2013-12-31', rate: 0.565 },
  { start: '2014-01-01', end: '2014-12-31', rate: 0.56 },
  { start: '2015-01-01', end: '2015-12-31', rate: 0.575 },
  { start: '2016-01-01', end: '2016-12-31', rate: 0.54 },
  { start: '2017-01-01', end: '2017-12-31', rate: 0.535 },
  { start: '2018-01-01', end: '2018-12-31', rate: 0.545 },
  { start: '2019-01-01', end: '2019-12-31', rate: 0.58 },
  { start: '2020-01-01', end: '2020-12-31', rate: 0.575 },
  { start: '2021-01-01', end: '2021-12-31', rate: 0.56 },
  { start: '2022-01-01', end: '2022-06-30', rate: 0.585 },
  { start: '2022-07-01', end: '2022-12-31', rate: 0.625 },
  { start: '2023-01-01', end: '2023-12-31', rate: 0.655 },
  { start: '2024-01-01', end: '2024-12-31', rate: 0.67 },
  { start: '2025-01-01', end: '2025-12-31', rate: 0.7 },
  { start: '2026-01-01', end: '2026-06-30', rate: 0.725 },
  { start: '2026-07-01', end: '2026-12-31', rate: 0.76 },
];

export function seededMileageRates(): MileageRate[] {
  return SEED_ROWS.map((row) => ({
    id: `seed-${row.start}`,
    startDate: row.start,
    endDate: row.end,
    ratePerMile: row.rate,
    label: `IRS standard business rate ${row.start.slice(0, 4)}`,
    source: 'Seeded reference data',
    seeded: true,
  }));
}

/**
 * Resolve the effective rate for a shift date.
 *  1. Consider entries whose [startDate, endDate] range contains the date
 *     (endDate null = open-ended).
 *  2. Prefer the eligible entry with the latest effective start date.
 *  3. On equal start dates, a user override (seeded === false) wins.
 *  4. No eligible entry -> null (caller counts the miles as unpriced).
 */
export function effectiveRate(dateStr: LocalDate, rates: MileageRate[]): MileageRate | null {
  if (!isValidLocalDate(dateStr)) return null;
  const eligible = rates.filter((r) => {
    if (compareLocalDate(dateStr, r.startDate) < 0) return false;
    if (r.endDate !== null && compareLocalDate(dateStr, r.endDate) > 0) return false;
    return true;
  });
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const byStart = compareLocalDate(a.startDate, b.startDate);
    if (byStart !== 0) return byStart;
    // same start date: user override beats seed
    if (a.seeded !== b.seeded) return a.seeded ? -1 : 1;
    return 0;
  });
  return eligible[eligible.length - 1];
}

export function rateForDate(dateStr: LocalDate, rates: MileageRate[]): number | null {
  const r = effectiveRate(dateStr, rates);
  return r ? r.ratePerMile : null;
}

/** Validate a user-entered rate period before saving. */
export function validateRatePeriod(input: {
  startDate: string;
  endDate: string | null;
  ratePerMile: number;
}): string[] {
  const errors: string[] = [];
  if (!isValidLocalDate(input.startDate)) errors.push('Start date must be a valid YYYY-MM-DD date.');
  if (input.endDate !== null && input.endDate !== '' && !isValidLocalDate(input.endDate)) {
    errors.push('End date must be a valid YYYY-MM-DD date or left open.');
  }
  if (
    isValidLocalDate(input.startDate) &&
    input.endDate &&
    isValidLocalDate(input.endDate) &&
    compareLocalDate(input.endDate, input.startDate) < 0
  ) {
    errors.push('End date cannot be before the start date.');
  }
  if (!Number.isFinite(input.ratePerMile) || input.ratePerMile <= 0) {
    errors.push('Rate per mile must be a positive number of dollars, e.g. 0.700.');
  }
  if (input.ratePerMile > 10) errors.push('Rate per mile looks too large — enter dollars per mile, e.g. 0.700.');
  return errors;
}

export function formatRate(rate: number): string {
  return `$${rate.toFixed(3)}/mi`;
}
