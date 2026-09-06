import { useLedger } from '../state/store';
import { backupHealth } from '../domain/backupHealth';
import { Pill } from './ui';
import { Link } from '../app/router';

export function useBackupHealth() {
  const { shifts, expenses, receipts, meta, settings } = useLedger();
  const hasRecords = shifts.length + expenses.length + receipts.length > 0;
  return backupHealth({
    hasRecords,
    lastRecordChangeAt: meta.lastRecordChangeAt,
    lastArchiveConfirmedAt: meta.lastArchiveConfirmedAt,
    overdueDays: settings.backupOverdueDays,
  });
}

export function BackupHealthCard({ compact = false }: { compact?: boolean }) {
  const health = useBackupHealth();
  const tone = health.status === 'safe' ? 'good' : health.status === 'due' ? 'warn' : 'danger';
  return (
    <div className={`notice notice--${tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : 'danger'}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Pill tone={tone}>{health.status.toUpperCase()}</Pill>
        <strong>{health.headline}</strong>
      </div>
      <div className="small">{health.detail}</div>
      {!compact && (
        <div style={{ marginTop: 8 }}>
          <Link to="/vault?s=backup" className="link-btn">
            Open backup &amp; restore →
          </Link>
        </div>
      )}
    </div>
  );
}
