PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_label TEXT NOT NULL,
  credential_digest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  token_digest TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  last_sync_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS sync_state (
  user_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  latest_snapshot_version INTEGER NOT NULL,
  source_generated_at TEXT NOT NULL,
  server_received_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  format_version INTEGER NOT NULL,
  snapshot_hash TEXT NOT NULL,
  vehicle_count INTEGER NOT NULL,
  shift_count INTEGER NOT NULL,
  expense_count INTEGER NOT NULL,
  mileage_rate_count INTEGER NOT NULL,
  implausible_miles REAL NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vehicles (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  archived INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS shifts (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  week_key TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  vehicle_label TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  start_odometer REAL,
  end_odometer REAL,
  app_earnings_cents INTEGER,
  cash_tips_cents INTEGER,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON shifts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_user_status ON shifts(user_id, status);

CREATE TABLE IF NOT EXISTS expenses (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category TEXT NOT NULL,
  tax_class TEXT NOT NULL,
  shift_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_tax_class ON expenses(user_id, tax_class);

CREATE TABLE IF NOT EXISTS mileage_rates (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  rate_per_mile REAL NOT NULL,
  label TEXT NOT NULL,
  source TEXT NOT NULL,
  seeded INTEGER NOT NULL,
  snapshot_version INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_rates_user_start ON mileage_rates(user_id, start_date);

CREATE TABLE IF NOT EXISTS remote_inbox (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'shift_update')),
  payload_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded', 'expired')),
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  source_client TEXT,
  UNIQUE (user_id, idempotency_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_inbox_user_status ON remote_inbox(user_id, status, created_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  tool_name TEXT NOT NULL,
  outcome TEXT NOT NULL,
  request_id TEXT,
  payload_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS usage_daily (
  user_id TEXT NOT NULL,
  day_utc TEXT NOT NULL,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  sync_uploads INTEGER NOT NULL DEFAULT 0,
  proposals INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day_utc)
);
