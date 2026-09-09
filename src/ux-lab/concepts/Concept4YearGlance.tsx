import { useMemo, useState } from 'react';
import { useRouter } from '../../app/router';
import { useLedger } from '../../state/store';
import { estimateMileage, summariseYear, summariseYearByMonth } from '../../domain/aggregation';
import { formatCents } from '../../domain/money';
import { yearOf } from '../../domain/dates';
import { LabFrame } from '../LabFrame';

type Metric = 'gross' | 'deduction' | 'miles';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function Concept4YearGlance() {
  const snap = useLedger();
  const { navigate } = useRouter();
  const year = yearOf(snap.today);
  const [metric, setMetric] = useState<Metric>('gross');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(Number(snap.today.slice(5, 7)) - 1);

  const reviewed = useMemo(() => new Set(snap.weeklyClosures.map((c) => c.weekKey)), [snap.weeklyClosures]);
  const totals = useMemo(
    () => summariseYear(year, snap.shifts, snap.expenses, snap.receipts, reviewed, snap.mileageRates, snap.settings.implausibleMiles, snap.today),
    [year, snap.shifts, snap.expenses, snap.receipts, reviewed, snap.mileageRates, snap.settings.implausibleMiles, snap.today],
  );
  const months = useMemo(
    () => summariseYearByMonth(year, snap.shifts, snap.expenses, snap.settings.implausibleMiles),
    [year, snap.shifts, snap.expenses, snap.settings.implausibleMiles],
  );
  const monthDeductions = useMemo(() => MONTHS.map((_, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const shifts = snap.shifts.filter((s) => s.status === 'completed' && s.date.startsWith(`${year}-${mm}-`));
    return estimateMileage(shifts, snap.mileageRates, snap.settings.implausibleMiles).estimateCents;
  }), [year, snap.shifts, snap.mileageRates, snap.settings.implausibleMiles]);

  const values = months.map((m, i) => metric === 'gross' ? m.grossIncomeCents : metric === 'deduction' ? monthDeductions[i] : m.businessMiles);
  const max = Math.max(...values, 1);
  const selected = selectedMonth == null ? null : months[selectedMonth];
  const statement = snap.settings.statementTotals.find((s) => s.year === year);

  function fmtMetric(v: number): string {
    return metric === 'miles' ? `${v.toLocaleString('en-US')} mi` : formatCents(v);
  }

  return (
    <LabFrame
      concept={4}
      title="Year at a glance — trend first, filing numbers up front"
      sub="The headline and month trend are calculated from the same live shifts, expenses, receipts, rates, and review state as the current UI."
    >
      <section className="uxlab-year-hero">
        <div className="uxlab-year-hero__cell">
          <span className="uxlab-badge uxlab-badge--fact">Fact</span>
          <div className="uxlab-year-hero__num uxlab-tabular">{formatCents(totals.grossIncomeCents)}</div>
          <div className="uxlab-year-hero__sub">Gross income · {year} · {totals.completedShiftCount} completed dashes</div>
        </div>
        <div className="uxlab-year-hero__cell uxlab-year-hero__cell--estimate">
          <span className="uxlab-badge uxlab-badge--estimate">Estimate</span>
          <div className="uxlab-year-hero__num uxlab-tabular">{formatCents(totals.mileage.estimateCents)}</div>
          <div className="uxlab-year-hero__sub">Standard-mileage deduction · {totals.businessMiles.toLocaleString('en-US')} business mi</div>
        </div>
      </section>

      <section className="uxlab-card">
        <div className="uxlab-label">Month by month · live</div>
        <div className="uxlab-metric-switch" role="group" aria-label="Chart metric">
          {([['gross', 'Gross'], ['deduction', 'Deduction'], ['miles', 'Miles']] as Array<[Metric, string]>).map(([key, label]) => (
            <button key={key} type="button" className={`uxlab-seg__btn ${metric === key ? 'uxlab-seg__btn--primary' : ''}`} aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</button>
          ))}
        </div>
        <div className="uxlab-chart" role="img" aria-label={`${metric} by month, ${year}`}>
          {months.map((m, i) => {
            const v = values[i];
            const h = Math.round((v / max) * 100);
            return (
              <button
                key={m.month}
                type="button"
                className={`uxlab-chart__col ${selectedMonth === i ? 'uxlab-chart__col--sel' : ''}`}
                aria-label={`${MONTHS[i]}: ${fmtMetric(v)}`}
                aria-pressed={selectedMonth === i}
                onClick={() => setSelectedMonth(selectedMonth === i ? null : i)}
              >
                <span className="uxlab-chart__bar" style={{ height: `${h}%` }} />
              </button>
            );
          })}
        </div>
        <div className="uxlab-chart__axis" aria-hidden>{MONTHS.map((m) => <span key={m}>{m.slice(0, 1)}</span>)}</div>
        {selected && selectedMonth != null && (
          <div className="uxlab-chart-detail">
            <div className="uxlab-chart-detail__cell"><div className="uxlab-preview__num uxlab-tabular">{formatCents(selected.grossIncomeCents)}</div><div className="uxlab-preview__lbl">{MONTHS[selectedMonth]} gross · fact</div></div>
            <div className="uxlab-chart-detail__cell"><div className="uxlab-preview__num uxlab-tabular">{formatCents(monthDeductions[selectedMonth])}</div><div className="uxlab-preview__lbl">Deduction · estimate</div></div>
            <div className="uxlab-chart-detail__cell"><div className="uxlab-preview__num uxlab-tabular">{selected.businessMiles} mi</div><div className="uxlab-preview__lbl">{selected.dashCount} dashes</div></div>
            <div className="uxlab-chart-detail__cell"><div className="uxlab-preview__num uxlab-tabular">{formatCents(selected.trackedExpensesCents)}</div><div className="uxlab-preview__lbl">Tracked expenses</div></div>
          </div>
        )}
      </section>

      <section className="uxlab-card">
        <div className="uxlab-label">Ledger health</div>
        <div className="uxlab-vs uxlab-tabular">
          <span>{totals.reviewedWeeks} reviewed week{totals.reviewedWeeks === 1 ? '' : 's'} · {totals.unresolvedRecordCount} unresolved record{totals.unresolvedRecordCount === 1 ? '' : 's'} · {totals.receiptCount} receipts</span>
        </div>
      </section>

      <section className="uxlab-card">
        <div className="uxlab-label">DoorDash statement reconciliation</div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {statement?.appEarningsCents == null
            ? `No ${year} statement total entered yet.`
            : `Statement app earnings: ${formatCents(statement.appEarningsCents)} · ledger app earnings: ${formatCents(totals.appEarningsCents)}.`}
        </p>
        <button type="button" className="uxlab-btn" onClick={() => navigate(`/vault?s=year&y=${year}&demo=1`)}>Open full Year / reconciliation →</button>
      </section>
    </LabFrame>
  );
}
