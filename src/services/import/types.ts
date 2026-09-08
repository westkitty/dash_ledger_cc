/**
 * Import boundary types.
 *
 * A legacy source (backup file or read-only legacy database) is turned into an
 * `ImportCandidate` of purely canonical records plus a report of everything that
 * could not be resolved cleanly. Nothing outside `services/import/` needs to
 * know that dollar-denominated or differently-named source fields ever existed.
 */

import type {
  Expense,
  MerchantMemoryEntry,
  Meta,
  MileageRate,
  Receipt,
  Settings,
  Shift,
  Vehicle,
  WeeklyClosure,
} from '../../domain/types';

/** Backup / database dialects this build can read. */
export type SourceFormat =
  | 'canonical-v2'
  /** The ambiguous `dash-ledger-backup` marker, written by BOTH the original app and early cc builds. */
  | 'dash-ledger-v1'
  | 'grok-v1'
  | 'unknown';

/** Which lineage actually produced the rows, determined by inspecting record shape. */
export type SourceVariant =
  | 'canonical'
  /** Original single-file DASH_LEDGER: dollar money fields. */
  | 'legacy-a'
  /** Early dash_ledger_cc: integer-cent money fields. */
  | 'cc-b'
  /** Rows from both lineages in one source — the hybrid A -> B database case. */
  | 'mixed'
  | 'grok'
  | 'unknown';

export type ImportIssueSeverity = 'warning' | 'conflict' | 'rejected';

export interface ImportIssue {
  severity: ImportIssueSeverity;
  /** Stable machine code, e.g. `money-conflict`, `invalid-date`. */
  code: string;
  recordType: 'vehicle' | 'shift' | 'expense' | 'receipt' | 'weeklyClosure' | 'mileageRate' | 'settings' | 'source';
  recordId: string | null;
  message: string;
  /** Both source representations for a conflict, so a human can resolve it later. */
  evidence?: Record<string, string | number | boolean | null>;
}

/** Fully canonical records ready to be written, plus the images that go with them. */
export interface ImportCandidate {
  vehicles: Vehicle[];
  shifts: Shift[];
  expenses: Expense[];
  receipts: Receipt[];
  /** Receipt images still in data-URL form; decoded to Blobs just before the write. */
  receiptImages: Array<{ receiptId: string; dataUrl: string }>;
  weeklyClosures: WeeklyClosure[];
  mileageRates: MileageRate[];
  merchantMemory: MerchantMemoryEntry[];
  settings: Settings;
  meta: Partial<Meta>;
}

export interface ImportCounts {
  vehicles: number;
  shifts: number;
  expenses: number;
  receipts: number;
  receiptImages: number;
  weeklyClosures: number;
  mileageRates: number;
  merchantMemory: number;
}

export interface ImportReport {
  sourceFormat: SourceFormat;
  sourceVariant: SourceVariant;
  sourceLabel: string;
  sourceSchemaVersion: number | null;
  sourceGeneratedAt: string | null;
  /** Records that will be / were written. */
  imported: ImportCounts;
  totals: {
    imported: number;
    warnings: number;
    conflicts: number;
    rejected: number;
  };
  issues: ImportIssue[];
  /** Source fields with no canonical home. The source itself is never modified. */
  unsupportedFields: string[];
  /** Non-blocking observations worth showing the user (not issues). */
  notes: string[];
  /** True when the candidate is safe to write. False means nothing should be applied. */
  ok: boolean;
  /** Populated when `ok` is false. */
  errors: string[];
}

/** Persisted audit row. Canonical records stay clean; conflicts live here. */
export interface ImportReportRecord {
  id: string;
  createdAt: string;
  report: ImportReport;
}

export interface ImportAnalysis {
  candidate: ImportCandidate;
  report: ImportReport;
}

export function emptyCounts(): ImportCounts {
  return {
    vehicles: 0,
    shifts: 0,
    expenses: 0,
    receipts: 0,
    receiptImages: 0,
    weeklyClosures: 0,
    mileageRates: 0,
    merchantMemory: 0,
  };
}

export function summariseIssues(issues: ImportIssue[]): {
  warnings: number;
  conflicts: number;
  rejected: number;
} {
  let warnings = 0;
  let conflicts = 0;
  let rejected = 0;
  for (const i of issues) {
    if (i.severity === 'warning') warnings += 1;
    else if (i.severity === 'conflict') conflicts += 1;
    else rejected += 1;
  }
  return { warnings, conflicts, rejected };
}
