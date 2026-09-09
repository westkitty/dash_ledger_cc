import { describe, it, expect } from 'vitest';
import { shiftDuration, isValidLocalTime, timeToMinutes, elapsedSince } from '../domain/duration';

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

describe('elapsedSince (active-dash elapsed, day-boundary safe)', () => {
  it('same-day elapsed matches wall-clock difference', () => {
    const now = new Date('2026-03-04T12:30:00'); // local
    const r = elapsedSince('2026-03-04', '09:00', now);
    expect(r.known).toBe(true);
    expect(r.hours).toBeCloseTo(3.5, 5);
  });

  it('a dash left open across a day boundary reports true elapsed, not a wrapped small number', () => {
    const now = new Date('2026-03-05T11:00:00'); // ~26h after a 09:00 start the prior day
    const r = elapsedSince('2026-03-04', '09:00', now);
    expect(r.known).toBe(true);
    expect(r.hours).toBeCloseTo(26, 1);
    // shiftDuration would have wrapped this to ~2h — the bug this replaces.
    expect(shiftDuration('09:00', '11:00').hours).toBe(2);
  });

  it('missing start time or clock skew -> not known, never a fabricated number', () => {
    expect(elapsedSince('2026-03-04', null).known).toBe(false);
    expect(elapsedSince('2026-03-04', 'bad').known).toBe(false);
    expect(elapsedSince('not-a-date', '09:00').known).toBe(false);
    const past = elapsedSince('2026-03-04', '09:00', new Date('2026-03-04T08:00:00'));
    expect(past.known).toBe(false);
  });
});
