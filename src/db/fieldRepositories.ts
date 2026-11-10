/**
 * Phase 1 repository boundary for multi-platform observations.
 *
 * Add-only for now: editing and UI capture belong to Phase 2. Every insertion
 * validates the runtime payload, its links, and the single-open-session rule
 * inside one IndexedDB transaction. Legacy shifts/totals are never rewritten.
 */
import { getDB, KV_KEYS } from './db';
import {
  FIELD_TABLE_NAMES,
  validateFieldRecord,
  type FieldRecordTypes,
  type FieldTableName,
} from '../domain/fieldIntelligence';
import { SCHEMA_VERSION } from '../domain/types';

function isFieldTable(name: string): name is FieldTableName {
  return FIELD_TABLE_NAMES.some(value => value === name);
}

export async function listFieldRecords<K extends FieldTableName>(table: K): Promise<FieldRecordTypes[K][]> {
  if (!isFieldTable(table)) throw new Error('Unknown field-intelligence table.');
  return getDB().table(table).toArray() as Promise<FieldRecordTypes[K][]>;
}

export async function addFieldRecord<K extends FieldTableName>(
  table: K, record: FieldRecordTypes[K],
): Promise<void> {
  if (!isFieldTable(table)) throw new Error('Unknown field-intelligence table.');
  const errors = validateFieldRecord(table, record);
  if (errors.length) throw new Error(errors.join('; '));
  const db = getDB();
  const row = record as unknown as Record<string, unknown>;

  await db.transaction('rw', db.tables, async () => {
    if (table === 'workSessions') {
      if (!await db.vehicles.get(row.vehicleId as string)) {
        throw new Error('Work session references an unknown vehicle.');
      }
      if (row.status === 'open' && await db.workSessions.where('status').equals('open').count()) {
        throw new Error('Only one open work session is allowed.');
      }
    } else {
      const session = await db.workSessions.get(row.sessionId as string);
      if (!session) throw new Error('Field record references an unknown work session.');
      if (table === 'legacyShiftLinks') {
        if (!await db.shifts.get(row.shiftId as string)) throw new Error('Unknown legacy shift.');
      }
      if (table === 'sessionExpenseLinks') {
        if (!await db.expenses.get(row.expenseId as string)) throw new Error('Unknown expense.');
      }
      if (table === 'completedJobs' && row.offerId !== null) {
        const offer = await db.offerEvents.get(row.offerId as string);
        if (!offer || offer.sessionId !== row.sessionId || offer.platform !== row.platform) {
          throw new Error('Job offer must exist in the same session and platform.');
        }
      }
      if (table === 'offerEvents' && row.linkedJobId !== null) {
        const job = await db.completedJobs.get(row.linkedJobId as string);
        if (!job || job.sessionId !== row.sessionId || job.platform !== row.platform) {
          throw new Error('Linked job must exist in the same session and platform.');
        }
      }
    }

    // Dexie's add() and unique indexes reject duplicate ids / reused links.
    await db.table(table).add(record);
    const current = await db.kv.get(KV_KEYS.meta);
    const previous = current && typeof current.value === 'object' && current.value !== null
      ? current.value as Record<string, unknown> : {};
    await db.kv.put({
      key: KV_KEYS.meta,
      value: { ...previous, schemaVersion: SCHEMA_VERSION, lastRecordChangeAt: new Date().toISOString() },
    });
  });
}
