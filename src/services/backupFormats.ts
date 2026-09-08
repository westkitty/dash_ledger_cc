/**
 * Backup format identity.
 *
 * The original single-file app and the first `dash_ledger_cc` build BOTH wrote
 * `format: "dash-ledger-backup"` with `schemaVersion: 1` while carrying
 * incompatible record bodies (dollars vs integer cents). A marker that does not
 * discriminate between incompatible payloads is worse than no marker, because it
 * invites a validator to accept a file it will then misread.
 *
 * The canonical successor therefore writes its own unambiguous marker plus an
 * explicit `formatVersion`. The v1 markers are READ-ONLY: they are recognised by
 * the import adapters in `services/import/` and are never written again.
 */

/** Canonical full backup — includes receipt image bytes. */
export const FULL_FORMAT = 'dash-ledger-backup-v2';
/** Canonical ledger-only export — metadata, no image bytes. Not image-restorable. */
export const LEDGER_ONLY_FORMAT = 'dash-ledger-ledger-only-v2';

/** Envelope discriminator carried by every canonical backup this build writes. */
export const BACKUP_FORMAT_VERSION = 2;

export const CANONICAL_FORMATS: readonly string[] = [FULL_FORMAT, LEDGER_ONLY_FORMAT];

/**
 * Ambiguous v1 markers. Written by the original app AND by early cc builds.
 * Recognised for import only — the actual dialect is decided by record shape.
 */
export const LEGACY_V1_FORMATS: readonly string[] = [
  'dash-ledger-backup',
  'dash-ledger-ledger-only',
];

/** Grok build's native backup marker. */
export const GROK_V1_FORMAT = 'dash-ledger-grok-backup';

export function isCanonicalFormat(format: unknown): boolean {
  return typeof format === 'string' && CANONICAL_FORMATS.includes(format);
}
