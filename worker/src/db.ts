import type { Env } from './env';
import { LIMITS } from './env';
import type { GptSyncSnapshot } from './schemas';

export interface UserRow {
  id: string;
  display_label: string;
  credential_digest: string;
  status: 'active' | 'disabled';
}

export interface DeviceRow {
  id: string;
  user_id: string;
  label: string;
  token_digest: string;
  revoked_at: string | null;
}

export interface SyncStateRow {
  user_id: string;
  device_id: string;
  latest_snapshot_version: number;
  source_generated_at: string;
  server_received_at: string;
  schema_version: number;
  format_version: number;
  snapshot_hash: string;
  vehicle_count: number;
  shift_count: number;
  expense_count: number;
  mileage_rate_count: number;
  implausible_miles: number;
}

export interface ShiftRow {
  id: string;
  status: 'active' | 'completed';
  date: string;
  week_key: string;
  vehicle_id: string;
  vehicle_label: string;
  start_time: string | null;
  end_time: string | null;
  start_odometer: number | null;
  end_odometer: number | null;
  app_earnings_cents: number | null;
  cash_tips_cents: number | null;
  purpose: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalRow {
  id: string;
  user_id: string;
  kind: 'expense' | 'shift_update';
  payload_json: string;
  idempotency_key: string;
  status: 'pending' | 'accepted' | 'rejected' | 'superseded' | 'expired';
  created_at: string;
  resolved_at: string | null;
  source_client: string | null;
}

export async function getUser(env: Env, userId: string): Promise<UserRow | null> {
  return env.DB.prepare(
    'SELECT id, display_label, credential_digest, status FROM users WHERE id = ?',
  ).bind(userId).first<UserRow>();
}

export async function upsertUser(
  env: Env,
  input: { userId: string; displayLabel: string; credentialDigest: string },
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO users (id, display_label, credential_digest, status, created_at, updated_at) " +
      "VALUES (?, ?, ?, 'active', ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET display_label = excluded.display_label, " +
      "credential_digest = excluded.credential_digest, status = 'active', updated_at = excluded.updated_at",
  ).bind(input.userId, input.displayLabel, input.credentialDigest, now, now).run();
}

export async function createDevice(
  env: Env,
  input: { userId: string; label: string; tokenDigest: string },
): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO devices (id, user_id, label, token_digest, created_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, input.userId, input.label, input.tokenDigest, new Date().toISOString()).run();
  return id;
}

export async function getDeviceByDigest(env: Env, digest: string): Promise<DeviceRow | null> {
  return env.DB.prepare(
    'SELECT id, user_id, label, token_digest, revoked_at FROM devices ' +
      'WHERE token_digest = ? AND revoked_at IS NULL',
  ).bind(digest).first<DeviceRow>();
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

export async function replaceMirror(
  env: Env,
  userId: string,
  snapshot: GptSyncSnapshot,
): Promise<{ version: number; unchanged: boolean }> {
  const current = await env.DB.prepare(
    'SELECT latest_snapshot_version, snapshot_hash FROM sync_state WHERE user_id = ?',
  ).bind(userId).first<{ latest_snapshot_version: number; snapshot_hash: string }>();

  if (current?.snapshot_hash === snapshot.snapshotHash) {
    await env.DB.prepare('UPDATE devices SET last_sync_at = ? WHERE id = ? AND user_id = ?')
      .bind(new Date().toISOString(), snapshot.deviceId, userId)
      .run();
    return { version: current.latest_snapshot_version, unchanged: true };
  }

  const version = (current?.latest_snapshot_version ?? 0) + 1;
  const now = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare('DELETE FROM vehicles WHERE user_id = ?').bind(userId),
    env.DB.prepare(
      "INSERT INTO vehicles (user_id, id, label, archived, created_at, updated_at, snapshot_version) " +
        "SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.label'), " +
        "CASE json_extract(value, '$.archived') WHEN 1 THEN 1 ELSE 0 END, " +
        "json_extract(value, '$.createdAt'), json_extract(value, '$.updatedAt'), ? FROM json_each(?)",
    ).bind(userId, version, serialized(snapshot.vehicles)),

    env.DB.prepare('DELETE FROM shifts WHERE user_id = ?').bind(userId),
    env.DB.prepare(
      "INSERT INTO shifts (user_id, id, status, date, week_key, vehicle_id, vehicle_label, " +
        "start_time, end_time, start_odometer, end_odometer, app_earnings_cents, cash_tips_cents, " +
        "purpose, created_at, updated_at, snapshot_version) " +
        "SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.status'), " +
        "json_extract(value, '$.date'), json_extract(value, '$.weekKey'), " +
        "json_extract(value, '$.vehicleId'), json_extract(value, '$.vehicleLabel'), " +
        "json_extract(value, '$.startTime'), json_extract(value, '$.endTime'), " +
        "json_extract(value, '$.startOdometer'), json_extract(value, '$.endOdometer'), " +
        "json_extract(value, '$.appEarningsCents'), json_extract(value, '$.cashTipsCents'), " +
        "json_extract(value, '$.purpose'), json_extract(value, '$.createdAt'), " +
        "json_extract(value, '$.updatedAt'), ? FROM json_each(?)",
    ).bind(userId, version, serialized(snapshot.shifts)),

    env.DB.prepare('DELETE FROM expenses WHERE user_id = ?').bind(userId),
    env.DB.prepare(
      "INSERT INTO expenses (user_id, id, date, amount_cents, category, tax_class, shift_id, " +
        "created_at, updated_at, snapshot_version) " +
        "SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.date'), " +
        "json_extract(value, '$.amountCents'), json_extract(value, '$.category'), " +
        "json_extract(value, '$.taxClass'), json_extract(value, '$.shiftId'), " +
        "json_extract(value, '$.createdAt'), json_extract(value, '$.updatedAt'), ? FROM json_each(?)",
    ).bind(userId, version, serialized(snapshot.expenses)),

    env.DB.prepare('DELETE FROM mileage_rates WHERE user_id = ?').bind(userId),
    env.DB.prepare(
      "INSERT INTO mileage_rates (user_id, id, start_date, end_date, rate_per_mile, label, source, " +
        "seeded, snapshot_version) SELECT ?, json_extract(value, '$.id'), " +
        "json_extract(value, '$.startDate'), json_extract(value, '$.endDate'), " +
        "json_extract(value, '$.ratePerMile'), json_extract(value, '$.label'), " +
        "json_extract(value, '$.source'), CASE json_extract(value, '$.seeded') WHEN 1 THEN 1 ELSE 0 END, " +
        "? FROM json_each(?)",
    ).bind(userId, version, serialized(snapshot.mileageRates)),

    env.DB.prepare(
      "INSERT INTO sync_state (user_id, device_id, latest_snapshot_version, source_generated_at, " +
        "server_received_at, schema_version, format_version, snapshot_hash, vehicle_count, shift_count, " +
        "expense_count, mileage_rate_count, implausible_miles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET device_id = excluded.device_id, " +
        "latest_snapshot_version = excluded.latest_snapshot_version, " +
        "source_generated_at = excluded.source_generated_at, server_received_at = excluded.server_received_at, " +
        "schema_version = excluded.schema_version, format_version = excluded.format_version, " +
        "snapshot_hash = excluded.snapshot_hash, vehicle_count = excluded.vehicle_count, " +
        "shift_count = excluded.shift_count, expense_count = excluded.expense_count, " +
        "mileage_rate_count = excluded.mileage_rate_count, implausible_miles = excluded.implausible_miles",
    ).bind(
      userId,
      snapshot.deviceId,
      version,
      snapshot.generatedAt,
      now,
      snapshot.schemaVersion,
      snapshot.formatVersion,
      snapshot.snapshotHash,
      snapshot.vehicles.length,
      snapshot.shifts.length,
      snapshot.expenses.length,
      snapshot.mileageRates.length,
      snapshot.settings.implausibleMiles,
    ),

    env.DB.prepare('UPDATE devices SET last_sync_at = ? WHERE id = ? AND user_id = ?')
      .bind(now, snapshot.deviceId, userId),
  ]);

  return { version, unchanged: false };
}

export async function getSyncState(env: Env, userId: string): Promise<SyncStateRow | null> {
  return env.DB.prepare('SELECT * FROM sync_state WHERE user_id = ?')
    .bind(userId)
    .first<SyncStateRow>();
}

export async function getRecentShifts(env: Env, userId: string, limit: number): Promise<ShiftRow[]> {
  const result = await env.DB.prepare(
    'SELECT id, status, date, week_key, vehicle_id, vehicle_label, start_time, end_time, ' +
      'start_odometer, end_odometer, app_earnings_cents, cash_tips_cents, purpose, created_at, updated_at ' +
      'FROM shifts WHERE user_id = ? ORDER BY date DESC, start_time DESC LIMIT ?',
  ).bind(userId, limit).all<ShiftRow>();
  return result.results;
}

export async function getShift(env: Env, userId: string, shiftId: string): Promise<ShiftRow | null> {
  return env.DB.prepare(
    'SELECT id, status, date, week_key, vehicle_id, vehicle_label, start_time, end_time, ' +
      'start_odometer, end_odometer, app_earnings_cents, cash_tips_cents, purpose, created_at, updated_at ' +
      'FROM shifts WHERE user_id = ? AND id = ?',
  ).bind(userId, shiftId).first<ShiftRow>();
}

export async function getShiftsInRange(
  env: Env,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<ShiftRow[]> {
  const result = await env.DB.prepare(
    'SELECT id, status, date, week_key, vehicle_id, vehicle_label, start_time, end_time, ' +
      'start_odometer, end_odometer, app_earnings_cents, cash_tips_cents, purpose, created_at, updated_at ' +
      'FROM shifts WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, start_time',
  ).bind(userId, startDate, endDate).all<ShiftRow>();
  return result.results;
}

export async function getPendingReviewSummary(env: Env, userId: string) {
  const state = await getSyncState(env, userId);
  const threshold = state?.implausible_miles ?? 400;
  const [active, incomplete, suspicious, reviewExpenses] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM shifts WHERE user_id = ? AND status = 'active'")
      .bind(userId).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM shifts WHERE user_id = ? AND status = 'completed' " +
        'AND (start_odometer IS NULL OR end_odometer IS NULL)',
    ).bind(userId).first<{ count: number }>(),
    env.DB.prepare(
      'SELECT COUNT(*) AS count FROM shifts WHERE user_id = ? ' +
        'AND start_odometer IS NOT NULL AND end_odometer IS NOT NULL ' +
        'AND (end_odometer < start_odometer OR end_odometer - start_odometer > ?)',
    ).bind(userId, threshold).first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM expenses WHERE user_id = ? AND tax_class = 'REVIEW'")
      .bind(userId).first<{ count: number }>(),
  ]);

  return {
    activeShifts: active?.count ?? 0,
    completedShiftsMissingOdometer: incomplete?.count ?? 0,
    suspiciousMileageShifts: suspicious?.count ?? 0,
    reviewClassExpenses: reviewExpenses?.count ?? 0,
    implausibleMilesThreshold: threshold,
  };
}

export async function incrementUsage(
  env: Env,
  userId: string,
  kind: 'tool_calls' | 'sync_uploads' | 'proposals',
): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    'INSERT INTO usage_daily (user_id, day_utc, tool_calls, sync_uploads, proposals) ' +
      'VALUES (?, ?, 0, 0, 0) ON CONFLICT(user_id, day_utc) DO NOTHING',
  ).bind(userId, day).run();

  const sql =
    kind === 'tool_calls'
      ? 'UPDATE usage_daily SET tool_calls = tool_calls + 1 WHERE user_id = ? AND day_utc = ? RETURNING tool_calls AS count'
      : kind === 'sync_uploads'
        ? 'UPDATE usage_daily SET sync_uploads = sync_uploads + 1 WHERE user_id = ? AND day_utc = ? RETURNING sync_uploads AS count'
        : 'UPDATE usage_daily SET proposals = proposals + 1 WHERE user_id = ? AND day_utc = ? RETURNING proposals AS count';
  const row = await env.DB.prepare(sql).bind(userId, day).first<{ count: number }>();
  const count = row?.count ?? 0;
  const limit =
    kind === 'tool_calls'
      ? LIMITS.toolCallsPerUserPerDay
      : kind === 'sync_uploads'
        ? LIMITS.syncUploadsPerUserPerDay
        : LIMITS.proposalsPerUserPerDay;
  if (count > limit) throw new Error('Daily ' + kind + ' limit reached.');
  return count;
}

export async function queueProposal(
  env: Env,
  input: {
    userId: string;
    kind: ProposalRow['kind'];
    payload: unknown;
    idempotencyKey: string;
    sourceClient?: string | null;
  },
): Promise<ProposalRow> {
  const existing = await env.DB.prepare(
    'SELECT * FROM remote_inbox WHERE user_id = ? AND idempotency_key = ?',
  ).bind(input.userId, input.idempotencyKey).first<ProposalRow>();
  if (existing) return existing;

  const row: ProposalRow = {
    id: crypto.randomUUID(),
    user_id: input.userId,
    kind: input.kind,
    payload_json: JSON.stringify(input.payload),
    idempotency_key: input.idempotencyKey,
    status: 'pending',
    created_at: new Date().toISOString(),
    resolved_at: null,
    source_client: input.sourceClient ?? null,
  };

  await env.DB.prepare(
    "INSERT INTO remote_inbox (id, user_id, kind, payload_json, idempotency_key, status, created_at, source_client) " +
      "VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
  ).bind(
    row.id,
    row.user_id,
    row.kind,
    row.payload_json,
    row.idempotency_key,
    row.created_at,
    row.source_client,
  ).run();
  return row;
}

export async function listPendingProposals(env: Env, userId: string): Promise<ProposalRow[]> {
  const result = await env.DB.prepare(
    "SELECT * FROM remote_inbox WHERE user_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 200",
  ).bind(userId).all<ProposalRow>();
  return result.results;
}

export async function resolveProposal(
  env: Env,
  userId: string,
  proposalId: string,
  status: 'accepted' | 'rejected',
): Promise<boolean> {
  const result = await env.DB.prepare(
    "UPDATE remote_inbox SET status = ?, resolved_at = ? " +
      "WHERE id = ? AND user_id = ? AND status = 'pending'",
  ).bind(status, new Date().toISOString(), proposalId, userId).run();
  return (result.meta?.changes ?? 0) > 0;
}

export function publicProposal(row: ProposalRow) {
  return {
    id: row.id,
    kind: row.kind,
    payload: JSON.parse(row.payload_json) as unknown,
    status: row.status,
    createdAt: row.created_at,
  };
}
