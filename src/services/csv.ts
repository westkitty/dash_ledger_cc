/**
 * UTF-8 CSV export for shifts and expenses.
 *
 * A field containing a comma, double-quote, CR or LF is wrapped in double
 * quotes; embedded double-quotes are doubled. Rows end with CRLF for maximum
 * spreadsheet compatibility.
 */

import type { Expense, Shift, MileageRate } from '../domain/types';
import { centsToPlainString, grossIncomeCents } from '../domain/money';
import { TAX_CLASS_LABELS } from '../domain/types';
import { compareLocalDate } from '../domain/dates';
import { computeMileage } from '../domain/mileage';

const EOL = '\r\n';

/**
 * Neutralise CSV formula injection: a spreadsheet treats a cell starting with
 * `= + @ TAB CR` (or `-` when it isn't a plain number) as a formula. Prefixing
 * with an apostrophe makes it a literal string on open. Plain numbers, including
 * negatives like `-12.00`, are left untouched so numeric columns stay numeric.
 */
export function neutraliseCsvInjection(s: string): string {
  if (s === '') return s;
  const first = s[0];
  if (first === '=' || first === '+' || first === '@' || first === '\t' || first === '\r') {
    return `'${s}`;
  }
  if (first === '-' && !/^-?\d+(\.\d+)?$/.test(s)) {
    return `'${s}`;
  }
  return s;
}

export function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const s = neutraliseCsvInjection(raw);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(',');
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [csvRow(header), ...rows.map(csvRow)];
  return lines.join(EOL) + EOL;
}

export const SHIFT_CSV_HEADER = [
  'Date',
  'Vehicle',
  'Start',
  'End',
  'Start Odo',
  'End Odo',
  'Business Miles',
  'DoorDash Earnings',
  'Cash Tips',
  'Gross Income',
  'Purpose',
  'Notes',
];

export function shiftsToCsv(shifts: Shift[], implausibleMiles = 400): string {
  const sorted = [...shifts].sort(
    (a, b) => compareLocalDate(a.date, b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
  );
  const rows = sorted.map((s) => {
    const m = computeMileage(s.startOdometer, s.endOdometer, implausibleMiles);
    const miles = m.miles === null ? '' : String(m.miles);
    const gross = grossIncomeCents(s.appEarningsCents, s.cashTipsCents);
    return [
      s.date,
      s.vehicleLabel,
      s.startTime ?? '',
      s.endTime ?? '',
      s.startOdometer ?? '',
      s.endOdometer ?? '',
      miles,
      centsToPlainString(s.appEarningsCents),
      centsToPlainString(s.cashTipsCents),
      centsToPlainString(gross),
      s.purpose,
      s.notes,
    ];
  });
  return toCsv(SHIFT_CSV_HEADER, rows);
}

export const EXPENSE_CSV_HEADER = [
  'Date',
  'Amount',
  'Merchant',
  'Category',
  'Tax Treatment Class',
  'Linked Shift',
  'Linked Receipt',
  'Notes',
];

export function expensesToCsv(expenses: Expense[]): string {
  const sorted = [...expenses].sort(
    (a, b) => compareLocalDate(a.date, b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  const rows = sorted.map((e) => [
    e.date,
    centsToPlainString(e.amountCents),
    e.merchant,
    e.category,
    `${e.taxClass} (${TAX_CLASS_LABELS[e.taxClass] ?? e.taxClass})`,
    e.shiftId ?? '',
    e.receiptId ?? '',
    e.notes,
  ]);
  return toCsv(EXPENSE_CSV_HEADER, rows);
}

export const MILEAGE_RATE_CSV_HEADER = ['Start', 'End', 'Rate Per Mile', 'Label', 'Source', 'Seeded'];

export function mileageRatesToCsv(rates: MileageRate[]): string {
  const sorted = [...rates].sort((a, b) => compareLocalDate(a.startDate, b.startDate));
  const rows = sorted.map((r) => [
    r.startDate,
    r.endDate ?? 'open',
    r.ratePerMile.toFixed(3),
    r.label,
    r.source,
    r.seeded ? 'yes' : 'no',
  ]);
  return toCsv(MILEAGE_RATE_CSV_HEADER, rows);
}
