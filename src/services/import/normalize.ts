/**
 * Legacy source -> canonical records.
 *
 * ONE tolerant normaliser handles every recognised dialect. That is deliberate:
 * a hybrid database (original app, later opened by an early cc build) can hold
 * original-era rows, cc-era rows, and rows carrying both representations at
 * once, so a per-dialect reader would be wrong for exactly the case that caused
 * the original corruption.
 *
 * Tolerance is safe here because no field name means two different things across
 * the lineages — they differ only by presence:
 *
 *   dollars   `appEarnings`  `cashTips`  `amount`      (original app, Grok)
 *   cents     `appEarningsCents` `cashTipsCents` `amountCents`  (cc)
 *   vehicle   `label` (A/B)   vs `name` (C)
 *   shifts    `shifts` (A/B)  vs `dashes` (C)
 *   weeks     `weeklyClosures` (A/B) vs `weekReviews` (C)
 *   dash link `shiftId` (A/B) vs `dashId` (C)
 *   image     `imageBase64` (A/C) vs `image.dataUrl` (B)
 *
 * Nothing here invents a value. Missing stays missing, conflicts stay conflicts.
 */

import {
  DEFAULT_SETTINGS,
  type AnnualOdometer,
  type Expense,
  type MerchantMemoryEntry,
  type Meta,
  type MileageRate,
  type Receipt,
  type ReceiptStatus,
  type Settings,
  type Shift,
  type ShiftStatus,
  type StatementTotal,
  type TaxClass,
  type ThemeChoice,
  type Vehicle,
  type WeeklyClosure,
} from '../../domain/types';
import { isValidLocalDate, mondayOf } from '../../domain/dates';
import { isValidLocalTime } from '../../domain/duration';
import { taxClassForCategory } from '../../domain/expenses';
import { normaliseMerchant } from '../../domain/merchantMemory';
import { legacyDollarsToCents, moneyEvidence, resolveMoneyField } from './legacyMoney';
import { detectSource, type Detection } from './detect';
import {
  emptyCounts,
  summariseIssues,
  type ImportAnalysis,
  type ImportCandidate,
  type ImportIssue,
  type ImportReport,
} from './types';

// ---------------------------------------------------------------------------
// Small readers. Every one of these returns null rather than a substitute value.
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function rows(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter(isPlainObject) : [];
}

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function nonEmptyId(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  return s === '' ? null : s;
}

/** Finite number or null. Never coerces a blank/garbage value to 0. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.trim().replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function iso(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return fallback;
  return Number.isNaN(Date.parse(s)) ? fallback : s;
}

function isoOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  return Number.isNaN(Date.parse(s)) ? null : s;
}

/** Local work date, or null. A date is never guessed from a timestamp's timezone. */
function localDate(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  const candidate = s.length > 10 ? s.slice(0, 10) : s;
  return isValidLocalDate(candidate) ? candidate : null;
}

/** `""` (original app's "unset") and invalid values both become null. */
function localTime(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  return isValidLocalTime(s) ? s : null;
}

const TAX_CLASS_ALIASES: Record<string, TaxClass> = {
  VEHICLE_ACTUAL: 'VEHICLE_ACTUAL',
  MILEAGE_ADDON: 'MILEAGE_ADDON',
  NON_VEHICLE_BUSINESS: 'NON_VEHICLE_BUSINESS',
  REVIEW: 'REVIEW',
  vehicle_actual: 'VEHICLE_ACTUAL',
  mileage_addon: 'MILEAGE_ADDON',
  non_vehicle_business: 'NON_VEHICLE_BUSINESS',
  review: 'REVIEW',
};

function taxClass(rawValue: unknown, category: string): TaxClass {
  const s = typeof rawValue === 'string' ? rawValue.trim() : '';
  const mapped = TAX_CLASS_ALIASES[s] ?? TAX_CLASS_ALIASES[s.toUpperCase()];
  if (mapped) return mapped;
  return taxClassForCategory(category);
}

function receiptStatus(v: unknown): ReceiptStatus {
  return str(v).trim().toLowerCase() === 'classified' ? 'Classified' : 'Inbox';
}

function theme(v: unknown): ThemeChoice {
  const s = str(v).trim().toLowerCase();
  return s === 'light' || s === 'dark' ? s : 'system';
}

/** Receipt image data URL from either `imageBase64` (A/C) or `image.dataUrl` (B). */
function receiptDataUrl(row: Record<string, unknown>): string | null {
  const flat = row.imageBase64;
  if (typeof flat === 'string' && flat.startsWith('data:')) return flat;
  const nested = row.image;
  if (isPlainObject(nested) && typeof nested.dataUrl === 'string' && nested.dataUrl.startsWith('data:')) {
    return nested.dataUrl;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

class Collector {
  readonly issues: ImportIssue[] = [];
  readonly unsupportedFields = new Set<string>();
  readonly notes: string[] = [];

  add(issue: ImportIssue): void {
    this.issues.push(issue);
  }

  unsupported(field: string): void {
    this.unsupportedFields.add(field);
  }

  note(text: string): void {
    if (!this.notes.includes(text)) this.notes.push(text);
  }
}

export function normalizeSource(raw: unknown, sourceLabel?: string): ImportAnalysis {
  const detection = detectSource(raw);
  const c = new Collector();

  const empty: ImportCandidate = {
    vehicles: [],
    shifts: [],
    expenses: [],
    receipts: [],
    receiptImages: [],
    weeklyClosures: [],
    mileageRates: [],
    merchantMemory: [],
    settings: { ...DEFAULT_SETTINGS },
    meta: {},
  };

  if (!isPlainObject(raw) || detection.format === 'unknown') {
    return {
      candidate: empty,
      report: failedReport(detection, sourceLabel, [
        'This file is not a Dash Ledger backup this build recognises. Nothing was read from it.',
      ]),
    };
  }

  if (detection.schemaVersion !== null && detection.schemaVersion > 1) {
    return {
      candidate: empty,
      report: failedReport(detection, sourceLabel, [
        `Source schema version ${detection.schemaVersion} is newer than this build understands (1). Update the app before importing.`,
      ]),
    };
  }

  const now = new Date().toISOString();

  const vehicles = normalizeVehicles(raw, c, now);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  const shifts = normalizeShifts(raw, c, now, vehicleById);
  const shiftIds = new Set(shifts.map((s) => s.id));

  const receiptResult = normalizeReceipts(raw, c, now);
  const receiptIds = new Set(receiptResult.receipts.map((r) => r.id));

  const expenses = normalizeExpenses(raw, c, now, shiftIds, receiptIds);
  const expenseIds = new Set(expenses.map((e) => e.id));

  // Second pass: clear receipt -> expense back-references that point nowhere.
  for (const r of receiptResult.receipts) {
    if (r.expenseId && !expenseIds.has(r.expenseId)) {
      c.add({
        severity: 'warning',
        code: 'dangling-expense-link',
        recordType: 'receipt',
        recordId: r.id,
        message: `Receipt ${r.id} referenced expense ${r.expenseId}, which is not in this source. The link was cleared; the receipt was kept.`,
        evidence: { receiptId: r.id, expenseId: r.expenseId },
      });
      r.expenseId = null;
    }
  }

  const weeklyClosures = normalizeWeeklyClosures(raw, c);
  const rawSettings = isPlainObject(raw.settings) ? raw.settings : {};
  const mileageRates = normalizeMileageRates(raw, rawSettings, c);
  const merchantMemory = normalizeMerchantMemory(raw, rawSettings, c, now);
  const settings = normalizeSettings(rawSettings, c, vehicleById);
  const meta = normalizeMeta(raw, rawSettings);

  if (mileageRates.length === 0) {
    c.note(
      'The source carried no mileage-rate periods. The canonical seeded rate table (2011–2026) will be used.',
    );
  }

  const candidate: ImportCandidate = {
    vehicles,
    shifts,
    expenses,
    receipts: receiptResult.receipts,
    receiptImages: receiptResult.images,
    weeklyClosures,
    mileageRates,
    merchantMemory,
    settings,
    meta,
  };

  const counts = {
    ...emptyCounts(),
    vehicles: vehicles.length,
    shifts: shifts.length,
    expenses: expenses.length,
    receipts: receiptResult.receipts.length,
    receiptImages: receiptResult.images.length,
    weeklyClosures: weeklyClosures.length,
    mileageRates: mileageRates.length,
    merchantMemory: merchantMemory.length,
  };

  const totals = summariseIssues(c.issues);
  const importedTotal =
    counts.vehicles +
    counts.shifts +
    counts.expenses +
    counts.receipts +
    counts.weeklyClosures +
    counts.mileageRates +
    counts.merchantMemory;

  const report: ImportReport = {
    sourceFormat: detection.format,
    sourceVariant: detection.variant,
    sourceLabel: sourceLabel ?? detection.label,
    sourceSchemaVersion: detection.schemaVersion,
    sourceGeneratedAt: detection.generatedAt,
    imported: counts,
    totals: { imported: importedTotal, ...totals },
    issues: c.issues,
    unsupportedFields: [...c.unsupportedFields],
    notes: c.notes,
    ok: true,
    errors: [],
  };

  return { candidate, report };
}

function failedReport(d: Detection, sourceLabel: string | undefined, errors: string[]): ImportReport {
  return {
    sourceFormat: d.format,
    sourceVariant: d.variant,
    sourceLabel: sourceLabel ?? d.label,
    sourceSchemaVersion: d.schemaVersion,
    sourceGeneratedAt: d.generatedAt,
    imported: emptyCounts(),
    totals: { imported: 0, warnings: 0, conflicts: 0, rejected: 0 },
    issues: [],
    unsupportedFields: [],
    notes: [],
    ok: false,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

function normalizeVehicles(
  raw: Record<string, unknown>,
  c: Collector,
  now: string,
): Vehicle[] {
  const out: Vehicle[] = [];
  const seen = new Set<string>();

  for (const [i, row] of rows(raw.vehicles).entries()) {
    const id = nonEmptyId(row.id);
    if (!id) {
      c.add({
        severity: 'rejected',
        code: 'missing-id',
        recordType: 'vehicle',
        recordId: null,
        message: `vehicles[${i}] has no id, so it cannot be stored or de-duplicated. It was not imported.`,
      });
      continue;
    }
    if (seen.has(id)) {
      c.add({
        severity: 'rejected',
        code: 'duplicate-id',
        recordType: 'vehicle',
        recordId: id,
        message: `Duplicate vehicle id ${id}. Only the first occurrence was imported.`,
      });
      continue;
    }
    seen.add(id);

    // `label` (original app / cc) or `name` (Grok build).
    const label = str(row.label) || str(row.name) || 'Vehicle';
    if (str(row.notes)) c.unsupported('vehicles[].notes');

    out.push({
      id,
      label,
      archived: row.archivedAt ? true : Boolean(row.archived),
      createdAt: iso(row.createdAt, now),
      updatedAt: iso(row.updatedAt, now),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shifts / dashes
// ---------------------------------------------------------------------------

function normalizeShifts(
  raw: Record<string, unknown>,
  c: Collector,
  now: string,
  vehicleById: Map<string, Vehicle>,
): Shift[] {
  // `shifts` (original app / cc) or `dashes` (Grok build).
  const sourceRows = rows(raw.shifts).length > 0 ? rows(raw.shifts) : rows(raw.dashes);
  const out: Shift[] = [];
  const seen = new Set<string>();

  for (const [i, row] of sourceRows.entries()) {
    const id = nonEmptyId(row.id);
    if (!id) {
      c.add({
        severity: 'rejected',
        code: 'missing-id',
        recordType: 'shift',
        recordId: null,
        message: `Dash #${i + 1} has no id, so it cannot be stored or de-duplicated. It was not imported.`,
      });
      continue;
    }
    if (seen.has(id)) {
      c.add({
        severity: 'rejected',
        code: 'duplicate-id',
        recordType: 'shift',
        recordId: id,
        message: `Duplicate dash id ${id}. Only the first occurrence was imported.`,
      });
      continue;
    }

    const date = localDate(row.date);
    if (!date) {
      c.add({
        severity: 'rejected',
        code: 'invalid-date',
        recordType: 'shift',
        recordId: id,
        message: `Dash ${id} has no usable work date (${JSON.stringify(row.date)}). A work date cannot be guessed, so the record was not imported.`,
        evidence: { id, date: str(row.date) },
      });
      continue;
    }
    seen.add(id);

    const status: ShiftStatus = row.status === 'active' ? 'active' : 'completed';
    if (row.status !== 'active' && row.status !== 'completed' && row.status !== undefined) {
      c.add({
        severity: 'warning',
        code: 'unknown-status',
        recordType: 'shift',
        recordId: id,
        message: `Dash ${id} had status ${JSON.stringify(row.status)}, which this build does not recognise. It was imported as completed.`,
        evidence: { id, sourceStatus: str(row.status) },
      });
    }

    const vehicleId = nonEmptyId(row.vehicleId) ?? '';
    const vehicle = vehicleId ? vehicleById.get(vehicleId) : undefined;
    if (vehicleId && !vehicle) {
      c.add({
        severity: 'warning',
        code: 'unknown-vehicle',
        recordType: 'shift',
        recordId: id,
        message: `Dash ${id} references vehicle ${vehicleId}, which is not in this source. The id was kept and the label recorded as "Unknown vehicle".`,
        evidence: { id, vehicleId },
      });
    }

    const startOdometer = num(row.startOdometer);
    const endOdometer = num(row.endOdometer);

    const appEarnings = resolveMoneyField('appEarningsCents', row.appEarnings, row.appEarningsCents);
    const cashTips = resolveMoneyField('cashTipsCents', row.cashTips, row.cashTipsCents);

    for (const r of [appEarnings, cashTips]) {
      if (r.status === 'conflict' || r.status === 'invalid') {
        c.add({
          severity: 'conflict',
          code: r.status === 'conflict' ? 'money-conflict' : 'money-invalid',
          recordType: 'shift',
          recordId: id,
          message: `Dash ${id} — ${r.detail}`,
          evidence: { id, date, ...moneyEvidence(r) },
        });
      }
    }

    // Cross-check derived values the source stored, without ever preferring them.
    crossCheckStoredMiles(row, id, date, startOdometer, endOdometer, c);
    crossCheckStoredGross(row, id, appEarnings.cents, cashTips.cents, c);

    out.push({
      id,
      status,
      date,
      weekKey: mondayOf(date), // always recomputed; a stored week key is never trusted
      vehicleId,
      vehicleLabel: vehicle ? vehicle.label : vehicleId ? 'Unknown vehicle' : '',
      startTime: localTime(row.startTime),
      endTime: localTime(row.endTime),
      startOdometer,
      endOdometer,
      appEarningsCents: appEarnings.cents,
      cashTipsCents: cashTips.cents,
      purpose: str(row.purpose) || DEFAULT_SETTINGS.defaultPurpose,
      notes: str(row.notes),
      createdAt: iso(row.createdAt, now),
      updatedAt: iso(row.updatedAt, now),
    });
  }

  return enforceSingleActive(out, c);
}

/**
 * The canonical schema derives business miles from the odometer pair. Sources
 * stored the number too. If they disagree, say so — never silently prefer either.
 */
function crossCheckStoredMiles(
  row: Record<string, unknown>,
  id: string,
  date: string,
  startOdometer: number | null,
  endOdometer: number | null,
  c: Collector,
): void {
  const stored = num(row.businessMiles);
  if (stored === null || startOdometer === null || endOdometer === null) return;
  const derived = endOdometer - startOdometer;
  if (Math.abs(derived - stored) < 0.005) return;
  c.add({
    severity: 'warning',
    code: 'miles-mismatch',
    recordType: 'shift',
    recordId: id,
    message: `Dash ${id} (${date}) stored ${stored} business miles, but its odometer readings give ${derived}. Mileage is recalculated from the odometer pair; both numbers are recorded here.`,
    evidence: { id, date, storedBusinessMiles: stored, derivedBusinessMiles: derived, startOdometer, endOdometer },
  });
}

function crossCheckStoredGross(
  row: Record<string, unknown>,
  id: string,
  appEarningsCents: number | null,
  cashTipsCents: number | null,
  c: Collector,
): void {
  const storedGross = row.grossIncome;
  if (storedGross === null || storedGross === undefined || storedGross === '') return;
  if (appEarningsCents === null && cashTipsCents === null) return;
  const storedCents = legacyDollarsToCents(storedGross);
  if (storedCents === null) return;
  const derived = (appEarningsCents ?? 0) + (cashTipsCents ?? 0);
  if (derived === storedCents) return;
  c.add({
    severity: 'warning',
    code: 'gross-mismatch',
    recordType: 'shift',
    recordId: id,
    message: `Dash ${id} stored a gross income of ${storedCents} cents, but its earnings and tips add up to ${derived} cents. Gross income is recalculated; both numbers are recorded here.`,
    evidence: { id, storedGrossCents: storedCents, derivedGrossCents: derived, appEarningsCents, cashTipsCents },
  });
}

/**
 * The canonical invariant is at most one active dash. A source may violate it
 * (the original app had no transactional guard). The earliest active dash keeps
 * its status; the rest are imported as completed and reported for review.
 */
function enforceSingleActive(shifts: Shift[], c: Collector): Shift[] {
  const active = shifts.filter((s) => s.status === 'active');
  if (active.length <= 1) return shifts;

  const keep = [...active].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )[0];

  for (const s of active) {
    if (s.id === keep.id) continue;
    s.status = 'completed';
    c.add({
      severity: 'conflict',
      code: 'multiple-active-dashes',
      recordType: 'shift',
      recordId: s.id,
      message: `The source contained ${active.length} dashes marked active, but only one dash may be active. Dash ${s.id} (${s.date}) was imported as completed; dash ${keep.id} kept the active status. Review both.`,
      evidence: { id: s.id, date: s.date, keptActiveId: keep.id, activeCountInSource: active.length },
    });
  }
  return shifts;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

function normalizeExpenses(
  raw: Record<string, unknown>,
  c: Collector,
  now: string,
  shiftIds: Set<string>,
  receiptIds: Set<string>,
): Expense[] {
  const out: Expense[] = [];
  const seen = new Set<string>();

  for (const [i, row] of rows(raw.expenses).entries()) {
    const id = nonEmptyId(row.id);
    if (!id) {
      c.add({
        severity: 'rejected',
        code: 'missing-id',
        recordType: 'expense',
        recordId: null,
        message: `expenses[${i}] has no id, so it cannot be stored or de-duplicated. It was not imported.`,
      });
      continue;
    }
    if (seen.has(id)) {
      c.add({
        severity: 'rejected',
        code: 'duplicate-id',
        recordType: 'expense',
        recordId: id,
        message: `Duplicate expense id ${id}. Only the first occurrence was imported.`,
      });
      continue;
    }

    const date = localDate(row.date);
    if (!date) {
      c.add({
        severity: 'rejected',
        code: 'invalid-date',
        recordType: 'expense',
        recordId: id,
        message: `Expense ${id} has no usable date (${JSON.stringify(row.date)}). It was not imported.`,
        evidence: { id, date: str(row.date) },
      });
      continue;
    }

    const amount = resolveMoneyField('amountCents', row.amount, row.amountCents);
    // An expense amount has no canonical "unknown" representation, so a record
    // whose amount cannot be established is preserved as evidence in this report
    // rather than written with an invented figure.
    if (amount.cents === null) {
      c.add({
        severity: amount.status === 'absent' ? 'rejected' : 'conflict',
        code:
          amount.status === 'absent'
            ? 'missing-amount'
            : amount.status === 'conflict'
              ? 'money-conflict'
              : 'money-invalid',
        recordType: 'expense',
        recordId: id,
        message:
          amount.status === 'absent'
            ? `Expense ${id} (${date}) has no amount in the source. An expense cannot be stored without one, and zero would be an invention, so it was not imported. Its details are recorded here.`
            : `Expense ${id} (${date}) — ${amount.detail} It was not imported; re-enter it once you have decided which amount is right.`,
        evidence: {
          id,
          date,
          merchant: str(row.merchant),
          category: str(row.category),
          notes: str(row.notes),
          ...moneyEvidence(amount),
        },
      });
      continue;
    }
    seen.add(id);

    const category = str(row.category) || 'Review / Unsure';
    // `shiftId` (original app / cc) or `dashId` (Grok build).
    const rawShiftId = nonEmptyId(row.shiftId) ?? nonEmptyId(row.dashId);
    const rawReceiptId = nonEmptyId(row.receiptId);

    let shiftId: string | null = rawShiftId;
    if (shiftId && !shiftIds.has(shiftId)) {
      c.add({
        severity: 'warning',
        code: 'dangling-shift-link',
        recordType: 'expense',
        recordId: id,
        message: `Expense ${id} referenced dash ${shiftId}, which is not in this source. The link was cleared; the expense was kept.`,
        evidence: { id, shiftId },
      });
      shiftId = null;
    }

    let receiptId: string | null = rawReceiptId;
    if (receiptId && !receiptIds.has(receiptId)) {
      c.add({
        severity: 'warning',
        code: 'dangling-receipt-link',
        recordType: 'expense',
        recordId: id,
        message: `Expense ${id} referenced receipt ${receiptId}, which is not in this source. The link was cleared; the expense was kept.`,
        evidence: { id, receiptId },
      });
      receiptId = null;
    }

    out.push({
      id,
      date,
      amountCents: amount.cents,
      merchant: str(row.merchant),
      category,
      taxClass: taxClass(row.taxClass ?? row.tax_class, category),
      notes: str(row.notes),
      shiftId,
      receiptId,
      createdAt: iso(row.createdAt, now),
      updatedAt: iso(row.updatedAt, now),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

function normalizeReceipts(
  raw: Record<string, unknown>,
  c: Collector,
  now: string,
): { receipts: Receipt[]; images: Array<{ receiptId: string; dataUrl: string }> } {
  const receipts: Receipt[] = [];
  const images: Array<{ receiptId: string; dataUrl: string }> = [];
  const seen = new Set<string>();

  for (const [i, row] of rows(raw.receipts).entries()) {
    const id = nonEmptyId(row.id);
    if (!id) {
      c.add({
        severity: 'rejected',
        code: 'missing-id',
        recordType: 'receipt',
        recordId: null,
        message: `receipts[${i}] has no id, so it cannot be stored or de-duplicated. It was not imported.`,
      });
      continue;
    }
    if (seen.has(id)) {
      c.add({
        severity: 'rejected',
        code: 'duplicate-id',
        recordType: 'receipt',
        recordId: id,
        message: `Duplicate receipt id ${id}. Only the first occurrence was imported.`,
      });
      continue;
    }
    seen.add(id);

    // Receipt dates are optional in the canonical schema, so an unusable one is
    // reported and left null rather than blocking the record (and its image).
    const rawDate = row.date ?? row.capturedAt;
    const date = localDate(rawDate);
    if (rawDate && !date) {
      c.add({
        severity: 'warning',
        code: 'invalid-date',
        recordType: 'receipt',
        recordId: id,
        message: `Receipt ${id} had an unusable date (${JSON.stringify(rawDate)}). The receipt and its image were kept with no date.`,
        evidence: { id, date: str(rawDate) },
      });
    }

    const amount = resolveMoneyField('amountCents', row.amount, row.amountCents);
    if (amount.status === 'conflict' || amount.status === 'invalid') {
      c.add({
        severity: 'conflict',
        code: amount.status === 'conflict' ? 'money-conflict' : 'money-invalid',
        recordType: 'receipt',
        recordId: id,
        message: `Receipt ${id} — ${amount.detail}`,
        evidence: { id, ...moneyEvidence(amount) },
      });
    }

    if (row.width !== undefined) c.unsupported('receipts[].width');
    if (row.height !== undefined) c.unsupported('receipts[].height');

    const category = str(row.category) || null;
    const dataUrl = receiptDataUrl(row);
    if (dataUrl) images.push({ receiptId: id, dataUrl });

    const nestedImage = isPlainObject(row.image) ? row.image : null;
    const byteCount =
      num(row.byteCount) ??
      num(row.byteLength) ??
      num(row.imageBytes) ??
      (nestedImage ? num(nestedImage.byteCount) : null) ??
      0;

    receipts.push({
      id,
      capturedAt: iso(row.capturedAt, iso(row.createdAt, now)),
      date,
      merchant: str(row.merchant),
      amountCents: amount.cents,
      category,
      taxClass: category ? taxClass(row.taxClass, category) : null,
      notes: str(row.notes),
      status: receiptStatus(row.status),
      expenseId: nonEmptyId(row.expenseId),
      originalFilename: str(row.originalFilename),
      mimeType:
        str(row.mimeType) ||
        str(row.mime) ||
        str(row.imageMime) ||
        (nestedImage ? str(nestedImage.mimeType) : '') ||
        'application/octet-stream',
      byteCount,
      // The original app recorded `processError`; cc records `imageProcessingError`.
      imageProcessingError: str(row.imageProcessingError) || str(row.processError) || null,
      createdAt: iso(row.createdAt, now),
      updatedAt: iso(row.updatedAt, now),
    });
  }

  return { receipts, images };
}

// ---------------------------------------------------------------------------
// Weekly closures / week reviews
// ---------------------------------------------------------------------------

function normalizeWeeklyClosures(raw: Record<string, unknown>, c: Collector): WeeklyClosure[] {
  // `weeklyClosures` (original app / cc) or `weekReviews` (Grok build).
  const sourceRows =
    rows(raw.weeklyClosures).length > 0 ? rows(raw.weeklyClosures) : rows(raw.weekReviews);
  const out: WeeklyClosure[] = [];
  const seen = new Set<string>();

  for (const [i, row] of sourceRows.entries()) {
    const weekKey = localDate(row.weekKey);
    if (!weekKey) {
      c.add({
        severity: 'rejected',
        code: 'invalid-week-key',
        recordType: 'weeklyClosure',
        recordId: null,
        message: `Weekly review #${i + 1} has an unusable week key (${JSON.stringify(row.weekKey)}). It was not imported.`,
      });
      continue;
    }
    if (mondayOf(weekKey) !== weekKey) {
      c.add({
        severity: 'warning',
        code: 'week-key-not-monday',
        recordType: 'weeklyClosure',
        recordId: weekKey,
        message: `Weekly review ${weekKey} was not keyed to a Monday. It was re-keyed to ${mondayOf(weekKey)}.`,
        evidence: { sourceWeekKey: weekKey, canonicalWeekKey: mondayOf(weekKey) },
      });
    }
    const key = mondayOf(weekKey);
    if (seen.has(key)) continue;

    const reviewedAt = isoOrNull(row.reviewedAt);
    // A Grok `weekReviews` row with status "open" is not a closure at all.
    if (!reviewedAt) continue;
    seen.add(key);

    out.push({
      weekKey: key,
      reviewedAt,
      reopenedAt: isoOrNull(row.reopenedAt),
      // `note` (cc) or `notes` (original app / Grok build).
      note: str(row.note) || str(row.notes),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mileage rates
// ---------------------------------------------------------------------------

function normalizeMileageRates(
  raw: Record<string, unknown>,
  rawSettings: Record<string, unknown>,
  c: Collector,
): MileageRate[] {
  // Top-level array (cc) or nested in settings (original app / Grok build).
  const sourceRows =
    rows(raw.mileageRates).length > 0 ? rows(raw.mileageRates) : rows(rawSettings.mileageRates);
  const out: MileageRate[] = [];
  const seen = new Set<string>();

  for (const [i, row] of sourceRows.entries()) {
    const startDate = localDate(row.startDate ?? row.start);
    const rate = num(row.ratePerMile ?? row.rate);
    if (!startDate || rate === null || !(rate > 0)) {
      c.add({
        severity: 'warning',
        code: 'invalid-rate-period',
        recordType: 'mileageRate',
        recordId: nonEmptyId(row.id),
        message: `Mileage-rate period #${i + 1} is missing a usable start date or rate. It was not imported.`,
        evidence: {
          start: str(row.startDate ?? row.start),
          rate: num(row.ratePerMile ?? row.rate),
        },
      });
      continue;
    }
    const id = nonEmptyId(row.id) ?? `imported-${startDate}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      startDate,
      endDate: localDate(row.endDate ?? row.end),
      ratePerMile: rate,
      label: str(row.label) || str(row.note) || `Rate from ${startDate}`,
      source: str(row.source) || 'Imported from an earlier Dash Ledger version',
      // `locked` (original app / Grok build) marks shipped reference data,
      // which is what `seeded` means canonically.
      seeded: row.seeded !== undefined ? Boolean(row.seeded) : Boolean(row.locked),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Merchant memory
// ---------------------------------------------------------------------------

function normalizeMerchantMemory(
  raw: Record<string, unknown>,
  rawSettings: Record<string, unknown>,
  c: Collector,
  now: string,
): MerchantMemoryEntry[] {
  const out: MerchantMemoryEntry[] = [];
  const seen = new Set<string>();

  // cc shape: a top-level array of entries with per-category counts.
  for (const row of rows(raw.merchantMemory)) {
    const key = str(row.merchantKey).trim();
    if (!key || seen.has(key)) continue;
    const counts = isPlainObject(row.counts) ? row.counts : {};
    const cleanCounts: Record<string, number> = {};
    for (const [cat, n] of Object.entries(counts)) {
      const v = num(n);
      if (v !== null && v > 0) cleanCounts[cat] = Math.floor(v);
    }
    if (Object.keys(cleanCounts).length === 0) continue;
    seen.add(key);
    const lastCategory = str(row.lastCategory) || Object.keys(cleanCounts)[0];
    out.push({
      merchantKey: key,
      displayName: str(row.displayName) || key,
      counts: cleanCounts,
      lastCategory,
      lastTaxClass: taxClass(row.lastTaxClass, lastCategory),
      updatedAt: iso(row.updatedAt, now),
    });
  }

  // Original app / Grok shape: settings map of { merchantLower: { category, count } }.
  const map = isPlainObject(rawSettings.merchantMemory) ? rawSettings.merchantMemory : {};
  for (const [rawKey, value] of Object.entries(map)) {
    const key = normaliseMerchant(rawKey);
    if (!key || seen.has(key)) continue;
    if (!isPlainObject(value)) continue;
    const category = str(value.category);
    const count = num(value.count);
    if (!category || count === null || count <= 0) continue;
    seen.add(key);
    out.push({
      merchantKey: key,
      displayName: rawKey,
      counts: { [category]: Math.floor(count) },
      lastCategory: category,
      lastTaxClass: taxClassForCategory(category),
      updatedAt: now,
    });
  }

  if (out.length > 0) {
    c.note(
      'Merchant suggestions were imported. They remain suggestions only and are never applied automatically.',
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Settings & meta
// ---------------------------------------------------------------------------

function normalizeSettings(
  rawSettings: Record<string, unknown>,
  c: Collector,
  vehicleById: Map<string, Vehicle>,
): Settings {
  const defaultVehicleId = nonEmptyId(rawSettings.defaultVehicleId);
  let resolvedDefault: string | null = defaultVehicleId;
  if (defaultVehicleId && !vehicleById.has(defaultVehicleId)) {
    c.add({
      severity: 'warning',
      code: 'unknown-default-vehicle',
      recordType: 'settings',
      recordId: null,
      message: `The default vehicle ${defaultVehicleId} is not present in this source. The default was cleared; pick one in Vault → Vehicles.`,
      evidence: { defaultVehicleId },
    });
    resolvedDefault = null;
  }

  const overdue =
    num(rawSettings.backupOverdueDays) ?? num(rawSettings.overdueDays) ?? DEFAULT_SETTINGS.backupOverdueDays;
  const implausible = num(rawSettings.implausibleMiles) ?? DEFAULT_SETTINGS.implausibleMiles;

  return {
    theme: theme(rawSettings.theme),
    backupOverdueDays: overdue > 0 ? Math.floor(overdue) : DEFAULT_SETTINGS.backupOverdueDays,
    defaultVehicleId: resolvedDefault,
    defaultPurpose: str(rawSettings.defaultPurpose) || DEFAULT_SETTINGS.defaultPurpose,
    implausibleMiles: implausible > 0 ? implausible : DEFAULT_SETTINGS.implausibleMiles,
    annualOdometers: normalizeAnnualOdometers(rawSettings),
    statementTotals: normalizeStatementTotals(rawSettings, c),
  };
}

function normalizeAnnualOdometers(rawSettings: Record<string, unknown>): AnnualOdometer[] {
  // cc shape: already an array.
  if (Array.isArray(rawSettings.annualOdometers)) {
    const out: AnnualOdometer[] = [];
    for (const row of rows(rawSettings.annualOdometers)) {
      const year = num(row.year);
      if (year === null) continue;
      out.push({
        year: Math.floor(year),
        vehicleId: nonEmptyId(row.vehicleId),
        startOdometer: num(row.startOdometer),
        endOdometer: num(row.endOdometer),
      });
    }
    return out;
  }
  // Original app / Grok shape: { "2026": { start, end } }.
  const map = isPlainObject(rawSettings.annualOdometer) ? rawSettings.annualOdometer : {};
  const out: AnnualOdometer[] = [];
  for (const [yearKey, value] of Object.entries(map)) {
    const year = num(yearKey);
    if (year === null || !isPlainObject(value)) continue;
    out.push({
      year: Math.floor(year),
      vehicleId: null,
      startOdometer: num(value.start ?? value.startOdometer),
      endOdometer: num(value.end ?? value.endOdometer),
    });
  }
  return out;
}

function normalizeStatementTotals(
  rawSettings: Record<string, unknown>,
  c: Collector,
): StatementTotal[] {
  // cc shape: already an array of integer-cent totals.
  if (Array.isArray(rawSettings.statementTotals)) {
    const out: StatementTotal[] = [];
    for (const row of rows(rawSettings.statementTotals)) {
      const year = num(row.year);
      if (year === null) continue;
      const resolved = resolveMoneyField('appEarningsCents', undefined, row.appEarningsCents);
      out.push({ year: Math.floor(year), appEarningsCents: resolved.cents, note: str(row.note) });
    }
    return out;
  }
  // Original app / Grok shape: { "2026": 12345.67 } in dollars.
  const map = isPlainObject(rawSettings.statementTotals) ? rawSettings.statementTotals : {};
  const out: StatementTotal[] = [];
  for (const [yearKey, value] of Object.entries(map)) {
    const year = num(yearKey);
    if (year === null) continue;
    const cents = legacyDollarsToCents(value);
    if (cents === null && value !== null && value !== undefined && value !== '') {
      c.add({
        severity: 'warning',
        code: 'invalid-statement-total',
        recordType: 'settings',
        recordId: yearKey,
        message: `The ${yearKey} statement total (${JSON.stringify(value)}) is not a usable amount. It was left unset rather than guessed.`,
        evidence: { year: yearKey, sourceValue: str(value) },
      });
    }
    out.push({ year: Math.floor(year), appEarningsCents: cents, note: '' });
  }
  return out;
}

/**
 * Backup-health timestamps. "Generated a file" and "confirmed an external
 * archive" stay distinct concepts across every dialect.
 */
function normalizeMeta(
  raw: Record<string, unknown>,
  rawSettings: Record<string, unknown>,
): Partial<Meta> {
  const meta = isPlainObject(raw.meta) ? raw.meta : {};
  return {
    lastRecordChangeAt:
      isoOrNull(meta.lastRecordChangeAt) ?? isoOrNull(rawSettings.lastMutationAt),
    lastBackupGeneratedAt:
      isoOrNull(meta.lastBackupGeneratedAt) ?? isoOrNull(rawSettings.lastBackupAt),
    lastArchiveConfirmedAt:
      isoOrNull(meta.lastArchiveConfirmedAt) ?? isoOrNull(rawSettings.lastBackupConfirmedAt),
  };
}
