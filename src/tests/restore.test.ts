import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { getDB } from '../db/db';
import { restoreBackup } from '../services/restore';
import { buildLedgerOnlyBackup, LEDGER_ONLY_FORMAT, type BackupSource } from '../services/backup';
import { makeExportedAcknowledgement } from '../services/safetyGate';
import { seededMileageRates } from '../domain/mileageRates';
import { DEFAULT_SETTINGS } from '../domain/types';
import { makeShift, makeExpense, makeVehicle } from './factories';

function source(over: Partial<BackupSource> = {}): BackupSource {
  return {
    settings: { ...DEFAULT_SETTINGS, defaultPurpose: 'restored purpose' },
    meta: {
      schemaVersion: 1,
      appVersion: 'test',
      lastRecordChangeAt: '2026-01-05T00:00:00.000Z',
      lastBackupGeneratedAt: null,
      lastArchiveConfirmedAt: null,
      restoredAt: null,
      persistRequestedAt: null,
      lastImportAt: null,
    },
    vehicles: [makeVehicle({ id: 'veh-restored', label: 'Restored Car' })],
    shifts: [makeShift({ id: 'shift-restored', vehicleId: 'veh-restored' })],
    expenses: [makeExpense({ id: 'exp-restored', shiftId: 'shift-restored', receiptId: null })],
    weeklyClosures: [],
    receipts: [],
    mileageRates: seededMileageRates(),
    merchantMemory: [],
    ...over,
  };
}

/** The ledger seeded below is non-empty, so every restore needs a real safety backup. */
const SAFETY = () => makeExportedAcknowledgement('safety-backup.json', 2048, LEDGER_ONLY_FORMAT);

describe('atomic restore', () => {
  beforeEach(async () => {
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
    // Seed a "current" database that a restore must fully replace.
    await db.vehicles.put(makeVehicle({ id: 'veh-old', label: 'Old Car' }));
    await db.shifts.put(makeShift({ id: 'shift-old', vehicleId: 'veh-old' }));
  });

  it('replaces all data when the backup is valid', async () => {
    const backup = JSON.parse(JSON.stringify(buildLedgerOnlyBackup(source())));
    const result = await restoreBackup(backup, { safetyBackup: SAFETY() });
    expect(result.ok).toBe(true);

    const db = getDB();
    const vehicles = await db.vehicles.toArray();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].id).toBe('veh-restored');
    expect(await db.shifts.get('shift-old')).toBeUndefined();
    expect(await db.shifts.get('shift-restored')).toBeDefined();

    const meta = await db.kv.get('meta');
    expect((meta?.value as any).restoredAt).toBeTruthy();
    const settings = await db.kv.get('settings');
    expect((settings?.value as any).defaultPurpose).toBe('restored purpose');
  });

  it('does not partially restore a malformed backup', async () => {
    const before = await getDB().vehicles.toArray();
    const result = await restoreBackup(
      { format: LEDGER_ONLY_FORMAT, schemaVersion: 999 },
      { safetyBackup: SAFETY() },
    );
    expect(result.ok).toBe(false);
    const after = await getDB().vehicles.toArray();
    expect(after).toEqual(before); // untouched
  });

  it('rolls back completely if a write throws mid-transaction', async () => {
    const db = getDB();
    const backup = JSON.parse(JSON.stringify(buildLedgerOnlyBackup(source())));
    const original = db.shifts.bulkPut.bind(db.shifts);
    // Force a failure after vehicles.clear()/bulkPut have been queued in the txn.
    (db.shifts as any).bulkPut = () => Promise.reject(new Error('simulated write failure'));
    try {
      const result = await restoreBackup(backup, { safetyBackup: SAFETY() });
      expect(result.ok).toBe(false);
    } finally {
      (db.shifts as any).bulkPut = original;
    }
    // The previous database must remain intact — not half-wiped.
    const vehicles = await db.vehicles.toArray();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].id).toBe('veh-old');
    expect(await db.shifts.get('shift-old')).toBeDefined();
    expect(await db.shifts.get('shift-restored')).toBeUndefined();
  });
});
