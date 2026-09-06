import { useMemo } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { Link, useRouter } from '../../app/router';
import { Button, Card, ConfirmButton, EmptyState, Money, Pill, StatGrid } from '../../components/ui';
import { BackupHealthCard } from '../../components/BackupHealthCard';
import { deleteShift } from '../../db/repositories';
import { mondayOf, todayLocalDate, formatLocalDate } from '../../domain/dates';
import { summariseWeek } from '../../domain/aggregation';
import { computeMileage, checkContinuity } from '../../domain/mileage';
import { grossIncomeCents } from '../../domain/money';

export function DashHome() {
  const snap = useLedger();
  const { mutate } = useLedgerContext();
  const { navigate } = useRouter();
  const { shifts, expenses, receipts, mileageRates, settings, activeShift } = snap;

  const today = todayLocalDate();
  const weekKey = mondayOf(today);
  const week = useMemo(
    () => summariseWeek(weekKey, shifts, expenses, receipts, mileageRates, settings.implausibleMiles, today),
    [weekKey, shifts, expenses, receipts, mileageRates, settings.implausibleMiles, today],
  );

  const recent = useMemo(
    () =>
      [...shifts]
        .filter((s) => s.status === 'completed')
        .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5),
    [shifts],
  );

  return (
    <div className="stack">
      <div className="screen-head">
        <div>
          <h1>Dash</h1>
          <p>{formatLocalDate(today)}</p>
        </div>
      </div>

      {activeShift ? <ActiveDashBanner /> : <StartCta />}

      <Card label="This week">
        <StatGrid
          stats={[
            { label: 'Completed shifts', value: week.completedShiftCount },
            { label: 'Gross income', value: <Money cents={week.grossIncomeCents} /> },
            { label: 'Business miles', value: week.businessMiles.toLocaleString('en-US') },
            {
              label: 'Mileage estimate',
              value: <Money cents={week.mileage.estimateCents} />,
              sub: week.mileage.unpricedMiles > 0 ? `${week.mileage.unpricedMiles} mi unpriced` : undefined,
            },
            { label: 'Tracked expenses', value: <Money cents={week.expenses.totalCents} /> },
            {
              label: 'Net cash',
              value: <Money cents={week.netCashAfterExpensesCents} />,
              sub: 'gross − all tracked expenses',
              tone: week.netCashAfterExpensesCents < 0 ? 'neg' : undefined,
            },
          ]}
        />
        <div style={{ marginTop: 12 }}>
          <Link to={`/week?w=${weekKey}`} className="link-btn">
            Open week →
          </Link>
        </div>
      </Card>

      <div className="btn-row">
        <Button to="/expense/new">＋ Expense</Button>
        <Button to="/receipts/capture">＋ Receipt</Button>
        {!activeShift && <Button to="/log">Log completed dash</Button>}
        <Button to="/week">Week view</Button>
      </div>

      <BackupHealthCard />

      <Card label="Recent dashes">
        {recent.length === 0 ? (
          <EmptyState icon="—" title="No completed dashes yet">
            Start a dash above, or log one you already finished.
          </EmptyState>
        ) : (
          <div className="rows">
            {recent.map((s) => {
              const m = computeMileage(s.startOdometer, s.endOdometer, settings.implausibleMiles);
              const gross = grossIncomeCents(s.appEarningsCents, s.cashTipsCents);
              return (
                <button
                  key={s.id}
                  className="row-link"
                  onClick={() => navigate(`/dash/${s.id}`)}
                >
                  <span className="row-link__main">
                    <span className="row-link__title">{formatLocalDate(s.date)}</span>
                    <span className="row-link__sub">
                      {s.vehicleLabel} ·{' '}
                      {m.miles === null ? 'miles missing' : `${m.miles} mi`}
                      {m.status === 'suspicious' && ' ⚠'}
                      {m.status === 'reversed' && ' ⚠'}
                    </span>
                  </span>
                  <span className="row-link__value">
                    <Money cents={gross} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <p className="small faint" style={{ textAlign: 'center' }}>
        All records are stored only on this device. Export a backup from Tax / Vault to keep a copy.
      </p>
    </div>
  );

  function ActiveDashBanner() {
    if (!activeShift) return null;
    const cont = checkContinuity(
      shifts,
      activeShift.vehicleId,
      activeShift.date,
      activeShift.startOdometer,
      activeShift.id,
    );
    return (
      <section className="active-banner" aria-label="Active dash">
        <div className="active-banner__eyebrow">
          <span className="active-banner__pulse" aria-hidden />
          Active dash
        </div>
        <dl>
          <dt>Date</dt>
          <dd>{formatLocalDate(activeShift.date)}</dd>
          <dt>Vehicle</dt>
          <dd>{activeShift.vehicleLabel}</dd>
          <dt>Started</dt>
          <dd>{activeShift.startTime ?? 'time not set'}</dd>
          <dt>Start odometer</dt>
          <dd>{activeShift.startOdometer?.toLocaleString('en-US') ?? 'not set'}</dd>
        </dl>
        {cont.hasGap && cont.gap !== null && (
          <div
            className="notice notice--warn"
            style={{ marginBottom: 12, color: 'inherit', background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.3)' }}
          >
            Odometer continuity: {Math.abs(cont.gap)} mi {cont.gap > 0 ? 'gap after' : 'overlap with'} the
            previous {activeShift.vehicleLabel} reading ({cont.priorEndOdometer?.toLocaleString('en-US')}).
            Those miles won't count as business mileage.
          </div>
        )}
        <Button to="/end" variant="default" size="xl" block>
          End Dash
        </Button>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Button to={`/dash/${activeShift.id}`} variant="ghost">
            Edit
          </Button>
          <ConfirmButton
            variant="default"
            onConfirm={() =>
              void mutate(() => deleteShift(activeShift.id), { success: 'Active dash discarded' }).then(() =>
                navigate('/'),
              )
            }
          >
            Discard dash
          </ConfirmButton>
        </div>
      </section>
    );
  }

  function StartCta() {
    return (
      <section className="stack">
        <Button to="/start" variant="primary" size="xl" block>
          Start Dash
        </Button>
        <p className="small faint" style={{ textAlign: 'center', margin: 0 }}>
          <Pill tone="neutral">Tip</Pill> Add the Start-Dash link to an Apple Shortcut — see Tax /
          Vault → Settings.
        </p>
      </section>
    );
  }
}
