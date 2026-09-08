import { describe, it, expect } from 'vitest';
import {
  buildFullBackup,
  buildLedgerOnlyBackup,
  serializeBackup,
  FULL_FORMAT,
  LEDGER_ONLY_FORMAT,
  type BackupSource,
} from '../services/backup';
import { validateBackup } from '../services/restore';
import { seededMileageRates } from '../domain/mileageRates';
import { DEFAULT_SETTINGS } from '../domain/types';
import { makeShift, makeExpense, makeReceipt, makeVehicle } from './factories';

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
    vehicles: [makeVehicle({ id: 'veh-1' })],
    shifts: [makeShift({ id: 'shift-1', vehicleId: 'veh-1' })],
    expenses: [makeExpense({ id: 'exp-1', shiftId: 'shift-1', receiptId: 'rec-1' })],
    weeklyClosures: [],
    receipts: [makeReceipt({ id: 'rec-1', expenseId: 'exp-1' })],
    mileageRates: seededMileageRates(),
    merchantMemory: [],
    ...over,
  };
}

const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=';

describe('backup serialisation', () => {
  it('ledger-only backup round-trips through JSON and validates', () => {
    const backup = buildLedgerOnlyBackup(source());
    expect(backup.format).toBe(LEDGER_ONLY_FORMAT);
    expect(backup.imagesOmitted).toBe(true);
    const parsed = JSON.parse(serializeBackup(backup));
    const v = validateBackup(parsed);
    expect(v.ok).toBe(true);
    expect(v.hasImages).toBe(false);
  });

  it('full backup embeds receipt images as data URLs and validates', async () => {
    const backup = await buildFullBackup(source(), async () =>
      new Blob([Uint8Array.from(atob(tinyPngDataUrl.split(',')[1]), (c) => c.charCodeAt(0))], { type: 'image/png' }),
    );
    expect(backup.format).toBe(FULL_FORMAT);
    expect(backup.receipts[0].image?.dataUrl.startsWith('data:image/png')).toBe(true);
    const parsed = JSON.parse(serializeBackup(backup));
    const v = validateBackup(parsed);
    expect(v.ok).toBe(true);
    expect(v.hasImages).toBe(true);
  });

  it('counts reflect the source collections', () => {
    const backup = buildLedgerOnlyBackup(source());
    expect(backup.counts.vehicles).toBe(1);
    expect(backup.counts.shifts).toBe(1);
    expect(backup.counts.expenses).toBe(1);
    expect(backup.counts.receipts).toBe(1);
  });
});

describe('backup validation', () => {
  it('accepts a complete valid backup', () => {
    expect(validateBackup(buildLedgerOnlyBackup(source())).ok).toBe(true);
  });

  it('rejects a non-object root', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup('nope').ok).toBe(false);
    expect(validateBackup([]).ok).toBe(false);
  });

  it('rejects an unknown format marker', () => {
    const b: any = buildLedgerOnlyBackup(source());
    b.format = 'something-else';
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects a schema version newer than supported', () => {
    const b: any = buildLedgerOnlyBackup(source());
    b.schemaVersion = 999;
    const v = validateBackup(b);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/newer than this app supports/);
  });

  it('rejects missing / non-string ids and duplicates', () => {
    const b: any = buildLedgerOnlyBackup(source());
    b.shifts[0].id = '';
    expect(validateBackup(b).ok).toBe(false);

    const b2: any = buildLedgerOnlyBackup(source({ shifts: [makeShift({ id: 'dup' }), makeShift({ id: 'dup' })] }));
    expect(validateBackup(b2).errors.join(' ')).toMatch(/Duplicate shift id/);
  });

  it('rejects invalid work dates', () => {
    const b: any = buildLedgerOnlyBackup(source());
    b.shifts[0].date = '2026-13-40';
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects a structurally invalid image payload', () => {
    const b: any = buildLedgerOnlyBackup(source());
    b.format = FULL_FORMAT;
    b.receipts[0].image = { dataUrl: 'not-a-data-url', mimeType: 'image/png', byteCount: 10 };
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects more than one active dash', () => {
    const b: any = buildLedgerOnlyBackup(
      source({ shifts: [makeShift({ id: 's1', status: 'active' }), makeShift({ id: 's2', status: 'active' })] }),
    );
    expect(validateBackup(b).errors.join(' ')).toMatch(/active dashes/);
  });

  it('rejects non-array collections and non-object settings', () => {
    expect(validateBackup({ format: LEDGER_ONLY_FORMAT, schemaVersion: 1, shifts: 'x', settings: {} }).ok).toBe(false);
    expect(validateBackup({ format: LEDGER_ONLY_FORMAT, schemaVersion: 1, settings: 5 }).ok).toBe(false);
  });
});
