import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { LedgerSnapshot } from '../db/repositories';
import { buildGptSyncSnapshot } from '../services/gptBridge';

function snapshot(): LedgerSnapshot {
  return {
    vehicles: [
      {
        id: 'v1',
        label: 'Truck',
        archived: false,
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z',
      },
    ],
    shifts: [
      {
        id: 's1',
        status: 'completed',
        date: '2026-10-01',
        weekKey: '2026-09-28',
        vehicleId: 'v1',
        vehicleLabel: 'Truck',
        startTime: '10:00',
        endTime: '12:00',
        startOdometer: 100,
        endOdometer: 125,
        appEarningsCents: 4_000,
        cashTipsCents: 500,
        purpose: 'DoorDash delivery work',
        notes: 'PRIVATE SHIFT NOTE',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
    ],
    expenses: [
      {
        id: 'e1',
        date: '2026-10-01',
        amountCents: 2_000,
        merchant: 'PRIVATE MERCHANT',
        category: 'Fuel',
        taxClass: 'VEHICLE_ACTUAL',
        notes: 'PRIVATE EXPENSE NOTE',
        shiftId: 's1',
        receiptId: 'r1',
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
    ],
    receipts: [
      {
        id: 'r1',
        capturedAt: '2026-10-01T12:00:00Z',
        date: '2026-10-01',
        merchant: 'PRIVATE RECEIPT MERCHANT',
        amountCents: 2_000,
        category: 'Fuel',
        taxClass: 'VEHICLE_ACTUAL',
        notes: 'PRIVATE RECEIPT NOTE',
        status: 'Classified',
        expenseId: 'e1',
        originalFilename: 'receipt.jpg',
        mimeType: 'image/jpeg',
        byteCount: 99_999,
        imageProcessingError: null,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
    ],
    weeklyClosures: [],
    mileageRates: [
      {
        id: 'rate-1',
        startDate: '2026-01-01',
        endDate: null,
        ratePerMile: 0.725,
        label: 'test',
        source: 'test',
        seeded: true,
      },
    ],
    merchantMemory: [],
    settings: {
      theme: 'system',
      backupOverdueDays: 14,
      defaultVehicleId: 'v1',
      defaultPurpose: 'DoorDash delivery work',
      implausibleMiles: 400,
      annualOdometers: [],
      statementTotals: [],
    },
    meta: {
      schemaVersion: 1,
      appVersion: '1.0.0',
      lastRecordChangeAt: '2026-10-01T12:00:00Z',
      lastBackupGeneratedAt: null,
      lastArchiveConfirmedAt: null,
      restoredAt: null,
      persistRequestedAt: null,
      lastImportAt: null,
    },
    activeShift: undefined,
    today: '2026-10-01',
  };
}

describe('GPT sync privacy boundary', () => {
  it('builds a deterministic mirror without notes, merchants, receipts, or image metadata', async () => {
    const payload = await buildGptSyncSnapshot(snapshot(), 'device-1');
    const text = JSON.stringify(payload);

    expect(payload.format).toBe('dash-ledger-gpt-sync-v1');
    expect(payload.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(text).not.toContain('PRIVATE SHIFT NOTE');
    expect(text).not.toContain('PRIVATE MERCHANT');
    expect(text).not.toContain('PRIVATE EXPENSE NOTE');
    expect(text).not.toContain('PRIVATE RECEIPT');
    expect(text).not.toContain('receipt.jpg');
    expect(text).not.toContain('byteCount');
    expect(text).not.toContain('receipts');
  });
});
