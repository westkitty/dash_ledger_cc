import { useRef, useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { Button, Card, ConfirmButton, Notice } from '../../components/ui';
import { BackupHealthCard } from '../../components/BackupHealthCard';
import {
  buildFullBackup,
  buildLedgerOnlyBackup,
  serializeBackup,
  readBackupSource,
} from '../../services/backup';
import { validateBackup, restoreBackup, type ValidationResult } from '../../services/restore';
import { shiftsToCsv, expensesToCsv, mileageRatesToCsv } from '../../services/csv';
import { deliverFile, timestampSlug } from '../../services/share';
import { confirmArchive, markBackupGenerated } from '../../db/repositories';
import {
  makeExportedAcknowledgement,
  makeNoExistingDataAcknowledgement,
  type SafetyBackupAcknowledgement,
} from '../../services/safetyGate';
import { Link } from '../../app/router';

export function BackupPanel() {
  const snap = useLedger();
  const { mutate, pushToast, reload } = useLedgerContext();
  const { shifts, expenses, mileageRates, settings, receipts, vehicles, weeklyClosures } = snap;
  const fileRef = useRef<HTMLInputElement>(null);

  // Records the restore would destroy. Drives whether a safety backup is needed.
  const existingRecords =
    vehicles.length + shifts.length + expenses.length + receipts.length + weeklyClosures.length;

  const [busy, setBusy] = useState<string | null>(null);
  const [restoreState, setRestoreState] = useState<{
    raw: unknown;
    validation: ValidationResult;
    filename: string;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [safety, setSafety] = useState<SafetyBackupAcknowledgement | null>(null);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      pushToast((err as Error).message || 'Export failed', 'danger');
    } finally {
      setBusy(null);
    }
  }

  const exportFull = () =>
    run('full', async () => {
      const src = await readBackupSource();
      const backup = await buildFullBackup(src);
      const json = serializeBackup(backup);
      const res = await deliverFile(`dash-ledger-backup-${timestampSlug()}.json`, json, 'application/json');
      await markBackupGenerated();
      await reload();
      pushToast(res === 'shared' ? 'Backup shared' : 'Full backup downloaded');
    });

  const exportLedgerOnly = () =>
    run('ledger', async () => {
      const src = await readBackupSource();
      const backup = buildLedgerOnlyBackup(src);
      const json = serializeBackup(backup);
      const res = await deliverFile(
        `dash-ledger-ledger-only-${timestampSlug()}.json`,
        json,
        'application/json',
      );
      await markBackupGenerated();
      await reload();
      pushToast(res === 'shared' ? 'Ledger export shared' : 'Ledger-only JSON downloaded (no images)');
    });

  const exportShiftsCsv = () =>
    run('shifts-csv', async () => {
      const csv = shiftsToCsv(shifts, settings.implausibleMiles);
      await deliverFile(`dash-ledger-shifts-${timestampSlug()}.csv`, csv, 'text/csv');
      pushToast('Shifts CSV exported');
    });

  const exportExpensesCsv = () =>
    run('expenses-csv', async () => {
      const csv = expensesToCsv(expenses);
      await deliverFile(`dash-ledger-expenses-${timestampSlug()}.csv`, csv, 'text/csv');
      pushToast('Expenses CSV exported');
    });

  const exportRatesCsv = () =>
    run('rates-csv', async () => {
      const csv = mileageRatesToCsv(mileageRates);
      await deliverFile(`dash-ledger-mileage-rates-${timestampSlug()}.csv`, csv, 'text/csv');
      pushToast('Mileage-rate CSV exported');
    });

  async function onRestoreFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const validation = validateBackup(raw);
      setSafety(null);
      setRestoreState({ raw, validation, filename: file.name });
    } catch (err) {
      setRestoreState(null);
      pushToast(`Could not read "${file.name}": ${(err as Error).message}`, 'danger');
    }
  }

  /**
   * Step 1 of the restore. Exports the CURRENT ledger so a bad restore is
   * recoverable, and only then unlocks the destructive step.
   */
  const saveSafetyBackup = () =>
    run('safety', async () => {
      if (existingRecords === 0) {
        setSafety(makeNoExistingDataAcknowledgement());
        pushToast('Ledger is empty — there is nothing to back up first.');
        return;
      }
      const src = await readBackupSource();
      const backup = await buildFullBackup(src);
      const json = serializeBackup(backup);
      const filename = `dash-ledger-safety-${timestampSlug()}.json`;
      await deliverFile(filename, json, 'application/json');
      await markBackupGenerated();
      await reload();
      setSafety(makeExportedAcknowledgement(filename, json.length, backup.format));
      pushToast('Safety backup saved. You can now replace your data.');
    });

  async function doRestore() {
    if (!restoreState?.validation.ok) return;
    setRestoring(true);
    try {
      const result = await restoreBackup(restoreState.raw, { safetyBackup: safety });
      if (!result.ok) {
        pushToast(result.error ?? 'Restore failed', 'danger');
      } else {
        pushToast('Restore complete. Data reloaded.');
        setRestoreState(null);
        setSafety(null);
        await reload();
      }
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="stack">
      <BackupHealthCard compact />

      <Card label="Full backup">
        <p className="small muted">
          Complete restorable JSON. Receipt images are embedded as data URLs, so the file is
          self-sufficient. This is the one to keep.
        </p>
        <Button variant="primary" block onClick={exportFull} disabled={busy === 'full'}>
          {busy === 'full' ? 'Building…' : 'Export full backup (.json)'}
        </Button>
        <div style={{ marginTop: 10 }}>
          <ConfirmButton
            variant="default"
            block
            confirmLabel="Tap again — I have saved this backup somewhere safe"
            onConfirm={() => void mutate(() => confirmArchive(), { success: 'Archive confirmed' })}
          >
            I saved / archived a backup
          </ConfirmButton>
          <p className="small faint" style={{ marginTop: 6 }}>
            Generating a file doesn't prove it's stored safely. Confirm here after you copy it to
            cloud storage, email, or another device.
          </p>
        </div>
      </Card>

      <Card label="Other exports">
        <div className="btn-row">
          <Button onClick={exportLedgerOnly} disabled={busy === 'ledger'}>
            Ledger-only JSON
          </Button>
          <Button onClick={exportShiftsCsv} disabled={busy === 'shifts-csv'}>
            Shifts CSV
          </Button>
          <Button onClick={exportExpensesCsv} disabled={busy === 'expenses-csv'}>
            Expenses CSV
          </Button>
          <Button onClick={exportRatesCsv} disabled={busy === 'rates-csv'}>
            Mileage rates CSV
          </Button>
        </div>
        <p className="small faint" style={{ marginTop: 8 }}>
          Ledger-only JSON keeps all receipt metadata but omits image bytes — it is an export, not an
          image-restorable backup.
        </p>
      </Card>

      <Card label="Restore from backup">
        <p className="small muted">
          Restore validates the entire file first, then replaces all data in a single transaction. A
          failed restore leaves your current database untouched. Because it is destructive, it runs
          in two steps: save a safety backup, then replace.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => onRestoreFile(e.target.files?.[0] ?? null)}
        />
        <Button block onClick={() => fileRef.current?.click()}>
          Choose backup file…
        </Button>

        {restoreState && (
          <div style={{ marginTop: 12 }}>
            <p className="small">
              <strong>{restoreState.filename}</strong> · format{' '}
              <span className="inline-code">{restoreState.validation.format ?? 'unknown'}</span>
            </p>
            {restoreState.validation.ok ? (
              <>
                <Notice tone="good" title="Backup passed validation">
                  {restoreState.validation.hasImages
                    ? 'Includes embedded receipt images.'
                    : 'No receipt images in this file.'}{' '}
                  Restoring replaces everything currently in the app.
                </Notice>

                <div className="stack" style={{ marginTop: 10 }}>
                  <div>
                    <Button
                      block
                      onClick={saveSafetyBackup}
                      disabled={busy === 'safety' || safety !== null}
                    >
                      {safety
                        ? '✓ 1 · Safety backup saved'
                        : busy === 'safety'
                          ? 'Saving…'
                          : existingRecords === 0
                            ? '1 · Confirm there is nothing to back up'
                            : '1 · Save a safety backup first'}
                    </Button>
                    <p className="small faint" style={{ marginTop: 6 }}>
                      {existingRecords === 0
                        ? 'Your ledger is currently empty, so there is nothing a restore could destroy.'
                        : `Exports your current ${existingRecords} record${existingRecords === 1 ? '' : 's'} so this restore is reversible. Required before step 2.`}
                    </p>
                  </div>

                  <ConfirmButton
                    block
                    disabled={!safety}
                    confirmLabel="Tap again to replace ALL current data"
                    onConfirm={doRestore}
                  >
                    {restoring ? 'Restoring…' : '2 · Replace everything with this backup'}
                  </ConfirmButton>
                </div>
              </>
            ) : restoreState.validation.importable ? (
              <Notice tone="warn" title="This is an earlier Dash Ledger backup">
                <p className="small" style={{ margin: '6px 0' }}>
                  {restoreState.validation.errors[0]}
                </p>
                <Link to="/vault?s=recovery" className="link-btn">
                  Open Recovery &amp; import →
                </Link>
              </Notice>
            ) : (
              <Notice tone="danger" title="Backup failed validation">
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {restoreState.validation.errors.slice(0, 12).map((e, i) => (
                    <li key={i} className="small">
                      {e}
                    </li>
                  ))}
                </ul>
                Nothing was changed.
              </Notice>
            )}
          </div>
        )}
      </Card>

      <p className="small faint" style={{ textAlign: 'center' }}>
        Exports are created on-device and shared/saved by you. Nothing is uploaded anywhere.
      </p>
    </div>
  );
}
