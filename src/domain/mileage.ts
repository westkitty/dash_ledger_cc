/**
 * Odometer / business-mileage rules.
 *
 * Business mileage for a completed shift = ending odometer - starting odometer.
 * We never fabricate, clamp, zero-out or auto-swap odometer readings.
 */

import type { Shift, LocalDate } from './types';
import { compareLocalDate } from './dates';

export const DEFAULT_IMPLAUSIBLE_MILES = 400;

export type MileageStatus = 'ok' | 'missing' | 'reversed' | 'suspicious';

export interface MileageResult {
  status: MileageStatus;
  /** Calculated business miles, or null when a reading is missing. Preserved even when suspicious. */
  miles: number | null;
  message: string | null;
}

export function computeMileage(
  startOdometer: number | null | undefined,
  endOdometer: number | null | undefined,
  implausibleMiles: number = DEFAULT_IMPLAUSIBLE_MILES,
): MileageResult {
  const hasStart = typeof startOdometer === 'number' && Number.isFinite(startOdometer);
  const hasEnd = typeof endOdometer === 'number' && Number.isFinite(endOdometer);
  if (!hasStart || !hasEnd) {
    return { status: 'missing', miles: null, message: 'Odometer reading missing.' };
  }
  const miles = (endOdometer as number) - (startOdometer as number);
  if (miles < 0) {
    return {
      status: 'reversed',
      miles,
      message: 'Ending odometer is lower than the starting odometer. Fix the readings before completing this dash.',
    };
  }
  if (miles > implausibleMiles) {
    return {
      status: 'suspicious',
      miles,
      message: `${miles.toLocaleString('en-US')} miles on one dash is above your ${implausibleMiles}-mile check. The value is kept as entered — please verify it.`,
    };
  }
  return { status: 'ok', miles, message: null };
}

/** Business miles that should count for aggregation: positive, non-reversed only. */
export function countableBusinessMiles(shift: Pick<Shift, 'startOdometer' | 'endOdometer'>, implausibleMiles?: number): number {
  const r = computeMileage(shift.startOdometer, shift.endOdometer, implausibleMiles);
  if (r.miles === null) return 0;
  if (r.status === 'reversed') return 0;
  return r.miles > 0 ? r.miles : 0;
}

/**
 * Per-vehicle odometer continuity. Finds the most recent valid completed ending
 * odometer for `vehicleId` strictly before `beforeDate` (or on the same date but
 * excluding `excludeShiftId`). Used only as a prefill suggestion.
 */
export function suggestStartOdometer(
  shifts: Shift[],
  vehicleId: string,
  beforeDate: LocalDate,
  excludeShiftId?: string,
): number | null {
  const candidates = shifts
    .filter(
      (s) =>
        s.vehicleId === vehicleId &&
        s.status === 'completed' &&
        s.id !== excludeShiftId &&
        typeof s.endOdometer === 'number' &&
        Number.isFinite(s.endOdometer) &&
        typeof s.startOdometer === 'number' &&
        (s.endOdometer as number) >= (s.startOdometer as number) &&
        compareLocalDate(s.date, beforeDate) <= 0,
    )
    .sort((a, b) => {
      const d = compareLocalDate(a.date, b.date);
      if (d !== 0) return d;
      return (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0);
    });
  const last = candidates[candidates.length - 1];
  return last ? (last.endOdometer as number) : null;
}

export interface ContinuityResult {
  /** true when there is a prior reading to compare against. */
  hasPrior: boolean;
  priorEndOdometer: number | null;
  /** gap = thisStart - priorEnd; positive means unrecorded intervening miles. */
  gap: number | null;
  hasGap: boolean;
}

export function checkContinuity(
  shifts: Shift[],
  vehicleId: string,
  thisDate: LocalDate,
  thisStartOdometer: number | null | undefined,
  excludeShiftId?: string,
): ContinuityResult {
  const prior = suggestStartOdometer(shifts, vehicleId, thisDate, excludeShiftId);
  if (prior === null || typeof thisStartOdometer !== 'number' || !Number.isFinite(thisStartOdometer)) {
    return { hasPrior: prior !== null, priorEndOdometer: prior, gap: null, hasGap: false };
  }
  const gap = thisStartOdometer - prior;
  return {
    hasPrior: true,
    priorEndOdometer: prior,
    gap,
    // Any non-zero difference is a continuity note. Those miles are NOT business miles.
    hasGap: gap !== 0,
  };
}
