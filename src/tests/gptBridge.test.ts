import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDB } from '../db/db';
import {
  createVehicle,
  logCompletedShift,
  loadSnapshot,
} from '../db/repositories';
import { todayLocalDate } from '../domain/dates';
import type { LedgerSnapshot } from '../db/repositories';
import {
  applyGptProposal,
  buildGptSyncSnapshot,
  type GptProposal,
} from '../services/gptBridge';

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

async function clearCanonical(): Promise<void> {
  const db = getDB();
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.vehicles.clear(),
    db.shifts.clear(),
    db.expenses.clear(),
    db.receipts.clear(),
    db.receiptBlobs.clear(),
    db.weeklyClosures.clear(),
    db.mileageRates.clear(),
    db.merchantMemory.clear(),
    db.kv.clear(),
  ]);
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

describe('GPT proposal accept paths', () => {
  beforeEach(async () => {
    await clearCanonical();
    // Seed bridge config so applyGptProposal can resolve remotely (mocked).
    const { default: Dexie } = await import('dexie');
    // Use the same bridge DB name as the service.
    const bridge = new Dexie('dash-ledger-gpt-bridge-v1');
    bridge.version(1).stores({
      config: 'key',
      appliedProposals: 'proposalId, appliedAt',
    });
    await bridge.open();
    await (bridge as any).table('config').put({
      key: 'config',
      endpoint: 'https://example.test',
      userId: 'andrew-test',
      displayLabel: 'Andrew Test',
      deviceId: 'device-test',
      deviceToken: 'token-test',
      connectedAt: new Date().toISOString(),
      lastSyncAt: null,
    });
    await bridge.close();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts an expense proposal through createExpense', async () => {
    const proposal: GptProposal = {
      id: 'prop-expense-1',
      kind: 'expense',
      status: 'pending',
      createdAt: new Date().toISOString(),
      payload: {
        clientRequestId: 'req-1',
        date: todayLocalDate(),
        amountCents: 1482,
        category: 'Fuel',
        taxClass: 'VEHICLE_ACTUAL',
        merchant: 'Synthetic Fuel',
      },
    };

    const result = await applyGptProposal(proposal);
    expect(result).toBe('applied');

    const expenses = await getDB().expenses.toArray();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].amountCents).toBe(1482);
    expect(expenses[0].category).toBe('Fuel');
    expect(expenses[0].taxClass).toBe('VEHICLE_ACTUAL');

    const again = await applyGptProposal(proposal);
    expect(again).toBe('already-applied');
    expect(await getDB().expenses.count()).toBe(1);
  });

  it('accepts a shift_update proposal through updateShift', async () => {
    const vehicle = await createVehicle('Synthetic Car');
    const shift = await logCompletedShift({
      vehicleId: vehicle.id,
      vehicleLabel: vehicle.label,
      date: todayLocalDate(),
      startTime: '09:00',
      endTime: '12:00',
      startOdometer: 1000,
      endOdometer: 1050,
      appEarningsCents: 3000,
      cashTipsCents: 0,
      purpose: 'DoorDash delivery work',
      notes: '',
    });

    const proposal: GptProposal = {
      id: 'prop-shift-1',
      kind: 'shift_update',
      status: 'pending',
      createdAt: new Date().toISOString(),
      payload: {
        clientRequestId: 'req-2',
        shiftId: shift.id,
        patch: { cashTipsCents: 250 },
      },
    };

    const result = await applyGptProposal(proposal);
    expect(result).toBe('applied');

    const snap = await loadSnapshot();
    const updated = snap.shifts.find((s) => s.id === shift.id);
    expect(updated?.cashTipsCents).toBe(250);
  });
});
