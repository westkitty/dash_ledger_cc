import { describe, expect, it } from 'vitest';
import { GptSyncSnapshotSchema } from '../src/schemas';

const base = {
  format: 'dash-ledger-gpt-sync-v1' as const,
  formatVersion: 1 as const,
  schemaVersion: 1,
  generatedAt: '2026-10-01T12:00:00.000Z',
  deviceId: 'device-1',
  snapshotHash: 'a'.repeat(64),
  settings: { implausibleMiles: 400 },
  vehicles: [],
  shifts: [],
  expenses: [],
  mileageRates: [],
};

describe('sync contract', () => {
  it('accepts the minimal canonical mirror envelope', () => {
    expect(GptSyncSnapshotSchema.parse(base)).toEqual(base);
  });

  it('rejects receipt and image material outside the contract', () => {
    expect(() =>
      GptSyncSnapshotSchema.parse({
        ...base,
        receipts: [{ id: 'nope', image: 'data:image/png;base64,nope' }],
      }),
    ).toThrow();
  });

  it('rejects non-integer money', () => {
    expect(() =>
      GptSyncSnapshotSchema.parse({
        ...base,
        expenses: [
          {
            id: 'e1',
            date: '2026-10-01',
            amountCents: 12.34,
            category: 'fuel',
            taxClass: 'VEHICLE_ACTUAL',
            shiftId: null,
            createdAt: '2026-10-01T12:00:00Z',
            updatedAt: '2026-10-01T12:00:00Z',
          },
        ],
      }),
    ).toThrow();
  });
});
