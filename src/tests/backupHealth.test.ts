import { describe, it, expect } from 'vitest';
import { backupHealth } from '../domain/backupHealth';

const now = new Date('2026-02-01T12:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

describe('backup / archive health', () => {
  it('no records -> Safe', () => {
    expect(
      backupHealth({ hasRecords: false, lastRecordChangeAt: null, lastArchiveConfirmedAt: null, overdueDays: 14, now }).status,
    ).toBe('safe');
  });

  it('records but no archive ever -> Due', () => {
    expect(
      backupHealth({ hasRecords: true, lastRecordChangeAt: daysAgo(1), lastArchiveConfirmedAt: null, overdueDays: 14, now }).status,
    ).toBe('due');
  });

  it('newer records since a recent archive -> Due', () => {
    expect(
      backupHealth({
        hasRecords: true,
        lastRecordChangeAt: daysAgo(1),
        lastArchiveConfirmedAt: daysAgo(3),
        overdueDays: 14,
        now,
      }).status,
    ).toBe('due');
  });

  it('newer records and a stale archive past the threshold -> Overdue', () => {
    expect(
      backupHealth({
        hasRecords: true,
        lastRecordChangeAt: daysAgo(2),
        lastArchiveConfirmedAt: daysAgo(30),
        overdueDays: 14,
        now,
      }).status,
    ).toBe('overdue');
  });

  it('no records changed since the confirmed archive -> Safe', () => {
    expect(
      backupHealth({
        hasRecords: true,
        lastRecordChangeAt: daysAgo(10),
        lastArchiveConfirmedAt: daysAgo(3),
        overdueDays: 14,
        now,
      }).status,
    ).toBe('safe');
  });
});
