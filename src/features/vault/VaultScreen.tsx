import { useLedger } from '../../state/store';
import { Link, useRouter } from '../../app/router';
import { Card, DisclaimerNote } from '../../components/ui';
import { BackupHealthCard } from '../../components/BackupHealthCard';
import { YearReport } from './YearReport';
import { BackupPanel } from './BackupPanel';
import { StoragePanel } from './StoragePanel';
import { VehiclesPanel } from './VehiclesPanel';
import { RatesPanel } from './RatesPanel';

const SECTIONS = [
  { id: 'year', label: 'Year' },
  { id: 'backup', label: 'Backup' },
  { id: 'storage', label: 'Storage' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'rates', label: 'Rates' },
] as const;

export function VaultScreen({ section, year }: { section: string | null; year: string | null }) {
  const { navigate } = useRouter();
  const active = SECTIONS.find((s) => s.id === section)?.id ?? null;

  return (
    <div className="stack">
      <div className="screen-head">
        <div>
          <h1>Tax / Vault</h1>
          <p>Yearly reports, backups, storage health, vehicles &amp; mileage rates.</p>
        </div>
      </div>

      <div className="chips" role="tablist" aria-label="Vault sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={active === s.id}
            className="chip"
            aria-pressed={active === s.id}
            onClick={() => navigate(`/vault?s=${s.id}`)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!active && <Overview />}
      {active === 'year' && <YearReport year={year} />}
      {active === 'backup' && <BackupPanel />}
      {active === 'storage' && <StoragePanel />}
      {active === 'vehicles' && <VehiclesPanel />}
      {active === 'rates' && <RatesPanel />}
    </div>
  );
}

function Overview() {
  const { shifts, expenses, receipts, vehicles } = useLedger();
  return (
    <div className="stack">
      <BackupHealthCard />
      <Card label="At a glance">
        <div className="kv">
          <div className="kv__row">
            <dt>Vehicles</dt>
            <dd>{vehicles.length}</dd>
          </div>
          <div className="kv__row">
            <dt>Shifts</dt>
            <dd>{shifts.length}</dd>
          </div>
          <div className="kv__row">
            <dt>Expenses</dt>
            <dd>{expenses.length}</dd>
          </div>
          <div className="kv__row">
            <dt>Receipts</dt>
            <dd>{receipts.length}</dd>
          </div>
        </div>
      </Card>
      <Card label="Open">
        <div className="rows">
          <Link to="/vault?s=year" className="row-link">
            <span className="row-link__main">
              <span className="row-link__title">Yearly report &amp; Tax Binder</span>
              <span className="row-link__sub">Mileage estimate, planning comparison, statement reconciliation</span>
            </span>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/vault?s=backup" className="row-link">
            <span className="row-link__main">
              <span className="row-link__title">Backup, restore &amp; exports</span>
              <span className="row-link__sub">Full backup · ledger JSON · CSV · restore</span>
            </span>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/vault?s=storage" className="row-link">
            <span className="row-link__main">
              <span className="row-link__title">Storage health</span>
              <span className="row-link__sub">Persistent storage, quota, backup timeline</span>
            </span>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/vault?s=vehicles" className="row-link">
            <span className="row-link__main">
              <span className="row-link__title">Vehicles</span>
            </span>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/vault?s=rates" className="row-link">
            <span className="row-link__main">
              <span className="row-link__title">Mileage-rate configuration</span>
            </span>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/settings" className="row-link">
            <span className="row-link__main">
              <span className="row-link__title">Settings</span>
              <span className="row-link__sub">Theme, thresholds, default purpose, deep link</span>
            </span>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/diagnostics" className="row-link">
            <span className="row-link__main">
              <span className="row-link__title">Diagnostics &amp; self-test</span>
            </span>
            <span aria-hidden>›</span>
          </Link>
        </div>
      </Card>
      <DisclaimerNote />
    </div>
  );
}
