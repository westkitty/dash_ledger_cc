/**
 * UX Lab · Concept 3 — "Week as a story"
 *
 * Redesign hypothesis: the production Week opens with wrapped nav buttons and
 * a six-cell accounting grid where facts and estimates are visually identical,
 * pushes "needs attention" below the fold, and hides the completion action at
 * the bottom of a long scroll. This demo restructures the same content as a
 * single-screen story: a day-strip for *what happened*, a headline money band
 * with explicit FACT vs ESTIMATE badges, a collapsed needs-attention row, and
 * a sticky completion footer always in thumb reach. Same domain numbers,
 * same review semantics (nothing auto-reviews).
 *
 * Local mock state only — no store, no db.
 */

import { useState } from 'react';
import { LabFrame } from '../LabFrame';
import { LAB_WEEK_EXPENSES, LAB_WEEK_SHIFTS, LAB_VEHICLE, labMoney } from '../fixtures';

type ReviewState = 'in-progress' | 'review-due' | 'reviewed';

const DAYS = [
  { lbl: 'Mon', date: '2026-09-07' },
  { lbl: 'Tue', date: '2026-09-08' },
  { lbl: 'Wed', date: '2026-09-09' },
  { lbl: 'Thu', date: '2026-09-10' },
  { lbl: 'Fri', date: '2026-09-11' },
  { lbl: 'Sat', date: '2026-09-12' },
  { lbl: 'Sun', date: '2026-09-13' },
];

function dayStats(date: string) {
  const shifts = LAB_WEEK_SHIFTS.filter((s) => s.date === date);
  const miles = shifts.reduce((a, s) => a + (s.endOdo - s.startOdo), 0);
  const gross = shifts.reduce((a, s) => a + s.appCents + s.tipsCents, 0);
  const minutes = shifts.reduce((a, s) => {
    if (!s.start || !s.end) return a;
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    return a + (eh * 60 + em - (sh * 60 + sm));
  }, 0);
  return { dashes: shifts.length, miles, gross, minutes };
}

export function Concept3WeekStory() {
  const [state, setState] = useState<ReviewState>('review-due');
  const [selectedDay, setSelectedDay] = useState<string | null>('2026-09-09');
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const totalGross = LAB_WEEK_SHIFTS.reduce((a, s) => a + s.appCents + s.tipsCents, 0);
  const appTotal = LAB_WEEK_SHIFTS.reduce((a, s) => a + s.appCents, 0);
  const tipsTotal = totalGross - appTotal;
  const totalMiles = LAB_WEEK_SHIFTS.reduce((a, s) => a + (s.endOdo - s.startOdo), 0);
  const estimate = Math.round(totalMiles * 0.76 * 100); // 2026 H2 rate — an estimate
  const expenses = LAB_WEEK_EXPENSES.reduce((a, e) => a + e.amountCents, 0);

  const sel = selectedDay ? dayStats(selectedDay) : null;

  const statePill =
    state === 'reviewed' ? (
      <span className="uxlab-badge uxlab-badge--fact">Reviewed</span>
    ) : state === 'review-due' ? (
      <span className="uxlab-badge uxlab-badge--warn">Review due</span>
    ) : (
      <span className="uxlab-badge uxlab-badge--review">In progress</span>
    );

  return (
    <LabFrame
      concept={3}
      title="Week as a story — scan, decide, close"
      sub="What happened (day strip) · what it earned (fact) · what it might deduct (estimate) · what still needs you · close from anywhere."
    >
      <div className="uxlab-week-body">
        <section className="uxlab-card">
          <div className="uxlab-week-head">
            <div>
              <h2>Aug 31 – Sep 6 looks back; this is Sep 7 – 13</h2>
              <p className="uxlab-sub">Mon–Sun · week 37 · tap a day to focus it</p>
            </div>
            {statePill}
          </div>
        </section>

        {/* 1 — what happened */}
        <section className="uxlab-card">
          <div className="uxlab-label">What happened</div>
          <div className="uxlab-daystrip" role="group" aria-label="Days of week">
            {DAYS.map((d) => {
              const st = dayStats(d.date);
              const isToday = d.date === '2026-09-09';
              return (
                <button
                  key={d.date}
                  type="button"
                  className={[
                    'uxlab-day',
                    isToday ? 'uxlab-day--today' : '',
                    selectedDay === d.date ? 'uxlab-day--selected' : '',
                  ].join(' ')}
                  aria-pressed={selectedDay === d.date}
                  onClick={() => setSelectedDay(selectedDay === d.date ? null : d.date)}
                >
                  <span className="uxlab-day__lbl">{d.lbl}</span>
                  <span className="uxlab-day__num">{st.dashes > 0 ? st.dashes : '·'}</span>
                  <span className="uxlab-day__miles">{st.miles > 0 ? `${st.miles}mi` : ''}</span>
                </button>
              );
            })}
          </div>
          {sel && sel.dashes > 0 && (
            <div className="uxlab-chart-detail uxlab-tabular">
              <div className="uxlab-chart-detail__cell">
                <div className="uxlab-preview__num">{labMoney(sel.gross)}</div>
                <div className="uxlab-preview__lbl">Gross that day</div>
              </div>
              <div className="uxlab-chart-detail__cell">
                <div className="uxlab-preview__num">{sel.miles} mi</div>
                <div className="uxlab-preview__lbl">Business miles</div>
              </div>
              <div className="uxlab-chart-detail__cell">
                <div className="uxlab-preview__num">{Math.floor(sel.minutes / 60)}h {sel.minutes % 60}m</div>
                <div className="uxlab-preview__lbl">On the clock</div>
              </div>
            </div>
          )}
          {sel && sel.dashes === 0 && (
            <p className="small faint" style={{ marginBottom: 0 }}>No dashes recorded that day.</p>
          )}
        </section>

        {/* 2 — what it earned: facts first, estimate clearly separate */}
        <section className="uxlab-card uxlab-money-band">
          <div className="uxlab-label">What it earned</div>
          <div className="uxlab-money-band__main">
            <span className="uxlab-money-band__big uxlab-tabular">{labMoney(totalGross)}</span>
            <span className="uxlab-badge uxlab-badge--fact">Fact</span>
            <span className="uxlab-money-band__split uxlab-tabular">
              {labMoney(appTotal)} app + {labMoney(tipsTotal)} cash tips
            </span>
          </div>
          <div className="uxlab-estimate-band">
            <span>
              <span className="uxlab-badge uxlab-badge--estimate">Estimate</span>
              <span style={{ marginLeft: 8, fontSize: '0.9rem' }}>
                Standard-mileage deduction · {totalMiles} mi
              </span>
            </span>
            <span className="uxlab-estimate-band__num uxlab-tabular">{labMoney(estimate)}</span>
          </div>
          <div className="uxlab-vs uxlab-tabular">
            <span>
              Tracked expenses <strong>{labMoney(expenses)}</strong> · net cash after expenses{' '}
              <strong>{labMoney(totalGross - expenses)}</strong>
            </span>
          </div>
        </section>

        {/* 3 — what needs attention, collapsed by default */}
        <section className="uxlab-attention">
          <button
            type="button"
            className="uxlab-attention__summary"
            aria-expanded={attentionOpen}
            onClick={() => setAttentionOpen(!attentionOpen)}
          >
            <span>
              Needs attention · <strong>1 to resolve, 1 for information</strong>
            </span>
            <span aria-hidden>{attentionOpen ? '▴' : '▾'}</span>
          </button>
          {attentionOpen && (
            <div className="uxlab-attention__body">
              <div className="uxlab-attention__item">
                <span className="uxlab-attention__dot" aria-hidden />
                <span>
                  Expense "Shell" on 2026-09-09 has no linked receipt. — open the Resolve queue from
                  the Desk to fix it in place.
                </span>
              </div>
              <div className="uxlab-attention__item">
                <span className="uxlab-attention__dot uxlab-attention__dot--info" aria-hidden />
                <span>Receipt from 2026-09-09 is still in the Inbox and unclassified.</span>
              </div>
            </div>
          )}
        </section>

        {/* 4 — the record itself */}
        <section className="uxlab-card">
          <div className="uxlab-label">Dashes ({LAB_WEEK_SHIFTS.length})</div>
          {[...LAB_WEEK_SHIFTS].reverse().map((s) => (
            <div key={s.id} className="uxlab-row" style={{ cursor: 'default' }}>
              <span className="uxlab-row__main">
                <span className="uxlab-row__title">
                  {s.date === '2026-09-07' ? 'Mon Sep 7' : 'Wed Sep 9'} · {LAB_VEHICLE}
                </span>
                <span className="uxlab-row__sub uxlab-tabular">
                  {s.start}–{s.end} · {s.endOdo - s.startOdo} mi
                </span>
              </span>
              <span className="uxlab-row__value">
                <span className="uxlab-tabular">{labMoney(s.appCents + s.tipsCents)}</span>
                <span className="uxlab-row__value-sub uxlab-tabular">{labMoney(s.appCents)} + {labMoney(s.tipsCents)}</span>
              </span>
            </div>
          ))}
        </section>

        <p className="small faint" style={{ margin: 0 }}>
          Try it: tap days, expand needs-attention, then close the week from the sticky footer — it
          never locks a record, and editing afterwards flips the pill back (see state toggle below).
        </p>

        {/* Demo-only state control */}
        <section className="uxlab-card">
          <div className="uxlab-label">Demo controls</div>
          <div className="uxlab-seg">
            {(['in-progress', 'review-due', 'reviewed'] as ReviewState[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`uxlab-seg__btn ${state === s ? 'uxlab-seg__btn--primary' : ''}`}
                aria-pressed={state === s}
                onClick={() => setState(s)}
              >
                {s === 'in-progress' ? 'In progress' : s === 'review-due' ? 'Review due' : 'Reviewed'}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* sticky completion footer — always in thumb reach */}
      <div className="uxlab-week-footer">
        <div className="uxlab-week-footer__inner">
          {state === 'reviewed' ? (
            <button type="button" className="uxlab-btn" style={{ width: '100%' }} onClick={() => setState('review-due')}>
              Reopen week
            </button>
          ) : !confirming ? (
            <button type="button" className="uxlab-btn uxlab-btn--primary" style={{ width: '100%' }} onClick={() => setConfirming(true)}>
              Mark week reviewed
            </button>
          ) : (
            <>
              <button
                type="button"
                className="uxlab-btn uxlab-btn--primary"
                style={{ flex: 1.4 }}
                onClick={() => {
                  setState('reviewed');
                  setConfirming(false);
                }}
              >
                Confirm — numbers are complete
              </button>
              <button type="button" className="uxlab-btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
        {confirming && (
          <p className="uxlab-week-footer__note">
            Reviewing says "the numbers above are complete as of today." It never freezes records —
            later edits are detected and the pill flips back.
          </p>
        )}
      </div>

      {state === 'reviewed' && (
        <div className="uxlab-toast" role="status">
          Week marked reviewed — nothing was locked · demo state only
        </div>
      )}
    </LabFrame>
  );
}
