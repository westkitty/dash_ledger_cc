/**
 * IndexedDB schema (via Dexie).
 *
 * Schema is explicitly versioned. Migrations get their own `version(n).upgrade()`
 * block below — migration behaviour is never designed around deleting the
 * database, and a migration failure surfaces through the diagnostics log.
 */

import Dexie, { type Table } from 'dexie';
import type {
  Vehicle,
  Shift,
  Expense,
  Receipt,
  ReceiptBlob,
  WeeklyClosure,
  MileageRate,
  MerchantMemoryEntry,
  Settings,
  Meta,
} from '../domain/types';
import { SCHEMA_VERSION } from '../domain/types';
import { logDiagnostic } from '../services/diagnosticsLog';

export const APP_VERSION = '1.0.0';
export const DB_NAME = 'dash-ledger';

export interface KvRow<T = unknown> {
  key: string;
  value: T;
}

export class DashLedgerDB extends Dexie {
  vehicles!: Table<Vehicle, string>;
  shifts!: Table<Shift, string>;
  expenses!: Table<Expense, string>;
  receipts!: Table<Receipt, string>;
  receiptBlobs!: Table<ReceiptBlob, string>;
  weeklyClosures!: Table<WeeklyClosure, string>;
  mileageRates!: Table<MileageRate, string>;
  merchantMemory!: Table<MerchantMemoryEntry, string>;
  kv!: Table<KvRow, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      vehicles: 'id, label, archived, createdAt',
      shifts: 'id, status, date, vehicleId, weekKey, createdAt, updatedAt',
      expenses: 'id, date, category, taxClass, shiftId, receiptId, createdAt',
      receipts: 'id, status, date, capturedAt, expenseId, createdAt',
      receiptBlobs: 'receiptId',
      weeklyClosures: 'weekKey, reviewedAt',
      mileageRates: 'id, startDate',
      merchantMemory: 'merchantKey, updatedAt',
      kv: 'key',
    });

    // Future migrations:
    // this.version(2).stores({ ... }).upgrade(async (tx) => { ... });
  }
}

let _db: DashLedgerDB | null = null;
let _openError: Error | null = null;

export function getDB(): DashLedgerDB {
  if (!_db) {
    _db = new DashLedgerDB();
    _db.on('blocked', () => {
      logDiagnostic('db', 'Database upgrade blocked by another open tab.');
    });
    _db.on('versionchange', () => {
      // Another tab upgraded the DB. Close ours so it isn't stuck on an old version.
      logDiagnostic('db', 'Database version change detected in another tab; closing local connection.');
      _db?.close();
    });
  }
  return _db;
}

export async function openDB(): Promise<DashLedgerDB> {
  const db = getDB();
  if (db.isOpen()) return db;
  try {
    await db.open();
    _openError = null;
    return db;
  } catch (err) {
    _openError = err as Error;
    logDiagnostic('db', `Failed to open database: ${(err as Error).message}`, err);
    throw err;
  }
}

export function lastOpenError(): Error | null {
  return _openError;
}

export function indexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export const KV_KEYS = {
  settings: 'settings',
  meta: 'meta',
} as const;

export function currentSchemaVersion(): number {
  return SCHEMA_VERSION;
}

export type { Settings, Meta };
