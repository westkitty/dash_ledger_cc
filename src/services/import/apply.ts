/**
 * Writing an import candidate into the canonical database.
 *
 * Same discipline as restore: every image is decoded BEFORE the transaction
 * opens (a malformed data URL must not abort a half-applied write), the whole
 * replacement happens inside ONE Dexie transaction, and a destructive apply
 * requires a safety-backup acknowledgement.
 *
 * The import report — including the source values behind every unresolved
 * conflict — is written to its own `importReports` table. Canonical records stay
 * clean; legacy evidence lives in the audit trail.
 */

import { getDB, openDB, KV_KEYS, APP_VERSION } from '../../db/db';
import { newId, nowIso, countCanonicalRecords } from '../../db/repositories';
import { SCHEMA_VERSION, type Meta, type Settings } from '../../domain/types';
import { dataUrlToBlob } from '../receiptImages';
import { logDiagnostic } from '../diagnosticsLog';
import {
  checkSafetyGate,
  type SafetyBackupAcknowledgement,
} from '../safetyGate';
import type { ImportCandidate, ImportIssue, ImportReport, ImportReportRecord } from './types';

export interface ApplyImportOptions {
  /**
   * Proof that the current ledger is either backed up or empty. Required — an
   * import replaces the authoritative ledger.
   */
  safetyBackup: SafetyBackupAcknowledgement | null;
}

export interface ApplyImportResult {
  ok: boolean;
  error?: string;
  needsSafetyBackup?: boolean;
  /** Persisted audit row id, when the import was applied. */
  reportId?: string;
  report?: ImportReport;
}

export async function applyImport(
  candidate: ImportCandidate,
  report: ImportReport,
  options: ApplyImportOptions,
): Promise<ApplyImportResult> {
  if (!report.ok) {
    return { ok: false, error: report.errors.join(' ') || 'The source could not be read.' };
  }

  const db = await openDB();

  const existingRecords = await countCanonicalRecords();
  const gate = checkSafetyGate(options.safetyBackup, existingRecords);
  if (!gate.ok) {
    return { ok: false, error: gate.error, needsSafetyBackup: gate.needsSafetyBackup };
  }

  // Decode outside the transaction. A bad image becomes a reported issue, never
  // a half-written database.
  const blobRows: Array<{ receiptId: string; image: Blob; thumbnail: null; mimeType: string; byteCount: number }> = [];
  const decodeIssues: ImportIssue[] = [];
  for (const img of candidate.receiptImages) {
    try {
      const blob = dataUrlToBlob(img.dataUrl);
      blobRows.push({
        receiptId: img.receiptId,
        image: blob,
        thumbnail: null,
        mimeType: blob.type || 'application/octet-stream',
        byteCount: blob.size,
      });
    } catch (err) {
      decodeIssues.push({
        severity: 'warning',
        code: 'image-decode-failed',
        recordType: 'receipt',
        recordId: img.receiptId,
        message: `Receipt ${img.receiptId}: its stored image could not be decoded (${(err as Error).message}). The receipt record was imported without the image; the source file still contains the original bytes.`,
        evidence: { receiptId: img.receiptId, dataUrlPrefix: img.dataUrl.slice(0, 48) },
      });
    }
  }

  const byteCountByReceipt = new Map(blobRows.map((b) => [b.receiptId, b.byteCount]));
  const receipts = candidate.receipts.map((r) => {
    const known = byteCountByReceipt.get(r.id);
    return known === undefined ? r : { ...r, byteCount: known };
  });

  const appliedAt = nowIso();
  const finalReport: ImportReport = {
    ...report,
    issues: [...report.issues, ...decodeIssues],
    imported: { ...report.imported, receiptImages: blobRows.length },
    totals: {
      ...report.totals,
      warnings: report.totals.warnings + decodeIssues.length,
    },
  };
  const reportRecord: ImportReportRecord = {
    id: newId(),
    createdAt: appliedAt,
    report: finalReport,
  };

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
        db.importReports,
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

        if (candidate.vehicles.length) await db.vehicles.bulkPut(candidate.vehicles);
        if (candidate.shifts.length) await db.shifts.bulkPut(candidate.shifts);
        if (candidate.expenses.length) await db.expenses.bulkPut(candidate.expenses);
        if (receipts.length) await db.receipts.bulkPut(receipts);
        if (blobRows.length) await db.receiptBlobs.bulkPut(blobRows);
        if (candidate.weeklyClosures.length) await db.weeklyClosures.bulkPut(candidate.weeklyClosures);
        if (candidate.mileageRates.length) await db.mileageRates.bulkPut(candidate.mileageRates);
        if (candidate.merchantMemory.length) await db.merchantMemory.bulkPut(candidate.merchantMemory);

        const settings: Settings = candidate.settings;
        await db.kv.put({ key: KV_KEYS.settings, value: settings });

        const existingMeta = (await db.kv.get(KV_KEYS.meta))?.value as Partial<Meta> | undefined;
        const meta: Meta = {
          schemaVersion: SCHEMA_VERSION,
          appVersion: APP_VERSION,
          lastRecordChangeAt: candidate.meta.lastRecordChangeAt ?? appliedAt,
          lastBackupGeneratedAt: candidate.meta.lastBackupGeneratedAt ?? null,
          // Importing a file is not the same as having archived one.
          lastArchiveConfirmedAt: candidate.meta.lastArchiveConfirmedAt ?? null,
          restoredAt: existingMeta?.restoredAt ?? null,
          persistRequestedAt: existingMeta?.persistRequestedAt ?? null,
          lastImportAt: appliedAt,
        };
        await db.kv.put({ key: KV_KEYS.meta, value: meta });

        await db.importReports.put(reportRecord);
      },
    );
  } catch (err) {
    logDiagnostic('import', 'Import transaction failed and was rolled back.', err);
    return {
      ok: false,
      error: `Import failed and was rolled back — your existing records were left in place: ${(err as Error).message}`,
    };
  }

  logDiagnostic(
    'import',
    `Imported ${finalReport.totals.imported} records from ${finalReport.sourceLabel} (${finalReport.totals.conflicts} conflicts, ${finalReport.totals.warnings} warnings, ${finalReport.totals.rejected} rejected).`,
  );

  return { ok: true, reportId: reportRecord.id, report: finalReport };
}

/** Most recent import audit rows, newest first. */
export async function listImportReports(limit = 10): Promise<ImportReportRecord[]> {
  const db = getDB();
  const all = await db.importReports.toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
