/**
 * Built-in runtime self-test. Operates on pure functions and an isolated,
 * throwaway IndexedDB database. It NEVER touches the user's real ledger.
 */

import Dexie from 'dexie';
import { mondayOf, isWeekTemporallyComplete, addDays } from '../domain/dates';
import { shiftDuration } from '../domain/duration';
import { computeMileage } from '../domain/mileage';
import { effectiveRate, seededMileageRates } from '../domain/mileageRates';
import { parseMoneyToCents, formatCents, grossIncomeCents } from '../domain/money';
import { csvEscape } from './csv';
import { validateBackup } from './restore';
import { buildLedgerOnlyBackup, FULL_FORMAT } from './backup';
import type { BackupSource } from './backup';
import { DEFAULT_SETTINGS } from '../domain/types';

export interface SelfTestCase {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface SelfTestReport {
  ran: string;
  cases: SelfTestCase[];
  passed: number;
  failed: number;
}

function check(name: string, cond: boolean, detail?: string): SelfTestCase {
  return { name, pass: cond, detail: cond ? undefined : detail ?? 'assertion failed' };
}

async function tempDbRoundTrip(): Promise<SelfTestCase[]> {
  const cases: SelfTestCase[] = [];
  const dbName = `dash-ledger-selftest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const db = new Dexie(dbName);
  db.version(1).stores({ items: 'id', blobs: 'id' });
  try {
    await db.open();
    await (db as any).items.put({ id: 'a', n: 42 });
    const got = await (db as any).items.get('a');
    cases.push(check('temp IndexedDB write/read', got?.n === 42, `got ${JSON.stringify(got)}`));
    await (db as any).items.delete('a');
    const gone = await (db as any).items.get('a');
    cases.push(check('temp IndexedDB delete', gone === undefined));

    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/octet-stream' });
    await (db as any).blobs.put({ id: 'b', blob });
    const backB = await (db as any).blobs.get('b');
    const buf = new Uint8Array(await (backB.blob as Blob).arrayBuffer());
    cases.push(check('Blob write/read', buf.length === 4 && buf[3] === 4, `len ${buf.length}`));
  } catch (err) {
    cases.push(check('temp IndexedDB available', false, (err as Error).message));
  } finally {
    db.close();
    try {
      await Dexie.delete(dbName);
    } catch {
      /* best effort */
    }
  }
  return cases;
}

export async function runSelfTest(): Promise<SelfTestReport> {
  const cases: SelfTestCase[] = [];

  // Date / week
  cases.push(check('Monday maps to itself', mondayOf('2026-01-05') === '2026-01-05'));
  cases.push(check('Sunday maps to prior Monday', mondayOf('2026-01-04') === '2025-12-29'));
  cases.push(
    check(
      'Sunday and Monday differ by week',
      mondayOf('2026-01-04') !== mondayOf('2026-01-05'),
    ),
  );
  cases.push(check('leap day is valid', addDays('2024-02-28', 1) === '2024-02-29'));
  cases.push(
    check('week temporally complete after Sunday', isWeekTemporallyComplete('2020-01-06', '2020-01-13')),
  );
  cases.push(
    check('week not complete before Sunday', !isWeekTemporallyComplete('2099-01-05', '2099-01-07')),
  );

  // Duration
  cases.push(check('same-day duration', shiftDuration('09:00', '17:30').hours === 8.5));
  cases.push(check('overnight duration 23:30->01:00 = 1.5', shiftDuration('23:30', '01:00').hours === 1.5));
  cases.push(check('missing time is unknown', shiftDuration('09:00', null).known === false));

  // Mileage
  cases.push(check('1000 -> 1150 = 150', computeMileage(1000, 1150).miles === 150));
  cases.push(check('reversed odometer rejected', computeMileage(1150, 1000).status === 'reversed'));
  {
    const r = computeMileage(0, 900, 400);
    cases.push(check('900-mile dash preserved + flagged', r.miles === 900 && r.status === 'suspicious'));
  }

  // Money
  cases.push(check('80 + 25 = 105', grossIncomeCents(8000, 2500) === 10500));
  cases.push(check('parse $84.50 -> 8450', parseMoneyToCents('$84.50') === 8450));
  cases.push(check('parse blank -> null', parseMoneyToCents('') === null));
  cases.push(check('format 8450 -> $84.50', formatCents(8450) === '$84.50'));

  // Mileage rates
  {
    const rates = seededMileageRates();
    cases.push(check('2026-06-30 rate = 0.725', effectiveRate('2026-06-30', rates)?.ratePerMile === 0.725));
    cases.push(check('2026-07-01 rate = 0.760', effectiveRate('2026-07-01', rates)?.ratePerMile === 0.76));
    cases.push(check('no rate before table -> null', effectiveRate('2000-01-01', rates) === null));
  }

  // CSV
  cases.push(check('CSV escapes quotes', csvEscape('he said "hi"') === '"he said ""hi"""'));
  cases.push(check('CSV escapes comma', csvEscape('a,b') === '"a,b"'));
  cases.push(check('CSV leaves plain text', csvEscape('plain') === 'plain'));

  // Backup serialize/validate round trip
  {
    const src: BackupSource = {
      settings: { ...DEFAULT_SETTINGS },
      meta: {
        schemaVersion: 1,
        appVersion: 'test',
        lastRecordChangeAt: null,
        lastBackupGeneratedAt: null,
        lastArchiveConfirmedAt: null,
        restoredAt: null,
      },
      vehicles: [
        { id: 'v1', label: 'Test Car', archived: false, createdAt: 'x', updatedAt: 'x' },
      ],
      shifts: [],
      expenses: [],
      weeklyClosures: [],
      receipts: [],
      mileageRates: seededMileageRates(),
      merchantMemory: [],
    };
    const backup = buildLedgerOnlyBackup(src);
    const json = JSON.stringify(backup);
    const parsed = JSON.parse(json);
    const v = validateBackup(parsed);
    cases.push(check('ledger-only backup round-trips + validates', v.ok, v.errors.join('; ')));
    const bad = validateBackup({ nope: true });
    cases.push(check('malformed backup rejected', !bad.ok));
    const future = validateBackup({ format: FULL_FORMAT, schemaVersion: 999, settings: {} });
    cases.push(check('future schema rejected', !future.ok));
  }

  cases.push(...(await tempDbRoundTrip()));

  const passed = cases.filter((c) => c.pass).length;
  return {
    ran: new Date().toISOString(),
    cases,
    passed,
    failed: cases.length - passed,
  };
}
