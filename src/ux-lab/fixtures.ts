/**
 * UX Lab fixtures — EXPERIMENTAL, SYNTHETIC DATA ONLY.
 *
 * Every number here is fabricated for the redesign study. Nothing in this
 * module reads from or writes to IndexedDB, the ledger store, or repositories.
 * The shapes deliberately echo the domain types so the demos feel like Dash
 * Ledger, but they are lab-local and self-contained.
 *
 * Scenario: a Portland-area DoorDash driver, one vehicle (2019 Corolla),
 * working since spring 2026. Dates are real local-date strings so the demos
 * read naturally around the capture date (2026-09-09).
 */

export interface LabShift {
  id: string;
  date: string; // YYYY-MM-DD
  start?: string; // HH:MM
  end?: string;
  startOdo: number;
  endOdo: number;
  appCents: number;
  tipsCents: number;
}

export interface LabExpense {
  id: string;
  date: string;
  merchant: string;
  amountCents: number;
  category: string;
  taxClass: 'VEHICLE_ACTUAL' | 'MILEAGE_ADDON' | 'NON_VEHICLE_BUSINESS' | 'REVIEW';
}

export interface LabReceipt {
  id: string;
  date: string;
  merchant: string | null;
  amountCents: number | null;
  status: 'Inbox' | 'Classified';
}

export const LAB_VEHICLE = '2019 Corolla';

/** Weekly shifts — week of Mon 2026-09-07 (the "current week" in demos). */
export const LAB_WEEK_SHIFTS: LabShift[] = [
  { id: 'w1', date: '2026-09-07', start: '17:05', end: '21:40', startOdo: 62291, endOdo: 62319, appCents: 11875, tipsCents: 1200 },
  { id: 'w2', date: '2026-09-09', start: '10:36', end: '15:11', startOdo: 62319, endOdo: 62345, appCents: 13280, tipsCents: 1550 },
];

/** Week of Mon 2026-08-31 (the "last week", already reviewed in demos). */
export const LAB_LAST_WEEK_SHIFTS: LabShift[] = [
  { id: 'l1', date: '2026-09-02', start: '11:15', end: '14:35', startOdo: 62212, endOdo: 62233, appCents: 8815, tipsCents: 1125 },
  { id: 'l2', date: '2026-09-03', start: '16:45', end: '20:20', startOdo: 62233, endOdo: 62254, appCents: 9640, tipsCents: 975 },
  { id: 'l3', date: '2026-09-05', start: '11:30', end: '15:10', startOdo: 62254, endOdo: 62291, appCents: 16730, tipsCents: 2250 },
];

export const LAB_WEEK_EXPENSES: LabExpense[] = [
  { id: 'e1', date: '2026-09-09', merchant: 'Shell', amountCents: 3825, category: 'Fuel', taxClass: 'VEHICLE_ACTUAL' },
];

export const LAB_RECEIPTS: LabReceipt[] = [
  { id: 'r1', date: '2026-09-09', merchant: 'Shell', amountCents: 3825, status: 'Classified' },
  { id: 'r2', date: '2026-09-09', merchant: null, amountCents: null, status: 'Inbox' },
];

/** Twelve months of 2026 for the year-trend demo (dollars → cents). */
export interface LabMonth {
  label: string; // Jan…Dec
  grossCents: number;
  miles: number;
  deductionCents: number; // standard-mileage estimate
  expenseCents: number;
  dashes: number;
}

export const LAB_YEAR_2026: LabMonth[] = [
  { label: 'Jan', grossCents: 0, miles: 0, deductionCents: 0, expenseCents: 0, dashes: 0 },
  { label: 'Feb', grossCents: 0, miles: 0, deductionCents: 0, expenseCents: 0, dashes: 0 },
  { label: 'Mar', grossCents: 124860, miles: 214, deductionCents: 155150, expenseCents: 3120, dashes: 11 },
  { label: 'Apr', grossCents: 161240, miles: 268, deductionCents: 194260, expenseCents: 5480, dashes: 13 },
  { label: 'May', grossCents: 148730, miles: 241, deductionCents: 174725, expenseCents: 4230, dashes: 12 },
  { label: 'Jun', grossCents: 172415, miles: 289, deductionCents: 209525, expenseCents: 6110, dashes: 14 },
  { label: 'Jul', grossCents: 0, miles: 0, deductionCents: 0, expenseCents: 0, dashes: 0 },
  { label: 'Aug', grossCents: 0, miles: 0, deductionCents: 0, expenseCents: 0, dashes: 0 },
  { label: 'Sep', grossCents: 96270, miles: 195, deductionCents: 148200, expenseCents: 10325, dashes: 7 },
  { label: 'Oct', grossCents: 0, miles: 0, deductionCents: 0, expenseCents: 0, dashes: 0 },
  { label: 'Nov', grossCents: 0, miles: 0, deductionCents: 0, expenseCents: 0, dashes: 0 },
  { label: 'Dec', grossCents: 0, miles: 0, deductionCents: 0, expenseCents: 0, dashes: 0 },
];

/** Simple tabular money formatter for lab display (mirrors domain formatCents). */
export function labMoney(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, '0');
  return `${neg ? '−' : ''}$${dollars.toLocaleString('en-US')}.${rem}`;
}

/** Jul–Sep 2026 standard mileage rates as they would resolve per month. */
export function labRateForMonth(index: number): number {
  return index <= 5 ? 0.725 : 0.76;
}

export const LAB_SHEET_HEADERS = 'uxlab synthetic data — nothing here touches the real ledger';
