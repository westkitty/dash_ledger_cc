/**
 * The Desk — the home screen, built for recording a day's work from a phone in a
 * parking lot.
 *
 * Hierarchy when not dashing:
 *   1. restrained contextual heading + date
 *   2. READY state
 *   3. dominant START DASH
 *   4. this-week snapshot
 *   5. quick Expense / Receipt
 *   6. recent dashes
 *   7. backup health (secondary)
 *
 * When dashing, an unmistakable ON THE ROAD card takes the top slot with a
 * dominant END DASH. Start / End open as sheets over this screen, never a route
 * change. All financial and mileage math comes from `src/domain`.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLedger, useUndoableDelete } from '../../state/store';
import { useRouter, Link } from '../../app/router';
import { Button, Card, ConfirmButton, EmptyState, Money } from '../../components/ui';
import { BackupHealthCard } from '../../components/BackupHealthCard';
import { StartDashSheet } from './StartDashSheet';
import { EndDashSheet } from './EndDashSheet';
import { deleteShift, restoreDeletedShift } from '../../db/repositories';
import type { Shift } from '../../domain/types';
import { formatLocalDate, mondayOf, nowLocalTime, todayLocalDate } from '../../domain/dates';
import { summariseWeek } from '../../domain/aggregation';
import { pendingReview } from '../../domain/completeness';
import { checkContinuity, computeMileage } from '../../domain/mileage';
import { grossIncomeCents } from '../../domain/money';
import { formatHours, shiftDuration } from '../../domain/duration';

function deskLabel(hour: number): string {
  if (hour < 5) return 'Night';
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Day';
  if (hour < 21) return 'Evening';
  return 'Night';
}

export function DeskScreen() {
  const snap = useLedger();
  const undoableDelete = useUndoableDelete();
  const { navigate } = useRouter();
  const { shifts, expenses, receipts, mileageRates, settings, activeShift } = snap;

  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const today = todayLocalDate();
  const weekKey = mondayOf(today);
  const week = useMemo(
    () =>
      summariseWeek(weekKey, shifts, expenses, receipts, mileageRates, settings.implausibleMiles, today),
    [weekKey, shifts, expenses, receipts, mileageRates, settings.implausibleMiles, today],
  );

  const review = useMemo(
    () => pendingReview(shifts, expenses, receipts, mileageRates, settings.implausibleMiles),
    [shifts, expenses, receipts, mileageRates, settings.implausibleMiles],
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
          <h1>{deskLabel(new Date().getHours())} desk</h1>
          <p>{formatLocalDate(today)}</p>
        </div>
      </div>

      {activeShift ? (
        <ActiveDashCard
          shift={activeShift}
          shifts={shifts}
          onEnd={() => setEndOpen(true)}
          onDiscard={() =>
            void undoableDelete(
              () => deleteShift(activeShift.id),
              (d) => restoreDeletedShift(d),
              { deleted: 'Active dash discarded', restored: 'Active dash restored' },
            )
          }
        />
      ) : (
        <section className="ready" aria-label="Ready to start a dash">
          <p className="ready__line">Ready when you are.</p>
          <Button variant="primary" size="xl" block onClick={() => setStartOpen(true)}>
            Start Dash
          </Button>
        </section>
      )}

      <Card label="This week">
        <div className="stat-grid">
          <Stat label="Gross income" value={<Money cents={week.grossIncomeCents} />} />
          <Stat label="Business miles" value={week.businessMiles.toLocaleString('en-US')} />
          <Stat label="Dashes" value={week.completedShiftCount} />
          <Stat label="Receipt inbox" value={week.unresolvedReceiptCount} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Link to={`/week?w=${weekKey}`} className="link-btn">
            Open week →
          </Link>
        </div>
      </Card>

      <div className="quick-actions">
        <button
          type="button"
          className="quick-action"
          onClick={() =>
            navigate(activeShift ? `/expense/new?shift=${activeShift.id}` : '/expense/new')
          }
        >
          <span className="quick-action__plus" aria-hidden>
            ＋
          </span>
          Expense
        </button>
        <button type="button" className="quick-action" onClick={() => navigate('/receipts/capture')}>
          <span className="quick-action__plus" aria-hidden>
            ＋
          </span>
          Receipt
        </button>
      </div>

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
              const flagged =
                m.status === 'suspicious' || m.status === 'reversed' || m.status === 'missing';
              return (
                <button key={s.id} className="row-link" onClick={() => navigate(`/dash/${s.id}`)}>
                  <span className="row-link__main">
                    <span className="row-link__title">{formatLocalDate(s.date)}</span>
                    <span className="row-link__sub">
                      {s.vehicleLabel} ·{' '}
                      {m.miles === null ? 'miles missing' : `${m.miles.toLocaleString('en-US')} mi`}
                      {flagged && ' · ⚠ needs review'}
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

      {!activeShift && recent.length > 0 && (
        <p className="small faint" style={{ textAlign: 'center' }}>
          <Link to="/log">Log a completed dash</Link>
        </p>
      )}

      {review.length > 0 && (
        <Card label={`Needs review (${review.length})`}>
          <p className="small faint">
            Records with something to decide, across every week. Record-completeness only — not a
            tax-compliance score.
          </p>
          <ul className="issue-list">
            {review.slice(0, 5).map((iss, i) => (
              <li key={i} className={`issue ${iss.severity === 'warn' ? 'issue--warn' : ''}`}>
                <span className="issue__dot" aria-hidden />
                <span>{iss.href ? <Link to={iss.href}>{iss.message}</Link> : iss.message}</span>
              </li>
            ))}
          </ul>
          {review.length > 5 && (
            <p className="small faint" style={{ marginTop: 8 }}>
              +{review.length - 5} more — open each week from <Link to="/week">Week</Link> to work
              through them.
            </p>
          )}
        </Card>
      )}

      <BackupHealthCard />

      <p className="small faint" style={{ textAlign: 'center' }}>
        All records are stored only on this device. Export a backup from Tax / Vault to keep a copy.
      </p>

      {startOpen && <StartDashSheet onClose={() => setStartOpen(false)} />}
      {endOpen && <EndDashSheet onClose={() => setEndOpen(false)} />}
    </div>
  );
}

function ActiveDashCard({
  shift,
  shifts,
  onEnd,
  onDiscard,
}: {
  shift: Shift;
  shifts: Shift[];
  onEnd: () => void;
  onDiscard: () => void;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const cont = checkContinuity(shifts, shift.vehicleId, shift.date, shift.startOdometer, shift.id);
  const elapsed = shift.startTime ? shiftDuration(shift.startTime, nowLocalTime()) : null;

  return (
    <section className="active-card" aria-label="Active dash — on the road">
      <p className="active-card__status">
        <span className="active-card__mark" aria-hidden>
          ▲
        </span>
        On the road
      </p>
      <dl>
        <dt>Date</dt>
        <dd>{formatLocalDate(shift.date)}</dd>
        <dt>Vehicle</dt>
        <dd>{shift.vehicleLabel}</dd>
        <dt>Started</dt>
        <dd>{shift.startTime ?? 'time not set'}</dd>
        <dt>Start odometer</dt>
        <dd>{shift.startOdometer?.toLocaleString('en-US') ?? 'not set'}</dd>
        {elapsed?.known && (
          <>
            <dt>Elapsed</dt>
            <dd>{formatHours(elapsed.hours)}</dd>
          </>
        )}
      </dl>
      {cont.hasGap && cont.gap !== null && (
        <div className="active-card__notice">
          Odometer continuity: {Math.abs(cont.gap)} mi{' '}
          {cont.gap > 0 ? 'gap after' : 'overlap with'} the previous {shift.vehicleLabel} reading (
          {cont.priorEndOdometer?.toLocaleString('en-US')}). Those miles won't count as business
          mileage.
        </div>
      )}
      <Button variant="primary" size="xl" block onClick={onEnd}>
        End Dash
      </Button>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <Button to={`/dash/${shift.id}`} variant="ghost">
          Edit
        </Button>
        <ConfirmButton variant="default" onConfirm={onDiscard}>
          Discard dash
        </ConfirmButton>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
    </div>
  );
}
