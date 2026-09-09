import { useMemo, useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { markWeekReviewed, reopenWeek } from '../../db/repositories';
import { summariseWeek } from '../../domain/aggregation';
import { weekCompleteness } from '../../domain/completeness';
import { addDays, formatWeekRange, mondayOf } from '../../domain/dates';
import { formatCents, grossIncomeCents } from '../../domain/money';
import { computeMileage } from '../../domain/mileage';
import { LabFrame } from '../LabFrame';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Concept3WeekStory() {
  const snap = useLedger();
  const { mutate } = useLedgerContext();
  const wk = mondayOf(snap.today);
  const [selectedDay, setSelectedDay] = useState(snap.today);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const summary = useMemo(
    () => summariseWeek(wk, snap.shifts, snap.expenses, snap.receipts, snap.mileageRates, snap.settings.implausibleMiles, snap.today),
    [wk, snap.shifts, snap.expenses, snap.receipts, snap.mileageRates, snap.settings.implausibleMiles, snap.today],
  );
  const issues = useMemo(
    () => weekCompleteness(wk, snap.shifts, snap.expenses, snap.receipts, snap.mileageRates, snap.settings.implausibleMiles),
    [wk, snap.shifts, snap.expenses, snap.receipts, snap.mileageRates, snap.settings.implausibleMiles],
  );
  const closure = snap.weeklyClosures.find((c) => c.weekKey === wk);
  const reviewState = closure ? 'reviewed' : summary.temporallyComplete ? 'review-due' : 'in-progress';
  const days = DAY_NAMES.map((label, i) => ({ label, date: addDays(wk, i) }));
  const selectedShifts = snap.shifts.filter((s) => s.date === selectedDay);
  const selectedGross = selectedShifts.reduce((n, s) => n + grossIncomeCents(s.appEarningsCents, s.cashTipsCents), 0);
  const selectedMiles = selectedShifts.reduce((n, s) => {
    const m = computeMileage(s.startOdometer, s.endOdometer, snap.settings.implausibleMiles);
    return n + (m.miles ?? 0);
  }, 0);
  const weekShifts = snap.shifts
    .filter((s) => s.weekKey === wk || mondayOf(s.date) === wk)
    .sort((a, b) => b.date.localeCompare(a.date));

  async function closeWeek() {
    await mutate(() => markWeekReviewed(wk), { success: 'Week marked reviewed' });
    setConfirming(false);
  }

  return (
    <LabFrame
      concept={3}
      title="Week as a story — scan, decide, close"
      sub="The live week is reorganized into what happened, what it earned, what is estimated, and what still needs attention."
    >
      <div className="uxlab-week-body">
        <section className="uxlab-card">
          <div className="uxlab-week-head">
            <div>
              <h2>{formatWeekRange(wk)}</h2>
              <p className="uxlab-sub">Mon–Sun · live records · tap a day to focus it</p>
            </div>
            <span className={`uxlab-badge ${reviewState === 'reviewed' ? 'uxlab-badge--fact' : reviewState === 'review-due' ? 'uxlab-badge--warn' : 'uxlab-badge--review'}`}>
              {reviewState === 'reviewed' ? 'Reviewed' : reviewState === 'review-due' ? 'Review due' : 'In progress'}
            </span>
          </div>
        </section>

        <section className="uxlab-card">
          <div className="uxlab-label">What happened</div>
          <div className="uxlab-daystrip" role="group" aria-label="Days of week">
            {days.map((d) => {
              const shifts = snap.shifts.filter((s) => s.date === d.date);
              const miles = shifts.reduce((n, s) => n + (computeMileage(s.startOdometer, s.endOdometer, snap.settings.implausibleMiles).miles ?? 0), 0);
              return (
                <button
                  key={d.date}
                  type="button"
                  className={`uxlab-day ${d.date === snap.today ? 'uxlab-day--today' : ''} ${selectedDay === d.date ? 'uxlab-day--selected' : ''}`}
                  aria-pressed={selectedDay === d.date}
                  onClick={() => setSelectedDay(d.date)}
                >
                  <span className="uxlab-day__lbl">{d.label}</span>
                  <span className="uxlab-day__num">{shifts.length || '·'}</span>
                  <span className="uxlab-day__miles">{miles > 0 ? `${miles}mi` : ''}</span>
                </button>
              );
            })}
          </div>
          <div className="uxlab-chart-detail uxlab-tabular">
            <div className="uxlab-chart-detail__cell">
              <div className="uxlab-preview__num">{formatCents(selectedGross)}</div>
              <div className="uxlab-preview__lbl">Selected-day gross</div>
            </div>
            <div className="uxlab-chart-detail__cell">
              <div className="uxlab-preview__num">{selectedMiles} mi</div>
              <div className="uxlab-preview__lbl">Business miles</div>
            </div>
            <div className="uxlab-chart-detail__cell">
              <div className="uxlab-preview__num">{selectedShifts.length}</div>
              <div className="uxlab-preview__lbl">Dash records</div>
            </div>
          </div>
        </section>

        <section className="uxlab-card uxlab-money-band">
          <div className="uxlab-label">What it earned</div>
          <div className="uxlab-money-band__main">
            <span className="uxlab-money-band__big uxlab-tabular">{formatCents(summary.grossIncomeCents)}</span>
            <span className="uxlab-badge uxlab-badge--fact">Fact</span>
            <span className="uxlab-money-band__split uxlab-tabular">
              {formatCents(summary.appEarningsCents)} app + {formatCents(summary.cashTipsCents)} cash tips
            </span>
          </div>
          <div className="uxlab-estimate-band">
            <span><span className="uxlab-badge uxlab-badge--estimate">Estimate</span><span style={{ marginLeft: 8 }}>Standard-mileage deduction · {summary.businessMiles} mi</span></span>
            <span className="uxlab-estimate-band__num uxlab-tabular">{formatCents(summary.mileage.estimateCents)}</span>
          </div>
          <div className="uxlab-vs uxlab-tabular">
            <span>Tracked expenses <strong>{formatCents(summary.expenses.totalCents)}</strong> · net cash after expenses <strong>{formatCents(summary.netCashAfterExpensesCents)}</strong></span>
          </div>
        </section>

        <section className="uxlab-attention">
          <button type="button" className="uxlab-attention__summary" aria-expanded={attentionOpen} onClick={() => setAttentionOpen(!attentionOpen)}>
            <span>Needs attention · <strong>{issues.length} item{issues.length === 1 ? '' : 's'}</strong></span>
            <span aria-hidden>{attentionOpen ? '▴' : '▾'}</span>
          </button>
          {attentionOpen && (
            <div className="uxlab-attention__body">
              {issues.length === 0 ? <div className="uxlab-attention__item">Nothing unresolved in this week.</div> : issues.map((issue, i) => (
                <div className="uxlab-attention__item" key={`${issue.code ?? 'issue'}-${i}`}>
                  <span className={`uxlab-attention__dot ${issue.severity === 'warn' ? '' : 'uxlab-attention__dot--info'}`} aria-hidden />
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="uxlab-card">
          <div className="uxlab-label">Dashes ({weekShifts.length})</div>
          {weekShifts.length === 0 ? <p className="small faint">No dashes recorded this week.</p> : weekShifts.map((s) => (
            <div key={s.id} className="uxlab-row">
              <span className="uxlab-row__main">
                <span className="uxlab-row__title">{s.date} · {s.vehicleLabel}</span>
                <span className="uxlab-row__sub uxlab-tabular">{s.startTime ?? '—'}–{s.endTime ?? '—'}</span>
              </span>
              <span className="uxlab-row__value"><span>{formatCents(grossIncomeCents(s.appEarningsCents, s.cashTipsCents))}</span></span>
            </div>
          ))}
        </section>
      </div>

      <div className="uxlab-week-footer">
        <div className="uxlab-week-footer__inner">
          {reviewState === 'reviewed' ? (
            <button type="button" className="uxlab-btn" style={{ width: '100%' }} onClick={() => void mutate(() => reopenWeek(wk), { success: 'Week reopened' })}>Reopen week</button>
          ) : !confirming ? (
            <button type="button" className="uxlab-btn uxlab-btn--primary" style={{ width: '100%' }} onClick={() => setConfirming(true)}>Mark week reviewed</button>
          ) : (
            <>
              <button type="button" className="uxlab-btn uxlab-btn--primary" style={{ flex: 1.4 }} onClick={() => void closeWeek()}>Confirm — numbers are complete</button>
              <button type="button" className="uxlab-btn" onClick={() => setConfirming(false)}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </LabFrame>
  );
}
