/**
 * Pre-replacement safety gate.
 *
 * The original single-file app made a destructive restore a two-step action:
 * "1 · Save a safety backup first", then "2 · Replace everything now". Both
 * successors dropped it. It is the only mechanism in the lineage that protects a
 * user from destroying good records with a bad restore, so it is reintroduced
 * here as a REQUIRED argument rather than a UI convention — an operation that
 * replaces the authoritative ledger cannot be called without one.
 *
 * Two kinds of acknowledgement exist:
 *
 *  - `exported`          the user generated a backup of the current ledger and
 *                        confirmed they have it.
 *  - `no-existing-data`  there is nothing to lose. This claim is NOT trusted:
 *                        the caller must prove it, and the gate re-verifies that
 *                        the ledger is genuinely empty before honouring it.
 */

export interface ExportedSafetyBackup {
  kind: 'exported';
  acknowledgedAt: string;
  filename: string;
  byteCount: number;
  format: string;
}

export interface NoExistingDataAcknowledgement {
  kind: 'no-existing-data';
  acknowledgedAt: string;
}

export type SafetyBackupAcknowledgement = ExportedSafetyBackup | NoExistingDataAcknowledgement;

export interface SafetyGateResult {
  ok: boolean;
  /** Set when the caller must produce a safety backup before retrying. */
  needsSafetyBackup: boolean;
  error?: string;
}

export function makeExportedAcknowledgement(
  filename: string,
  byteCount: number,
  format: string,
): ExportedSafetyBackup {
  return {
    kind: 'exported',
    acknowledgedAt: new Date().toISOString(),
    filename,
    byteCount,
    format,
  };
}

export function makeNoExistingDataAcknowledgement(): NoExistingDataAcknowledgement {
  return { kind: 'no-existing-data', acknowledgedAt: new Date().toISOString() };
}

const PASSED: SafetyGateResult = { ok: true, needsSafetyBackup: false };

/**
 * Decide whether a destructive replacement may proceed.
 *
 * @param ack             what the caller is offering as proof.
 * @param existingRecords how many records the canonical ledger currently holds.
 */
export function checkSafetyGate(
  ack: SafetyBackupAcknowledgement | null | undefined,
  existingRecords: number,
): SafetyGateResult {
  if (!ack) {
    return {
      ok: false,
      needsSafetyBackup: true,
      error:
        existingRecords > 0
          ? `This will replace ${existingRecords} existing record${existingRecords === 1 ? '' : 's'}. Export a safety backup of the current ledger and confirm you have saved it before continuing.`
          : 'A safety acknowledgement is required before replacing the ledger.',
    };
  }

  if (ack.kind === 'no-existing-data') {
    if (existingRecords > 0) {
      return {
        ok: false,
        needsSafetyBackup: true,
        error: `The ledger was reported as empty, but it holds ${existingRecords} record${existingRecords === 1 ? '' : 's'}. Export a safety backup and confirm you have saved it before continuing.`,
      };
    }
    return PASSED;
  }

  if (!ack.filename.trim()) {
    return { ok: false, needsSafetyBackup: true, error: 'The safety backup has no filename.' };
  }
  if (!Number.isFinite(ack.byteCount) || ack.byteCount <= 0) {
    return {
      ok: false,
      needsSafetyBackup: true,
      error: 'The safety backup is empty, so it would not restore anything. Export it again.',
    };
  }
  if (Number.isNaN(Date.parse(ack.acknowledgedAt))) {
    return { ok: false, needsSafetyBackup: true, error: 'The safety backup acknowledgement is malformed.' };
  }
  return PASSED;
}
