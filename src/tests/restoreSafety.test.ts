/**
 * The pre-restore safety gate, and the format boundary between canonical
 * backups and earlier lineages.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { getDB } from '../db/db';
import { restoreBackup, validateBackup } from '../services/restore';
import {
  buildLedgerOnlyBackup,
  FULL_FORMAT,
  LEDGER_ONLY_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupSource,
} from '../services/backup';
import {
  checkSafetyGate,
  makeExportedAcknowledgement,
  makeNoExistingDataAcknowledgement,
} from '../services/safetyGate';
import { seededMileageRates } from '../domain/mileageRates';
import { DEFAULT_SETTINGS } from '../domain/types';
import { makeShift, makeVehicle } from './factories';
import { legacyAOriginalBackup, grokBackup } from './fixtures/legacySources';

function source(over: Partial<BackupSource> = {}): BackupSource {
  return {
    settings: { ...DEFAULT_SETTINGS },
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
    vehicles: [makeVehicle({ id: 'veh-new', label: 'New Car' })],
    shifts: [makeShift({ id: 'shift-new', vehicleId: 'veh-new' })],
    expenses: [],
    weeklyClosures: [],
    receipts: [],
    mileageRates: seededMileageRates(),
    merchantMemory: [],
    ...over,
  };
}

const GOOD_BACKUP = () => JSON.parse(JSON.stringify(buildLedgerOnlyBackup(source())));
const EXPORTED_ACK = () => makeExportedAcknowledgement('safety.json', 4096, LEDGER_ONLY_FORMAT);

async function reset({ withData }: { withData: boolean }) {
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
  if (withData) {
    await db.vehicles.put(makeVehicle({ id: 'veh-existing', label: 'Existing Car' }));
    await db.shifts.put(makeShift({ id: 'shift-existing', vehicleId: 'veh-existing' }));
  }
}

// ---------------------------------------------------------------------------

describe('safety gate (pure)', () => {
  it('refuses without an acknowledgement, whether or not data exists', () => {
    expect(checkSafetyGate(null, 5).ok).toBe(false);
    expect(checkSafetyGate(null, 5).needsSafetyBackup).toBe(true);
    expect(checkSafetyGate(undefined, 0).ok).toBe(false);
  });

  it('accepts an exported backup acknowledgement', () => {
    expect(checkSafetyGate(makeExportedAcknowledgement('b.json', 100, FULL_FORMAT), 5).ok).toBe(true);
  });

  it('rejects an acknowledgement that references an empty file', () => {
    const r = checkSafetyGate(makeExportedAcknowledgement('b.json', 0, FULL_FORMAT), 5);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/empty/);
  });

  it('does not take a caller\'s word that the ledger is empty', () => {
    expect(checkSafetyGate(makeNoExistingDataAcknowledgement(), 0).ok).toBe(true);
    const forged = checkSafetyGate(makeNoExistingDataAcknowledgement(), 3);
    expect(forged.ok).toBe(false);
    expect(forged.error).toMatch(/holds 3 records/);
  });
});

describe('restore requires the safety gate', () => {
  beforeEach(() => reset({ withData: true }));

  it('refuses to replace an existing ledger without a safety backup', async () => {
    const result = await restoreBackup(GOOD_BACKUP(), { safetyBackup: null });
    expect(result.ok).toBe(false);
    expect(result.needsSafetyBackup).toBe(true);

    // Nothing was touched.
    expect(await getDB().shifts.get('shift-existing')).toBeDefined();
    expect(await getDB().shifts.get('shift-new')).toBeUndefined();
  });

  it('refuses a forged "nothing to lose" claim when records exist', async () => {
    const result = await restoreBackup(GOOD_BACKUP(), {
      safetyBackup: makeNoExistingDataAcknowledgement(),
    });
    expect(result.ok).toBe(false);
    expect(result.needsSafetyBackup).toBe(true);
    expect(await getDB().shifts.get('shift-existing')).toBeDefined();
  });

  it('proceeds once a safety backup is acknowledged', async () => {
    const result = await restoreBackup(GOOD_BACKUP(), { safetyBackup: EXPORTED_ACK() });
    expect(result.ok).toBe(true);
    expect(await getDB().shifts.get('shift-new')).toBeDefined();
    expect(await getDB().shifts.get('shift-existing')).toBeUndefined();
  });

  it('runs the gate before any write, so a refusal is not a partial restore', async () => {
    const before = await getDB().vehicles.toArray();
    await restoreBackup(GOOD_BACKUP(), { safetyBackup: null });
    expect(await getDB().vehicles.toArray()).toEqual(before);
  });
});

describe('restore into an empty ledger', () => {
  beforeEach(() => reset({ withData: false }));

  it('still requires an explicit acknowledgement', async () => {
    const result = await restoreBackup(GOOD_BACKUP(), { safetyBackup: null });
    expect(result.ok).toBe(false);
    expect(result.needsSafetyBackup).toBe(true);
  });

  it('accepts the verified "nothing to lose" acknowledgement', async () => {
    const result = await restoreBackup(GOOD_BACKUP(), {
      safetyBackup: makeNoExistingDataAcknowledgement(),
    });
    expect(result.ok).toBe(true);
    expect(await getDB().shifts.get('shift-new')).toBeDefined();
  });
});

describe('canonical backup identity', () => {
  it('writes an unambiguous marker and an envelope version', () => {
    const b = buildLedgerOnlyBackup(source());
    expect(b.format).toBe('dash-ledger-ledger-only-v2');
    expect(b.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(b.producer).toMatch(/^dash-ledger-canonical@/);
    expect(FULL_FORMAT).toBe('dash-ledger-backup-v2');
  });

  it('never reuses the ambiguous v1 marker', () => {
    const b = buildLedgerOnlyBackup(source());
    expect(b.format).not.toBe('dash-ledger-backup');
    expect(b.format).not.toBe('dash-ledger-ledger-only');
    expect(FULL_FORMAT).not.toBe('dash-ledger-backup');
  });

  it('rejects a canonical backup whose schema is newer than supported', () => {
    const b = GOOD_BACKUP();
    b.schemaVersion = 999;
    const v = validateBackup(b);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/newer than this app supports/);
  });

  it('rejects an unsupported envelope version', () => {
    const b = GOOD_BACKUP();
    b.formatVersion = 99;
    const v = validateBackup(b);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/envelope version 99/);
  });

  it('will not restore a newer-schema backup even with a safety backup', async () => {
    await reset({ withData: true });
    const b = GOOD_BACKUP();
    b.schemaVersion = 999;
    const result = await restoreBackup(b, { safetyBackup: EXPORTED_ACK() });
    expect(result.ok).toBe(false);
    expect(await getDB().shifts.get('shift-existing')).toBeDefined();
  });
});

describe('legacy files are routed to the importer, not restored', () => {
  beforeEach(() => reset({ withData: true }));

  it('recognises an original-app backup and names the import route', () => {
    const v = validateBackup(legacyAOriginalBackup());
    expect(v.ok).toBe(false);
    expect(v.importable).toBe(true);
    expect(v.errors.join(' ')).toMatch(/Recovery/);
  });

  it('recognises a Grok backup the same way', () => {
    const v = validateBackup(grokBackup());
    expect(v.ok).toBe(false);
    expect(v.importable).toBe(true);
  });

  it('refuses to restore a legacy file directly, even with a safety backup', async () => {
    const result = await restoreBackup(legacyAOriginalBackup(), { safetyBackup: EXPORTED_ACK() });
    expect(result.ok).toBe(false);
    // The existing ledger is untouched — no misread money reached the database.
    expect(await getDB().shifts.get('shift-existing')).toBeDefined();
    expect(await getDB().shifts.count()).toBe(1);
  });

  it('marks a genuinely unknown document as not importable', () => {
    const v = validateBackup({ format: 'something-else', schemaVersion: 1 });
    expect(v.ok).toBe(false);
    expect(v.importable).toBeUndefined();
  });
});
