import { useEffect, useState } from 'react';
import { useLedger } from '../../state/store';
import { Button, Card, Notice, Pill } from '../../components/ui';
import { readStorageHealth, requestPersistentStorage, formatBytes, type StorageHealth } from '../../services/storageHealth';
import { BackupHealthCard } from '../../components/BackupHealthCard';

export function StoragePanel() {
  const { meta } = useLedger();
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => readStorageHealth().then(setHealth);
  useEffect(() => {
    void refresh();
  }, []);

  async function askPersist() {
    setBusy(true);
    await requestPersistentStorage();
    await refresh();
    setBusy(false);
  }

  const usedPct =
    health?.usageBytes != null && health?.quotaBytes ? (health.usageBytes / health.quotaBytes) * 100 : null;

  return (
    <div className="stack">
      <BackupHealthCard compact />

      <Card label="Local storage">
        {!health ? (
          <p className="small muted">Reading storage status…</p>
        ) : (
          <div className="kv">
            <div className="kv__row">
              <dt>Persistent storage</dt>
              <dd>
                {!health.persistentSupported ? (
                  <Pill tone="neutral">not supported</Pill>
                ) : health.persisted ? (
                  <Pill tone="good">granted</Pill>
                ) : (
                  <Pill tone="warn">not granted</Pill>
                )}
              </dd>
            </div>
            <div className="kv__row">
              <dt>Estimated usage</dt>
              <dd>{health.estimateSupported ? formatBytes(health.usageBytes) : '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>Quota</dt>
              <dd>{health.estimateSupported ? formatBytes(health.quotaBytes) : '—'}</dd>
            </div>
            {usedPct !== null && (
              <div className="kv__row">
                <dt>Used</dt>
                <dd>{usedPct.toFixed(usedPct < 1 ? 2 : 1)}%</dd>
              </div>
            )}
          </div>
        )}
        {health && !health.persisted && health.persistentSupported && (
          <Notice tone="info">
            Without persistent storage the browser may evict your data under storage pressure. Granting
            it makes eviction far less likely.
          </Notice>
        )}
        <div className="btn-row" style={{ marginTop: 10 }}>
          <Button onClick={askPersist} disabled={busy || !health?.persistentSupported}>
            Request persistent storage
          </Button>
          <Button onClick={refresh}>Refresh</Button>
        </div>
      </Card>

      <Card label="Backup timeline">
        <div className="kv">
          <div className="kv__row">
            <dt>Last record change</dt>
            <dd>{meta.lastRecordChangeAt ? meta.lastRecordChangeAt.slice(0, 16).replace('T', ' ') : '—'}</dd>
          </div>
          <div className="kv__row">
            <dt>Last backup generated</dt>
            <dd>{meta.lastBackupGeneratedAt ? meta.lastBackupGeneratedAt.slice(0, 16).replace('T', ' ') : '—'}</dd>
          </div>
          <div className="kv__row">
            <dt>Last archive confirmed</dt>
            <dd>{meta.lastArchiveConfirmedAt ? meta.lastArchiveConfirmedAt.slice(0, 16).replace('T', ' ') : 'never'}</dd>
          </div>
          <div className="kv__row">
            <dt>Last restore</dt>
            <dd>{meta.restoredAt ? meta.restoredAt.slice(0, 16).replace('T', ' ') : '—'}</dd>
          </div>
        </div>
      </Card>
    </div>
  );
}
