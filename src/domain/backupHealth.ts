/**
 * Backup / external-archive health.
 *
 * Generating a backup file is NOT the same as archiving it somewhere safe. The
 * user confirms an external archive explicitly; that timestamp drives status.
 */

export type BackupStatus = 'safe' | 'due' | 'overdue';

export interface BackupHealthInput {
  hasRecords: boolean;
  /** Most recent meaningful record change. */
  lastRecordChangeAt: string | null;
  /** Last time the user confirmed they stored a backup externally. */
  lastArchiveConfirmedAt: string | null;
  overdueDays: number;
  now?: Date;
}

export interface BackupHealth {
  status: BackupStatus;
  daysSinceArchive: number | null;
  daysSinceChange: number | null;
  headline: string;
  detail: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function backupHealth(input: BackupHealthInput): BackupHealth {
  const now = input.now ?? new Date();
  const archiveTime = input.lastArchiveConfirmedAt ? Date.parse(input.lastArchiveConfirmedAt) : NaN;
  const changeTime = input.lastRecordChangeAt ? Date.parse(input.lastRecordChangeAt) : NaN;

  const daysSinceArchive = Number.isFinite(archiveTime)
    ? Math.floor((now.getTime() - archiveTime) / DAY_MS)
    : null;
  const daysSinceChange = Number.isFinite(changeTime)
    ? Math.floor((now.getTime() - changeTime) / DAY_MS)
    : null;

  // No records at all -> nothing to lose.
  if (!input.hasRecords) {
    return {
      status: 'safe',
      daysSinceArchive,
      daysSinceChange,
      headline: 'Nothing to back up yet',
      detail: 'Start recording dashes and your backup status will appear here.',
    };
  }

  const hasArchive = Number.isFinite(archiveTime);
  const changedSinceArchive =
    !hasArchive || (Number.isFinite(changeTime) && changeTime > archiveTime);

  // Records exist and nothing has changed since the confirmed archive.
  if (hasArchive && !changedSinceArchive) {
    return {
      status: 'safe',
      daysSinceArchive,
      daysSinceChange,
      headline: 'Backup is current',
      detail: `No records have changed since your last confirmed archive${
        daysSinceArchive !== null ? ` ${daysSinceArchive} day${daysSinceArchive === 1 ? '' : 's'} ago` : ''
      }.`,
    };
  }

  // Never archived, or newer records since the archive.
  const elapsed = hasArchive && daysSinceArchive !== null ? daysSinceArchive : Infinity;
  if (hasArchive && elapsed <= input.overdueDays) {
    return {
      status: 'due',
      daysSinceArchive,
      daysSinceChange,
      headline: 'Backup due soon',
      detail: `You have new records since your last archive ${daysSinceArchive} day${
        daysSinceArchive === 1 ? '' : 's'
      } ago. Export a backup and store it somewhere safe.`,
    };
  }

  if (!hasArchive) {
    return {
      status: 'due',
      daysSinceArchive: null,
      daysSinceChange,
      headline: 'No archive confirmed yet',
      detail: 'You have records but have never confirmed an external backup. Export one and mark it archived.',
    };
  }

  return {
    status: 'overdue',
    daysSinceArchive,
    daysSinceChange,
    headline: 'Backup overdue',
    detail: `Records changed and it has been ${daysSinceArchive} days since your last confirmed archive (threshold ${input.overdueDays}). Export a backup now.`,
  };
}
