/**
 * Recovery: import records from an earlier Dash Ledger version.
 *
 * Deliberately small. It inspects, reports, and imports — it does not restyle
 * the app or duplicate the Backup panel. Nothing here writes to a legacy source:
 * legacy databases are read, summarised, and left exactly as they were.
 */

import { useEffect, useRef, useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { Button, Card, ConfirmButton, Notice, Pill } from '../../components/ui';
import {
  analyseLegacyDatabase,
  applyImport,
  listImportReports,
  normalizeSource,
  scanLegacyDatabases,
  type ImportAnalysis,
  type ImportIssue,
  type ImportReportRecord,
  type LegacyScanResult,
} from '../../services/import';
import { buildFullBackup, readBackupSource, serializeBackup } from '../../services/backup';
import { deliverFile, timestampSlug } from '../../services/share';
import { markBackupGenerated } from '../../db/repositories';
import {
  makeExportedAcknowledgement,
  makeNoExistingDataAcknowledgement,
  type SafetyBackupAcknowledgement,
} from '../../services/safetyGate';

export function RecoveryPanel() {
  const { vehicles, shifts, expenses, receipts, weeklyClosures } = useLedger();
  const { pushToast, reload } = useLedgerContext();
  const fileRef = useRef<HTMLInputElement>(null);

  const existingRecords =
    vehicles.length + shifts.length + expenses.length + receipts.length + weeklyClosures.length;

  const [scan, setScan] = useState<LegacyScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [safety, setSafety] = useState<SafetyBackupAcknowledgement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<ImportReportRecord[]>([]);

  useEffect(() => {
    void (async () => {
      setScanning(true);
      try {
        setScan(await scanLegacyDatabases());
        setHistory(await listImportReports(5));
      } finally {
        setScanning(false);
      }
    })();
  }, []);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      pushToast((err as Error).message || 'Recovery step failed', 'danger');
    } finally {
      setBusy(null);
    }
  }

  const inspectDatabase = (name: string) =>
    run(`db:${name}`, async () => {
      const result = await analyseLegacyDatabase(name);
      setSafety(null);
      if (!result) {
        pushToast(`Could not read "${name}".`, 'danger');
        return;
      }
      setAnalysis(result);
    });

  async function onFile(file: File | null) {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      setSafety(null);
      setAnalysis(normalizeSource(raw, file.name));
    } catch (err) {
      setAnalysis(null);
      pushToast(`Could not read "${file.name}": ${(err as Error).message}`, 'danger');
    }
  }

  const saveSafetyBackup = () =>
    run('safety', async () => {
      if (existingRecords === 0) {
        setSafety(makeNoExistingDataAcknowledgement());
        pushToast('Ledger is empty — there is nothing to back up first.');
        return;
      }
      const backup = await buildFullBackup(await readBackupSource());
      const json = serializeBackup(backup);
      const filename = `dash-ledger-safety-${timestampSlug()}.json`;
      await deliverFile(filename, json, 'application/json');
      await markBackupGenerated();
      setSafety(makeExportedAcknowledgement(filename, json.length, backup.format));
      pushToast('Safety backup saved. You can now import.');
    });

  const doImport = () =>
    run('import', async () => {
      if (!analysis) return;
      const result = await applyImport(analysis.candidate, analysis.report, { safetyBackup: safety });
      if (!result.ok) {
        pushToast(result.error ?? 'Import failed', 'danger');
        return;
      }
      pushToast(`Imported ${result.report?.totals.imported ?? 0} records.`);
      setAnalysis(null);
      setSafety(null);
      setHistory(await listImportReports(5));
      await reload();
    });

  const present = scan?.found.filter((f) => f.present) ?? [];

  return (
    <div className="stack">
      <Card label="Import from an earlier version">
        <p className="small muted">
          Records written by the original Dash Ledger, an earlier build of this app, or the Grok
          build can be brought in here. Amounts are converted once, at import. Anything ambiguous is
          reported rather than guessed.
        </p>
        <Notice tone="info" title="Your old data is left alone">
          A legacy database on this device is only ever read. It is never upgraded, cleared, or
          deleted — it stays as a recovery source.
        </Notice>
      </Card>

      <Card label="Legacy databases on this device">
        {scanning && <p className="small muted">Looking…</p>}
        {scan?.unavailable && (
          <Notice tone="warn" title="No local storage">
            IndexedDB is unavailable here, so nothing could be scanned.
          </Notice>
        )}
        {scan && !scan.unavailable && (
          <>
            {!scan.enumerationSupported && (
              <p className="small faint">
                This browser cannot list databases, so only the known Dash Ledger names were checked.
                A database saved under a different name would not be found — import its backup file
                below instead.
              </p>
            )}
            {present.length === 0 ? (
              <p className="small muted">No earlier Dash Ledger database found on this device.</p>
            ) : (
              <div className="rows">
                {present.map((db) => (
                  <div key={db.name} className="kv__row">
                    <dt>
                      <span className="inline-code">{db.name}</span>
                      <span className="small faint"> · v{db.version} · {db.stores.length} stores</span>
                    </dt>
                    <dd>
                      <Button
                        onClick={() => inspectDatabase(db.name)}
                        disabled={busy === `db:${db.name}`}
                      >
                        {busy === `db:${db.name}` ? 'Reading…' : 'Inspect'}
                      </Button>
                    </dd>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <Card label="Import a backup file">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <Button block onClick={() => fileRef.current?.click()}>
          Choose an older backup file…
        </Button>
      </Card>

      {analysis && (
        <AnalysisCard
          analysis={analysis}
          existingRecords={existingRecords}
          safety={safety}
          busy={busy}
          onSafety={saveSafetyBackup}
          onImport={doImport}
          onCancel={() => {
            setAnalysis(null);
            setSafety(null);
          }}
        />
      )}

      {history.length > 0 && (
        <Card label="Previous imports">
          <div className="rows">
            {history.map((h) => (
              <div key={h.id} className="kv__row">
                <dt>
                  {h.report.sourceLabel}
                  <span className="small faint"> · {h.createdAt.slice(0, 16).replace('T', ' ')}</span>
                </dt>
                <dd className="small">
                  {h.report.totals.imported} imported
                  {h.report.totals.conflicts > 0 && `, ${h.report.totals.conflicts} conflicts`}
                </dd>
              </div>
            ))}
          </div>
          <p className="small faint" style={{ marginTop: 8 }}>
            Conflicting values from an import are kept in this log so you can resolve them later.
          </p>
        </Card>
      )}
    </div>
  );
}

function AnalysisCard({
  analysis,
  existingRecords,
  safety,
  busy,
  onSafety,
  onImport,
  onCancel,
}: {
  analysis: ImportAnalysis;
  existingRecords: number;
  safety: SafetyBackupAcknowledgement | null;
  busy: string | null;
  onSafety: () => void;
  onImport: () => void;
  onCancel: () => void;
}) {
  const { report } = analysis;

  if (!report.ok) {
    return (
      <Card label="Cannot import this source">
        <Notice tone="danger" title="Nothing was read">
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {report.errors.map((e, i) => (
              <li key={i} className="small">
                {e}
              </li>
            ))}
          </ul>
        </Notice>
        <div style={{ marginTop: 10 }}>
          <Button onClick={onCancel}>Close</Button>
        </div>
      </Card>
    );
  }

  const conflicts = report.issues.filter((i) => i.severity === 'conflict');
  const rejected = report.issues.filter((i) => i.severity === 'rejected');
  const warnings = report.issues.filter((i) => i.severity === 'warning');

  return (
    <Card label="What was found">
      <p className="small">
        <strong>{report.sourceLabel}</strong>
        <br />
        <span className="small faint">
          {report.sourceFormat} · {report.sourceVariant}
          {report.sourceSchemaVersion !== null && ` · schema v${report.sourceSchemaVersion}`}
        </span>
      </p>

      <div className="kv">
        <Row k="Vehicles" v={report.imported.vehicles} />
        <Row k="Dashes" v={report.imported.shifts} />
        <Row k="Expenses" v={report.imported.expenses} />
        <Row k="Receipts" v={report.imported.receipts} />
        <Row k="Receipt images" v={report.imported.receiptImages} />
        <Row k="Weekly reviews" v={report.imported.weeklyClosures} />
        <Row k="Mileage rates" v={report.imported.mileageRates} />
      </div>

      <div className="btn-row" style={{ marginTop: 10 }}>
        <Pill tone="good">{report.totals.imported} importable</Pill>
        {report.totals.conflicts > 0 && <Pill tone="danger">{report.totals.conflicts} conflicts</Pill>}
        {report.totals.rejected > 0 && <Pill tone="warn">{report.totals.rejected} not imported</Pill>}
        {report.totals.warnings > 0 && <Pill tone="info">{report.totals.warnings} warnings</Pill>}
      </div>

      {conflicts.length > 0 && (
        <IssueBlock
          tone="danger"
          title="Needs your decision"
          intro="These records carry two different values for the same amount. Neither was chosen. The value was left unset and both are kept in the import log."
          issues={conflicts}
        />
      )}
      {rejected.length > 0 && (
        <IssueBlock
          tone="warn"
          title="Not imported"
          intro="These could not be represented without inventing something, so they were left out. Their details are kept in the import log."
          issues={rejected}
        />
      )}
      {warnings.length > 0 && (
        <IssueBlock tone="info" title="Worth knowing" intro={null} issues={warnings} />
      )}

      {report.unsupportedFields.length > 0 && (
        <p className="small faint" style={{ marginTop: 8 }}>
          No canonical home for: {report.unsupportedFields.join(', ')}. The source still contains
          them.
        </p>
      )}
      {report.notes.map((n, i) => (
        <p key={i} className="small faint" style={{ marginTop: 6 }}>
          {n}
        </p>
      ))}

      <Notice tone="warn" title="Importing replaces this app's records">
        {existingRecords === 0
          ? 'Your ledger is currently empty, so nothing will be lost.'
          : `Your current ${existingRecords} record${existingRecords === 1 ? '' : 's'} will be replaced.`}
      </Notice>

      <div className="stack" style={{ marginTop: 10 }}>
        <Button block onClick={onSafety} disabled={busy === 'safety' || safety !== null}>
          {safety
            ? '✓ 1 · Safety backup saved'
            : busy === 'safety'
              ? 'Saving…'
              : existingRecords === 0
                ? '1 · Confirm there is nothing to back up'
                : '1 · Save a safety backup first'}
        </Button>
        <ConfirmButton
          block
          disabled={!safety || busy === 'import'}
          confirmLabel="Tap again to import and replace"
          onConfirm={onImport}
        >
          {busy === 'import' ? 'Importing…' : '2 · Import these records'}
        </ConfirmButton>
        <Button block onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="kv__row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function IssueBlock({
  tone,
  title,
  intro,
  issues,
}: {
  tone: 'danger' | 'warn' | 'info';
  title: string;
  intro: string | null;
  issues: ImportIssue[];
}) {
  const [open, setOpen] = useState(issues.length <= 3);
  const shown = open ? issues : issues.slice(0, 3);
  return (
    <div style={{ marginTop: 10 }}>
      <Notice tone={tone} title={title}>
        {intro && <p className="small">{intro}</p>}
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {shown.map((iss, i) => (
            <li key={i} className="small">
              {iss.message}
            </li>
          ))}
        </ul>
        {!open && issues.length > shown.length && (
          <Button onClick={() => setOpen(true)}>Show all {issues.length}</Button>
        )}
      </Notice>
    </div>
  );
}
