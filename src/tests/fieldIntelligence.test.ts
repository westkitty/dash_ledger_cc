import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { DashLedgerDB, DB_NAME, getDB } from '../db/db';
import { addFieldRecord, listFieldRecords } from '../db/fieldRepositories';
import { countCanonicalRecords, deleteShift, deleteExpense, restoreDeletedShift, restoreDeletedExpense } from '../db/repositories';
import {
  FIELD_TABLE_NAMES, validateFieldRecord,
  type WorkSession, type PlatformTotal, type OfferEvent, type CompletedJob,
} from '../domain/fieldIntelligence';
import { SCHEMA_VERSION } from '../domain/types';
import {
  buildFullBackup, buildLedgerOnlyBackup, readBackupSource, serializeBackup,
  BACKUP_FORMAT_VERSION, FULL_FORMAT, LEDGER_ONLY_FORMAT,
} from '../services/backup';
import { V2_FULL_FORMAT, V2_LEDGER_ONLY_FORMAT } from '../services/backupFormats';
import { restoreBackup, validateBackup } from '../services/restore';
import { makeExportedAcknowledgement, makeNoExistingDataAcknowledgement } from '../services/safetyGate';
import { normalizeSource } from '../services/import/normalize';
import { shiftsToCsv } from '../services/csv';
import { makeExpense, makeShift, makeVehicle, makeReceipt } from './factories';

const T0 = '2026-11-10T09:00:00-05:00';
const T1 = '2026-11-10T13:00:00-05:00';
const T2 = '2026-11-10T14:00:00-05:00';
const stamp = { createdAt: T0, updatedAt: T0 };

function session(over: Partial<WorkSession> = {}): WorkSession {
  return {
    ...stamp, id: 'ses1', status: 'closed', localDate: '2026-11-10',
    timeZone: 'America/Detroit', vehicleId: 'v1', leftHomeAt: T0, returnedHomeAt: T2,
    startOdometer: 1000, endOdometer: 1040, primaryMarketId: 'niles-mi',
    conditionTags: [], ...over,
  };
}
function total(over: Partial<PlatformTotal> = {}): PlatformTotal {
  return {
    ...stamp, id: 'pt1', sessionId: 'ses1', platform: 'doordash',
    appPayoutCents: 6200, extraCashTipsCents: null, reportedOnlineMinutes: 240,
    reportedActiveMinutes: 90, offerCaptureCoverage: 'partial',
    reconciliation: 'pending', ...over,
  };
}
function offer(over: Partial<OfferEvent> = {}): OfferEvent {
  return {
    ...stamp, id: 'offer1', sessionId: 'ses1', platform: 'doordash', observedAt: T0,
    decision: 'accepted', quotedPayCents: 1250, quotedMiles: 3.5,
    linkedJobId: null, ...over,
  };
}
function job(over: Partial<CompletedJob> = {}): CompletedJob {
  return {
    ...stamp, id: 'job1', sessionId: 'ses1', platform: 'doordash',
    offerId: 'offer1', storeLabel: null, startedAt: T0, completedAt: T1,
    finalPayoutCents: 1325, itemCount: null, unitCount: null,
    customerCount: 1, ...over,
  };
}
function safety() {
  return makeExportedAcknowledgement('phase1-pre-restore.json', 4096, FULL_FORMAT);
}
async function wipe() {
  const db = getDB();
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
}
async function seed() {
  const db = getDB();
  await db.vehicles.add(makeVehicle({ id: 'v1' }));
  await db.shifts.add(makeShift({ id: 'shift1', vehicleId: 'v1', appEarningsCents: 5500, cashTipsCents: 150 }));
  await db.expenses.add(makeExpense({ id: 'exp1', shiftId: 'shift1', receiptId: null }));
}
async function allNine() {
  const db = getDB();
  await addFieldRecord('workSessions', session());
  await addFieldRecord('platformTotals', total());
  await addFieldRecord('onlineIntervals', {
    ...stamp, id: 'on1', sessionId: 'ses1', platform: 'doordash', startedAt: T0, endedAt: T1,
  });
  await addFieldRecord('offerEvents', offer());
  await addFieldRecord('completedJobs', job());
  await addFieldRecord('travelLegs', {
    ...stamp, id: 'leg1', sessionId: 'ses1', kind: 'recovery', startedAt: T1, endedAt: T2,
    miles: 7.2, source: 'manual',
  });
  await addFieldRecord('marketVisits', {
    ...stamp, id: 'visit1', sessionId: 'ses1', marketId: 'niles-mi', startedAt: T0,
    endedAt: T2, conditionTags: ['weekday'], notes: '',
  });
  await addFieldRecord('legacyShiftLinks', {
    ...stamp, id: 'll1', sessionId: 'ses1', shiftId: 'shift1',
    reportingAuthority: 'legacy', reconciledAt: null,
  });
  await addFieldRecord('sessionExpenseLinks', {
    ...stamp, id: 'el1', sessionId: 'ses1', expenseId: 'exp1',
  });
  expect(await db.workSessions.count()).toBe(1);
}

describe('additive v1-to-v2 Dexie migration', () => {
  it('opens the same database name and retains every v1 record and metadata', async () => {
    const name = DB_NAME + '-migration-' + Math.random().toString(36).slice(2);
    const old = new Dexie(name);
    old.version(1).stores({
      vehicles: 'id, label, archived, createdAt',
      shifts: 'id, status, date, vehicleId, weekKey, createdAt, updatedAt',
      expenses: 'id, date, category, taxClass, shiftId, receiptId, createdAt',
      receipts: 'id, status, date, capturedAt, expenseId, createdAt',
      receiptBlobs: 'receiptId', weeklyClosures: 'weekKey, reviewedAt',
      mileageRates: 'id, startDate', merchantMemory: 'merchantKey, updatedAt',
      kv: 'key', importReports: 'id, createdAt',
    });
    await old.open();
    const vehicle = makeVehicle({ id: 'oldv' });
    const shift = makeShift({ id: 'olds', vehicleId: 'oldv', appEarningsCents: 12345 });
    await old.table('vehicles').add(vehicle);
    await old.table('shifts').add(shift);
    await old.table('kv').put({ key: 'meta', value: { schemaVersion: 1, lastRecordChangeAt: T0 } });
    old.close();

    const upgraded = new DashLedgerDB(name);
    try {
      await upgraded.open();
      expect(upgraded.verno).toBe(2);
      expect(await upgraded.vehicles.get('oldv')).toEqual(vehicle);
      expect(await upgraded.shifts.get('olds')).toEqual(shift);
      expect((await upgraded.kv.get('meta'))?.value).toMatchObject({
        schemaVersion: SCHEMA_VERSION, lastRecordChangeAt: T0,
      });
      for (const table of FIELD_TABLE_NAMES) expect(await upgraded.table(table).count()).toBe(0);
    } finally {
      upgraded.close();
      await upgraded.delete();
    }
  });
});

describe('field-intelligence runtime constraints', () => {
  beforeEach(async () => { await wipe(); await seed(); });

  it('accepts null unknowns but rejects fractional cents, invalid timezones and reversed odometers', () => {
    expect(validateFieldRecord('workSessions', session())).toEqual([]);
    expect(validateFieldRecord('platformTotals', total())).toEqual([]);
    expect(validateFieldRecord('platformTotals', total({ appPayoutCents: 10.25 }))).not.toEqual([]);
    expect(validateFieldRecord('workSessions', session({ timeZone: 'bad/zone' }))).not.toEqual([]);
    expect(validateFieldRecord('workSessions', session({ startOdometer: 1100, endOdometer: 1000 })))
      .toContain('workSessions: reversed odometer');
    expect(validateFieldRecord('completedJobs', job({ startedAt: T1, completedAt: T0 })))
      .toContain('completedJobs: end before start');
  });

  it('writes all nine collections and leaves old shift money and CSV unchanged', async () => {
    const db = getDB();
    const oldShift = await db.shifts.get('shift1');
    const csvBefore = shiftsToCsv([oldShift!]);
    await allNine();
    const read = await readBackupSource();
    for (const table of FIELD_TABLE_NAMES) expect(read[table]).toHaveLength(1);
    expect(await listFieldRecords('platformTotals')).toEqual([total()]);
    expect(await db.shifts.get('shift1')).toEqual(oldShift);
    expect(shiftsToCsv([oldShift!])).toBe(csvBefore);
    // All nine records participate in the destructive-restore safety count.
    expect(await countCanonicalRecords()).toBeGreaterThan(9);
  });

  it('rejects orphan sessions and duplicate platform totals without partial writes', async () => {
    const db = getDB();
    await expect(addFieldRecord('workSessions', session({ vehicleId: 'unknown' }))).rejects.toThrow(/unknown vehicle/);
    expect(await db.workSessions.count()).toBe(0);
    await addFieldRecord('workSessions', session());
    await addFieldRecord('platformTotals', total());
    await expect(addFieldRecord('platformTotals', total({ id: 'pt2' }))).rejects.toThrow();
    expect(await db.platformTotals.count()).toBe(1);
    await expect(addFieldRecord('completedJobs', job())).rejects.toThrow(/offer/);
    expect(await db.completedJobs.count()).toBe(0);
  });

  it('keeps legacy shift delete/Undo valid with a dependent v2 link', async () => {
    const db = getDB();
    await addFieldRecord('workSessions', session());
    await addFieldRecord('legacyShiftLinks', {
      ...stamp, id: 'll1', sessionId: 'ses1', shiftId: 'shift1',
      reportingAuthority: 'legacy', reconciledAt: null,
    });
    const deleted = await deleteShift('shift1');
    expect(deleted?.detachedFieldLinks).toHaveLength(1);
    expect(await db.legacyShiftLinks.count()).toBe(0);
    expect(await db.workSessions.count()).toBe(1);
    expect(validateBackup(buildLedgerOnlyBackup(await readBackupSource())).ok).toBe(true);
    await restoreDeletedShift(deleted!);
    expect(await db.legacyShiftLinks.get('ll1')).toBeDefined();
    expect(validateBackup(buildLedgerOnlyBackup(await readBackupSource())).ok).toBe(true);
  });

  it('keeps expense delete/Undo valid with a dependent v2 link', async () => {
    const db = getDB();
    await addFieldRecord('workSessions', session());
    await addFieldRecord('sessionExpenseLinks', {
      ...stamp, id: 'el1', sessionId: 'ses1', expenseId: 'exp1',
    });
    const deleted = await deleteExpense('exp1');
    expect(deleted?.detachedFieldLinks).toHaveLength(1);
    expect(await db.sessionExpenseLinks.count()).toBe(0);
    expect(await db.workSessions.count()).toBe(1);
    expect(validateBackup(buildLedgerOnlyBackup(await readBackupSource())).ok).toBe(true);
    await restoreDeletedExpense(deleted!);
    expect(await db.sessionExpenseLinks.get('el1')).toBeDefined();
    expect(validateBackup(buildLedgerOnlyBackup(await readBackupSource())).ok).toBe(true);
  });

  it('enforces a single open session under concurrent writes', async () => {
    await Promise.allSettled([
      addFieldRecord('workSessions', session({ id: 'a', status: 'open' })),
      addFieldRecord('workSessions', session({ id: 'b', status: 'open' })),
    ]);
    expect(await getDB().workSessions.where('status').equals('open').count()).toBe(1);
  });

  it('counts a new-only ledger as populated for restore safety', async () => {
    const db = getDB();
    await addFieldRecord('workSessions', session());
    const validBackup = buildLedgerOnlyBackup(await readBackupSource());
    await Promise.all([db.vehicles.clear(), db.shifts.clear(), db.expenses.clear()]);
    expect(await countCanonicalRecords()).toBe(1);
    const result = await restoreBackup(validBackup, {
      safetyBackup: makeNoExistingDataAcknowledgement(),
    });
    expect(result.ok).toBe(false);
    expect(result.needsSafetyBackup).toBe(true);
    expect(await db.workSessions.count()).toBe(1);
  });
});

describe('v3 backup and compatibility', () => {
  beforeEach(async () => { await wipe(); await seed(); });

  it('serializes and atomically restores all nine collections and old ledger data', async () => {
    await allNine();
    const oldShift = await getDB().shifts.get('shift1');
    const backup = JSON.parse(serializeBackup(buildLedgerOnlyBackup(await readBackupSource())));
    expect(backup.format).toBe(LEDGER_ONLY_FORMAT);
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.schemaVersion).toBe(2);
    expect(validateBackup(backup).ok).toBe(true);
    for (const table of FIELD_TABLE_NAMES) expect(backup.counts[table]).toBe(1);

    const result = await restoreBackup(backup, { safetyBackup: safety() });
    expect(result.ok).toBe(true);
    const db = getDB();
    for (const table of FIELD_TABLE_NAMES) expect(await db.table(table).count()).toBe(1);
    expect(await db.shifts.get('shift1')).toEqual(oldShift);
    expect(result.restoredCounts?.completedJobs).toBe(1);
  });

  it('retains the full receipt-image export pathway while including new arrays', async () => {
    await addFieldRecord('workSessions', session());
    const backup = await buildFullBackup(await readBackupSource());
    expect(backup.format).toBe(FULL_FORMAT);
    expect(backup.workSessions).toHaveLength(1);
    expect(validateBackup(JSON.parse(serializeBackup(backup))).ok).toBe(true);
  });

  it('rejects incomplete or corrupt v3 collections before changing anything', async () => {
    await allNine();
    const db = getDB();
    const original = await db.workSessions.toArray();
    const backup: any = buildLedgerOnlyBackup(await readBackupSource());
    delete backup.marketVisits;
    expect(validateBackup(backup).errors.join(' ')).toMatch(/marketVisits must be an array/);
    const result = await restoreBackup(backup, { safetyBackup: safety() });
    expect(result.ok).toBe(false);
    expect(await db.workSessions.toArray()).toEqual(original);
  });

  it('rejects orphan references, duplicate platform totals and fractional money', async () => {
    await allNine();
    const backup: any = buildLedgerOnlyBackup(await readBackupSource());
    backup.platformTotals.push({ ...total(), id: 'double' });
    expect(validateBackup(backup).errors.join(' ')).toMatch(/duplicate platform per session/);
    backup.platformTotals.pop();
    backup.completedJobs[0].sessionId = 'ghost';
    expect(validateBackup(backup).errors.join(' ')).toMatch(/unknown session/);
    backup.completedJobs[0].sessionId = 'ses1';
    backup.platformTotals[0].appPayoutCents = 42.8;
    expect(validateBackup(backup).errors.join(' ')).toMatch(/appPayoutCents/);
  });

  it('accepts an authentic-shaped canonical v2 backup and clears stale v3 tables atomically', async () => {
    await allNine();
    const source = await readBackupSource();
    const legacy: any = buildLedgerOnlyBackup(source);
    legacy.format = V2_LEDGER_ONLY_FORMAT;
    legacy.formatVersion = 2;
    legacy.schemaVersion = 1;
    for (const table of FIELD_TABLE_NAMES) {
      delete legacy[table];
      delete legacy.counts[table];
    }
    expect(validateBackup(legacy).ok).toBe(true);
    const result = await restoreBackup(legacy, { safetyBackup: safety() });
    expect(result.ok).toBe(true);
    for (const table of FIELD_TABLE_NAMES) expect(await getDB().table(table).count()).toBe(0);
    expect(await getDB().shifts.get('shift1')).toBeDefined();
    expect(validateBackup({ ...legacy, format: V2_FULL_FORMAT }).ok).toBe(true);
  });

  it('restores an earlier canonical v2 FULL backup with its receipt image bytes', async () => {
    const db = getDB();
    await db.receipts.put(makeReceipt({ id: 'photo1', expenseId: null }));
    const pixels = new Uint8Array([1, 4, 9, 16]);
    await db.receiptBlobs.put({
      receiptId: 'photo1', image: new Blob([pixels], { type: 'image/png' }),
      thumbnail: null, mimeType: 'image/png', byteCount: pixels.byteLength,
    });
    const full: any = await buildFullBackup(await readBackupSource());
    full.format = V2_FULL_FORMAT;
    full.formatVersion = 2;
    full.schemaVersion = 1;
    for (const table of FIELD_TABLE_NAMES) {
      delete full[table];
      delete full.counts[table];
    }
    expect(validateBackup(full).ok).toBe(true);
    const result = await restoreBackup(JSON.parse(serializeBackup(full)), { safetyBackup: safety() });
    expect(result.ok).toBe(true);
    const image = await db.receiptBlobs.get('photo1');
    expect(image).toBeDefined();
    expect(new Uint8Array(await image!.image.arrayBuffer())).toEqual(pixels);
  });

  it('does not let the legacy import normalizer strip v3 field data', async () => {
    await allNine();
    const backup = buildLedgerOnlyBackup(await readBackupSource());
    const analysis = normalizeSource(backup);
    expect(analysis.report.ok).toBe(false);
    expect(analysis.report.errors.join(' ')).toMatch(/Restore/);
  });

  it('rolls back existing data if a field-table write fails during restore', async () => {
    await allNine();
    const db = getDB();
    const backup = buildLedgerOnlyBackup(await readBackupSource());
    const oldSession = await db.workSessions.get('ses1');
    const oldShift = await db.shifts.get('shift1');
    const failWrite = () => { throw new Error('injected field write failure'); };
    db.platformTotals.hook('creating', failWrite);
    try {
      const result = await restoreBackup(backup, { safetyBackup: safety() });
      expect(result.ok).toBe(false);
    } finally {
      db.platformTotals.hook('creating').unsubscribe(failWrite);
    }
    expect(await db.workSessions.get('ses1')).toEqual(oldSession);
    expect(await db.shifts.get('shift1')).toEqual(oldShift);
  });
});
