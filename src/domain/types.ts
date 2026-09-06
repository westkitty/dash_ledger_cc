/**
 * Dash Ledger core domain types.
 *
 * Conventions:
 *  - Money is stored as integer cents (see domain/money.ts). Fields named
 *    `*Cents` are integer cents. Never store dollars as floats.
 *  - Calendar work dates are local-date strings `YYYY-MM-DD` (see domain/dates.ts).
 *    Never a UTC timestamp.
 *  - Event timestamps (`createdAt`, `updatedAt`, `capturedAt`, `reviewedAt`) are
 *    ISO 8601 strings and may carry timezone / time-of-day.
 */

export const SCHEMA_VERSION = 1;

export type Iso = string; // ISO-8601 timestamp
export type LocalDate = string; // YYYY-MM-DD, local calendar
export type LocalTime = string; // HH:mm, local wall clock
export type WeekKey = string; // LocalDate of the week's Monday

export type ShiftStatus = 'active' | 'completed';

export interface Vehicle {
  id: string;
  label: string;
  archived: boolean;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface Shift {
  id: string;
  status: ShiftStatus;
  /** Local calendar date the work belongs to. Never shifts across midnight. */
  date: LocalDate;
  /** Denormalised Monday key for fast weekly queries. Recomputed from `date`. */
  weekKey: WeekKey;
  vehicleId: string;
  /** Historical label snapshot so deleting/renaming a vehicle keeps the record readable. */
  vehicleLabel: string;
  startTime: LocalTime | null;
  endTime: LocalTime | null;
  startOdometer: number | null;
  endOdometer: number | null;
  appEarningsCents: number | null;
  cashTipsCents: number | null;
  purpose: string;
  notes: string;
  createdAt: Iso;
  updatedAt: Iso;
}

export type TaxClass =
  | 'VEHICLE_ACTUAL'
  | 'MILEAGE_ADDON'
  | 'NON_VEHICLE_BUSINESS'
  | 'REVIEW';

export interface Expense {
  id: string;
  date: LocalDate;
  amountCents: number;
  merchant: string;
  category: string;
  taxClass: TaxClass;
  notes: string;
  shiftId: string | null;
  receiptId: string | null;
  createdAt: Iso;
  updatedAt: Iso;
}

export type ReceiptStatus = 'Inbox' | 'Classified';

export interface Receipt {
  id: string;
  capturedAt: Iso;
  date: LocalDate | null;
  merchant: string;
  amountCents: number | null;
  category: string | null;
  taxClass: TaxClass | null;
  notes: string;
  status: ReceiptStatus;
  expenseId: string | null;
  originalFilename: string;
  mimeType: string;
  byteCount: number;
  /** null = ok; string = human-readable optimisation error (image still preserved). */
  imageProcessingError: string | null;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface ReceiptBlob {
  receiptId: string;
  image: Blob;
  thumbnail: Blob | null;
  mimeType: string;
  byteCount: number;
}

export interface WeeklyClosure {
  weekKey: WeekKey;
  reviewedAt: Iso;
  reopenedAt: Iso | null;
  note: string;
}

export interface MileageRate {
  id: string;
  /** Inclusive local start date. */
  startDate: LocalDate;
  /** Inclusive local end date, or null for open-ended. */
  endDate: LocalDate | null;
  /** Dollars per mile, e.g. 0.725. Reference/estimate data only. */
  ratePerMile: number;
  label: string;
  source: string;
  /** true = shipped seed data; false = user-added override/period. */
  seeded: boolean;
}

export interface MerchantMemoryEntry {
  merchantKey: string; // normalised merchant name
  displayName: string;
  /** category -> count of times classified that way */
  counts: Record<string, number>;
  lastCategory: string;
  lastTaxClass: TaxClass;
  updatedAt: Iso;
}

export interface AnnualOdometer {
  year: number;
  vehicleId: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
}

export interface StatementTotal {
  year: number;
  appEarningsCents: number | null;
  note: string;
}

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeChoice;
  backupOverdueDays: number;
  defaultVehicleId: string | null;
  defaultPurpose: string;
  implausibleMiles: number;
  annualOdometers: AnnualOdometer[];
  statementTotals: StatementTotal[];
}

export interface Meta {
  schemaVersion: number;
  appVersion: string;
  lastRecordChangeAt: Iso | null;
  lastBackupGeneratedAt: Iso | null;
  lastArchiveConfirmedAt: Iso | null;
  restoredAt: Iso | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  backupOverdueDays: 14,
  defaultVehicleId: null,
  defaultPurpose: 'DoorDash delivery work',
  implausibleMiles: 400,
  annualOdometers: [],
  statementTotals: [],
};

export const TAX_CLASS_LABELS: Record<TaxClass, string> = {
  VEHICLE_ACTUAL: 'Vehicle actual-expense evidence',
  MILEAGE_ADDON: 'Potential standard-mileage additions',
  NON_VEHICLE_BUSINESS: 'Other business-expense tracking',
  REVIEW: 'Review / Unsure',
};

export const TAX_CLASS_HINTS: Record<TaxClass, string> = {
  VEHICLE_ACTUAL:
    'Tracked as possible evidence for an actual-expense vehicle calculation. Not added to the standard-mileage estimate.',
  MILEAGE_ADDON:
    'Kept separate from vehicle operating costs. Parking and tolls may be added on top of a standard-mileage estimate.',
  NON_VEHICLE_BUSINESS: 'Other business-expense tracking, kept separate from vehicle costs.',
  REVIEW: 'You have not decided how to classify this record yet. No deductible treatment is assumed.',
};
