/**
 * Full + ledger-only backup serialisation.
 *
 * Full backup ("dash-ledger-backup-v2") embeds every receipt image as a data URL
 * so the file is self-sufficient. Ledger-only ("dash-ledger-ledger-only-v2")
 * keeps all receipt metadata but omits image bytes and is explicitly not
 * image-restorable.
 *
 * The v1 markers used by earlier lineages are never written here — see
 * `services/backupFormats.ts` for why they cannot be trusted to identify a body.
 */

import type {
  Expense,
  MerchantMemoryEntry,
  MileageRate,
  Receipt,
  Settings,
  Shift,
  Vehicle,
  WeeklyClosure,
  Meta,
} from '../domain/types';
import { SCHEMA_VERSION } from '../domain/types';
import { APP_VERSION } from '../db/db';
import { getDB } from '../db/db';
import { getReceiptBlob } from '../db/repositories';
import { blobToDataUrl } from './receiptImages';
import { BACKUP_FORMAT_VERSION, FULL_FORMAT, LEDGER_ONLY_FORMAT } from './backupFormats';

export { BACKUP_FORMAT_VERSION, FULL_FORMAT, LEDGER_ONLY_FORMAT };

/** Identifies which build produced a file, for support and future migrations. */
export const BACKUP_PRODUCER = `dash-ledger-canonical@${APP_VERSION}`;

export interface BackupImage {
  dataUrl: string;
  mimeType: string;
  byteCount: number;
}

export interface BackupReceipt extends Receipt {
  image: BackupImage | null;
}

export interface BackupCounts {
  vehicles: number;
  shifts: number;
  expenses: number;
  receipts: number;
  weeklyClosures: number;
  mileageRates: number;
  merchantMemory: number;
}

export interface FullBackup {
  format: typeof FULL_FORMAT;
  /** Envelope discriminator. Separates this body from the ambiguous v1 marker. */
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  schemaVersion: number;
  appVersion: string;
  producer: string;
  generatedAt: string;
  counts: BackupCounts;
  settings: Settings;
  meta: Meta;
  vehicles: Vehicle[];
  shifts: Shift[];
  expenses: Expense[];
  weeklyClosures: WeeklyClosure[];
  receipts: BackupReceipt[];
  mileageRates: MileageRate[];
  merchantMemory: MerchantMemoryEntry[];
}

export interface LedgerOnlyBackup extends Omit<FullBackup, 'format' | 'receipts'> {
  format: typeof LEDGER_ONLY_FORMAT;
  imagesOmitted: true;
  receipts: Receipt[];
}

export interface BackupSource {
  settings: Settings;
  meta: Meta;
  vehicles: Vehicle[];
  shifts: Shift[];
  expenses: Expense[];
  weeklyClosures: WeeklyClosure[];
  receipts: Receipt[];
  mileageRates: MileageRate[];
  merchantMemory: MerchantMemoryEntry[];
}

function counts(src: BackupSource): BackupCounts {
  return {
    vehicles: src.vehicles.length,
    shifts: src.shifts.length,
    expenses: src.expenses.length,
    receipts: src.receipts.length,
    weeklyClosures: src.weeklyClosures.length,
    mileageRates: src.mileageRates.length,
    merchantMemory: src.merchantMemory.length,
  };
}

export async function buildFullBackup(
  src: BackupSource,
  loadBlob: (receiptId: string) => Promise<Blob | null> = defaultLoadBlob,
): Promise<FullBackup> {
  const receipts: BackupReceipt[] = [];
  for (const r of src.receipts) {
    let image: BackupImage | null = null;
    try {
      const blob = await loadBlob(r.id);
      if (blob) {
        image = {
          dataUrl: await blobToDataUrl(blob),
          mimeType: blob.type || r.mimeType,
          byteCount: blob.size,
        };
      }
    } catch {
      image = null;
    }
    receipts.push({ ...r, image });
  }
  return {
    format: FULL_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    producer: BACKUP_PRODUCER,
    generatedAt: new Date().toISOString(),
    counts: counts(src),
    settings: src.settings,
    meta: src.meta,
    vehicles: src.vehicles,
    shifts: src.shifts,
    expenses: src.expenses,
    weeklyClosures: src.weeklyClosures,
    receipts,
    mileageRates: src.mileageRates,
    merchantMemory: src.merchantMemory,
  };
}

export function buildLedgerOnlyBackup(src: BackupSource): LedgerOnlyBackup {
  return {
    format: LEDGER_ONLY_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    producer: BACKUP_PRODUCER,
    generatedAt: new Date().toISOString(),
    imagesOmitted: true,
    counts: counts(src),
    settings: src.settings,
    meta: src.meta,
    vehicles: src.vehicles,
    shifts: src.shifts,
    expenses: src.expenses,
    weeklyClosures: src.weeklyClosures,
    receipts: src.receipts,
    mileageRates: src.mileageRates,
    merchantMemory: src.merchantMemory,
  };
}

async function defaultLoadBlob(receiptId: string): Promise<Blob | null> {
  const row = await getReceiptBlob(receiptId);
  return row?.image ?? null;
}

export function serializeBackup(backup: FullBackup | LedgerOnlyBackup): string {
  return JSON.stringify(backup, null, 2);
}

/** Convenience: pull a BackupSource straight from the DB. */
export async function readBackupSource(): Promise<BackupSource> {
  const db = getDB();
  const [
    vehicles,
    shifts,
    expenses,
    weeklyClosures,
    receipts,
    mileageRates,
    merchantMemory,
    settingsRow,
    metaRow,
  ] = await Promise.all([
    db.vehicles.toArray(),
    db.shifts.toArray(),
    db.expenses.toArray(),
    db.weeklyClosures.toArray(),
    db.receipts.toArray(),
    db.mileageRates.toArray(),
    db.merchantMemory.toArray(),
    db.kv.get('settings'),
    db.kv.get('meta'),
  ]);
  return {
    vehicles,
    shifts,
    expenses,
    weeklyClosures,
    receipts,
    mileageRates,
    merchantMemory,
    settings: (settingsRow?.value as Settings) ?? ({} as Settings),
    meta: (metaRow?.value as Meta) ?? ({} as Meta),
  };
}
