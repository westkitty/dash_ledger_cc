/**
 * UX Lab · Concept 1 — "Reach Desk"
 *
 * Redesign hypothesis: the Desk's primary actions (Start / End Dash, quick
 * Expense / Receipt) live in the least reachable zone of a 6.1" iPhone, and
 * the active-dash state disappears from the action surface the moment you
 * scroll. This demo re-anchors the desk around a persistent bottom drive dock
 * (thumb zone), a one-line week fact strip, and a properly stacked list-row
 * design (fixing the title/sub inline-flow defect seen across production
 * lists). Everything is local mock state; nothing touches the ledger.
 */

import { useEffect, useMemo, useState } from 'react';
import { LabFrame } from '../LabFrame';
import { LAB_VEHICLE, LAB_WEEK_SHIFTS, labMoney, type LabShift } from '../fixtures';

interface DockShift {
  startedAt: number; // epoch ms (demo clock)
  startOdo: number;
  vehicle: string;
}

function fmtElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function Concept1ReachDesk() {
  const [shift, setShift] = useState<DockShift | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [completed, setCompleted] = useState<LabShift[]>(LAB_WEEK_SHIFTS);
  const [sheet, setSheet] = useState<null | 'start' | 'end'>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Demo clock for the live elapsed timer.
  useEffect(() => {
    if (!shift) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [shift]);

  const week = useMemo(() => {
    let gross = 0;
    let miles = 0;
    for (const s of completed) {
      gross += s.appCents + s.tipsCents;
      miles += s.endOdo - s.startOdo;
    }
        return { gross, miles, dashes: completed.length, inbox: 1 };
  }, [completed]);

  const lastEnd = useMemo(
    () => completed.reduce((max, s) => Math.max(max, s.endOdo), 62319),
    [completed],
  );

  function startDash(odo: number) {
    setShift({ startedAt: Date.now(), startOdo: odo, vehicle: LAB_VEHICLE });
    setSheet(null);
  }

  function endDash(endOdo: number, appDollars: number, tipsDollars: number) {
    if (!shift) return;
    const miles = endOdo - shift.startOdo;
    const saved: LabShift = {
      id: `demo-${Date.now()}`,
      date: '2026-09-09',
      start: '12:10',
      end: '17:02',
      startOdo: shift.startOdo,
      endOdo,
      appCents: Math.round(appDollars * 100),
      tipsCents: Math.round(tipsDollars * 100),
    };
    setCompleted((c) => [...c, saved]);
    setShift(null);
    setSheet(null);
    setToast(`Dash saved · ${miles} mi · ${labMoney(saved.appCents + saved.tipsCents)} gross — demo state only, ledger untouched`);
    window.setTimeout(() => setToast(null), 4000);
  }

  return (
    <LabFrame
      concept={1}
      title="Reach Desk — thumb-first, state-true"
      sub="Primary actions live in a bottom drive dock; the active dash never leaves reach; list rows stack title over sub."
    >
      <div className="uxlab-desk">
        {/* One-line week fact strip replaces the 4-stat grid */}
        <section className="uxlab-card">
          <div className="uxlab-label">This week · facts</div>
          <div className="uxlab-weekline">
            <span className="uxlab-weekline__big uxlab-tabular">{labMoney(week.gross)}</span>
            <span className="uxlab-weekline__rest uxlab-tabular">
              gross · {week.miles} mi · {week.dashes} dashes · {week.inbox} in inbox
            </span>
            <span className="uxlab-badge uxlab-badge--fact">Fact</span>
          </div>
        </section>

        {shift && (
          <button
            type="button"
            className="uxlab-reviewchip"
            onClick={() => setSheet('end')}
            aria-label="On the road — open end dash"
          >
            <span className="uxlab-dock__live-dot" aria-hidden />
            On the road · {LAB_VEHICLE} · from {shift.startOdo.toLocaleString('en-US')}
          </button>
        )}

        <section className="uxlab-card">
          <div className="uxlab-label">Needs review</div>
          <div className="uxlab-row" style={{ cursor: 'default' }}>
            <span className="uxlab-emoji-free" aria-hidden>2</span>
            <span className="uxlab-row__main">
              <span className="uxlab-row__title">2 items need a decision</span>
              <span className="uxlab-row__sub">1 unclassified receipt · 1 Review-class expense</span>
            </span>
            <span className="uxlab-row__value-sub">Resolve ›</span>
          </div>
        </section>

        <section className="uxlab-card">
          <div className="uxlab-label">Recent dashes</div>
          {[...completed].reverse().slice(0, 5).map((s) => {
            const miles = s.endOdo - s.startOdo;
            return (
              <div key={s.id} className="uxlab-row" style={{ cursor: 'default' }}>
                <span className="uxlab-row__main">
                  <span className="uxlab-row__title">
                    {s.date === '2026-09-07' ? 'Mon Sep 7' : s.date === '2026-09-09' ? 'Wed Sep 9' : s.date}
                  </span>
                  <span className="uxlab-row__sub uxlab-tabular">
                    {LAB_VEHICLE} · {miles} mi · {s.start}–{s.end}
                  </span>
                </span>
                <span className="uxlab-row__value">
                  <span>{labMoney(s.appCents + s.tipsCents)}</span>
                  <span className="uxlab-row__value-sub uxlab-tabular">
                    {labMoney(s.appCents)} + {labMoney(s.tipsCents)} cash
                  </span>
                </span>
              </div>
            );
          })}
        </section>

        <p className="small faint" style={{ margin: 0 }}>
          Baseline comparison: the production Desk opens with a heading block, a READY section, a
          four-stat week card, two quick actions, recent dashes, review list and backup card before
          the fold — and its Start/End controls scroll away. Here: act from the dock at any scroll
          position, scan state in one line.
        </p>
      </div>

      {/* ---- lab toast (replaces the baseline's stacked bottom toasts) ---- */}
      {toast && (
        <div className="uxlab-toast" role="status">
          {toast}
        </div>
      )}

      {/* ---- the persistent drive dock ---- */}
      <div className="uxlab-dock" role="region" aria-label="Drive dock">
        {shift ? (
          <>
            <div className="uxlab-dock__status">
              <span className="uxlab-dock__live-dot" aria-hidden />
              <strong>On the road</strong>
              <span className="uxlab-tabular">{fmtElapsed(now - shift.startedAt)} elapsed</span>
              <span className="uxlab-tabular">from {shift.startOdo.toLocaleString('en-US')} mi</span>
            </div>
            <div className="uxlab-dock__inner">
              <button type="button" className="uxlab-dock__primary uxlab-dock__primary--live" onClick={() => setSheet('end')}>
                End Dash
              </button>
            </div>
          </>
        ) : (
          <div className="uxlab-dock__inner">
            <button type="button" className="uxlab-dock__primary" onClick={() => setSheet('start')}>
              Start Dash
            </button>
            <button type="button" className="uxlab-dock__aux">Expense</button>
            <button type="button" className="uxlab-dock__aux">Receipt</button>
          </div>
        )}
      </div>

      {/* ---- lab sheets ---- */}
      {sheet === 'start' && (
        <StartSheet onStart={startDash} suggestion={lastEnd} onClose={() => setSheet(null)} />
      )}
      {sheet === 'end' && shift && (
        <EndSheet
          startOdo={shift.startOdo}
          elapsedLabel={fmtElapsed(now - shift.startedAt)}
          onSave={endDash}
          onClose={() => setSheet(null)}
        />
      )}
    </LabFrame>
  );
}

function StartSheet({
  suggestion,
  onStart,
  onClose,
}: {
  suggestion: number;
  onStart: (odo: number) => void;
  onClose: () => void;
}) {
  const [odo, setOdo] = useState(String(suggestion));
  return (
    <div className="uxlab-sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="uxlab-sheet" role="dialog" aria-modal="true" aria-label="Start dash">
        <div className="uxlab-sheet__head">
          <h3>Start dash</h3>
          <button type="button" className="uxlab-sheet__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="uxlab-sheet__desc">Saved to this device the moment you start. (Demo — lab state only.)</p>
        <label className="uxlab-fieldlabel">
          Starting odometer
          <span className="uxlab-fieldhint">Prefilled from this vehicle's last ending reading.</span>
        </label>
        <input
          className="uxlab-input"
          type="text"
          inputMode="decimal"
          value={odo}
          onChange={(e) => setOdo(e.target.value.replace(/[^\d]/g, ''))}
        />
        <button
          type="button"
          className="uxlab-btn uxlab-btn--primary"
          style={{ width: '100%', marginTop: 16 }}
          onClick={() => onStart(Number(odo) || suggestion)}
        >
          Start dash
        </button>
      </div>
    </div>
  );
}

function EndSheet({
  startOdo,
  elapsedLabel,
  onSave,
  onClose,
}: {
  startOdo: number;
  elapsedLabel: string;
  onSave: (endOdo: number, appDollars: number, tipsDollars: number) => void;
  onClose: () => void;
}) {
  const [endOdo, setEndOdo] = useState(String(startOdo + 26));
  const [app, setApp] = useState('132.80');
  const [tips, setTips] = useState('15.50');
  const miles = (Number(endOdo) || startOdo) - startOdo;
  const gross = (Number(app) || 0) + (Number(tips) || 0);
  return (
    <div className="uxlab-sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="uxlab-sheet" role="dialog" aria-modal="true" aria-label="End dash">
        <div className="uxlab-sheet__head">
          <h3>End dash</h3>
          <button type="button" className="uxlab-sheet__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="uxlab-sheet__desc">{LAB_VEHICLE} · {elapsedLabel} elapsed · from {startOdo.toLocaleString('en-US')} mi</p>
        <label className="uxlab-fieldlabel">
          Ending odometer
          <span className="uxlab-fieldhint">The one fact only you know.</span>
        </label>
        <input
          className="uxlab-input"
          type="text"
          inputMode="decimal"
          value={endOdo}
          onChange={(e) => setEndOdo(e.target.value.replace(/[^\d]/g, ''))}
        />
        <label className="uxlab-fieldlabel">
          DoorDash / app earnings
          <span className="uxlab-fieldhint">Total shown in the DoorDash app for this dash.</span>
        </label>
        <input className="uxlab-input" type="text" inputMode="decimal" value={app} onChange={(e) => setApp(e.target.value)} />
        <label className="uxlab-fieldlabel">
          Additional cash tips
          <span className="uxlab-fieldhint">Cash tips NOT already in the app total.</span>
        </label>
        <input className="uxlab-input" type="text" inputMode="decimal" value={tips} onChange={(e) => setTips(e.target.value)} />
        <div className="uxlab-preview">
          <div className="uxlab-preview__cell">
            <div className="uxlab-preview__num uxlab-tabular">{miles >= 0 ? miles : 0} mi</div>
            <div className="uxlab-preview__lbl">Miles</div>
          </div>
          <div className="uxlab-preview__cell">
            <div className="uxlab-preview__num uxlab-tabular">{elapsedLabel}</div>
            <div className="uxlab-preview__lbl">Duration</div>
          </div>
          <div className="uxlab-preview__cell">
            <div className="uxlab-preview__num uxlab-tabular">{labMoney(Math.round(gross * 100))}</div>
            <div className="uxlab-preview__lbl">Gross</div>
          </div>
        </div>
        <button
          type="button"
          className="uxlab-btn uxlab-btn--primary"
          style={{ width: '100%', marginTop: 16 }}
          onClick={() => onSave(Number(endOdo) || startOdo, Number(app) || 0, Number(tips) || 0)}
        >
          Save dash
        </button>
      </div>
    </div>
  );
}
