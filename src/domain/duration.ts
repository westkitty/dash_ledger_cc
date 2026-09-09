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

/**
 * Real elapsed hours since a shift's local start (`date` + `startTime`) up to
 * `now`. Unlike `shiftDuration`, this does NOT assume the span is under 24h — an
 * active dash left open across a day boundary reports its true elapsed time, not
 * a wrapped small number. Returns `{ known: false }` when the start is missing
 * or is in the future (clock skew).
 */
export function elapsedSince(
  date: string,
  startTime: string | null | undefined,
  now: Date = new Date(),
): { known: boolean; hours: number } {
  const mins = startTime ? timeToMinutes(startTime) : null;
  if (mins === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { known: false, hours: 0 };
  // `${date}T00:00:00` (no offset) parses as LOCAL time per ES2015+.
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return { known: false, hours: 0 };
  start.setHours(0, mins, 0, 0);
  const ms = now.getTime() - start.getTime();
  if (ms < 0) return { known: false, hours: 0 };
  return { known: true, hours: ms / 3_600_000 };
}
