/**
 * Phase 9 — local dates must not drift with the device timezone.
 *
 * The domain treats work dates as timezone-free `YYYY-MM-DD` strings. This suite
 * pins the guarantee: the same inputs produce the same week keys, year buckets
 * and today-date under +14 (Kiritimati), UTC and -11 (Midway). Vitest runs each
 * file in the process TZ; this file forces the three explicitly via a saved
 * `process.env.TZ` swap so the check travels with the repo.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mondayOf, yearOf, todayLocalDate, isoToLocalDate, addDays } from '../domain/dates';

const ORIGINAL_TZ = process.env.TZ;

function withTz(tz: string, fn: () => void) {
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    process.env.TZ = ORIGINAL_TZ;
  }
}

// Node reads process.env.TZ lazily per Date construction, so a swap mid-test
// affects subsequent `new Date(...)` calls.
const ZONES = ['Pacific/Kiritimati', 'UTC', 'Pacific/Midway'];

describe('local dates are timezone-free', () => {
  beforeAll(() => {
    /* noop — kept for symmetry */
  });
  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it('mondayOf and yearOf are identical across zones', () => {
    const results = ZONES.map((tz) => {
      let out: { monday: string; year: number; added: string } = { monday: '', year: 0, added: '' };
      withTz(tz, () => {
        out = {
          monday: mondayOf('2026-01-04'), // a Sunday -> prior Monday
          year: yearOf('2026-01-04'),
          added: addDays('2026-12-31', 1),
        };
      });
      return out;
    });
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[0].monday).toBe('2025-12-29');
    expect(results[0].added).toBe('2027-01-01');
  });

  it('isoToLocalDate reflects the device local day, not the UTC slice', () => {
    // 2026-01-01T06:00:00Z is 2026-01-01 20:00 in Kiritimati (+14) and
    // 2025-12-31 19:00 in Midway (-11).
    let kiritimati = '';
    let midway = '';
    withTz('Pacific/Kiritimati', () => {
      kiritimati = isoToLocalDate('2026-01-01T06:00:00.000Z');
    });
    withTz('Pacific/Midway', () => {
      midway = isoToLocalDate('2026-01-01T06:00:00.000Z');
    });
    expect(kiritimati).toBe('2026-01-01');
    expect(midway).toBe('2025-12-31');
    // A plain slice would wrongly give 2026-01-01 in both.
  });

  it('todayLocalDate uses local components', () => {
    const fixed = new Date('2026-06-15T02:00:00.000Z');
    let k = '';
    let m = '';
    withTz('Pacific/Kiritimati', () => {
      k = todayLocalDate(fixed);
    });
    withTz('Pacific/Midway', () => {
      m = todayLocalDate(fixed);
    });
    expect(k).toBe('2026-06-15'); // +14 -> 16:00 same day
    expect(m).toBe('2026-06-14'); // -11 -> 15:00 previous day
  });
});
