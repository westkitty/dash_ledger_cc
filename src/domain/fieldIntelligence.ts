/**
 * Phase 1 field-intelligence domain contract.
 *
 * These records are observations, not additions to the legacy shift earnings.
 * The legacy ledger remains authoritative until a legacyShiftLink is explicitly
 * reconciled with reportingAuthority='session'. No analytics are switched here.
 *
 * All money is integer cents, missing data is null (never zero), event times
 * must carry an offset, and calendar dates remain local YYYY-MM-DD.
 */
import { isValidLocalDate } from './dates';

export type DeliveryPlatform = 'doordash' | 'instacart';
export type IsoWithOffset = string;
export type CaptureCoverage = 'full' | 'partial' | 'unknown';
export type ReconciliationState = 'pending' | 'confirmed';

interface FieldBase {
  id: string;
  createdAt: IsoWithOffset;
  updatedAt: IsoWithOffset;
}

export interface WorkSession extends FieldBase {
  status: 'open' | 'closed';
  localDate: string;
  timeZone: string;
  vehicleId: string;
  leftHomeAt: IsoWithOffset | null;
  returnedHomeAt: IsoWithOffset | null;
  startOdometer: number | null;
  endOdometer: number | null;
  primaryMarketId: string | null;
  conditionTags: string[];
}

export interface PlatformTotal extends FieldBase {
  sessionId: string;
  platform: DeliveryPlatform;
  appPayoutCents: number | null;
  extraCashTipsCents: number | null;
  reportedOnlineMinutes: number | null;
  reportedActiveMinutes: number | null;
  offerCaptureCoverage: CaptureCoverage;
  reconciliation: ReconciliationState;
}

export interface OnlineInterval extends FieldBase {
  sessionId: string;
  platform: DeliveryPlatform;
  startedAt: IsoWithOffset;
  endedAt: IsoWithOffset | null;
}

export interface OfferEvent extends FieldBase {
  sessionId: string;
  platform: DeliveryPlatform;
  observedAt: IsoWithOffset;
  decision: 'accepted' | 'declined' | 'expired' | 'unknown';
  quotedPayCents: number | null;
  quotedMiles: number | null;
  linkedJobId: string | null;
}

export interface CompletedJob extends FieldBase {
  sessionId: string;
  platform: DeliveryPlatform;
  offerId: string | null;
  storeLabel: string | null;
  startedAt: IsoWithOffset | null;
  completedAt: IsoWithOffset | null;
  finalPayoutCents: number | null;
  itemCount: number | null;
  unitCount: number | null;
  customerCount: number | null;
}

export interface TravelLeg extends FieldBase {
  sessionId: string;
  kind: 'delivery' | 'recovery' | 'reposition' | 'outbound_commute' | 'return_commute' | 'uncategorized';
  startedAt: IsoWithOffset | null;
  endedAt: IsoWithOffset | null;
  miles: number | null;
  source: 'odometer' | 'manual' | 'estimated' | 'unknown';
}

export interface MarketVisit extends FieldBase {
  sessionId: string;
  marketId: string;
  startedAt: IsoWithOffset;
  endedAt: IsoWithOffset | null;
  conditionTags: string[];
  notes: string;
}

export interface LegacyShiftLink extends FieldBase {
  sessionId: string;
  shiftId: string;
  reportingAuthority: 'legacy' | 'session';
  reconciledAt: IsoWithOffset | null;
}

export interface SessionExpenseLink extends FieldBase {
  sessionId: string;
  expenseId: string;
}

export interface FieldRecordTypes {
  workSessions: WorkSession;
  platformTotals: PlatformTotal;
  onlineIntervals: OnlineInterval;
  offerEvents: OfferEvent;
  completedJobs: CompletedJob;
  travelLegs: TravelLeg;
  marketVisits: MarketVisit;
  legacyShiftLinks: LegacyShiftLink;
  sessionExpenseLinks: SessionExpenseLink;
}

export type FieldTableName = keyof FieldRecordTypes;
export type FieldCollections = { [K in FieldTableName]: FieldRecordTypes[K][] };

export const FIELD_TABLE_NAMES = [
  'workSessions', 'platformTotals', 'onlineIntervals', 'offerEvents',
  'completedJobs', 'travelLegs', 'marketVisits', 'legacyShiftLinks',
  'sessionExpenseLinks',
] as const satisfies readonly FieldTableName[];

export function emptyFieldCollections(): FieldCollections {
  return {
    workSessions: [], platformTotals: [], onlineIntervals: [],
    offerEvents: [], completedJobs: [], travelLegs: [],
    marketVisits: [], legacyShiftLinks: [], sessionExpenseLinks: [],
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function id(v: unknown): boolean {
  return typeof v === 'string' && v.length > 0 && v.trim() === v && v.length <= 256;
}
function nullableId(v: unknown): boolean { return v === null || id(v); }
function timestamp(v: unknown): boolean {
  return typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
    !Number.isNaN(Date.parse(v));
}
function nullableTimestamp(v: unknown): boolean { return v === null || timestamp(v); }
function cents(v: unknown): boolean { return v === null || (Number.isSafeInteger(v) && (v as number) >= 0); }
function count(v: unknown): boolean { return v === null || (Number.isSafeInteger(v) && (v as number) >= 0); }
function miles(v: unknown): boolean { return v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0); }
function labels(v: unknown): boolean {
  return Array.isArray(v) && v.every(x => id(x)) && v.length <= 50;
}
function oneOf(v: unknown, accepted: readonly string[]): boolean {
  return typeof v === 'string' && accepted.includes(v);
}
function chronological(a: unknown, b: unknown): boolean {
  return !timestamp(a) || !timestamp(b) || Date.parse(a as string) <= Date.parse(b as string);
}
function validTimeZone(v: unknown): boolean {
  if (typeof v !== 'string' || !v.trim()) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: v }).format(); return true; } catch { return false; }
}

export function validateFieldRecord<K extends FieldTableName>(table: K, input: unknown): string[] {
  if (!object(input)) return [table + ': record must be an object'];
  const e: string[] = [];
  const required = (key: string, ok: boolean) => { if (!ok) e.push(table + '.' + key + ' is invalid'); };
  required('id', id(input.id));
  required('createdAt', timestamp(input.createdAt));
  required('updatedAt', timestamp(input.updatedAt));
  if (table !== 'workSessions') required('sessionId', id(input.sessionId));

  if (table === 'workSessions') {
    required('status', oneOf(input.status, ['open', 'closed']));
    required('localDate', isValidLocalDate(input.localDate));
    required('timeZone', validTimeZone(input.timeZone));
    required('vehicleId', id(input.vehicleId));
    required('leftHomeAt', nullableTimestamp(input.leftHomeAt));
    required('returnedHomeAt', nullableTimestamp(input.returnedHomeAt));
    required('startOdometer', miles(input.startOdometer));
    required('endOdometer', miles(input.endOdometer));
    required('primaryMarketId', nullableId(input.primaryMarketId));
    required('conditionTags', labels(input.conditionTags));
    if (miles(input.startOdometer) && miles(input.endOdometer) &&
      input.startOdometer !== null && input.endOdometer !== null &&
      (input.endOdometer as number) < (input.startOdometer as number)) {
      e.push('workSessions: reversed odometer');
    }
    if (!chronological(input.leftHomeAt, input.returnedHomeAt)) e.push('workSessions: return before departure');
  } else if (table === 'platformTotals') {
    required('platform', oneOf(input.platform, ['doordash', 'instacart']));
    required('appPayoutCents', cents(input.appPayoutCents));
    required('extraCashTipsCents', cents(input.extraCashTipsCents));
    required('reportedOnlineMinutes', count(input.reportedOnlineMinutes));
    required('reportedActiveMinutes', count(input.reportedActiveMinutes));
    required('offerCaptureCoverage', oneOf(input.offerCaptureCoverage, ['full', 'partial', 'unknown']));
    required('reconciliation', oneOf(input.reconciliation, ['pending', 'confirmed']));
  } else if (table === 'onlineIntervals') {
    required('platform', oneOf(input.platform, ['doordash', 'instacart']));
    required('startedAt', timestamp(input.startedAt));
    required('endedAt', nullableTimestamp(input.endedAt));
    if (!chronological(input.startedAt, input.endedAt)) e.push('onlineIntervals: end before start');
  } else if (table === 'offerEvents') {
    required('platform', oneOf(input.platform, ['doordash', 'instacart']));
    required('observedAt', timestamp(input.observedAt));
    required('decision', oneOf(input.decision, ['accepted', 'declined', 'expired', 'unknown']));
    required('quotedPayCents', cents(input.quotedPayCents));
    required('quotedMiles', miles(input.quotedMiles));
    required('linkedJobId', nullableId(input.linkedJobId));
  } else if (table === 'completedJobs') {
    required('platform', oneOf(input.platform, ['doordash', 'instacart']));
    required('offerId', nullableId(input.offerId));
    required('storeLabel', input.storeLabel === null || id(input.storeLabel));
    required('startedAt', nullableTimestamp(input.startedAt));
    required('completedAt', nullableTimestamp(input.completedAt));
    required('finalPayoutCents', cents(input.finalPayoutCents));
    required('itemCount', count(input.itemCount));
    required('unitCount', count(input.unitCount));
    required('customerCount', count(input.customerCount));
    if (!chronological(input.startedAt, input.completedAt)) e.push('completedJobs: end before start');
  } else if (table === 'travelLegs') {
    required('kind', oneOf(input.kind, ['delivery', 'recovery', 'reposition', 'outbound_commute', 'return_commute', 'uncategorized']));
    required('startedAt', nullableTimestamp(input.startedAt));
    required('endedAt', nullableTimestamp(input.endedAt));
    required('miles', miles(input.miles));
    required('source', oneOf(input.source, ['odometer', 'manual', 'estimated', 'unknown']));
    if (!chronological(input.startedAt, input.endedAt)) e.push('travelLegs: end before start');
  } else if (table === 'marketVisits') {
    required('marketId', id(input.marketId));
    required('startedAt', timestamp(input.startedAt));
    required('endedAt', nullableTimestamp(input.endedAt));
    required('conditionTags', labels(input.conditionTags));
    required('notes', typeof input.notes === 'string');
    if (!chronological(input.startedAt, input.endedAt)) e.push('marketVisits: end before start');
  } else if (table === 'legacyShiftLinks') {
    required('shiftId', id(input.shiftId));
    required('reportingAuthority', oneOf(input.reportingAuthority, ['legacy', 'session']));
    required('reconciledAt', nullableTimestamp(input.reconciledAt));
    if (input.reportingAuthority === 'session' && input.reconciledAt === null) {
      e.push('legacyShiftLinks: session authority requires explicit reconciliation timestamp');
    }
  } else if (table === 'sessionExpenseLinks') {
    required('expenseId', id(input.expenseId));
  }
  return e;
}

export type FieldReferenceSets = {
  vehicleIds: ReadonlySet<string>;
  shiftIds: ReadonlySet<string>;
  expenseIds: ReadonlySet<string>;
};

/** Strict v3 backup validation; never discard unknown or malformed field rows. */
export function validateFieldCollections(
  input: Record<string, unknown>,
  references: FieldReferenceSets,
): string[] {
  const errors: string[] = [];
  const records = emptyFieldCollections();
  for (const table of FIELD_TABLE_NAMES) {
    const value = input[table];
    if (!Array.isArray(value)) { errors.push(table + ' must be an array in a v3 backup'); continue; }
    const seen = new Set<string>();
    for (const [i, row] of value.entries()) {
      errors.push(...validateFieldRecord(table, row).map(e => table + '[' + i + ']: ' + e));
      if (object(row) && id(row.id)) {
        if (seen.has(row.id as string)) errors.push(table + ': duplicate id ' + row.id);
        seen.add(row.id as string);
      }
    }
    (records as unknown as Record<string, unknown>)[table] = value;
  }
  if (errors.length) return errors;

  const sessions = new Set(records.workSessions.map(x => x.id));
  const offers = new Map(records.offerEvents.map(x => [x.id, x]));
  const jobs = new Map(records.completedJobs.map(x => [x.id, x]));
  const platformTotals = new Set<string>();
  const linkedShifts = new Set<string>();
  const linkedExpenses = new Set<string>();
  if (records.workSessions.filter(x => x.status === 'open').length > 1) {
    errors.push('workSessions: at most one open work session');
  }
  for (const session of records.workSessions) {
    if (!references.vehicleIds.has(session.vehicleId)) errors.push('workSessions: unknown vehicle ' + session.vehicleId);
  }
  for (const table of FIELD_TABLE_NAMES) {
    if (table === 'workSessions') continue;
    for (const row of records[table]) {
      if (!sessions.has(row.sessionId)) errors.push(table + ': unknown session ' + row.sessionId);
    }
  }
  for (const total of records.platformTotals) {
    const key = total.sessionId + '|' + total.platform;
    if (platformTotals.has(key)) errors.push('platformTotals: duplicate platform per session');
    platformTotals.add(key);
  }
  for (const job of records.completedJobs) {
    const offer = job.offerId ? offers.get(job.offerId) : null;
    if (job.offerId && !offer) errors.push('completedJobs: unknown offer ' + job.offerId);
    if (offer && (offer.sessionId !== job.sessionId || offer.platform !== job.platform)) {
      errors.push('completedJobs: offer must match job session and platform');
    }
  }
  for (const offer of records.offerEvents) {
    const job = offer.linkedJobId ? jobs.get(offer.linkedJobId) : null;
    if (offer.linkedJobId && !job) errors.push('offerEvents: unknown job ' + offer.linkedJobId);
    if (job && (job.sessionId !== offer.sessionId || job.platform !== offer.platform)) {
      errors.push('offerEvents: job must match offer session and platform');
    }
  }
  for (const link of records.legacyShiftLinks) {
    if (!references.shiftIds.has(link.shiftId)) errors.push('legacyShiftLinks: unknown legacy shift ' + link.shiftId);
    if (linkedShifts.has(link.shiftId)) errors.push('legacyShiftLinks: duplicate shift link ' + link.shiftId);
    linkedShifts.add(link.shiftId);
  }
  for (const link of records.sessionExpenseLinks) {
    if (!references.expenseIds.has(link.expenseId)) errors.push('sessionExpenseLinks: unknown expense ' + link.expenseId);
    if (linkedExpenses.has(link.expenseId)) errors.push('sessionExpenseLinks: duplicate expense link ' + link.expenseId);
    linkedExpenses.add(link.expenseId);
  }
  return errors;
}
