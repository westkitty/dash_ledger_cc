/**
 * Repository layer. All IndexedDB access goes through here; components and
 * domain calculations never touch Dexie directly.
 */

import { getDB, openDB, KV_KEYS, APP_VERSION, type DashLedgerDB } from './db';
import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  type Vehicle,
  type Shift,
  type Expense,
  type Receipt,
  type ReceiptBlob,
  type WeeklyClosure,
  type MileageRate,
  type MerchantMemoryEntry,
  type Settings,
  type Meta,
} from '../domain/types';
import { mondayOf, todayLocalDate } from '../domain/dates';
import { seededMileageRates } from '../domain/mileageRates';
import { recordClassification, normaliseMerchant } from '../domain/merchantMemory';
import { logDiagnostic } from '../services/diagnosticsLog';
import { requestPersistentStorage } from '../services/storageHealth';

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // RFC4122-ish fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Settings & meta (single KV rows)
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const db = getDB();
  const row = await db.kv.get(KV_KEYS.settings);
  if (!row) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<Settings>) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = getDB();
  const current = await getSettings();
  const next: Settings = { ...current, ...patch };
  await db.kv.put({ key: KV_KEYS.settings, value: next });
  return next;
}

export async function getMeta(): Promise<Meta> {
  const db = getDB();
  const row = await db.kv.get(KV_KEYS.meta);
  const base: Meta = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    lastRecordChangeAt: null,
    lastBackupGeneratedAt: null,
    lastArchiveConfirmedAt: null,
    restoredAt: null,
    persistRequestedAt: null,
    lastImportAt: null,
  };
  if (!row) return base;
  return { ...base, ...(row.value as Partial<Meta>) };
}

export async function saveMeta(patch: Partial<Meta>): Promise<Meta> {
  const db = getDB();
  const current = await getMeta();
  const next: Meta = { ...current, ...patch };
  await db.kv.put({ key: KV_KEYS.meta, value: next });
  return next;
}

async function touchRecordChange(): Promise<void> {
  await saveMeta({ lastRecordChangeAt: nowIso() });
}

// ---------------------------------------------------------------------------
// Bootstrap / seed
// ---------------------------------------------------------------------------

export async function ensureSeed(): Promise<void> {
  const db = await openDB();
  const rateCount = await db.mileageRates.count();
  if (rateCount === 0) {
    await db.mileageRates.bulkPut(seededMileageRates());
  }
  const meta = await db.kv.get(KV_KEYS.meta);
  if (!meta) {
    await saveMeta({});
  }
  const settings = await db.kv.get(KV_KEYS.settings);
  if (!settings) {
    await db.kv.put({ key: KV_KEYS.settings, value: { ...DEFAULT_SETTINGS } });
  }
}

/**
 * Ask the browser once to make this origin's storage persistent, so the ledger
 * is not evicted under storage pressure.
 *
 * Best effort in every direction: feature-detected, never fatal, and asked
 * exactly once — the attempt is recorded whether or not it was granted, so the
 * user is never re-prompted. The honest live state is read separately from
 * `navigator.storage.persisted()` in Vault -> Storage.
 */
export async function ensurePersistentStorageRequested(): Promise<void> {
  try {
    const meta = await getMeta();
    if (meta.persistRequestedAt) return;
    let granted: boolean | null = null;
    try {
      granted = await requestPersistentStorage();
    } catch {
      granted = null;
    }
    await saveMeta({ persistRequestedAt: nowIso() });
    logDiagnostic(
      'storage',
      granted === true
        ? 'Persistent storage granted for this origin.'
        : granted === false
          ? 'Persistent storage was not granted. Records are still saved locally, but the browser may evict them under storage pressure.'
          : 'Persistent storage could not be requested in this browser.',
    );
  } catch (err) {
    // Storage permission must never be able to block startup.
    logDiagnostic('storage', 'Persistent-storage request failed; continuing without it.', err);
  }
}

/** Total authoritative records currently held. Drives the pre-restore safety gate. */
export async function countCanonicalRecords(): Promise<number> {
  const db = await openDB();
  const [vehicles, shifts, expenses, receipts, weeklyClosures] = await Promise.all([
    db.vehicles.count(),
    db.shifts.count(),
    db.expenses.count(),
    db.receipts.count(),
    db.weeklyClosures.count(),
  ]);
  return vehicles + shifts + expenses + receipts + weeklyClosures;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export async function listVehicles(): Promise<Vehicle[]> {
  const db = getDB();
  const all = await db.vehicles.toArray();
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createVehicle(label: string): Promise<Vehicle> {
  const db = getDB();
  const now = nowIso();
  const vehicle: Vehicle = {
    id: newId(),
    label: label.trim(),
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.vehicles.put(vehicle);
  const settings = await getSettings();
  if (!settings.defaultVehicleId) {
    await saveSettings({ defaultVehicleId: vehicle.id });
  }
  await touchRecordChange();
  return vehicle;
}

export async function updateVehicle(id: string, patch: Partial<Pick<Vehicle, 'label' | 'archived'>>): Promise<void> {
  const db = getDB();
  await db.vehicles.update(id, { ...patch, updatedAt: nowIso() });
  await touchRecordChange();
}

export async function setDefaultVehicle(id: string): Promise<void> {
  await saveSettings({ defaultVehicleId: id });
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export async function listShifts(): Promise<Shift[]> {
  const db = getDB();
  const all = await db.shifts.toArray();
  return all.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });
}

export async function getShift(id: string): Promise<Shift | undefined> {
  return getDB().shifts.get(id);
}

export async function getActiveShift(): Promise<Shift | undefined> {
  const db = getDB();
  const actives = await db.shifts.where('status').equals('active').toArray();
  return actives.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}

export interface StartShiftInput {
  vehicleId: string;
  vehicleLabel: string;
  date: string;
  startTime: string | null;
  startOdometer: number | null;
  purpose: string;
}

/**
 * Start a dash. Enforces the single-active-dash invariant inside one
 * transaction: if an active dash already exists, no new record is created and
 * the existing one is returned instead.
 */
export async function startShift(
  input: StartShiftInput,
): Promise<{ shift: Shift; created: boolean }> {
  const db = getDB();
  return db.transaction('rw', db.shifts, db.kv, async () => {
    const existing = await db.shifts.where('status').equals('active').first();
    if (existing) {
      return { shift: existing, created: false };
    }
    const now = nowIso();
    const shift: Shift = {
      id: newId(),
      status: 'active',
      date: input.date,
      weekKey: mondayOf(input.date),
      vehicleId: input.vehicleId,
      vehicleLabel: input.vehicleLabel,
      startTime: input.startTime,
      endTime: null,
      startOdometer: input.startOdometer,
      endOdometer: null,
      appEarningsCents: null,
      cashTipsCents: null,
      purpose: input.purpose,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    await db.shifts.put(shift);
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: now } });
    return { shift, created: true };
  });
}

export interface EndShiftInput {
  endTime: string | null;
  endOdometer: number | null;
  appEarningsCents: number | null;
  cashTipsCents: number | null;
  notes: string;
}

/** Complete an active dash atomically. */
export async function endShift(id: string, input: EndShiftInput): Promise<Shift> {
  const db = getDB();
  return db.transaction('rw', db.shifts, db.kv, async () => {
    const shift = await db.shifts.get(id);
    if (!shift) throw new Error('Dash not found.');
    // Reversed odometer is a factual error, not an unusual-but-plausible value.
    // Reject it here so the invariant holds even if the UI guard is bypassed;
    // the reading is never zeroed, clamped or swapped.
    if (
      typeof input.endOdometer === 'number' &&
      Number.isFinite(input.endOdometer) &&
      typeof shift.startOdometer === 'number' &&
      Number.isFinite(shift.startOdometer) &&
      input.endOdometer < shift.startOdometer
    ) {
      throw new Error(
        'Ending odometer is lower than the starting odometer. Fix the readings before completing this dash.',
      );
    }
    const now = nowIso();
    const next: Shift = {
      ...shift,
      status: 'completed',
      endTime: input.endTime,
      endOdometer: input.endOdometer,
      appEarningsCents: input.appEarningsCents,
      cashTipsCents: input.cashTipsCents,
      notes: input.notes,
      weekKey: mondayOf(shift.date),
      updatedAt: now,
    };
    await db.shifts.put(next);
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: now } });
    return next;
  });
}

export type LogCompletedShiftInput = StartShiftInput & EndShiftInput & { notes: string };

export async function logCompletedShift(input: LogCompletedShiftInput): Promise<Shift> {
  const db = getDB();
  const now = nowIso();
  const shift: Shift = {
    id: newId(),
    status: 'completed',
    date: input.date,
    weekKey: mondayOf(input.date),
    vehicleId: input.vehicleId,
    vehicleLabel: input.vehicleLabel,
    startTime: input.startTime,
    endTime: input.endTime,
    startOdometer: input.startOdometer,
    endOdometer: input.endOdometer,
    appEarningsCents: input.appEarningsCents,
    cashTipsCents: input.cashTipsCents,
    purpose: input.purpose,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  await db.shifts.put(shift);
  await touchRecordChange();
  return shift;
}

export type EditShiftInput = Partial<
  Pick<
    Shift,
    | 'vehicleId'
    | 'vehicleLabel'
    | 'date'
    | 'startTime'
    | 'endTime'
    | 'startOdometer'
    | 'endOdometer'
    | 'appEarningsCents'
    | 'cashTipsCents'
    | 'purpose'
    | 'notes'
    | 'status'
  >
>;

export async function updateShift(id: string, patch: EditShiftInput): Promise<Shift> {
  const db = getDB();
  return db.transaction('rw', db.shifts, db.kv, async () => {
    const shift = await db.shifts.get(id);
    if (!shift) throw new Error('Dash not found.');
    // If we're activating this shift, make sure no other active dash exists.
    if (patch.status === 'active' && shift.status !== 'active') {
      const other = await db.shifts.where('status').equals('active').first();
      if (other && other.id !== id) {
        throw new Error('Another dash is already active. End or discard it first.');
      }
    }
    const next: Shift = {
      ...shift,
      ...patch,
      weekKey: mondayOf(patch.date ?? shift.date),
      updatedAt: nowIso(),
    };
    await db.shifts.put(next);
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: next.updatedAt } });
    return next;
  });
}

/**
 * Delete a shift. Linked expenses and receipts are preserved; only their
 * `shiftId` back-reference is cleared.
 */
export async function deleteShift(id: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.shifts, db.expenses, db.kv, async () => {
    await db.shifts.delete(id);
    const linked = await db.expenses.where('shiftId').equals(id).toArray();
    for (const e of linked) {
      await db.expenses.update(e.id, { shiftId: null, updatedAt: nowIso() });
    }
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: nowIso() } });
  });
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function listExpenses(): Promise<Expense[]> {
  const db = getDB();
  const all = await db.expenses.toArray();
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export async function getExpense(id: string): Promise<Expense | undefined> {
  return getDB().expenses.get(id);
}

export interface ExpenseInput {
  date: string;
  amountCents: number;
  merchant: string;
  category: string;
  taxClass: Expense['taxClass'];
  notes: string;
  shiftId: string | null;
  receiptId: string | null;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const db = getDB();
  const now = nowIso();
  const expense: Expense = { id: newId(), ...input, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.expenses, db.receipts, db.merchantMemory, db.kv, async () => {
    await db.expenses.put(expense);
    if (input.receiptId) {
      await db.receipts.update(input.receiptId, { expenseId: expense.id, updatedAt: now });
    }
    if (input.merchant.trim()) {
      await bumpMerchantMemory(db, input.merchant, input.category, now);
    }
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: now } });
  });
  return expense;
}

export async function updateExpense(id: string, patch: Partial<ExpenseInput>): Promise<Expense> {
  const db = getDB();
  return db.transaction('rw', db.expenses, db.receipts, db.merchantMemory, db.kv, async () => {
    const existing = await db.expenses.get(id);
    if (!existing) throw new Error('Expense not found.');
    const now = nowIso();
    // Receipt link changes: keep both sides consistent.
    if (patch.receiptId !== undefined && patch.receiptId !== existing.receiptId) {
      if (existing.receiptId) {
        await db.receipts.update(existing.receiptId, { expenseId: null, updatedAt: now });
      }
      if (patch.receiptId) {
        await db.receipts.update(patch.receiptId, { expenseId: id, updatedAt: now });
      }
    }
    const next: Expense = { ...existing, ...patch, updatedAt: now };
    await db.expenses.put(next);
    if (patch.merchant !== undefined || patch.category !== undefined) {
      if (next.merchant.trim()) await bumpMerchantMemory(db, next.merchant, next.category, now);
    }
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: now } });
    return next;
  });
}

/** Delete an expense. Linked receipt is preserved; its `expenseId` is cleared. */
export async function deleteExpense(id: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.expenses, db.receipts, db.kv, async () => {
    const existing = await db.expenses.get(id);
    await db.expenses.delete(id);
    if (existing?.receiptId) {
      await db.receipts.update(existing.receiptId, { expenseId: null, updatedAt: nowIso() });
    }
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: nowIso() } });
  });
}

// ---------------------------------------------------------------------------
// Merchant memory
// ---------------------------------------------------------------------------

async function bumpMerchantMemory(
  db: DashLedgerDB,
  merchant: string,
  category: string,
  now: string,
): Promise<void> {
  const key = normaliseMerchant(merchant);
  const existing = await db.merchantMemory.get(key);
  const next = recordClassification(existing, merchant, category, now);
  await db.merchantMemory.put(next);
}

export async function listMerchantMemory(): Promise<MerchantMemoryEntry[]> {
  return getDB().merchantMemory.toArray();
}

export async function getMerchantMemory(merchantKey: string): Promise<MerchantMemoryEntry | undefined> {
  return getDB().merchantMemory.get(merchantKey);
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export async function listReceipts(): Promise<Receipt[]> {
  const db = getDB();
  const all = await db.receipts.toArray();
  return all.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function getReceipt(id: string): Promise<Receipt | undefined> {
  return getDB().receipts.get(id);
}

export async function getReceiptBlob(receiptId: string): Promise<ReceiptBlob | undefined> {
  return getDB().receiptBlobs.get(receiptId);
}

export interface CreateReceiptInput {
  meta: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>;
  /** The image to store — usually the optimised one. */
  image: Blob;
  thumbnail: Blob | null;
  /**
   * The untouched source bytes, when they differ from `image`.
   *
   * Optimisation is best effort, and so is storing its output: if writing the
   * processed image fails (a quota trip, a rejected blob), the receipt is saved
   * once more with the original instead. A receipt is worth more than a smaller
   * receipt, and losing the photo is not an acceptable outcome of trying to
   * shrink it.
   */
  originalImage?: Blob | null;
}

async function writeReceipt(
  db: DashLedgerDB,
  receipt: Receipt,
  image: Blob,
  thumbnail: Blob | null,
  now: string,
): Promise<void> {
  await db.transaction('rw', db.receipts, db.receiptBlobs, db.kv, async () => {
    await db.receipts.put(receipt);
    await db.receiptBlobs.put({
      receiptId: receipt.id,
      image,
      thumbnail,
      mimeType: receipt.mimeType,
      byteCount: receipt.byteCount,
    });
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: now } });
  });
}

export async function createReceipt(input: CreateReceiptInput): Promise<Receipt> {
  const db = getDB();
  const now = nowIso();
  const id = newId();
  const receipt: Receipt = { ...input.meta, id, createdAt: now, updatedAt: now };

  try {
    await writeReceipt(db, receipt, input.image, input.thumbnail, now);
    return receipt;
  } catch (err) {
    const original = input.originalImage;
    const canRetry = original instanceof Blob && original !== input.image && original.size > 0;
    if (!canRetry) throw err;

    logDiagnostic(
      'receipt',
      'Storing the optimised receipt image failed; retrying once with the original bytes.',
      err,
    );
    // Drop the thumbnail on the retry: it belongs to the image we could not
    // store, and it is not worth failing the receipt a second time for.
    const fallback: Receipt = {
      ...receipt,
      mimeType: original.type || receipt.mimeType,
      byteCount: original.size,
      imageProcessingError:
        receipt.imageProcessingError ??
        'The optimised image could not be stored, so the original photo was saved instead.',
    };
    await writeReceipt(db, fallback, original, null, now);
    return fallback;
  }
}

export type ReceiptEditInput = Partial<
  Pick<Receipt, 'date' | 'merchant' | 'amountCents' | 'category' | 'taxClass' | 'notes' | 'status' | 'expenseId'>
>;

export async function updateReceipt(id: string, patch: ReceiptEditInput): Promise<Receipt> {
  const db = getDB();
  return db.transaction('rw', db.receipts, db.expenses, db.merchantMemory, db.kv, async () => {
    const existing = await db.receipts.get(id);
    if (!existing) throw new Error('Receipt not found.');
    const now = nowIso();
    if (patch.expenseId !== undefined && patch.expenseId !== existing.expenseId) {
      if (existing.expenseId) {
        await db.expenses.update(existing.expenseId, { receiptId: null, updatedAt: now });
      }
      if (patch.expenseId) {
        await db.expenses.update(patch.expenseId, { receiptId: id, updatedAt: now });
      }
    }
    const next: Receipt = { ...existing, ...patch, updatedAt: now };
    await db.receipts.put(next);
    if ((patch.merchant !== undefined || patch.category !== undefined) && next.merchant.trim() && next.category) {
      await bumpMerchantMemory(db, next.merchant, next.category, now);
    }
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: now } });
    return next;
  });
}

/** Delete a receipt and its blob. Linked expense is preserved; `receiptId` cleared. */
export async function deleteReceipt(id: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.receipts, db.receiptBlobs, db.expenses, db.kv, async () => {
    const existing = await db.receipts.get(id);
    await db.receipts.delete(id);
    await db.receiptBlobs.delete(id);
    if (existing?.expenseId) {
      await db.expenses.update(existing.expenseId, { receiptId: null, updatedAt: nowIso() });
    }
    await db.kv.put({ key: KV_KEYS.meta, value: { ...(await getMeta()), lastRecordChangeAt: nowIso() } });
  });
}

// ---------------------------------------------------------------------------
// Weekly closures
// ---------------------------------------------------------------------------

export async function listWeeklyClosures(): Promise<WeeklyClosure[]> {
  return getDB().weeklyClosures.toArray();
}

export async function markWeekReviewed(weekKey: string, note = ''): Promise<void> {
  const db = getDB();
  await db.weeklyClosures.put({ weekKey, reviewedAt: nowIso(), reopenedAt: null, note });
}

export async function reopenWeek(weekKey: string): Promise<void> {
  const db = getDB();
  const existing = await db.weeklyClosures.get(weekKey);
  if (existing) {
    await db.weeklyClosures.put({ ...existing, reopenedAt: nowIso() });
    await db.weeklyClosures.delete(weekKey);
  }
}

// ---------------------------------------------------------------------------
// Mileage rates
// ---------------------------------------------------------------------------

export async function listMileageRates(): Promise<MileageRate[]> {
  const db = getDB();
  const all = await db.mileageRates.toArray();
  return all.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function addMileageRate(input: Omit<MileageRate, 'id' | 'seeded'>): Promise<MileageRate> {
  const db = getDB();
  const rate: MileageRate = { ...input, id: newId(), seeded: false };
  await db.mileageRates.put(rate);
  return rate;
}

export async function updateMileageRate(id: string, patch: Partial<MileageRate>): Promise<void> {
  await getDB().mileageRates.update(id, patch);
}

export async function deleteMileageRate(id: string): Promise<void> {
  await getDB().mileageRates.delete(id);
}

export async function resetSeededMileageRates(): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.mileageRates, async () => {
    const all = await db.mileageRates.toArray();
    for (const r of all) if (r.seeded) await db.mileageRates.delete(r.id);
    await db.mileageRates.bulkPut(seededMileageRates());
  });
}

// ---------------------------------------------------------------------------
// Snapshot for the app store
// ---------------------------------------------------------------------------

export interface LedgerSnapshot {
  vehicles: Vehicle[];
  shifts: Shift[];
  expenses: Expense[];
  receipts: Receipt[];
  weeklyClosures: WeeklyClosure[];
  mileageRates: MileageRate[];
  merchantMemory: MerchantMemoryEntry[];
  settings: Settings;
  meta: Meta;
  activeShift: Shift | undefined;
  today: string;
}

export async function loadSnapshot(): Promise<LedgerSnapshot> {
  await openDB();
  await ensureSeed();
  await ensurePersistentStorageRequested();
  const [
    vehicles,
    shifts,
    expenses,
    receipts,
    weeklyClosures,
    mileageRates,
    merchantMemory,
    settings,
    meta,
  ] = await Promise.all([
    listVehicles(),
    listShifts(),
    listExpenses(),
    listReceipts(),
    listWeeklyClosures(),
    listMileageRates(),
    listMerchantMemory(),
    getSettings(),
    getMeta(),
  ]);
  const activeShift = shifts.find((s) => s.status === 'active');
  return {
    vehicles,
    shifts,
    expenses,
    receipts,
    weeklyClosures,
    mileageRates,
    merchantMemory,
    settings,
    meta,
    activeShift,
    today: todayLocalDate(),
  };
}

export async function confirmArchive(): Promise<void> {
  await saveMeta({ lastArchiveConfirmedAt: nowIso() });
}

export async function markBackupGenerated(): Promise<void> {
  await saveMeta({ lastBackupGeneratedAt: nowIso() });
}

export { logDiagnostic };
