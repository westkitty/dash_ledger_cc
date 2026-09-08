/**
 * The legacy compatibility boundary.
 *
 * Everything the app knows about earlier Dash Ledger representations lives under
 * this directory and terminates here. Repositories, the domain layer and every
 * component deal only in canonical records.
 *
 *   detect  ->  normalize  ->  (report + candidate)  ->  apply
 */

export { detectSource, isImportable, type Detection } from './detect';
export { normalizeSource } from './normalize';
export { applyImport, listImportReports, type ApplyImportOptions, type ApplyImportResult } from './apply';
export {
  scanLegacyDatabases,
  readLegacyDatabase,
  type LegacyDatabaseInfo,
  type LegacyScanResult,
} from './legacyDb';
export {
  legacyDollarsToCents,
  resolveMoneyField,
  isBlockingMoneyStatus,
  type MoneyFieldResolution,
  type MoneyFieldStatus,
} from './legacyMoney';
export type {
  ImportAnalysis,
  ImportCandidate,
  ImportCounts,
  ImportIssue,
  ImportIssueSeverity,
  ImportReport,
  ImportReportRecord,
  SourceFormat,
  SourceVariant,
} from './types';

import { normalizeSource } from './normalize';
import { readLegacyDatabase } from './legacyDb';
import type { ImportAnalysis } from './types';

/**
 * Analyse a legacy database without writing anything, anywhere.
 *
 * Running this repeatedly is safe and produces the same result each time: the
 * source is only read, and normalisation is a pure function of what it holds.
 */
export async function analyseLegacyDatabase(name: string): Promise<ImportAnalysis | null> {
  const doc = await readLegacyDatabase(name);
  if (!doc) return null;
  return normalizeSource(doc, `Legacy database "${name}"`);
}
