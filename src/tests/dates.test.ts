import { describe, it, expect } from 'vitest';
import {
  mondayOf,
  sundayOf,
  isWeekTemporallyComplete,
  isValidLocalDate,
  dateToLocalDate,
  localDateToDate,
  addDays,
  yearOf,
  isoWeekday,
} from '../domain/dates';

describe('week keys (Monday–Sunday)', () => {
  it('Monday maps to itself', () => {
    expect(mondayOf('2026-01-05')).toBe('2026-01-05');
  });

  it('Sunday maps to the prior Monday', () => {
    expect(mondayOf('2026-01-04')).toBe('2025-12-29');
  });

  it('Sunday and the next Monday are different weeks', () => {
    expect(mondayOf('2026-01-04')).not.toBe(mondayOf('2026-01-05'));
  });

  it('every weekday of one week resolves to the same Monday', () => {
    const days = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08'];
    for (const d of days) expect(mondayOf(d)).toBe('2026-03-02');
  });

  it('sundayOf is Monday + 6', () => {
    expect(sundayOf('2026-01-05')).toBe('2026-01-11');
  });

  it('isoWeekday: 1 = Monday, 7 = Sunday', () => {
    expect(isoWeekday('2026-01-05')).toBe(1);
    expect(isoWeekday('2026-01-04')).toBe(7);
  });
});

describe('temporal completeness', () => {
  it('a week is not complete before its Sunday passes', () => {
    expect(isWeekTemporallyComplete('2026-01-05', '2026-01-07')).toBe(false);
    expect(isWeekTemporallyComplete('2026-01-05', '2026-01-11')).toBe(false);
  });
  it('a week is complete once the following Monday arrives', () => {
    expect(isWeekTemporallyComplete('2026-01-05', '2026-01-12')).toBe(true);
  });
});

describe('local date parsing survives round-trips', () => {
  it('formats back to the same string it parsed', () => {
    for (const d of ['2024-02-29', '2025-12-31', '2026-01-01', '2026-07-01']) {
      expect(dateToLocalDate(localDateToDate(d))).toBe(d);
    }
  });

  it('does not UTC-shift the day', () => {
    // localDateToDate uses the local Date constructor, so the calendar day is stable
    // regardless of the runner's timezone.
    const d = localDateToDate('2026-03-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
  });

  it('handles the leap day and rejects an impossible one', () => {
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('not-a-date')).toBe(false);
  });

  it('crosses the year boundary correctly', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(mondayOf('2026-01-01')).toBe('2025-12-29');
    expect(yearOf('2025-12-29')).toBe(2025);
  });
});
