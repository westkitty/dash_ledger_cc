/**
 * Backup validation + atomic restore.
 *
 * Validation runs over the whole payload before anything destructive happens.
 * Restore replaces every authoritative table inside ONE Dexie transaction, so a
 * failure leaves the previous database completely intact.
 *
 * Restore only accepts CANONICAL backups. Files written by earlier lineages go
 * through `services/import/`, which knows how to read them without misreading
 * their money. `validateBackup` names that route explicitly rather than just
 * rejecting the file.
 *
 * Replacing the authoritative ledger also requires a safety-backup
 * acknowledgement — see `services/safetyGate.ts`.
 */

import { getDB } from '../db/db';
import { countCanonicalRecords } from '../db/repositories';
import { SCHEMA_VERSION, type Meta, type Settings } from '../domain/types';
import { isValidLocalDate } from '../domain/dates';
import { isValidLocalTime } from '../domain/duration';
import { dataUrlToBlob } from './receiptImages';
import { logDiagnostic } from './diagnosticsLog';
import {
  BACKUP_FORMAT_VERSION,
  FULL_FORMAT,
  GROK_V1_FORMAT,
  LEDGER_ONLY_FORMAT,
  LEGACY_V1_FORMATS,
} from './backupFormats';
import { checkSafetyGate, type SafetyBackupAcknowledgement } from './safetyGate';
import type { BackupReceipt } from './backup';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  format: string | null;
  hasImages: boolean;
  /**
   * True when the file is a recognised EARLIER Dash Ledger format. It is not a
   * canonical backup and must not be restored directly, but Vault -> Recovery
   * can import it.
   */
  importable?: boolean;
}

const KNOWN_FORMATS = new Set([FULL_FORMAT, LEDGER_ONLY_FORMAT]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumberOrNull(v: unknown): boolean {
  return v === null || (typeof v === 'number' && Number.isFinite(v));
}

const DATA_URL_RE = /^data:([^;,]*)?(;base64)?,.+/s;

export function validateBackup(raw: unknown, supportedSchema = SCHEMA_VERSION): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['Backup root must be a JSON object.'], format: null, hasImages: false };
  }

  const format = typeof raw.format === 'string' ? raw.format : null;
  if (!format || !KNOWN_FORMATS.has(format)) {
    // Point a legacy file at the importer instead of just refusing it.
    if (format && (LEGACY_V1_FORMATS.includes(format) || format === GROK_V1_FORMAT)) {
      return {
        ok: false,
        errors: [
          `"${format}" is an earlier Dash Ledger format, not a canonical backup. Its records use a different money representation, so restoring it directly could misread amounts. Use Vault -> Recovery to import it instead.`,
        ],
        format,
        hasImages: false,
        importable: true,
      };
    }
    errors.push(`Unrecognised backup format marker: ${format ?? '(missing)'}.`);
  }

  if (raw.formatVersion !== undefined && raw.formatVersion !== BACKUP_FORMAT_VERSION) {
    errors.push(
      `Backup envelope version ${String(raw.formatVersion)} is not supported (expected ${BACKUP_FORMAT_VERSION}).`,
    );
  }

  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) {
    errors.push('Backup is missing a numeric schemaVersion.');
  } else if (schemaVersion > supportedSchema) {
    errors.push(
      `Backup schema version ${schemaVersion} is newer than this app supports (${supportedSchema}). Update the app before restoring.`,
    );
  }

  const collections = ['vehicles', 'shifts', 'expenses', 'weeklyClosures', 'receipts', 'mileageRates', 'merchantMemory'];
  for (const c of collections) {
    if (raw[c] !== undefined && !Array.isArray(raw[c])) {
      errors.push(`"${c}" must be an array.`);
    }
  }
  if (raw.settings !== undefined && !isPlainObject(raw.settings)) {
    errors.push('"settings" must be an object.');
  }

  // Bail before deep checks if the shape is already wrong.
  if (errors.length > 0) {
    return { ok: false, errors, format, hasImages: false };
  }

  const vehicles = (raw.vehicles as any[]) ?? [];
  const shifts = (raw.shifts as any[]) ?? [];
  const expenses = (raw.expenses as any[]) ?? [];
  const receipts = (raw.receipts as any[]) ?? [];
  const weeklyClosures = (raw.weeklyClosures as any[]) ?? [];
  const mileageRates = (raw.mileageRates as any[]) ?? [];

  const vehicleIds = new Set<string>();
  vehicles.forEach((v, i) => {
    if (!isPlainObject(v) || typeof v.id !== 'string' || v.id === '') {
      errors.push(`vehicles[${i}] is missing a valid id.`);
      return;
    }
    if (vehicleIds.has(v.id)) errors.push(`Duplicate vehicle id: ${v.id}.`);
    vehicleIds.add(v.id);
    if (typeof v.label !== 'string') errors.push(`vehicles[${i}] label must be a string.`);
  });

  const shiftIds = new Set<string>();
  shifts.forEach((s, i) => {
    if (!isPlainObject(s) || typeof s.id !== 'string' || s.id === '') {
      errors.push(`shifts[${i}] is missing a valid id.`);
      return;
    }
    if (shiftIds.has(s.id)) errors.push(`Duplicate shift id: ${s.id}.`);
    shiftIds.add(s.id);
    if (!isValidLocalDate(s.date)) errors.push(`shifts[${i}] has an invalid work date: ${s.date}.`);
    if (s.status !== 'active' && s.status !== 'completed') {
      errors.push(`shifts[${i}] has an invalid status: ${s.status}.`);
    }
    for (const f of ['startOdometer', 'endOdometer', 'appEarningsCents', 'cashTipsCents']) {
      if (!isFiniteNumberOrNull(s[f])) errors.push(`shifts[${i}].${f} must be a finite number or null.`);
    }
    if (s.startTime !== null && s.startTime !== undefined && !isValidLocalTime(s.startTime)) {
      errors.push(`shifts[${i}].startTime is not a valid HH:mm value.`);
    }
    if (s.endTime !== null && s.endTime !== undefined && !isValidLocalTime(s.endTime)) {
      errors.push(`shifts[${i}].endTime is not a valid HH:mm value.`);
    }
    if (typeof s.vehicleId === 'string' && s.vehicleId !== '' && vehicleIds.size > 0 && !vehicleIds.has(s.vehicleId)) {
      errors.push(`shifts[${i}] references unknown vehicleId ${s.vehicleId}.`);
    }
  });

  const activeCount = shifts.filter((s) => isPlainObject(s) && s.status === 'active').length;
  if (activeCount > 1) errors.push(`Backup contains ${activeCount} active dashes; at most one is allowed.`);

  const expenseIds = new Set<string>();
  expenses.forEach((e, i) => {
    if (!isPlainObject(e) || typeof e.id !== 'string' || e.id === '') {
      errors.push(`expenses[${i}] is missing a valid id.`);
      return;
    }
    if (expenseIds.has(e.id)) errors.push(`Duplicate expense id: ${e.id}.`);
    expenseIds.add(e.id);
    if (!isValidLocalDate(e.date)) errors.push(`expenses[${i}] has an invalid date: ${e.date}.`);
    if (typeof e.amountCents !== 'number' || !Number.isFinite(e.amountCents)) {
      errors.push(`expenses[${i}].amountCents must be a finite number.`);
    }
  });

  const receiptIds = new Set<string>();
  receipts.forEach((r: BackupReceipt | any, i: number) => {
    if (!isPlainObject(r) || typeof r.id !== 'string' || r.id === '') {
      errors.push(`receipts[${i}] is missing a valid id.`);
      return;
    }
    if (receiptIds.has(r.id)) errors.push(`Duplicate receipt id: ${r.id}.`);
    receiptIds.add(r.id);
    if (r.date !== null && r.date !== undefined && !isValidLocalDate(r.date)) {
      errors.push(`receipts[${i}] has an invalid date: ${r.date}.`);
    }
    if (!isFiniteNumberOrNull(r.amountCents)) errors.push(`receipts[${i}].amountCents must be a finite number or null.`);
    if (r.status !== 'Inbox' && r.status !== 'Classified') {
      errors.push(`receipts[${i}] has an invalid status: ${r.status}.`);
    }
    if (r.image !== null && r.image !== undefined) {
      if (!isPlainObject(r.image)) {
        errors.push(`receipts[${i}].image must be an object or null.`);
      } else {
        if (typeof r.image.dataUrl !== 'string' || !DATA_URL_RE.test(r.image.dataUrl)) {
          errors.push(`receipts[${i}].image.dataUrl is not a valid data URL.`);
        }
        if (r.image.byteCount !== undefined && !isFiniteNumberOrNull(r.image.byteCount)) {
          errors.push(`receipts[${i}].image.byteCount must be a number.`);
        }
      }
    }
  });

  // Cross-links should be sensible (unknown ids are cleared on restore, not fatal,
  // but a dangling link to a totally absent set is worth flagging).
  expenses.forEach((e, i) => {
    if (typeof e.receiptId === 'string' && receiptIds.size > 0 && !receiptIds.has(e.receiptId)) {
      errors.push(`expenses[${i}] links to unknown receiptId ${e.receiptId}.`);
    }
    if (typeof e.shiftId === 'string' && shiftIds.size > 0 && !shiftIds.has(e.shiftId)) {
      errors.push(`expenses[${i}] links to unknown shiftId ${e.shiftId}.`);
    }
  });

  weeklyClosures.forEach((w, i) => {
    if (!isPlainObject(w) || !isValidLocalDate(w.weekKey)) {
      errors.push(`weeklyClosures[${i}] has an invalid weekKey.`);
    }
  });

  mileageRates.forEach((m, i) => {
    if (!isPlainObject(m) || typeof m.id !== 'string') {
      errors.push(`mileageRates[${i}] is missing an id.`);
      return;
    }
    if (!isValidLocalDate(m.startDate)) errors.push(`mileageRates[${i}].startDate is invalid.`);
    if (m.endDate !== null && m.endDate !== undefined && !isValidLocalDate(m.endDate)) {
      errors.push(`mileageRates[${i}].endDate is invalid.`);
    }
    if (typeof m.ratePerMile !== 'number' || !(m.ratePerMile > 0)) {
      errors.push(`mileageRates[${i}].ratePerMile must be a positive number.`);
    }
  });

  const hasImages = format === FULL_FORMAT && receipts.some((r) => isPlainObject(r) && r.image);

  return { ok: errors.length === 0, errors, format, hasImages };
}

export interface RestoreOptions {
  /**
   * Proof that the ledger about to be replaced is either backed up or empty.
   * Required: a restore destroys the authoritative ledger.
   */
  safetyBackup: SafetyBackupAcknowledgement | null;
}

export interface RestoreResult {
  ok: boolean;
  error?: string;
  /** True when the caller must produce a safety backup and retry. */
  needsSafetyBackup?: boolean;
  restoredCounts?: Record<string, number>;
}

/**
 * Atomically replace the database contents from a validated backup. Every write
 * happens inside a single transaction; any failure aborts and rolls back.
 */
export async function restoreBackup(raw: unknown, options: RestoreOptions): Promise<RestoreResult> {
  const validation = validateBackup(raw);
  if (!validation.ok) {
    return { ok: false, error: `Backup failed validation:\n- ${validation.errors.join('\n- ')}` };
  }

  // Nothing destructive has happened yet. The safety gate runs before the first
  // write and re-verifies any "there is nothing to lose" claim itself.
  const existingRecords = await countCanonicalRecords();
  const gate = checkSafetyGate(options?.safetyBackup, existingRecords);
  if (!gate.ok) {
    return { ok: false, error: gate.error, needsSafetyBackup: gate.needsSafetyBackup };
  }

  const backup = raw as Record<string, any>;
  const db = getDB();

  // Prepare receipt blobs OUTSIDE the transaction (decoding can't fail it midway).
  const receiptRows: any[] = [];
  const blobRows: any[] = [];
  for (const r of (backup.receipts as any[]) ?? []) {
    const { image, ...meta } = r;
    receiptRows.push(meta);
    if (image && typeof image.dataUrl === 'string') {
      try {
        const blob = dataUrlToBlob(image.dataUrl);
        blobRows.push({
          receiptId: r.id,
          image: blob,
          thumbnail: null,
          mimeType: blob.type || meta.mimeType || 'application/octet-stream',
          byteCount: blob.size,
        });
      } catch (err) {
        return { ok: false, error: `Receipt ${r.id} image payload could not be decoded: ${(err as Error).message}` };
      }
    }
  }

  // Repair dangling cross-links so the restored DB is internally consistent.
  const shiftIds = new Set((backup.shifts as any[])?.map((s) => s.id) ?? []);
  const receiptIds = new Set(receiptRows.map((r) => r.id));
  const expenseIds = new Set((backup.expenses as any[])?.map((e) => e.id) ?? []);
  const expenseRows = ((backup.expenses as any[]) ?? []).map((e) => ({
    ...e,
    shiftId: e.shiftId && shiftIds.has(e.shiftId) ? e.shiftId : null,
    receiptId: e.receiptId && receiptIds.has(e.receiptId) ? e.receiptId : null,
  }));
  const cleanedReceiptRows = receiptRows.map((r) => ({
    ...r,
    expenseId: r.expenseId && expenseIds.has(r.expenseId) ? r.expenseId : null,
  }));

  try {
    await db.transaction(
      'rw',
      [
        db.vehicles,
        db.shifts,
        db.expenses,
        db.receipts,
        db.receiptBlobs,
        db.weeklyClosures,
        db.mileageRates,
        db.merchantMemory,
        db.kv,
      ],
      async () => {
        await Promise.all([
          db.vehicles.clear(),
          db.shifts.clear(),
          db.expenses.clear(),
          db.receipts.clear(),
          db.receiptBlobs.clear(),
          db.weeklyClosures.clear(),
          db.mileageRates.clear(),
          db.merchantMemory.clear(),
        ]);
        if (backup.vehicles?.length) await db.vehicles.bulkPut(backup.vehicles);
        if (backup.shifts?.length) await db.shifts.bulkPut(backup.shifts);
        if (expenseRows.length) await db.expenses.bulkPut(expenseRows);
        if (cleanedReceiptRows.length) await db.receipts.bulkPut(cleanedReceiptRows);
        if (blobRows.length) await db.receiptBlobs.bulkPut(blobRows);
        if (backup.weeklyClosures?.length) await db.weeklyClosures.bulkPut(backup.weeklyClosures);
        if (backup.mileageRates?.length) await db.mileageRates.bulkPut(backup.mileageRates);
        if (backup.merchantMemory?.length) await db.merchantMemory.bulkPut(backup.merchantMemory);

        const settings: Settings = { ...(backup.settings ?? {}) };
        await db.kv.put({ key: 'settings', value: settings });
        const meta: Meta = {
          schemaVersion: SCHEMA_VERSION,
          appVersion: backup.appVersion ?? '',
          lastRecordChangeAt: backup.meta?.lastRecordChangeAt ?? new Date().toISOString(),
          lastBackupGeneratedAt: backup.meta?.lastBackupGeneratedAt ?? null,
          lastArchiveConfirmedAt: backup.meta?.lastArchiveConfirmedAt ?? null,
          restoredAt: new Date().toISOString(),
          persistRequestedAt: backup.meta?.persistRequestedAt ?? null,
          lastImportAt: backup.meta?.lastImportAt ?? null,
        };
        await db.kv.put({ key: 'meta', value: meta });
      },
    );
  } catch (err) {
    logDiagnostic('restore', 'Restore transaction failed and was rolled back.', err);
    return { ok: false, error: `Restore failed and was rolled back: ${(err as Error).message}` };
  }

  return {
    ok: true,
    restoredCounts: {
      vehicles: backup.vehicles?.length ?? 0,
      shifts: backup.shifts?.length ?? 0,
      expenses: expenseRows.length,
      receipts: cleanedReceiptRows.length,
      receiptImages: blobRows.length,
      weeklyClosures: backup.weeklyClosures?.length ?? 0,
      mileageRates: backup.mileageRates?.length ?? 0,
    },
  };
}
