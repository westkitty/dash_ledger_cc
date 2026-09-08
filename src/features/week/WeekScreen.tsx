import { useMemo } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { Link, useRouter } from '../../app/router';
import { Button, Card, ConfirmButton, EmptyState, IssueList, Money, Notice, Pill, StatGrid } from '../../components/ui';
import { markWeekReviewed, reopenWeek } from '../../db/repositories';
import {
  mondayOf,
  todayLocalDate,
  formatWeekRange,
  nextWeekKey,
  prevWeekKey,
  isWeekTemporallyComplete,
} from '../../domain/dates';
import { summariseWeek } from '../../domain/aggregation';
import { weekCompleteness, weekChangedSinceReview } from '../../domain/completeness';
import { formatHours } from '../../domain/duration';
import { computeMileage } from '../../domain/mileage';
import { grossIncomeCents } from '../../domain/money';

export function WeekScreen({ weekKey }: { weekKey: string | null }) {
  const snap = useLedger();
  const { mutate } = useLedgerContext();
  const { navigate } = useRouter();
  const { shifts, expenses, receipts, mileageRates, weeklyClosures, settings } = snap;

  const today = todayLocalDate();
  const wk = weekKey && /^\d{4}-\d{2}-\d{2}$/.test(weekKey) ? mondayOf(weekKey) : mondayOf(today);

  const summary = useMemo(
    () => summariseWeek(wk, shifts, expenses, receipts, mileageRates, settings.implausibleMiles, today),
    [wk, shifts, expenses, receipts, mileageRates, settings.implausibleMiles, today],
  );
  const issues = useMemo(
    () => weekCompleteness(wk, shifts, expenses, receipts, mileageRates, settings.implausibleMiles),
    [wk, shifts, expenses, receipts, mileageRates, settings.implausibleMiles],
  );

  const closure = weeklyClosures.find((c) => c.weekKey === wk);
  const staleness = useMemo(
    () => weekChangedSinceReview(closure, shifts, expenses, receipts),
    [closure, shifts, expenses, receipts],
  );
  const temporallyComplete = isWeekTemporallyComplete(wk, today);
  const reviewState: 'in-progress' | 'review-due' | 'reviewed' = closure
    ? 'reviewed'
    : temporallyComplete
      ? 'review-due'
      : 'in-progress';

  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  const infoCount = issues.length - warnCount;

  const weekShifts = shifts
    .filter((s) => s.weekKey === wk || mondayOf(s.date) === wk)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const weekExpenses = expenses
    .filter((e) => mondayOf(e.date) === wk)
    .sort((a, b) => a.date.localeCompare(b.date));

  const go = (k: string) => navigate(`/week?w=${k}`);

  return (
    <div className="stack">
      <div className="screen-head">
        <div>
          <h1>Week</h1>
          <p>{formatWeekRange(wk)} · Mon–Sun</p>
        </div>
      </div>

      <div className="btn-row">
        <Button onClick={() => go(prevWeekKey(wk))}>‹ Prev</Button>
        <Button onClick={() => go(mondayOf(today))}>This week</Button>
        <Button onClick={() => go(nextWeekKey(wk))}>Next ›</Button>
      </div>

      {/* 1 — what happened */}
      <Card>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          {reviewState === 'reviewed' && <Pill tone={staleness.stale ? 'warn' : 'good'}>{staleness.stale ? 'Reviewed · changed since' : 'Reviewed'}</Pill>}
          {reviewState === 'review-due' && <Pill tone="warn">Review due</Pill>}
          {reviewState === 'in-progress' && <Pill tone="neutral">In progress</Pill>}
          <span className="small muted">
            {temporallyComplete ? 'Week has ended' : 'Week still in progress'}
          </span>
        </div>
        <StatGrid
          stats={[
            { label: 'DoorDash earnings', value: <Money cents={summary.appEarningsCents} /> },
            { label: 'Cash tips', value: <Money cents={summary.cashTipsCents} /> },
            { label: 'Gross income', value: <Money cents={summary.grossIncomeCents} /> },
            { label: 'Business miles', value: summary.businessMiles.toLocaleString('en-US') },
            {
              label: 'Standard mileage estimate',
              value: <Money cents={summary.mileage.estimateCents} />,
              sub:
                summary.mileage.unpricedMiles > 0
                  ? `${summary.mileage.unpricedMiles} mi have no rate`
                  : 'planning estimate',
            },
            {
              label: 'Net cash after expenses',
              value: <Money cents={summary.netCashAfterExpensesCents} />,
              sub: 'gross − all tracked expenses · not taxable profit',
              tone: summary.netCashAfterExpensesCents < 0 ? 'neg' : undefined,
            },
          ]}
        />

        <details className="disclosure" style={{ marginTop: 12 }}>
          <summary>Expense &amp; time breakdown</summary>
          <div className="disclosure__body">
            <StatGrid
              stats={[
                { label: 'Tracked expenses', value: <Money cents={summary.expenses.totalCents} /> },
                { label: 'Non-vehicle business', value: <Money cents={summary.expenses.nonVehicleBusinessCents} /> },
                { label: 'Vehicle actual-expense', value: <Money cents={summary.expenses.vehicleActualCents} /> },
                { label: 'Parking', value: <Money cents={summary.expenses.parkingCents} /> },
                { label: 'Tolls', value: <Money cents={summary.expenses.tollsCents} /> },
                { label: 'Review-class expenses', value: summary.expenses.reviewCount },
              ]}
            />
            <div className="divider" />
            <StatGrid
              stats={[
                {
                  label: 'Hours',
                  value: summary.time.timeComplete
                    ? formatHours(summary.time.knownHours)
                    : `${formatHours(summary.time.knownHours)}*`,
                  sub: summary.time.timeComplete
                    ? `${summary.time.completedShifts} shift(s)`
                    : `* ${summary.time.shiftsMissingTime} shift(s) missing a time`,
                },
                {
                  label: 'Gross / hour',
                  value:
                    summary.grossPerHourCents === null ? '—' : <Money cents={summary.grossPerHourCents} />,
                  sub:
                    summary.grossPerHourCents === null
                      ? summary.time.timeComplete
                        ? 'no hours recorded yet'
                        : 'needs complete time data'
                      : undefined,
                },
                {
                  label: 'Gross / business mile',
                  value:
                    summary.grossPerBusinessMileCents === null ? (
                      '—'
                    ) : (
                      <Money cents={summary.grossPerBusinessMileCents} />
                    ),
                },
                { label: 'Shifts', value: summary.shiftCount, sub: `${summary.completedShiftCount} completed` },
                { label: 'Receipts', value: summary.receiptCount },
                { label: 'Unresolved receipts', value: summary.unresolvedReceiptCount },
              ]}
            />
          </div>
        </details>
      </Card>

      {/* 2 — what still needs attention */}
      <Card label="Needs attention">
        {staleness.stale && (
          <Notice tone="warn" title="Records changed since this week was reviewed">
            {staleness.changedCount} record{staleness.changedCount === 1 ? '' : 's'} in this week{' '}
            {staleness.changedCount === 1 ? 'was' : 'were'} edited after it was marked reviewed. Reopen
            and re-review, or mark it reviewed again to refresh the timestamp.
          </Notice>
        )}
        <p className="small faint">
          Record-completeness check — not a tax-compliance score.
          {issues.length > 0 &&
            ` ${warnCount} to resolve${infoCount > 0 ? `, ${infoCount} for information` : ''}.`}
        </p>
        <IssueList issues={issues} />
      </Card>

      {/* 3 — what action completes review */}
      <Card label="Weekly close">
        {reviewState === 'reviewed' ? (
          <>
            <p className="small muted">
              Marked reviewed {closure?.reviewedAt?.slice(0, 16).replace('T', ' ')}. A reviewed week can
              be reopened at any time — closing it never freezes the records.
            </p>
            <div className="btn-row">
              {staleness.stale && (
                <Button
                  variant="primary"
                  onClick={() => void mutate(() => markWeekReviewed(wk), { success: 'Review refreshed' })}
                >
                  Mark reviewed again
                </Button>
              )}
              <ConfirmButton
                variant="default"
                block={!staleness.stale}
                confirmLabel="Tap again to reopen"
                onConfirm={() => void mutate(() => reopenWeek(wk), { success: 'Week reopened' })}
              >
                Reopen week
              </ConfirmButton>
            </div>
          </>
        ) : (
          <>
            <p className="small muted">
              {temporallyComplete
                ? 'This week has ended. Review the items above, then mark it reviewed. Nothing is marked reviewed automatically.'
                : 'This week has not finished yet. You can still mark it reviewed early if you are done recording.'}
            </p>
            <Button
              variant="primary"
              block
              onClick={() => void mutate(() => markWeekReviewed(wk), { success: 'Week marked reviewed' })}
            >
              Mark week reviewed
            </Button>
          </>
        )}
      </Card>

      <Card label={`Shifts (${weekShifts.length})`}>
        {weekShifts.length === 0 ? (
          <EmptyState icon="—" title="No shifts this week" />
        ) : (
          <div className="rows">
            {weekShifts.map((s) => {
              const m = computeMileage(s.startOdometer, s.endOdometer, settings.implausibleMiles);
              return (
                <Link key={s.id} to={`/dash/${s.id}`} className="row-link">
                  <span className="row-link__main">
                    <span className="row-link__title">
                      {s.date} {s.status === 'active' && <Pill tone="warn">Active</Pill>}
                    </span>
                    <span className="row-link__sub">
                      {s.vehicleLabel} · {s.startTime ?? '—'}–{s.endTime ?? '—'} ·{' '}
                      {m.miles === null ? 'no miles' : `${m.miles} mi`}
                      {m.status === 'suspicious' && ' ⚠'}
                    </span>
                  </span>
                  <span className="row-link__value">
                    <Money cents={grossIncomeCents(s.appEarningsCents, s.cashTipsCents)} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <Card label={`Expenses (${weekExpenses.length})`}>
        {weekExpenses.length === 0 ? (
          <EmptyState icon="—" title="No expenses this week" />
        ) : (
          <div className="rows">
            {weekExpenses.map((e) => (
              <Link key={e.id} to={`/expense/${e.id}`} className="row-link">
                <span className="row-link__main">
                  <span className="row-link__title">{e.merchant || e.category}</span>
                  <span className="row-link__sub">
                    {e.date} · {e.category} · {e.taxClass}
                    {!e.receiptId && ' · no receipt'}
                  </span>
                </span>
                <span className="row-link__value">
                  <Money cents={e.amountCents} />
                </span>
              </Link>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <Button to="/expense/new">＋ Add expense</Button>
        </div>
      </Card>
    </div>
  );
}
