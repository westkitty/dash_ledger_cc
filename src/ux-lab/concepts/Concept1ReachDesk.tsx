import { useMemo } from 'react';
import { useRouter } from '../../app/router';
import { useLedger } from '../../state/store';
import { summariseWeek } from '../../domain/aggregation';
import { mondayOf } from '../../domain/dates';
import { formatCents, grossIncomeCents } from '../../domain/money';
import { computeMileage } from '../../domain/mileage';
import { LabFrame } from '../LabFrame';

export function Concept1ReachDesk() {
  const snap = useLedger();
  const { navigate } = useRouter();
  const weekKey = mondayOf(snap.today);
  const week = useMemo(
    () => summariseWeek(
      weekKey,
      snap.shifts,
      snap.expenses,
      snap.receipts,
      snap.mileageRates,
      snap.settings.implausibleMiles,
      snap.today,
    ),
    [weekKey, snap.shifts, snap.expenses, snap.receipts, snap.mileageRates, snap.settings.implausibleMiles, snap.today],
  );
  const recent = [...snap.shifts]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);
  const inbox = snap.receipts.filter((r) => r.status === 'Inbox').length;
  const reviewExpenses = snap.expenses.filter((e) => e.taxClass === 'REVIEW').length;
  const active = snap.activeShift;

  return (
    <LabFrame
      concept={1}
      title="Reach Desk — thumb-first, state-true"
      sub="Primary actions live in a bottom drive dock and the active dash never leaves reach."
    >
      <div className="uxlab-desk">
        <section className="uxlab-card">
          <div className="uxlab-label">This week · live facts</div>
          <div className="uxlab-weekline">
            <span className="uxlab-weekline__big uxlab-tabular">{formatCents(week.grossIncomeCents)}</span>
            <span className="uxlab-weekline__rest uxlab-tabular">
              gross · {week.businessMiles.toLocaleString('en-US')} mi · {week.completedShiftCount} dashes · {inbox + reviewExpenses} unresolved
            </span>
            <span className="uxlab-badge uxlab-badge--fact">Shared data</span>
          </div>
        </section>

        {active && (
          <button
            type="button"
            className="uxlab-reviewchip"
            onClick={() => navigate('/end?demo=1')}
            aria-label="Active dash — open end dash"
          >
            <span className="uxlab-dock__live-dot" aria-hidden />
            On the road · {active.vehicleLabel} · {active.date} {active.startTime ?? ''}
          </button>
        )}

        <section className="uxlab-card">
          <div className="uxlab-label">Needs review</div>
          <button type="button" className="uxlab-row" onClick={() => navigate('/ux-lab/2?demo=1')}>
            <span className="uxlab-emoji-free" aria-hidden>{inbox + reviewExpenses}</span>
            <span className="uxlab-row__main">
              <span className="uxlab-row__title">{inbox + reviewExpenses} item{inbox + reviewExpenses === 1 ? '' : 's'} need a decision</span>
              <span className="uxlab-row__sub">{inbox} receipt inbox · {reviewExpenses} Review-class expense{reviewExpenses === 1 ? '' : 's'}</span>
            </span>
            <span className="uxlab-row__value-sub">Resolve ›</span>
          </button>
        </section>

        <section className="uxlab-card">
          <div className="uxlab-label">Recent dashes</div>
          {recent.length === 0 ? (
            <p className="small faint">No completed dashes yet.</p>
          ) : recent.map((s) => {
            const mileage = computeMileage(s.startOdometer, s.endOdometer, snap.settings.implausibleMiles);
            return (
              <button key={s.id} type="button" className="uxlab-row" onClick={() => navigate(`/dash/${s.id}?demo=1`)}>
                <span className="uxlab-row__main">
                  <span className="uxlab-row__title">{s.date} · {s.vehicleLabel}</span>
                  <span className="uxlab-row__sub uxlab-tabular">
                    {mileage.miles == null ? 'miles missing' : `${mileage.miles} mi`} · {s.startTime ?? '—'}–{s.endTime ?? '—'}
                  </span>
                </span>
                <span className="uxlab-row__value">
                  <span>{formatCents(grossIncomeCents(s.appEarningsCents, s.cashTipsCents))}</span>
                  <span className="uxlab-row__value-sub">Edit ›</span>
                </span>
              </button>
            );
          })}
        </section>
      </div>

      <div className="uxlab-dock" role="region" aria-label="Drive dock">
        <div className="uxlab-dock__inner">
          <button
            type="button"
            className={`uxlab-dock__primary ${active ? 'uxlab-dock__primary--live' : ''}`}
            onClick={() => navigate(active ? '/end?demo=1' : '/start?demo=1')}
          >
            {active ? 'End Dash' : 'Start Dash'}
          </button>
          <button type="button" className="uxlab-dock__aux" onClick={() => navigate('/expense/new?demo=1')}>Expense</button>
          <button type="button" className="uxlab-dock__aux" onClick={() => navigate('/receipts/capture?demo=1')}>Receipt</button>
        </div>
      </div>
    </LabFrame>
  );
}
