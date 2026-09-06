/**
 * Local calendar date logic.
 *
 * A "work date" is a local calendar day, never a UTC instant. We deliberately
 * avoid `new Date("YYYY-MM-DD")` for calendar math because that parses as UTC
 * midnight and can shift the day in negative-offset timezones.
 */

import type { LocalDate, WeekKey } from './types';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  // Round-trip through a local Date to reject impossible dates (e.g. 2026-02-30).
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** Parse a local-date string into its numeric parts without timezone interpretation. */
export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(value);
  if (!m) throw new Error(`Invalid local date: ${value}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Build a local `Date` at midnight for the given local-date string. */
export function localDateToDate(value: LocalDate): Date {
  const { year, month, day } = parseLocalDate(value);
  return new Date(year, month - 1, day);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a `Date` as a local-date string using its local components. */
export function dateToLocalDate(dt: Date): LocalDate {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function todayLocalDate(now: Date = new Date()): LocalDate {
  return dateToLocalDate(now);
}

/** Current local wall-clock time as HH:mm. */
export function nowLocalTime(now: Date = new Date()): string {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

export function addDays(value: LocalDate, days: number): LocalDate {
  const dt = localDateToDate(value);
  dt.setDate(dt.getDate() + days);
  return dateToLocalDate(dt);
}

export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  // Lexicographic comparison is correct for zero-padded YYYY-MM-DD.
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Day of week for a local date. 1 = Monday ... 7 = Sunday (ISO numbering).
 */
export function isoWeekday(value: LocalDate): number {
  const js = localDateToDate(value).getDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

/**
 * The canonical week key for a local date: the LocalDate of that week's Monday.
 * Weeks run Monday through Sunday.
 */
export function mondayOf(value: LocalDate): WeekKey {
  const offset = isoWeekday(value) - 1; // days since Monday
  return addDays(value, -offset);
}

export function sundayOf(value: LocalDate): LocalDate {
  return addDays(mondayOf(value), 6);
}

export interface WeekRange {
  weekKey: WeekKey;
  monday: LocalDate;
  sunday: LocalDate;
}

export function weekRange(value: LocalDate): WeekRange {
  const monday = mondayOf(value);
  return { weekKey: monday, monday, sunday: addDays(monday, 6) };
}

export function nextWeekKey(weekKey: WeekKey): WeekKey {
  return addDays(weekKey, 7);
}

export function prevWeekKey(weekKey: WeekKey): WeekKey {
  return addDays(weekKey, -7);
}

/**
 * A week is temporally complete only once its Sunday has fully passed in the
 * user's local calendar (i.e. "today" is at least the following Monday).
 */
export function isWeekTemporallyComplete(weekKey: WeekKey, today: LocalDate = todayLocalDate()): boolean {
  const endExclusive = addDays(weekKey, 7);
  return compareLocalDate(today, endExclusive) >= 0;
}

export function isDateInWeek(value: LocalDate, weekKey: WeekKey): boolean {
  return mondayOf(value) === weekKey;
}

export function yearOf(value: LocalDate): number {
  return parseLocalDate(value).year;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Human label like "Mon Jan 5, 2026". */
export function formatLocalDate(value: LocalDate): string {
  if (!isValidLocalDate(value)) return value;
  const dt = localDateToDate(value);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
  const { year, month, day } = parseLocalDate(value);
  return `${wd} ${MONTHS[month - 1]} ${day}, ${year}`;
}

/** Short label like "Jan 5 – Jan 11, 2026" for a week. */
export function formatWeekRange(weekKey: WeekKey): string {
  const { monday, sunday } = weekRange(weekKey);
  const m = parseLocalDate(monday);
  const s = parseLocalDate(sunday);
  const left = `${MONTHS[m.month - 1]} ${m.day}`;
  const right =
    m.month === s.month
      ? `${s.day}`
      : `${MONTHS[s.month - 1]} ${s.day}`;
  const yr = m.year === s.year ? `${s.year}` : `${m.year}/${s.year}`;
  return `${left} – ${right}, ${yr}`;
}
