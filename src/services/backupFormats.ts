/**
 * Backup envelope versions are independent of Dexie's internal schema version.
 * Canonical v2 is READ-ONLY compatibility. New complete exports are v3 because
 * they must carry every Field Intelligence table. Neither changes the DB name.
 */
export const V2_FULL_FORMAT = 'dash-ledger-backup-v2';
export const V2_LEDGER_ONLY_FORMAT = 'dash-ledger-ledger-only-v2';
export const FULL_FORMAT = 'dash-ledger-backup-v3';
export const LEDGER_ONLY_FORMAT = 'dash-ledger-ledger-only-v3';
export const BACKUP_FORMAT_VERSION = 3;
export const CANONICAL_FORMATS: readonly string[] = [
  FULL_FORMAT, LEDGER_ONLY_FORMAT, V2_FULL_FORMAT, V2_LEDGER_ONLY_FORMAT,
];
/** Ambiguous, incompatible first-generation formats — only the importer reads them. */
export const LEGACY_V1_FORMATS: readonly string[] = ['dash-ledger-backup', 'dash-ledger-ledger-only'];
export const GROK_V1_FORMAT = 'dash-ledger-grok-backup';
export function isCanonicalFormat(format: unknown): boolean {
  return typeof format === 'string' && CANONICAL_FORMATS.includes(format);
}
