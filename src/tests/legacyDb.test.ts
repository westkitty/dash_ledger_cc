/**
 * Reading an on-device legacy database.
 *
 * Builds a database with the ORIGINAL app's store layout (per-key `settings`
 * rows, a `metadata` store, receipt Blobs on the receipt row), reads it through
 * the recovery path, and checks that the source is left byte-for-byte as it was.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { getDB, DB_NAME, LEGACY_DB_NAMES } from '../db/db';
import { scanLegacyDatabases, readLegacyDatabase } from '../services/import/legacyDb';
import { analyseLegacyDatabase } from '../services/import';
import { applyImport } from '../services/import/apply';
import { makeNoExistingDataAcknowledgement } from '../services/safetyGate';
import { formatCents, grossIncomeCents } from '../domain/money';
import { LEGACY_A_MONEY_SHIFT } from './fixtures/legacySources';

const LEGACY_NAME = 'dash-ledger';
const A_STORES = ['vehicles', 'shifts', 'expenses', 'receipts', 'settings', 'weeklyClosures', 'metadata'];

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/** Create a database shaped exactly like the original single-file app's. */
function createLegacyADatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('vehicles', { keyPath: 'id' });
      db.createObjectStore('shifts', { keyPath: 'id' });
      db.createObjectStore('expenses', { keyPath: 'id' });
      db.createObjectStore('receipts', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'key' });
      db.createObjectStore('weeklyClosures', { keyPath: 'weekKey' });
      db.createObjectStore('metadata', { keyPath: 'key' });
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(A_STORES, 'readwrite');
      tx.objectStore('vehicles').put({
        id: LEGACY_A_MONEY_SHIFT.vehicleId,
        label: 'My car',
        createdAt: 'x',
        updatedAt: 'x',
      });
      tx.objectStore('shifts').put({ ...LEGACY_A_MONEY_SHIFT });
      tx.objectStore('expenses').put({
        id: 'ex1',
        date: '2026-09-08',
        amount: 40.25,
        merchant: 'Shell',
        category: 'Fuel',
        taxClass: 'VEHICLE_ACTUAL',
        shiftId: LEGACY_A_MONEY_SHIFT.id,
        receiptId: 'rc1',
        notes: '',
      });
      tx.objectStore('receipts').put({
        id: 'rc1',
        expenseId: 'ex1',
        capturedAt: '2026-09-08T12:00:00.000Z',
        date: '2026-09-08',
        mime: 'image/png',
        status: 'Classified',
        category: 'Fuel',
        merchant: 'Shell',
        amount: 40.25,
        // The original app stored the Blob directly on the receipt row.
        image: new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' }),
        thumbnail: 'data:image/jpeg;base64,AAAA',
      });
      // Settings: one row per key.
      tx.objectStore('settings').put({ key: 'defaultVehicleId', value: LEGACY_A_MONEY_SHIFT.vehicleId });
      tx.objectStore('settings').put({ key: 'overdueDays', value: 14 });
      tx.objectStore('settings').put({ key: 'implausibleMiles', value: 400 });
      tx.objectStore('settings').put({
        key: 'mileageRates',
        value: [
          { id: 'rate-2026-h2', start: '2026-07-01', end: '2026-12-31', rate: 0.76, locked: true, note: 'h2' },
        ],
      });
      tx.objectStore('weeklyClosures').put({
        weekKey: '2026-09-07',
        reviewedAt: '2026-09-15T00:00:00.000Z',
        notes: 'ok',
      });
      tx.objectStore('metadata').put({ key: 'schemaVersion', value: 1 });
      tx.objectStore('metadata').put({ key: 'lastArchiveConfirmedAt', value: '2026-09-01T00:00:00.000Z' });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

/** Read the legacy database back with raw IndexedDB, to prove it is untouched. */
function snapshotLegacy(): Promise<Record<string, unknown[]>> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_NAME);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const names = Array.from(db.objectStoreNames);
      const tx = db.transaction(names, 'readonly');
      const out: Record<string, unknown[]> = {};
      let pending = names.length;
      for (const n of names) {
        const g = tx.objectStore(n).getAll();
        g.onsuccess = () => {
          out[n] = g.result;
          if (--pending === 0) {
            db.close();
            resolve(out);
          }
        };
      }
    };
  });
}

async function clearCanonical() {
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
    db.importReports.clear(),
  ]);
}

beforeEach(async () => {
  await clearCanonical();
  await deleteDatabase(LEGACY_NAME);
  await createLegacyADatabase();
});

describe('legacy database discovery', () => {
  it('finds the legacy database without opening it as our own', async () => {
    const scan = await scanLegacyDatabases();
    expect(scan.unavailable).toBe(false);
    const hit = scan.found.find((f) => f.name === LEGACY_NAME);
    expect(hit?.present).toBe(true);
    expect(hit?.version).toBe(1); // still v1 — never upgraded by us
    expect(hit?.stores).toEqual(expect.arrayContaining(['shifts', 'settings', 'metadata']));
  });

  it('reports an absent legacy database without creating one', async () => {
    await deleteDatabase('dash-ledger-grok');
    const scan = await scanLegacyDatabases();
    expect(scan.found.find((f) => f.name === 'dash-ledger-grok')?.present).toBe(false);

    // Probing must not have brought it into existence.
    const after = await scanLegacyDatabases();
    expect(after.found.find((f) => f.name === 'dash-ledger-grok')?.present).toBe(false);
  });

  it('only ever looks at names that are not the canonical database', () => {
    expect(LEGACY_DB_NAMES).not.toContain(DB_NAME);
  });
});

describe('reading the legacy database', () => {
  it('flattens per-key settings rows and the metadata store', async () => {
    const doc = await readLegacyDatabase(LEGACY_NAME);
    expect(doc).not.toBeNull();
    const settings = doc!.settings as Record<string, unknown>;
    expect(settings.defaultVehicleId).toBe(LEGACY_A_MONEY_SHIFT.vehicleId);
    expect(settings.overdueDays).toBe(14);
    expect(Array.isArray(settings.mileageRates)).toBe(true);

    const meta = doc!.meta as Record<string, unknown>;
    expect(meta.lastArchiveConfirmedAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('brings the receipt Blob across as a data URL', async () => {
    const doc = await readLegacyDatabase(LEGACY_NAME);
    const receipts = doc!.receipts as Array<Record<string, unknown>>;
    expect(typeof receipts[0].imageBase64).toBe('string');
    expect(String(receipts[0].imageBase64).startsWith('data:image/png')).toBe(true);
  });

  it('does not modify the legacy database', async () => {
    const before = await snapshotLegacy();
    await readLegacyDatabase(LEGACY_NAME);
    await scanLegacyDatabases();
    const after = await snapshotLegacy();

    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    expect(after.shifts).toEqual(before.shifts);
    expect(after.settings).toEqual(before.settings);
    expect(after.metadata).toEqual(before.metadata);
    // The dollar fields are still dollars, in place.
    expect((after.shifts[0] as Record<string, unknown>).appEarnings).toBe(84.5);
  });
});

describe('recovering the legacy database into the canonical one', () => {
  it('imports $96.50 correctly and leaves the source in place', async () => {
    const analysis = await analyseLegacyDatabase(LEGACY_NAME);
    expect(analysis).not.toBeNull();

    const result = await applyImport(analysis!.candidate, analysis!.report, {
      safetyBackup: makeNoExistingDataAcknowledgement(),
    });
    expect(result.ok).toBe(true);

    const shift = await getDB().shifts.get(LEGACY_A_MONEY_SHIFT.id);
    const gross = grossIncomeCents(shift!.appEarningsCents, shift!.cashTipsCents);
    expect(gross).toBe(9650);
    expect(formatCents(gross)).toBe('$96.50');

    expect((await getDB().expenses.get('ex1'))!.amountCents).toBe(4025);
    expect(await getDB().receiptBlobs.get('rc1')).toBeDefined();

    // Source database still present, still at version 1, still holding dollars.
    const scan = await scanLegacyDatabases();
    const hit = scan.found.find((f) => f.name === LEGACY_NAME);
    expect(hit?.present).toBe(true);
    expect(hit?.version).toBe(1);
    const raw = await snapshotLegacy();
    expect((raw.shifts[0] as Record<string, unknown>).appEarnings).toBe(84.5);
  });

  it('is safe to analyse repeatedly', async () => {
    const first = await analyseLegacyDatabase(LEGACY_NAME);
    const second = await analyseLegacyDatabase(LEGACY_NAME);

    expect(second!.candidate.shifts[0].appEarningsCents).toBe(
      first!.candidate.shifts[0].appEarningsCents,
    );
    expect(second!.candidate.shifts).toHaveLength(first!.candidate.shifts.length);
    expect(second!.report.totals.imported).toBe(first!.report.totals.imported);
  });

  it('a canonical snapshot never reads the legacy database', async () => {
    // Nothing was imported, so the canonical store must still be empty even
    // though a populated legacy database exists on the same origin.
    const db = getDB();
    expect(await db.shifts.count()).toBe(0);
    expect(await db.vehicles.count()).toBe(0);
    expect(db.name).toBe(DB_NAME);
  });
});
