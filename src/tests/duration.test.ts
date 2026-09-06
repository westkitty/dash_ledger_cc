import { describe, it, expect } from 'vitest';
import { shiftDuration, isValidLocalTime, timeToMinutes } from '../domain/duration';

describe('shift duration', () => {
  it('ordinary same-day duration', () => {
    const d = shiftDuration('09:00', '17:30');
    expect(d.known).toBe(true);
    expect(d.hours).toBe(8.5);
    expect(d.crossedMidnight).toBe(false);
  });

  it('overnight 23:30 -> 01:00 = 1.5 hours, flagged as crossing midnight', () => {
    const d = shiftDuration('23:30', '01:00');
    expect(d.hours).toBe(1.5);
    expect(d.crossedMidnight).toBe(true);
  });

  it('missing a time returns unknown, never a fabricated number', () => {
    expect(shiftDuration('09:00', null).known).toBe(false);
    expect(shiftDuration(null, '17:00').minutes).toBeNull();
    expect(shiftDuration(undefined, undefined).hours).toBeNull();
  });

  it('rejects malformed times', () => {
    expect(isValidLocalTime('25:00')).toBe(false);
    expect(isValidLocalTime('9:60')).toBe(false);
    expect(timeToMinutes('bad')).toBeNull();
    expect(shiftDuration('bad', '10:00').known).toBe(false);
  });

  it('equal times = zero duration', () => {
    expect(shiftDuration('12:00', '12:00').hours).toBe(0);
  });
});
