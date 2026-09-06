/**
 * Tax Binder: a standalone, offline, printable HTML file for one year.
 *
 * The output does not depend on the app, IndexedDB, or any script. CSS is
 * embedded; receipt images are embedded as data URLs.
 */

import type {
  Expense,
  MileageRate,
  Receipt,
  Settings,
  Shift,
  WeeklyClosure,
} from '../domain/types';
import { TAX_CLASS_LABELS, type TaxClass } from '../domain/types';
import { TAX_CLASS_ORDER } from '../domain/expenses';
import { formatCents, grossIncomeCents } from '../domain/money';
import { formatLocalDate, formatWeekRange, mondayOf, yearOf, isWeekTemporallyComplete } from '../domain/dates';
import { computeMileage } from '../domain/mileage';
import { formatHours, shiftDuration } from '../domain/duration';
import {
  summariseYear,
  annualOdometerResult,
  actualExpensePlanning,
  reconcileStatement,
  bucketExpenses,
} from '../domain/aggregation';
import { getReceiptBlob } from '../db/repositories';
import { blobToDataUrl } from './receiptImages';

const DISCLAIMER =
  'Dash Ledger organizes records and provides estimates. It is not tax advice and does not determine whether a particular expense is deductible.';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface TaxBinderInput {
  year: number;
  shifts: Shift[];
  expenses: Expense[];
  receipts: Receipt[];
  weeklyClosures: WeeklyClosure[];
  mileageRates: MileageRate[];
  settings: Settings;
}

export async function buildTaxBinderHtml(input: TaxBinderInput): Promise<string> {
  const { year, settings } = input;
  const shifts = input.shifts.filter((s) => yearOf(s.date) === year).sort((a, b) => a.date.localeCompare(b.date));
  const expenses = input.expenses.filter((e) => yearOf(e.date) === year).sort((a, b) => a.date.localeCompare(b.date));
  const receipts = input.receipts.filter((r) => r.date && yearOf(r.date) === year);
  const reviewed = new Set(input.weeklyClosures.map((w) => w.weekKey));

  const yr = summariseYear(year, input.shifts, input.expenses, input.receipts, reviewed, input.mileageRates, settings.implausibleMiles);

  const odoRec = settings.annualOdometers.find((o) => o.year === year);
  const odo = annualOdometerResult(odoRec?.startOdometer ?? null, odoRec?.endOdometer ?? null, yr.businessMiles);
  const planning = actualExpensePlanning(yr.expenses, odo);
  const stmtRec = settings.statementTotals.find((s) => s.year === year);
  const recon = reconcileStatement(stmtRec?.appEarningsCents ?? null, yr.appEarningsCents, yr.cashTipsCents);

  // Weekly summary rows
  const weekKeys = [...new Set(shifts.map((s) => mondayOf(s.date)))].sort();
  const weekRows = weekKeys
    .map((wk) => {
      const isReviewed = reviewed.has(wk);
      const complete = isWeekTemporallyComplete(wk);
      const state = isReviewed ? 'Reviewed' : complete ? 'Review due' : 'In progress';
      return `<tr><td>${esc(formatWeekRange(wk))}</td><td>${esc(state)}</td></tr>`;
    })
    .join('');

  // Shift log
  const shiftRows = shifts
    .map((s) => {
      const m = computeMileage(s.startOdometer, s.endOdometer, settings.implausibleMiles);
      const dur = shiftDuration(s.startTime, s.endTime);
      const gross = grossIncomeCents(s.appEarningsCents, s.cashTipsCents);
      const flag = m.status === 'suspicious' ? ' ⚠' : m.status === 'reversed' ? ' ⚠' : '';
      return `<tr>
        <td>${esc(formatLocalDate(s.date))}</td>
        <td>${esc(s.vehicleLabel)}</td>
        <td>${esc(s.startTime ?? '—')}–${esc(s.endTime ?? '—')}</td>
        <td class="num">${dur.known ? esc(formatHours(dur.hours)) : '—'}</td>
        <td class="num">${s.startOdometer ?? '—'} → ${s.endOdometer ?? '—'}</td>
        <td class="num">${m.miles === null ? '—' : esc(m.miles)}${flag}</td>
        <td class="num">${esc(formatCents(s.appEarningsCents))}</td>
        <td class="num">${esc(formatCents(s.cashTipsCents))}</td>
        <td class="num">${esc(formatCents(gross))}</td>
      </tr>`;
    })
    .join('');

  // Expenses grouped by tax class
  const expenseSections = TAX_CLASS_ORDER.map((cls: TaxClass) => {
    const rows = expenses.filter((e) => e.taxClass === cls);
    if (rows.length === 0) return '';
    const subtotal = rows.reduce((a, e) => a + e.amountCents, 0);
    const body = rows
      .map(
        (e) => `<tr>
          <td>${esc(formatLocalDate(e.date))}</td>
          <td>${esc(e.merchant || '—')}</td>
          <td>${esc(e.category)}</td>
          <td class="num">${esc(formatCents(e.amountCents))}</td>
          <td>${e.receiptId ? 'yes' : '—'}</td>
          <td>${esc(e.notes)}</td>
        </tr>`,
      )
      .join('');
    return `<h3>${esc(cls)} — ${esc(TAX_CLASS_LABELS[cls])}</h3>
      <table>
        <thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th class="num">Amount</th><th>Receipt</th><th>Notes</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td colspan="3">Subtotal</td><td class="num">${esc(formatCents(subtotal))}</td><td colspan="2"></td></tr></tfoot>
      </table>`;
  }).join('');

  // Receipt images
  const receiptBlocks: string[] = [];
  for (const r of receipts) {
    let img = '';
    try {
      const blob = await getReceiptBlob(r.id);
      if (blob?.image) {
        const dataUrl = await blobToDataUrl(blob.image);
        img = `<img src="${dataUrl}" alt="Receipt ${esc(r.merchant || r.originalFilename)}" />`;
      }
    } catch {
      img = '<p class="muted">(image unavailable)</p>';
    }
    receiptBlocks.push(`<figure class="receipt">
      ${img || '<p class="muted">(no image)</p>'}
      <figcaption>${esc(r.date ?? r.capturedAt.slice(0, 10))} · ${esc(r.merchant || '—')} · ${esc(
        formatCents(r.amountCents),
      )} · ${esc(r.status)}${r.imageProcessingError ? ' · optimisation failed (original kept)' : ''}</figcaption>
    </figure>`);
  }

  const byPeriodRows = yr.mileage.byPeriod
    .map(
      (p) =>
        `<tr><td>${esc(p.label)}</td><td class="num">$${p.ratePerMile.toFixed(3)}/mi</td><td class="num">${esc(
          p.miles,
        )}</td><td class="num">${esc(formatCents(p.estimateCents))}</td></tr>`,
    )
    .join('');

  const unresolved =
    yr.unresolvedRecordCount > 0
      ? `<div class="warn"><strong>${yr.unresolvedRecordCount} unresolved / incomplete record(s)</strong> in ${year}: open dashes, missing odometer readings, Review-class expenses, or receipts still in the Inbox. Resolve these in the app for a complete record.</div>`
      : `<div class="ok">No unresolved or incomplete records detected for ${year}.</div>`;

  const totalBuckets = bucketExpenses(expenses);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dash Ledger Tax Binder ${year}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #1a1a1a; background: #fff; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 28px 0 8px; border-bottom: 2px solid #0f766e; padding-bottom: 4px; }
  h3 { font-size: 15px; margin: 18px 0 6px; }
  .muted, .generated { color: #666; font-size: 12px; }
  .disclaimer { background: #f4f4f5; border-left: 4px solid #0f766e; padding: 10px 14px; margin: 14px 0; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 4px; font-size: 12.5px; }
  th, td { border: 1px solid #d4d4d8; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f4f4f5; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 600; background: #fafafa; }
  dl.summary { display: grid; grid-template-columns: max-content 1fr; gap: 2px 16px; margin: 8px 0; }
  dl.summary dt { color: #555; }
  dl.summary dd { margin: 0; font-variant-numeric: tabular-nums; }
  .warn { background: #fef3c7; border-left: 4px solid #d97706; padding: 10px 14px; margin: 12px 0; }
  .ok { background: #dcfce7; border-left: 4px solid #16a34a; padding: 10px 14px; margin: 12px 0; }
  .receipts { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  figure.receipt { margin: 0; border: 1px solid #d4d4d8; padding: 8px; break-inside: avoid; }
  figure.receipt img { width: 100%; height: auto; display: block; }
  figcaption { font-size: 11.5px; color: #444; margin-top: 6px; }
  @media print { body { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head><body>
<h1>Dash Ledger — Tax Binder ${year}</h1>
<p class="generated">Generated ${esc(new Date().toISOString())}</p>
<div class="disclaimer">${esc(DISCLAIMER)}</div>

${unresolved}

<h2>Annual summary</h2>
<dl class="summary">
  <dt>Shifts</dt><dd>${yr.completedShiftCount} completed (${yr.shiftCount} total)</dd>
  <dt>DoorDash / app earnings</dt><dd>${esc(formatCents(yr.appEarningsCents))}</dd>
  <dt>Cash tips (not in app total)</dt><dd>${esc(formatCents(yr.cashTipsCents))}</dd>
  <dt>Gross income</dt><dd>${esc(formatCents(yr.grossIncomeCents))}</dd>
  <dt>Business miles</dt><dd>${esc(yr.businessMiles)}</dd>
  <dt>Standard-mileage estimate</dt><dd>${esc(formatCents(yr.mileage.estimateCents))}</dd>
  <dt>Unpriced miles</dt><dd>${esc(yr.mileage.unpricedMiles)}</dd>
  <dt>Tracked expenses (all classes)</dt><dd>${esc(formatCents(totalBuckets.totalCents))}</dd>
  <dt>Reviewed weeks</dt><dd>${yr.reviewedWeeks} of ${yr.completedWeeks} complete</dd>
  <dt>Receipts</dt><dd>${yr.receiptCount} (${yr.linkedReceiptCount} linked, ${yr.unresolvedReceiptCount} in Inbox)</dd>
</dl>

<h2>Mileage estimate by effective rate period</h2>
${
  byPeriodRows
    ? `<table><thead><tr><th>Period</th><th class="num">Rate</th><th class="num">Miles</th><th class="num">Estimate</th></tr></thead><tbody>${byPeriodRows}</tbody></table>`
    : '<p class="muted">No priced mileage for this year.</p>'
}
${yr.mileage.unpricedMiles > 0 ? `<div class="warn">${yr.mileage.unpricedMiles} business miles have no configured mileage rate and are not included in the estimate.</div>` : ''}

<h2>Annual odometer &amp; business use</h2>
${
  odo.hasData
    ? `<dl class="summary">
        <dt>Annual start odometer</dt><dd>${odoRec?.startOdometer ?? '—'}</dd>
        <dt>Annual end odometer</dt><dd>${odoRec?.endOdometer ?? '—'}</dd>
        <dt>Annual vehicle miles</dt><dd>${odo.annualVehicleMiles ?? '—'}</dd>
        <dt>Business-use %</dt><dd>${odo.businessUsePercentage !== null ? `${odo.businessUsePercentage.toFixed(1)}%` : '—'}</dd>
      </dl>${odo.message ? `<div class="warn">${esc(odo.message)}</div>` : ''}`
    : '<p class="muted">No annual odometer readings recorded for this year.</p>'
}

<h2>Actual-expense planning comparison</h2>
<p class="muted">Planning estimate only — not tax advice.</p>
${
  planning.available
    ? `<dl class="summary">
        <dt>Vehicle actual-expense evidence</dt><dd>${esc(formatCents(planning.vehicleActualCents))}</dd>
        <dt>Business-use %</dt><dd>${planning.businessUsePercentage!.toFixed(1)}%</dd>
        <dt>Allocated vehicle expenses (planning)</dt><dd>${esc(formatCents(planning.allocatedVehicleExpensesCents))}</dd>
        <dt>Parking (kept separate)</dt><dd>${esc(formatCents(planning.parkingCents))}</dd>
        <dt>Tolls (kept separate)</dt><dd>${esc(formatCents(planning.tollsCents))}</dd>
      </dl>`
    : '<p class="muted">Not enough annual odometer data to produce a planning comparison.</p>'
}

<h2>Statement / 1099 reconciliation</h2>
${
  recon.hasStatement
    ? `<dl class="summary">
        <dt>Statement total</dt><dd>${esc(formatCents(recon.statementTotalCents))}</dd>
        <dt>Recorded DoorDash / app earnings</dt><dd>${esc(formatCents(recon.recordedAppEarningsCents))}</dd>
        <dt>Cash tips (separate)</dt><dd>${esc(formatCents(recon.cashTipsCents))}</dd>
        <dt>Total ledger gross</dt><dd>${esc(formatCents(recon.totalLedgerGrossCents))}</dd>
        <dt>Statement difference</dt><dd>${esc(formatCents(recon.statementDeltaCents))}</dd>
      </dl>
      <p class="muted">Investigate any difference between the statement total and your recorded app earnings. Dash Ledger never changes either figure automatically.</p>`
    : '<p class="muted">No year-end statement total entered for this year.</p>'
}

<h2>Weekly review summary</h2>
${weekRows ? `<table><thead><tr><th>Week</th><th>State</th></tr></thead><tbody>${weekRows}</tbody></table>` : '<p class="muted">No weeks with shifts.</p>'}

<h2>Shift log</h2>
${
  shiftRows
    ? `<table><thead><tr><th>Date</th><th>Vehicle</th><th>Time</th><th class="num">Hours</th><th class="num">Odometer</th><th class="num">Miles</th><th class="num">App</th><th class="num">Cash tips</th><th class="num">Gross</th></tr></thead><tbody>${shiftRows}</tbody></table>`
    : '<p class="muted">No shifts recorded for this year.</p>'
}

<h2>Expense records</h2>
${expenseSections || '<p class="muted">No expenses recorded for this year.</p>'}

<h2>Receipts</h2>
${receiptBlocks.length ? `<div class="receipts">${receiptBlocks.join('')}</div>` : '<p class="muted">No receipts recorded for this year.</p>'}

<hr />
<p class="generated">Dash Ledger ${year} Tax Binder · local-first · generated on device.</p>
</body></html>`;
}
