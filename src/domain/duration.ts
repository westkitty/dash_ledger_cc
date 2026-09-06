/**
 * Shift duration from local HH:mm wall-clock times.
 *
 * If the end time is earlier than the start time, the shift crossed midnight and
 * the end is treated as the following day. The recorded business date does NOT
 * move because of this.
 */

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function isValidLocalTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = TIME_RE.exec(value.trim());
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

export function timeToMinutes(value: string): number | null {
  if (!isValidLocalTime(value)) return null;
  const m = TIME_RE.exec(value.trim())!;
  return Number(m[1]) * 60 + Number(m[2]);
}

export interface DurationResult {
  /** true when both times are present and valid. */
  known: boolean;
  minutes: number | null;
  hours: number | null;
  /** true when the end wrapped past midnight. */
  crossedMidnight: boolean;
}

export function shiftDuration(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): DurationResult {
  const start = startTime ? timeToMinutes(startTime) : null;
  const end = endTime ? timeToMinutes(endTime) : null;
  if (start === null || end === null) {
    return { known: false, minutes: null, hours: null, crossedMidnight: false };
  }
  let diff = end - start;
  let crossedMidnight = false;
  if (diff < 0) {
    diff += 24 * 60;
    crossedMidnight = true;
  }
  return {
    known: true,
    minutes: diff,
    hours: diff / 60,
    crossedMidnight,
  };
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 60) return `${h + 1}h 0m`;
  return `${h}h ${m}m`;
}
