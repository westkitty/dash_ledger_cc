import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { getDB, DB_NAME, LEGACY_DB_NAMES } from '../db/db';
import { normalizeSource } from '../services/import/normalize';
import { detectSource } from '../services/import/detect';
import { applyImport } from '../services/import/apply';
import { makeNoExistingDataAcknowledgement } from '../services/safetyGate';
import { formatCents, grossIncomeCents } from '../domain/money';
import { computeMileage } from '../domain/mileage';
import { mondayOf } from '../domain/dates';
import {
  ccV1Backup,
  grokBackup,
  legacyAOriginalBackup,
  LEGACY_A_MONEY_SHIFT,
} from './fixtures/legacySources';

const EMPTY_LEDGER_ACK = () => makeNoExistingDataAcknowledgement();

async function clearDb() {
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

beforeEach(clearDb);

// ---------------------------------------------------------------------------

describe('canonical database identity', () => {
  it('cannot collide with any known legacy database name', () => {
    expect(LEGACY_DB_NAMES).toContain('dash-ledger');
    expect(LEGACY_DB_NAMES).toContain('dash-ledger-grok');
    for (const legacy of LEGACY_DB_NAMES) {
      expect(DB_NAME).not.toBe(legacy);
    }
  });

  it('is a stable, documented name', () => {
    // Changing this is a data-migration decision, not a refactor.
    expect(DB_NAME).toBe('dash-ledger-canonical-v2');
  });
});

describe('source detection', () => {
  it('reads the record shape, not just the ambiguous v1 marker', () => {
    const a = detectSource(legacyAOriginalBackup());
    expect(a.format).toBe('dash-ledger-v1');
    expect(a.variant).toBe('legacy-a');

    const b = detectSource(ccV1Backup());
    expect(b.format).toBe('dash-ledger-v1');
    expect(b.variant).toBe('cc-b');

    // Both files carry the SAME marker. Only the body distinguishes them.
    expect(legacyAOriginalBackup().format).toBe(ccV1Backup().format);
  });

  it('recognises the Grok build and rejects unknown documents', () => {
    expect(detectSource(grokBackup()).format).toBe('grok-v1');
    expect(detectSource({ hello: 'world' }).format).toBe('unknown');
    expect(detectSource(null).format).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------

describe('THE $96.50 -> $0.00 REGRESSION', () => {
  it('imports the original record as exactly 9650 cents, never 0', async () => {
    const source = legacyAOriginalBackup();
    const { candidate, report } = normalizeSource(source, 'original app backup');
    expect(report.ok).toBe(true);

    const result = await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    expect(result.ok).toBe(true);

    const shift = await getDB().shifts.get(LEGACY_A_MONEY_SHIFT.id);
    expect(shift).toBeDefined();

    // The dollars became cents at the import boundary.
    expect(shift!.appEarningsCents).toBe(8450);
    expect(shift!.cashTipsCents).toBe(1200);

    // The number the user actually sees.
    const gross = grossIncomeCents(shift!.appEarningsCents, shift!.cashTipsCents);
    expect(gross).toBe(9650);
    expect(gross).not.toBe(0);
    expect(formatCents(gross)).toBe('$96.50');
    expect(formatCents(gross)).not.toBe('$0.00');
  });

  it('imports a record whose app earnings alone are $96.50 as 9650 cents', async () => {
    const { candidate, report } = normalizeSource(legacyAOriginalBackup());
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });

    const shift = await getDB().shifts.get('legacy-a-all-app-earnings');
    expect(shift!.appEarningsCents).toBe(9650);
    expect(shift!.appEarningsCents).not.toBe(0);
    expect(formatCents(shift!.appEarningsCents)).toBe('$96.50');
  });

  it('leaves the source object completely unmodified', async () => {
    const source = legacyAOriginalBackup();
    const before = JSON.stringify(source);

    const { candidate, report } = normalizeSource(source);
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });

    expect(JSON.stringify(source)).toBe(before);
    // The dollar fields are still exactly where they were.
    expect(source.shifts[0].appEarnings).toBe(84.5);
    expect(source.shifts[0].cashTips).toBe(12);
    expect(source.shifts[0]).not.toHaveProperty('appEarningsCents');
  });

  it('fails if a future change makes the importer read A rows as B rows', async () => {
    // Reading the record the way the broken build did must NOT be what we store.
    const raw = LEGACY_A_MONEY_SHIFT as unknown as Record<string, unknown>;
    const naive = (raw.appEarningsCents as number | undefined) ?? 0;
    expect(naive).toBe(0); // this is precisely the historical bug

    const { candidate, report } = normalizeSource(legacyAOriginalBackup());
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    const stored = await getDB().shifts.get(LEGACY_A_MONEY_SHIFT.id);
    expect(stored!.appEarningsCents).not.toBe(naive);
  });
});

// ---------------------------------------------------------------------------

describe('original (A) backup import', () => {
  it('brings across every collection', async () => {
    const { candidate, report } = normalizeSource(legacyAOriginalBackup());
    const result = await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    expect(result.ok).toBe(true);

    const db = getDB();
    expect(await db.vehicles.count()).toBe(1);
    expect(await db.shifts.count()).toBe(2);
    expect(await db.expenses.count()).toBe(1);
    expect(await db.receipts.count()).toBe(1);
    expect(await db.weeklyClosures.count()).toBe(1);
    expect(await db.mileageRates.count()).toBe(2);
    expect(await db.merchantMemory.count()).toBe(1);
    expect(await db.receiptBlobs.count()).toBe(1);
  });

  it('converts expense dollars to cents once', async () => {
    const { candidate, report } = normalizeSource(legacyAOriginalBackup());
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    const expense = await getDB().expenses.get('ex1');
    expect(expense!.amountCents).toBe(4025);
  });

  it('maps settings, rates, merchant memory and statement totals', async () => {
    const { candidate } = normalizeSource(legacyAOriginalBackup());

    expect(candidate.settings.backupOverdueDays).toBe(14); // from `overdueDays`
    expect(candidate.settings.statementTotals[0]).toEqual({
      year: 2026,
      appEarningsCents: 1234567,
      note: '',
    });
    expect(candidate.settings.annualOdometers[0]).toMatchObject({
      year: 2026,
      startOdometer: 900,
      endOdometer: 21000,
    });

    const h2 = candidate.mileageRates.find((r) => r.id === 'rate-2026-h2');
    expect(h2).toMatchObject({ startDate: '2026-07-01', endDate: '2026-12-31', ratePerMile: 0.76 });

    expect(candidate.merchantMemory[0]).toMatchObject({
      merchantKey: 'shell',
      counts: { Fuel: 3 },
    });
  });

  it('keeps the receipt image bytes', async () => {
    const { candidate, report } = normalizeSource(legacyAOriginalBackup());
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    const blob = await getDB().receiptBlobs.get('rc1');
    expect(blob).toBeDefined();
    expect(blob!.image.size).toBeGreaterThan(0);
    expect(blob!.mimeType).toBe('image/png');
  });

  it('normalises the original app\'s "" times to null', async () => {
    const src = legacyAOriginalBackup();
    src.shifts = [{ ...LEGACY_A_MONEY_SHIFT, startTime: '', endTime: '' }];
    const { candidate } = normalizeSource(src);
    expect(candidate.shifts[0].startTime).toBeNull();
    expect(candidate.shifts[0].endTime).toBeNull();
  });
});

describe('cc-native (B) backup import', () => {
  it('imports cents records without touching their values', async () => {
    const { candidate, report } = normalizeSource(ccV1Backup());
    expect(report.sourceVariant).toBe('cc-b');
    const result = await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    expect(result.ok).toBe(true);

    const shift = await getDB().shifts.get('cc-shift-1');
    expect(shift!.appEarningsCents).toBe(8450);
    expect(shift!.cashTipsCents).toBe(1200);
    expect(await getDB().expenses.get('cc-exp-1')).toMatchObject({ amountCents: 4025 });
  });

  it('carries cc backup-health timestamps across', async () => {
    const { candidate } = normalizeSource(ccV1Backup());
    expect(candidate.meta.lastArchiveConfirmedAt).toBe('2026-09-07T19:00:00.000Z');
    expect(candidate.meta.lastBackupGeneratedAt).toBe('2026-09-08T19:00:00.000Z');
  });

  it('keeps cc records reachable after the database rename', async () => {
    // The whole point of the rename is that B data must not be stranded.
    const { candidate, report } = normalizeSource(ccV1Backup());
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    expect(await getDB().shifts.count()).toBe(1);
    expect(await getDB().vehicles.get('veh-cc')).toBeDefined();
  });
});

describe('Grok (C) backup import', () => {
  it('maps dashes, week reviews, dash links and snake-case tax classes', async () => {
    const { candidate, report } = normalizeSource(grokBackup());
    expect(report.sourceFormat).toBe('grok-v1');
    const result = await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    expect(result.ok).toBe(true);

    const db = getDB();
    const shift = await db.shifts.get('grok-dash-1');
    expect(shift).toBeDefined();
    expect(shift!.appEarningsCents).toBe(9650);
    expect(shift!.vehicleLabel).toBe('Prius'); // `name` -> `label`

    const expense = await db.expenses.get('grok-exp-1');
    expect(expense!.amountCents).toBe(1275);
    expect(expense!.taxClass).toBe('MILEAGE_ADDON'); // `mileage_addon` -> canonical
    expect(expense!.shiftId).toBe('grok-dash-1'); // `dashId` -> `shiftId`

    const receipt = await db.receipts.get('grok-rc-1');
    expect(receipt!.status).toBe('Classified'); // `classified` -> canonical
    expect(receipt!.amountCents).toBe(1275);

    // Only the reviewed week is a closure; the "open" one is not.
    const closures = await db.weeklyClosures.toArray();
    expect(closures).toHaveLength(1);
    expect(closures[0].weekKey).toBe('2026-09-07');
  });

  it('reports the C fields it has no canonical home for, without inventing one', () => {
    const { report } = normalizeSource(grokBackup());
    expect(report.unsupportedFields).toContain('vehicles[].notes');
    expect(report.unsupportedFields).toContain('receipts[].width');
    expect(report.unsupportedFields).toContain('receipts[].height');
  });
});

// ---------------------------------------------------------------------------

describe('canonical invariants survive import', () => {
  it('leaves at most one active dash and reports the rest', async () => {
    const src = legacyAOriginalBackup();
    src.shifts = [
      { ...LEGACY_A_MONEY_SHIFT, id: 'act-1', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' },
      { ...LEGACY_A_MONEY_SHIFT, id: 'act-2', status: 'active', createdAt: '2026-09-02T00:00:00.000Z' },
      { ...LEGACY_A_MONEY_SHIFT, id: 'act-3', status: 'active', createdAt: '2026-09-03T00:00:00.000Z' },
    ];

    const { candidate, report } = normalizeSource(src);
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });

    const active = await getDB().shifts.where('status').equals('active').toArray();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('act-1'); // earliest kept

    const conflicts = report.issues.filter((i) => i.code === 'multiple-active-dashes');
    expect(conflicts).toHaveLength(2);
    expect(report.totals.conflicts).toBeGreaterThanOrEqual(2);
    // The demoted dashes are still imported, not thrown away.
    expect(await getDB().shifts.count()).toBe(3);
  });

  it('keeps work dates as local calendar dates and recomputes the week key', async () => {
    const { candidate, report } = normalizeSource(legacyAOriginalBackup());
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });

    const shift = await getDB().shifts.get(LEGACY_A_MONEY_SHIFT.id);
    expect(shift!.date).toBe('2026-09-08'); // unchanged, no UTC drift
    expect(shift!.weekKey).toBe(mondayOf('2026-09-08'));
    expect(shift!.weekKey).toBe('2026-09-07');
  });

  it('never trusts a stored week key from the source', () => {
    const src = ccV1Backup();
    src.shifts[0].weekKey = '1999-01-01'; // deliberately wrong
    const { candidate } = normalizeSource(src);
    expect(candidate.shifts[0].weekKey).toBe('2026-09-07');
  });

  it('derives mileage from the odometer pair after import', async () => {
    const { candidate, report } = normalizeSource(legacyAOriginalBackup());
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });

    const shift = await getDB().shifts.get(LEGACY_A_MONEY_SHIFT.id);
    const m = computeMileage(shift!.startOdometer, shift!.endOdometer, 400);
    expect(m.status).toBe('ok');
    expect(m.miles).toBe(150);
  });

  it('reports a stored mileage figure that disagrees with the odometer pair', () => {
    const src = legacyAOriginalBackup();
    src.shifts = [{ ...LEGACY_A_MONEY_SHIFT, businessMiles: 999 }];
    const { report } = normalizeSource(src);
    const issue = report.issues.find((i) => i.code === 'miles-mismatch');
    expect(issue).toBeDefined();
    expect(issue!.evidence).toMatchObject({ storedBusinessMiles: 999, derivedBusinessMiles: 150 });
  });

  it('keeps a reversed odometer pair exactly as recorded', async () => {
    const src = legacyAOriginalBackup();
    src.shifts = [{ ...LEGACY_A_MONEY_SHIFT, startOdometer: 1150, endOdometer: 1000, businessMiles: 0 }];
    const { candidate, report } = normalizeSource(src);
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });

    const shift = await getDB().shifts.get(LEGACY_A_MONEY_SHIFT.id);
    expect(shift!.startOdometer).toBe(1150);
    expect(shift!.endOdometer).toBe(1000);
    expect(computeMileage(shift!.startOdometer, shift!.endOdometer, 400).status).toBe('reversed');
  });
});

describe('import safety and reporting', () => {
  it('refuses an unrecognised document and writes nothing', async () => {
    const { candidate, report } = normalizeSource({ some: 'json' });
    expect(report.ok).toBe(false);
    const result = await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    expect(result.ok).toBe(false);
    expect(await getDB().shifts.count()).toBe(0);
  });

  it('refuses a source whose schema is newer than this build', async () => {
    const { report } = normalizeSource(legacyAOriginalBackup({ schemaVersion: 99 }));
    expect(report.ok).toBe(false);
    expect(report.errors.join(' ')).toMatch(/newer than this build/);
  });

  it('a malformed source cannot corrupt existing canonical data', async () => {
    const good = normalizeSource(ccV1Backup());
    await applyImport(good.candidate, good.report, { safetyBackup: EMPTY_LEDGER_ACK() });
    const before = await getDB().shifts.toArray();
    expect(before).toHaveLength(1);

    const bad = normalizeSource({ format: 'dash-ledger-backup', schemaVersion: 1, shifts: 'not-an-array' });
    const result = await applyImport(bad.candidate, bad.report, { safetyBackup: null });
    expect(result.ok).toBe(false);

    expect(await getDB().shifts.toArray()).toEqual(before);
  });

  it('records an audit report with the counts and issues', async () => {
    const { candidate, report } = normalizeSource(legacyAOriginalBackup());
    const result = await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    expect(result.ok).toBe(true);

    const rows = await getDB().importReports.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].report.sourceVariant).toBe('legacy-a');
    expect(rows[0].report.imported.shifts).toBe(2);
    expect(rows[0].id).toBe(result.reportId);
  });

  it('does not treat importing a file as having archived one', async () => {
    const { candidate, report } = normalizeSource(ccV1Backup());
    await applyImport(candidate, report, { safetyBackup: EMPTY_LEDGER_ACK() });
    const meta = (await getDB().kv.get('meta'))?.value as Record<string, unknown>;
    expect(meta.lastImportAt).toBeTruthy();
    // The cc fixture carried an archive timestamp; it is preserved as evidence,
    // but the import itself never invents one.
    expect(meta.lastArchiveConfirmedAt).toBe('2026-09-07T19:00:00.000Z');
  });
});

describe('idempotency', () => {
  it('analysing the same source twice gives an identical result', () => {
    const source = legacyAOriginalBackup();
    const first = normalizeSource(source);
    const second = normalizeSource(source);

    expect(second.candidate.shifts).toEqual(first.candidate.shifts);
    expect(second.candidate.expenses).toEqual(first.candidate.expenses);
    expect(second.report.totals).toEqual(first.report.totals);
    // Money is never re-scaled on a second pass.
    expect(second.candidate.shifts[0].appEarningsCents).toBe(8450);
  });

  it('importing the same source twice does not duplicate or re-scale records', async () => {
    const source = legacyAOriginalBackup();

    const first = normalizeSource(source);
    await applyImport(first.candidate, first.report, { safetyBackup: EMPTY_LEDGER_ACK() });
    const afterFirst = await getDB().shifts.toArray();

    // Second run replaces rather than appends, so a safety backup is required.
    const second = normalizeSource(source);
    const result = await applyImport(second.candidate, second.report, {
      safetyBackup: {
        kind: 'exported',
        acknowledgedAt: new Date().toISOString(),
        filename: 'safety.json',
        byteCount: 1024,
        format: 'dash-ledger-backup-v2',
      },
    });
    expect(result.ok).toBe(true);

    const afterSecond = await getDB().shifts.toArray();
    expect(afterSecond).toHaveLength(afterFirst.length);
    expect(afterSecond.find((s) => s.id === LEGACY_A_MONEY_SHIFT.id)!.appEarningsCents).toBe(8450);
  });
});
