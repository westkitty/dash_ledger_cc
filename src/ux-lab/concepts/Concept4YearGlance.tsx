/**
 * UX Lab · Concept 4 — "Year at a glance"
 *
 * Redesign hypothesis: the production Year report is a flat grid of 8+
 * equal-weight stat tiles behind a tab named "Tax · Vault" → "Year"; the two
 * numbers a driver actually files with (gross, standard-mileage deduction)
 * carry the same visual weight as shift counts, and no trend is visible
 * without reading a 12-row table. This demo leads with those two numbers,
 * renders the year as a tap-explored 12-month bar chart (pure SVG-free CSS
 * bars — no new dependency), keeps ESTIMATE labeling on every derived number,
 * and progressively discloses month detail and reconciliation.
 *
 * Local mock state only — no store, no db.
 */

import { useMemo, useState } from 'react';
import { LabFrame } from '../LabFrame';
import { LAB_YEAR_2026, labMoney } from '../fixtures';

type Metric = 'gross' | 'deduction' | 'miles';

export function Concept4YearGlance() {
  const [metric, setMetric] = useState<Metric>('gross');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(8); // September
  const [openMonth, setOpenMonth] = useState<number | null>(null);
  const [reconOpen, setReconOpen] = useState(false);

  const totals = useMemo(() => {
    let gross = 0;
    let deduction = 0;
    let miles = 0;
    let expenses = 0;
    let dashes = 0;
    for (const m of LAB_YEAR_2026) {
      gross += m.grossCents;
      deduction += m.deductionCents;
      miles += m.miles;
      expenses += m.expenseCents;
      dashes += m.dashes;
    }
    return { gross, deduction, miles, expenses, dashes };
  }, []);

  const valueFor = (m: (typeof LAB_YEAR_2026)[number]): number =>
    metric === 'gross' ? m.grossCents : metric === 'deduction' ? m.deductionCents : m.miles;

  const max = Math.max(...LAB_YEAR_2026.map(valueFor), 1);
  const selected = selectedMonth != null ? LAB_YEAR_2026[selectedMonth] : null;

  const metricLabel = metric === 'gross' ? 'Gross income' : metric === 'deduction' ? 'Mileage deduction (estimate)' : 'Business miles';

  function fmtMetric(v: number): string {
    return metric === 'miles' ? `${v.toLocaleString('en-US')} mi` : labMoney(v);
  }

  return (
    <LabFrame
      concept={4}
      title="Year at a glance — trend first, filing numbers up front"
      sub="Gross and the standard-mileage estimate lead; months are a tappable trend, not a wall of tiles; reconciliation stays guarded."
    >
      {/* hero: the two numbers that matter, with honest labels */}
      <section className="uxlab-year-hero">
        <div className="uxlab-year-hero__cell">
          <span className="uxlab-badge uxlab-badge--fact">Fact</span>
          <div className="uxlab-year-hero__num uxlab-tabular">{labMoney(totals.gross)}</div>
          <div className="uxlab-year-hero__sub">Gross income · 2026 · {totals.dashes} dashes</div>
        </div>
        <div className="uxlab-year-hero__cell uxlab-year-hero__cell--estimate">
          <span className="uxlab-badge uxlab-badge--estimate">Estimate</span>
          <div className="uxlab-year-hero__num uxlab-tabular">{labMoney(totals.deduction)}</div>
          <div className="uxlab-year-hero__sub">
            Standard-mileage deduction · {totals.miles.toLocaleString('en-US')} business mi
          </div>
        </div>
      </section>

      {/* trend */}
      <section className="uxlab-card">
        <div className="uxlab-label">Month by month</div>
        <div className="uxlab-metric-switch" role="group" aria-label="Chart metric">
          {(
            [
              ['gross', 'Gross'],
              ['deduction', 'Deduction'],
              ['miles', 'Miles'],
            ] as Array<[Metric, string]>
          ).map(([key, lbl]) => (
            <button
              key={key}
              type="button"
              className={`uxlab-seg__btn ${metric === key ? 'uxlab-seg__btn--primary' : ''}`}
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {lbl}
            </button>
          ))}
        </div>
        <div className="uxlab-chart" role="img" aria-label={`${metricLabel} by month, 2026`}>
          {LAB_YEAR_2026.map((m, i) => {
            const v = valueFor(m);
            const h = Math.round((v / max) * 100);
            return (
              <button
                key={m.label}
                type="button"
                className={`uxlab-chart__col ${selectedMonth === i ? 'uxlab-chart__col--sel' : ''}`}
                aria-label={`${m.label}: ${fmtMetric(v)}`}
                aria-pressed={selectedMonth === i}
                onClick={() => setSelectedMonth(selectedMonth === i ? null : i)}
              >
                <span className="uxlab-chart__bar" style={{ height: `${h}%` }} />
              </button>
            );
          })}
        </div>
        <div className="uxlab-chart__axis" aria-hidden>
          {LAB_YEAR_2026.map((m) => (
            <span key={m.label}>{m.label.slice(0, 1)}</span>
          ))}
        </div>
        {selected && (
          <div className="uxlab-chart-detail">
            <div className="uxlab-chart-detail__cell">
              <div className="uxlab-preview__num uxlab-tabular">{labMoney(selected.grossCents)}</div>
              <div className="uxlab-preview__lbl">{selected.label} gross · fact</div>
            </div>
            <div className="uxlab-chart-detail__cell">
              <div className="uxlab-preview__num uxlab-tabular">{labMoney(selected.deductionCents)}</div>
              <div className="uxlab-preview__lbl">Deduction · estimate</div>
            </div>
            <div className="uxlab-chart-detail__cell">
              <div className="uxlab-preview__num uxlab-tabular">{selected.miles} mi</div>
              <div className="uxlab-preview__lbl">{selected.dashes} dashes</div>
            </div>
            <div className="uxlab-chart-detail__cell">
              <div className="uxlab-preview__num uxlab-tabular">{labMoney(selected.expenseCents)}</div>
              <div className="uxlab-preview__lbl">Tracked expenses</div>
            </div>
          </div>
        )}
        {!selected && (
          <p className="small faint" style={{ marginTop: 10, marginBottom: 0 }}>
            Tap any bar to inspect that month.
          </p>
        )}
      </section>

      {/* estimate vs actual comparison — kept explicit, never merged */}
      <section className="uxlab-card">
        <div className="uxlab-label">Standard vs actual</div>
        <div className="uxlab-vs uxlab-tabular">
          <span>
            Standard method <strong>{labMoney(totals.deduction)}</strong> · actual vehicle expenses{' '}
            <strong>{labMoney(totals.expenses)}</strong> — standard is higher in 2026 (estimate,
            planning only).
          </span>
        </div>
      </section>

      {/* months drill-down */}
      <section className="uxlab-card uxlab-months">
        <div className="uxlab-label">Months with activity</div>
        {LAB_YEAR_2026.filter((m) => m.dashes > 0).map((m) => {
          const idx = LAB_YEAR_2026.indexOf(m);
          const open = openMonth === idx;
          return (
            <div key={m.label}>
              <button
                type="button"
                className="uxlab-row"
                aria-expanded={open}
                onClick={() => setOpenMonth(open ? null : idx)}
              >
                <span className="uxlab-row__main">
                  <span className="uxlab-row__title">{m.label} 2026</span>
                  <span className="uxlab-row__sub uxlab-tabular">
                    {m.dashes} dashes · {m.miles} mi
                  </span>
                </span>
                <span className="uxlab-row__value">
                  <span className="uxlab-tabular">{labMoney(m.grossCents)}</span>
                  <span className="uxlab-row__value-sub">{open ? 'close' : 'detail'}</span>
                </span>
              </button>
              {open && (
                <div className="uxlab-monthdetail uxlab-tabular">
                  <span>Gross {labMoney(m.grossCents)}</span>
                  <span>Deduction est. {labMoney(m.deductionCents)}</span>
                  <span>Expenses {labMoney(m.expenseCents)}</span>
                  <span>Rate {`$${labRateLabel(idx)}`}/mi</span>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* reconciliation — guarded, collapsed, clearly secondary */}
      <section className="uxlab-card">
        <button
          type="button"
          className="uxlab-attention__summary"
          aria-expanded={reconOpen}
          onClick={() => setReconOpen(!reconOpen)}
        >
          <span>Reconcile DoorDash statements · <strong>nothing entered yet</strong></span>
          <span aria-hidden>{reconOpen ? '▴' : '▾'}</span>
        </button>
        {reconOpen && (
          <div className="uxlab-attention__body">
            <div className="uxlab-attention__item">
              <span className="uxlab-attention__dot uxlab-attention__dot--info" aria-hidden />
              <span>
                Enter the totals DoorDash reports for 2026 and Dash Ledger shows the difference
                against your records — it never auto-matches or "fixes" either side.
              </span>
            </div>
            <div className="uxlab-seg">
              <button type="button" className="uxlab-seg__btn">Enter statement totals…</button>
            </div>
          </div>
        )}
      </section>

      <p className="small faint" style={{ margin: 0 }}>
        Production comparison: Vault → Year currently opens on a flat 8-tile grid; the trend table
        and reconciliation sit below the fold. Here the year answers "how much did I make and what
        might it deduct?" at the fold, with drill-down one tap deep.
      </p>
    </LabFrame>
  );
}

function labRateLabel(monthIndex: number): string {
  // 2026 H1 0.725 / H2 0.760 — mirrors the seeded effective-dated rates.
  return monthIndex <= 5 ? '0.725' : '0.760';
}
