import { useMemo, useState } from 'react';
import { useLedger, useLedgerContext } from '../../state/store';
import { Button, Card, DisclaimerNote, Money, Notice, StatGrid } from '../../components/ui';
import { MoneyInput, NumberInput, SelectInput } from '../../components/forms';
import { saveSettings } from '../../db/repositories';
import { yearOf } from '../../domain/dates';
import {
  summariseYear,
  summariseYearByMonth,
  annualOdometerResult,
  actualExpensePlanning,
  reconcileStatement,
} from '../../domain/aggregation';
import { parseMoneyToCents, formatCents } from '../../domain/money';
import { buildTaxBinderHtml } from '../../services/taxBinder';
import { deliverFile } from '../../services/share';
import { markBackupGenerated } from '../../db/repositories';

export function YearReport({ year: yearParam }: { year: string | null }) {
  const snap = useLedger();
  const { mutate, pushToast } = useLedgerContext();
  const { shifts, expenses, receipts, weeklyClosures, mileageRates, settings } = snap;

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const s of shifts) set.add(yearOf(s.date));
    for (const e of expenses) set.add(yearOf(e.date));
    return [...set].sort((a, b) => b - a);
  }, [shifts, expenses]);

  const [year, setYear] = useState<number>(
    yearParam && years.includes(Number(yearParam)) ? Number(yearParam) : years[0],
  );

  const reviewed = useMemo(() => new Set(weeklyClosures.map((w) => w.weekKey)), [weeklyClosures]);
  const yr = useMemo(
    () => summariseYear(year, shifts, expenses, receipts, reviewed, mileageRates, settings.implausibleMiles),
    [year, shifts, expenses, receipts, reviewed, mileageRates, settings.implausibleMiles],
  );
  const months = useMemo(
    () => summariseYearByMonth(year, shifts, expenses, settings.implausibleMiles),
    [year, shifts, expenses, settings.implausibleMiles],
  );
  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const odoRec = settings.annualOdometers.find((o) => o.year === year);
  const odo = annualOdometerResult(odoRec?.startOdometer ?? null, odoRec?.endOdometer ?? null, yr.businessMiles);
  const planning = actualExpensePlanning(yr.expenses, odo);
  const stmtRec = settings.statementTotals.find((s) => s.year === year);
  const recon = reconcileStatement(stmtRec?.appEarningsCents ?? null, yr.appEarningsCents, yr.cashTipsCents);

  // Annual odometer editing
  const [annualStart, setAnnualStart] = useState(odoRec?.startOdometer != null ? String(odoRec.startOdometer) : '');
  const [annualEnd, setAnnualEnd] = useState(odoRec?.endOdometer != null ? String(odoRec.endOdometer) : '');
  const [stmt, setStmt] = useState(stmtRec?.appEarningsCents != null ? formatCents(stmtRec.appEarningsCents).replace('$', '') : '');
  const [binderBusy, setBinderBusy] = useState(false);

  function pickYear(v: string) {
    setYear(Number(v));
    const rec = settings.annualOdometers.find((o) => o.year === Number(v));
    setAnnualStart(rec?.startOdometer != null ? String(rec.startOdometer) : '');
    setAnnualEnd(rec?.endOdometer != null ? String(rec.endOdometer) : '');
    const s = settings.statementTotals.find((x) => x.year === Number(v));
    setStmt(s?.appEarningsCents != null ? formatCents(s.appEarningsCents).replace('$', '') : '');
  }

  async function saveAnnualOdo() {
    const start = annualStart.trim() === '' ? null : Number(annualStart);
    const end = annualEnd.trim() === '' ? null : Number(annualEnd);
    const rest = settings.annualOdometers.filter((o) => o.year !== year);
    await mutate(
      () => saveSettings({ annualOdometers: [...rest, { year, vehicleId: null, startOdometer: start, endOdometer: end }] }),
      { success: 'Annual odometer saved' },
    );
  }

  async function saveStatement() {
    const cents = parseMoneyToCents(stmt);
    const rest = settings.statementTotals.filter((s) => s.year !== year);
    await mutate(
      () => saveSettings({ statementTotals: [...rest, { year, appEarningsCents: cents, note: '' }] }),
      { success: 'Statement total saved' },
    );
  }

  async function generateBinder() {
    setBinderBusy(true);
    try {
      const html = await buildTaxBinderHtml({
        year,
        shifts,
        expenses,
        receipts,
        weeklyClosures,
        mileageRates,
        settings,
      });
      const res = await deliverFile(`dash-ledger-tax-binder-${year}.html`, html, 'text/html');
      await markBackupGenerated();
      pushToast(res === 'shared' ? 'Tax Binder shared' : 'Tax Binder downloaded');
    } catch (err) {
      pushToast((err as Error).message || 'Could not build the Tax Binder', 'danger');
    } finally {
      setBinderBusy(false);
    }
  }

  return (
    <div className="stack">
      <Card>
        <SelectInput
          label="Year"
          value={String(year)}
          onChange={pickYear}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <StatGrid
          stats={[
            { label: 'Shifts', value: yr.completedShiftCount, sub: `${yr.shiftCount} total` },
            { label: 'DoorDash earnings', value: <Money cents={yr.appEarningsCents} /> },
            { label: 'Cash tips', value: <Money cents={yr.cashTipsCents} /> },
            { label: 'Gross income', value: <Money cents={yr.grossIncomeCents} /> },
            { label: 'Business miles', value: yr.businessMiles.toLocaleString('en-US') },
            {
              label: 'Standard mileage estimate',
              value: <Money cents={yr.mileage.estimateCents} />,
              sub: yr.mileage.unpricedMiles > 0 ? `${yr.mileage.unpricedMiles} mi unpriced` : 'planning estimate',
            },
          ]}
        />
        <div className="divider" />
        <StatGrid
          stats={[
            { label: 'Non-vehicle business', value: <Money cents={yr.expenses.nonVehicleBusinessCents} /> },
            { label: 'Vehicle actual-expense', value: <Money cents={yr.expenses.vehicleActualCents} /> },
            { label: 'Parking', value: <Money cents={yr.expenses.parkingCents} /> },
            { label: 'Tolls', value: <Money cents={yr.expenses.tollsCents} /> },
            { label: 'Review-class expenses', value: <Money cents={yr.expenses.reviewCents} />, sub: `${yr.expenses.reviewCount} item(s)` },
            { label: 'Total tracked expenses', value: <Money cents={yr.expenses.totalCents} /> },
          ]}
        />
        <div className="divider" />
        <StatGrid
          stats={[
            { label: 'Reviewed weeks', value: `${yr.reviewedWeeks} / ${yr.completedWeeks}` },
            { label: 'Receipts', value: yr.receiptCount, sub: `${yr.linkedReceiptCount} linked` },
            { label: 'Unresolved receipts', value: yr.unresolvedReceiptCount },
            { label: 'Unresolved records', value: yr.unresolvedRecordCount },
          ]}
        />
      </Card>

      <Card label="Month by month">
        <details className="disclosure">
          <summary>
            {months.filter((m) => m.dashCount > 0 || m.trackedExpensesCents > 0).length} month(s) with
            activity
          </summary>
          <div className="disclosure__body" style={{ overflowX: 'auto' }}>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Dashes</th>
                  <th className="num">Gross</th>
                  <th className="num">Miles</th>
                  <th className="num">Expenses</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className={m.dashCount === 0 && m.trackedExpensesCents === 0 ? 'faint' : ''}>
                    <td>{MONTH_NAMES[m.month - 1]}</td>
                    <td className="num">{m.dashCount}</td>
                    <td className="num">{formatCents(m.grossIncomeCents)}</td>
                    <td className="num">{m.businessMiles.toLocaleString('en-US')}</td>
                    <td className="num">{formatCents(m.trackedExpensesCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <Card label="Mileage estimate by effective rate period">
        {yr.mileage.byPeriod.length === 0 ? (
          <p className="small muted">No priced mileage for {year}.</p>
        ) : (
          <div className="rows">
            {yr.mileage.byPeriod.map((p) => (
              <div key={p.key} className="row-link" style={{ cursor: 'default' }}>
                <span className="row-link__main">
                  <span className="row-link__title">{p.label}</span>
                  <span className="row-link__sub">
                    ${p.ratePerMile.toFixed(3)}/mi · {p.miles.toLocaleString('en-US')} mi
                  </span>
                </span>
                <span className="row-link__value">
                  <Money cents={p.estimateCents} />
                </span>
              </div>
            ))}
          </div>
        )}
        {yr.mileage.unpricedMiles > 0 && (
          <Notice tone="warn">
            {yr.mileage.unpricedMiles} business miles have no configured rate and are excluded from the
            estimate. Add a rate period in Rates.
          </Notice>
        )}
      </Card>

      <Card label="Annual odometer & business use">
        <NumberInput label="Annual beginning odometer" value={annualStart} onChange={setAnnualStart} />
        <NumberInput label="Annual ending odometer" value={annualEnd} onChange={setAnnualEnd} />
        <Button onClick={saveAnnualOdo}>Save annual odometer</Button>
        <div style={{ marginTop: 12 }}>
          {odo.hasData ? (
            <div className="kv">
              <div className="kv__row">
                <dt>Annual vehicle miles</dt>
                <dd>{odo.annualVehicleMiles?.toLocaleString('en-US') ?? '—'}</dd>
              </div>
              <div className="kv__row">
                <dt>Business-use %</dt>
                <dd>{odo.businessUsePercentage !== null ? `${odo.businessUsePercentage.toFixed(1)}%` : '—'}</dd>
              </div>
            </div>
          ) : (
            <p className="small muted">Enter both readings to calculate annual vehicle miles.</p>
          )}
          {odo.message && <Notice tone={odo.status === 'inconsistent' || odo.status === 'reversed' ? 'danger' : 'warn'}>{odo.message}</Notice>}
        </div>
      </Card>

      <Card label="Actual-expense planning comparison">
        <p className="small faint">Organisational planning aid only — not tax advice.</p>
        {planning.available ? (
          <div className="kv">
            <div className="kv__row">
              <dt>Vehicle actual-expense evidence</dt>
              <dd><Money cents={planning.vehicleActualCents} /></dd>
            </div>
            <div className="kv__row">
              <dt>× business-use {planning.businessUsePercentage!.toFixed(1)}%</dt>
              <dd><Money cents={planning.allocatedVehicleExpensesCents} /></dd>
            </div>
            <div className="kv__row">
              <dt>Parking (separate)</dt>
              <dd><Money cents={planning.parkingCents} /></dd>
            </div>
            <div className="kv__row">
              <dt>Tolls (separate)</dt>
              <dd><Money cents={planning.tollsCents} /></dd>
            </div>
          </div>
        ) : (
          <p className="small muted">Needs valid annual odometer data to produce a comparison.</p>
        )}
      </Card>

      <Card label="Statement / 1099 reconciliation">
        <MoneyInput
          label="Year-end platform statement total"
          hint="The DoorDash / platform earnings figure. Cash tips are kept separate."
          value={stmt}
          onChange={setStmt}
        />
        <Button onClick={saveStatement}>Save statement total</Button>
        <div style={{ marginTop: 12 }}>
          {recon.hasStatement ? (
            <div className="kv">
              <div className="kv__row">
                <dt>Statement total</dt>
                <dd><Money cents={recon.statementTotalCents} /></dd>
              </div>
              <div className="kv__row">
                <dt>Recorded app earnings</dt>
                <dd><Money cents={recon.recordedAppEarningsCents} /></dd>
              </div>
              <div className="kv__row">
                <dt>Cash tips (separate)</dt>
                <dd><Money cents={recon.cashTipsCents} /></dd>
              </div>
              <div className="kv__row">
                <dt>Total ledger gross</dt>
                <dd><Money cents={recon.totalLedgerGrossCents} /></dd>
              </div>
              <div className="kv__row">
                <dt>Statement difference</dt>
                <dd><Money cents={recon.statementDeltaCents} sign /></dd>
              </div>
            </div>
          ) : (
            <p className="small muted">No statement total entered for {year}.</p>
          )}
          {recon.hasStatement && recon.statementDeltaCents !== 0 && (
            <Notice tone="warn">
              Statement and recorded app earnings differ. Investigate the discrepancy — Dash Ledger
              never changes either figure to force a match.
            </Notice>
          )}
        </div>
      </Card>

      <Card label="Tax Binder">
        <p className="small muted">
          A standalone, printable HTML file for {year} with the full shift log, expenses, receipt
          images and every summary above. Works offline with no app needed.
        </p>
        <Button variant="primary" block onClick={generateBinder} disabled={binderBusy}>
          {binderBusy ? 'Building…' : `Generate ${year} Tax Binder`}
        </Button>
      </Card>

      <DisclaimerNote />
    </div>
  );
}
