/**
 * Expense category / tax-treatment-class mapping.
 *
 * Dash Ledger organises evidence and planning information. It does NOT determine
 * legal deductibility. Unknown categories default to REVIEW.
 */

import type { TaxClass } from './types';

export interface CategoryDef {
  category: string;
  taxClass: TaxClass;
}

export const CATEGORY_DEFS: CategoryDef[] = [
  // VEHICLE_ACTUAL — vehicle actual-expense evidence
  { category: 'Fuel', taxClass: 'VEHICLE_ACTUAL' },
  { category: 'Oil', taxClass: 'VEHICLE_ACTUAL' },
  { category: 'Maintenance / Repair', taxClass: 'VEHICLE_ACTUAL' },
  { category: 'Tires', taxClass: 'VEHICLE_ACTUAL' },
  { category: 'Insurance', taxClass: 'VEHICLE_ACTUAL' },
  { category: 'Registration / License', taxClass: 'VEHICLE_ACTUAL' },
  { category: 'Lease / Vehicle Cost', taxClass: 'VEHICLE_ACTUAL' },
  { category: 'Other Vehicle', taxClass: 'VEHICLE_ACTUAL' },
  // MILEAGE_ADDON — potential standard-mileage additions
  { category: 'Parking', taxClass: 'MILEAGE_ADDON' },
  { category: 'Tolls', taxClass: 'MILEAGE_ADDON' },
  // NON_VEHICLE_BUSINESS — other business-expense tracking
  { category: 'Phone / Data', taxClass: 'NON_VEHICLE_BUSINESS' },
  { category: 'Delivery Gear / Hot Bags', taxClass: 'NON_VEHICLE_BUSINESS' },
  { category: 'Phone Mount / Charger', taxClass: 'NON_VEHICLE_BUSINESS' },
  { category: 'Supplies', taxClass: 'NON_VEHICLE_BUSINESS' },
  { category: 'Cleaning', taxClass: 'NON_VEHICLE_BUSINESS' },
  { category: 'Other Business', taxClass: 'NON_VEHICLE_BUSINESS' },
  // REVIEW — undecided
  { category: 'Review / Unsure', taxClass: 'REVIEW' },
];

const CATEGORY_MAP: Map<string, TaxClass> = new Map(
  CATEGORY_DEFS.map((d) => [d.category.toLowerCase(), d.taxClass]),
);

export const ALL_CATEGORIES: string[] = CATEGORY_DEFS.map((d) => d.category);

/** Fast-access chips for the add/edit expense form. */
export const QUICK_CATEGORIES: string[] = [
  'Fuel',
  'Maintenance / Repair',
  'Parking',
  'Tolls',
  'Phone / Data',
  'Delivery Gear / Hot Bags',
  'Supplies',
  'Review / Unsure',
];

export function taxClassForCategory(category: string | null | undefined): TaxClass {
  if (!category) return 'REVIEW';
  return CATEGORY_MAP.get(category.trim().toLowerCase()) ?? 'REVIEW';
}

export function isKnownCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return CATEGORY_MAP.has(category.trim().toLowerCase());
}

/** Group tax classes for reporting. */
export const TAX_CLASS_ORDER: TaxClass[] = [
  'VEHICLE_ACTUAL',
  'MILEAGE_ADDON',
  'NON_VEHICLE_BUSINESS',
  'REVIEW',
];
