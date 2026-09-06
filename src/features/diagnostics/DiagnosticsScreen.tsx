import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from '../../app/router';
import { Button, Card, Pill } from '../../components/ui';
import { APP_VERSION, indexedDBAvailable } from '../../db/db';
import { SCHEMA_VERSION } from '../../domain/types';
import { canShareFiles } from '../../services/share';
import { readStorageHealth, formatBytes } from '../../services/storageHealth';
import {
  getDiagnostics,
  subscribeDiagnostics,
  clearDiagnostics,
} from '../../services/diagnosticsLog';
import { runSelfTest, type SelfTestReport } from '../../services/selfTest';

export function DiagnosticsScreen() {
  const entries = useSyncExternalStore(subscribeDiagnostics, getDiagnostics, getDiagnostics);
  const [report, setReport] = useState<SelfTestReport | null>(null);
  const [running, setRunning] = useState(false);
  const [storage, setStorage] = useState<string>('checking…');

  useEffect(() => {
    void readStorageHealth().then((h) => {
      setStorage(
        `${h.persistentSupported ? (h.persisted ? 'persisted' : 'not persisted') : 'unsupported'}` +
          (h.estimateSupported ? ` · ${formatBytes(h.usageBytes)} / ${formatBytes(h.quotaBytes)}` : ''),
      );
    });
  }, []);

  const env: Array<[string, string]> = [
    ['App version', APP_VERSION],
    ['Schema version', String(SCHEMA_VERSION)],
    ['IndexedDB available', indexedDBAvailable() ? 'yes' : 'no'],
    ['Secure context', typeof isSecureContext !== 'undefined' && isSecureContext ? 'yes' : 'no'],
    ['Origin', location.origin || '(none)'],
    ['Protocol', location.protocol],
    ['File sharing (Web Share)', canShareFiles() ? 'available' : 'unavailable'],
    [
      'Reduced motion',
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'preferred'
        : 'no preference',
    ],
    ['Storage', storage],
    ['Service worker', 'serviceWorker' in navigator ? 'supported' : 'unsupported'],
  ];

  async function doSelfTest() {
    setRunning(true);
    try {
      setReport(await runSelfTest());
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="stack">
      <Link to="/vault" className="back-link">
        <span aria-hidden>‹</span> Tax / Vault
      </Link>
      <div className="screen-head">
        <div>
          <h1>Diagnostics</h1>
          <p>Nothing here is collected or sent anywhere.</p>
        </div>
      </div>

      <Card label="Environment">
        <div className="kv">
          {env.map(([k, v]) => (
            <div className="kv__row" key={k}>
              <dt>{k}</dt>
              <dd style={{ maxWidth: '62%', wordBreak: 'break-word' }}>{v}</dd>
            </div>
          ))}
        </div>
      </Card>

      <Card label="Self-test">
        <p className="small muted">
          Runs pure-function checks plus an isolated temporary IndexedDB write/read/delete. It never
          touches your real ledger.
        </p>
        <Button variant="primary" onClick={doSelfTest} disabled={running}>
          {running ? 'Running…' : 'Run self-test'}
        </Button>
        {report && (
          <div style={{ marginTop: 12 }}>
            <p>
              <Pill tone={report.failed === 0 ? 'good' : 'danger'}>
                {report.passed} passed · {report.failed} failed
              </Pill>{' '}
              <span className="small faint">{report.ran.slice(0, 19).replace('T', ' ')}</span>
            </p>
            <ul className="issue-list">
              {report.cases.map((c, i) => (
                <li key={i} className={`issue ${c.pass ? '' : 'issue--warn'}`}>
                  <span className="issue__dot" aria-hidden />
                  <span>
                    {c.pass ? '✓' : '✕'} {c.name}
                    {!c.pass && c.detail ? ` — ${c.detail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card label={`Session log (${entries.length})`}>
        {entries.length === 0 ? (
          <p className="small muted">No diagnostic events this session.</p>
        ) : (
          <>
            <ul className="issue-list">
              {entries.map((e) => (
                <li key={e.id} className="issue">
                  <span className="issue__dot" aria-hidden />
                  <span>
                    <strong>{e.category}</strong> · {e.at.slice(11, 19)} — {e.message}
                    {e.detail ? <span className="faint"> ({e.detail})</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 10 }}>
              <Button onClick={clearDiagnostics}>Clear session log</Button>
            </div>
          </>
        )}
      </Card>

      <Card label="Recovery">
        <p className="small muted">
          If the app misbehaves: reload the page, run the self-test, and export your data from Tax /
          Vault → Backup while it is still accessible. Clearing app data is never the recommended
          first step and a runtime error will never do it automatically.
        </p>
      </Card>
    </div>
  );
}
