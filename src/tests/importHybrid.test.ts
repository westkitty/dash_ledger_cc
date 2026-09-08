/**
 * The hybrid A -> B database case.
 *
 * If the original app wrote records and an early `dash_ledger_cc` build later
 * opened the SAME database, Dexie bumped its version and the store ended up
 * holding original-era rows, cc-era rows, and rows carrying both money
 * representations at once. This is the state the canonical rename exists to
 * prevent, and the state the importer has to be able to recover from.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { getDB } from '../db/db';
import { normalizeSource } from '../services/import/normalize';
import { detectSource } from '../services/import/detect';
import { applyImport } from '../services/import/apply';
import { makeNoExistingDataAcknowledgement } from '../services/safetyGate';
import { formatCents } from '../domain/money';
import { LEGACY_A_MONEY_SHIFT } from './fixtures/legacySources';

const ACK = () => makeNoExistingDataAcknowledgement();

/** A dash carrying only the original app's dollar fields. */
function aOnlyShift(over: Record<string, unknown> = {}) {
  return { ...LEGACY_A_MONEY_SHIFT, id: 'a-only', appEarnings: 96.5, cashTips: 0, ...over };
}

/** A dash carrying only cc's integer-cent fields. */
function bOnlyShift(over: Record<string, unknown> = {}) {
  return {
    id: 'b-only',
    status: 'completed',
    date: '2026-09-08',
    vehicleId: LEGACY_A_MONEY_SHIFT.vehicleId,
    startTime: '10:00',
    endTime: '15:00',
    startOdometer: 1000,
    endOdometer: 1150,
    appEarningsCents: 9650,
    cashTipsCents: 0,
    purpose: 'DoorDash delivery work',
    notes: '',
    createdAt: 'x',
    updatedAt: 'x',
    ...over,
  };
}

/** A dash that somehow ended up with BOTH representations. */
function bothShift(id: string, dollars: unknown, cents: unknown) {
  return { ...LEGACY_A_MONEY_SHIFT, id, appEarnings: dollars, appEarningsCents: cents, cashTips: 0 };
}

function hybridBackup(shifts: unknown[]) {
  return {
    format: 'dash-ledger-backup',
    schemaVersion: 1,
    generatedAt: '2026-09-08T18:25:45.934Z',
    settings: { defaultVehicleId: LEGACY_A_MONEY_SHIFT.vehicleId },
    vehicles: [
      {
        id: LEGACY_A_MONEY_SHIFT.vehicleId,
        label: 'My car',
        createdAt: 'x',
        updatedAt: 'x',
      },
    ],
    shifts,
    expenses: [],
    receipts: [],
    weeklyClosures: [],
  };
}

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

describe('hybrid source detection', () => {
  it('detects a database holding rows from both lineages', () => {
    const d = detectSource(hybridBackup([aOnlyShift(), bOnlyShift()]));
    expect(d.format).toBe('dash-ledger-v1');
    expect(d.variant).toBe('mixed');
  });

  it('inspects record shape, so the marker alone never decides', () => {
    // Identical markers, different bodies, different variants.
    expect(detectSource(hybridBackup([aOnlyShift()])).variant).toBe('legacy-a');
    expect(detectSource(hybridBackup([bOnlyShift()])).variant).toBe('cc-b');
  });
});

describe('per-row money resolution in a hybrid database', () => {
  it('A-only rows convert, B-only rows pass through, in the same import', async () => {
    const src = hybridBackup([aOnlyShift(), bOnlyShift()]);
    const { candidate, report } = normalizeSource(src);
    const result = await applyImport(candidate, report, { safetyBackup: ACK() });
    expect(result.ok).toBe(true);

    const db = getDB();
    expect((await db.shifts.get('a-only'))!.appEarningsCents).toBe(9650);
    expect((await db.shifts.get('b-only'))!.appEarningsCents).toBe(9650);
    expect(formatCents((await db.shifts.get('a-only'))!.appEarningsCents)).toBe('$96.50');
  });

  it('equivalent duplicate fields resolve without ambiguity', async () => {
    const src = hybridBackup([bothShift('agreed', 96.5, 9650)]);
    const { candidate, report } = normalizeSource(src);
    await applyImport(candidate, report, { safetyBackup: ACK() });

    expect((await getDB().shifts.get('agreed'))!.appEarningsCents).toBe(9650);
    expect(report.totals.conflicts).toBe(0);
  });

  it('contradictory duplicate fields are surfaced, never silently resolved', async () => {
    const src = hybridBackup([bothShift('conflicted', 96.5, 4200)]);
    const { candidate, report } = normalizeSource(src);

    const conflict = report.issues.find(
      (i) => i.code === 'money-conflict' && i.recordId === 'conflicted',
    );
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe('conflict');
    expect(report.totals.conflicts).toBe(1);

    // Both source values are preserved for a human to resolve.
    expect(conflict!.evidence).toMatchObject({
      legacyDollars: 96.5,
      legacyAsCents: 9650,
      canonicalCents: 4200,
    });

    await applyImport(candidate, report, { safetyBackup: ACK() });
    const shift = await getDB().shifts.get('conflicted');

    // Neither figure was adopted. The dash itself is still recovered.
    expect(shift).toBeDefined();
    expect(shift!.appEarningsCents).toBeNull();
    expect(shift!.appEarningsCents).not.toBe(9650);
    expect(shift!.appEarningsCents).not.toBe(4200);
    expect(shift!.startOdometer).toBe(1000);
    expect(shift!.date).toBe('2026-09-08');
  });

  it('keeps the conflict evidence in the persisted audit trail', async () => {
    const src = hybridBackup([bothShift('conflicted', 96.5, 4200)]);
    const { candidate, report } = normalizeSource(src);
    await applyImport(candidate, report, { safetyBackup: ACK() });

    const rows = await getDB().importReports.toArray();
    const stored = rows[0].report.issues.find((i) => i.recordId === 'conflicted');
    expect(stored!.evidence).toMatchObject({ legacyAsCents: 9650, canonicalCents: 4200 });
  });

  it('missing money stays missing and is never turned into zero', async () => {
    const src = hybridBackup([
      { ...LEGACY_A_MONEY_SHIFT, id: 'absent', appEarnings: undefined, cashTips: undefined, grossIncome: undefined },
    ]);
    const { candidate, report } = normalizeSource(src);
    await applyImport(candidate, report, { safetyBackup: ACK() });

    const shift = await getDB().shifts.get('absent');
    expect(shift!.appEarningsCents).toBeNull();
    expect(shift!.cashTipsCents).toBeNull();
    expect(shift!.appEarningsCents).not.toBe(0);
    expect(formatCents(shift!.appEarningsCents)).toBe('—'); // "unknown", not "$0.00"
  });

  it('preserves an explicit zero as zero', async () => {
    const src = hybridBackup([{ ...LEGACY_A_MONEY_SHIFT, id: 'zeroed', appEarnings: 0, cashTips: 0 }]);
    const { candidate, report } = normalizeSource(src);
    await applyImport(candidate, report, { safetyBackup: ACK() });

    const shift = await getDB().shifts.get('zeroed');
    expect(shift!.appEarningsCents).toBe(0);
    expect(formatCents(shift!.appEarningsCents)).toBe('$0.00');
  });

  it('handles all five classes together without cross-contamination', async () => {
    const src = hybridBackup([
      aOnlyShift(),
      bOnlyShift(),
      bothShift('agreed', 96.5, 9650),
      bothShift('conflicted', 96.5, 4200),
      { ...LEGACY_A_MONEY_SHIFT, id: 'absent', appEarnings: null, cashTips: null },
    ]);
    const { candidate, report } = normalizeSource(src);
    const result = await applyImport(candidate, report, { safetyBackup: ACK() });
    expect(result.ok).toBe(true);

    const db = getDB();
    expect((await db.shifts.get('a-only'))!.appEarningsCents).toBe(9650);
    expect((await db.shifts.get('b-only'))!.appEarningsCents).toBe(9650);
    expect((await db.shifts.get('agreed'))!.appEarningsCents).toBe(9650);
    expect((await db.shifts.get('conflicted'))!.appEarningsCents).toBeNull();
    expect((await db.shifts.get('absent'))!.appEarningsCents).toBeNull();

    // Every dash is recovered; only the unresolved amount is withheld.
    expect(await db.shifts.count()).toBe(5);
    expect(report.totals.conflicts).toBe(1);
  });
});

describe('expenses, whose amount has no canonical "unknown"', () => {
  function expenseSource(expense: Record<string, unknown>) {
    return { ...hybridBackup([aOnlyShift()]), expenses: [expense] };
  }

  it('imports an unambiguous expense', async () => {
    const { candidate, report } = normalizeSource(
      expenseSource({ id: 'e-ok', date: '2026-09-08', amount: 40.25, category: 'Fuel' }),
    );
    await applyImport(candidate, report, { safetyBackup: ACK() });
    expect((await getDB().expenses.get('e-ok'))!.amountCents).toBe(4025);
  });

  it('does not import an expense whose amount is contradictory, and keeps the evidence', async () => {
    const { candidate, report } = normalizeSource(
      expenseSource({
        id: 'e-conflict',
        date: '2026-09-08',
        amount: 40.25,
        amountCents: 9999,
        merchant: 'Shell',
        category: 'Fuel',
      }),
    );
    await applyImport(candidate, report, { safetyBackup: ACK() });

    expect(await getDB().expenses.get('e-conflict')).toBeUndefined();
    const issue = report.issues.find((i) => i.recordId === 'e-conflict');
    expect(issue!.severity).toBe('conflict');
    expect(issue!.evidence).toMatchObject({
      merchant: 'Shell',
      legacyAsCents: 4025,
      canonicalCents: 9999,
    });
  });

  it('does not invent a zero for an expense with no amount at all', async () => {
    const { candidate, report } = normalizeSource(
      expenseSource({ id: 'e-absent', date: '2026-09-08', merchant: 'Shell', category: 'Fuel' }),
    );
    await applyImport(candidate, report, { safetyBackup: ACK() });

    expect(await getDB().expenses.get('e-absent')).toBeUndefined();
    const issue = report.issues.find((i) => i.recordId === 'e-absent');
    expect(issue!.code).toBe('missing-amount');
    expect(issue!.severity).toBe('rejected');
    expect(report.totals.rejected).toBe(1);
  });

  it('one unusable row does not block the rest of the dataset', async () => {
    const src = {
      ...hybridBackup([aOnlyShift(), bOnlyShift()]),
      expenses: [
        { id: 'e-good', date: '2026-09-08', amount: 10, category: 'Fuel' },
        { id: 'e-bad', date: '2026-09-08', amount: 10, amountCents: 5000, category: 'Fuel' },
        { id: 'e-good-2', date: '2026-09-08', amount: 20, category: 'Tolls' },
      ],
    };
    const { candidate, report } = normalizeSource(src);
    const result = await applyImport(candidate, report, { safetyBackup: ACK() });
    expect(result.ok).toBe(true);

    const db = getDB();
    expect(await db.expenses.count()).toBe(2);
    expect((await db.expenses.get('e-good'))!.amountCents).toBe(1000);
    expect((await db.expenses.get('e-good-2'))!.amountCents).toBe(2000);
    expect(await db.shifts.count()).toBe(2);
    expect(report.totals.conflicts).toBe(1);
  });
});

describe('hybrid import reporting', () => {
  it('reports imported / warning / conflict / rejected counts and the source type', () => {
    const src = {
      ...hybridBackup([aOnlyShift(), bothShift('conflicted', 96.5, 4200)]),
      expenses: [{ id: 'e-absent', date: '2026-09-08', category: 'Fuel' }],
    };
    const { report } = normalizeSource(src, 'hybrid fixture');

    expect(report.sourceFormat).toBe('dash-ledger-v1');
    expect(report.sourceVariant).toBe('mixed');
    expect(report.sourceLabel).toBe('hybrid fixture');
    expect(report.sourceSchemaVersion).toBe(1);
    expect(report.totals.imported).toBeGreaterThan(0);
    expect(report.totals.conflicts).toBe(1);
    expect(report.totals.rejected).toBe(1);
    expect(report.imported.shifts).toBe(2);
    expect(report.imported.expenses).toBe(0);
  });
});
