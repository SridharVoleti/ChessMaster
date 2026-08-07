// ============================================================
// authz — SQLite schema + connection factory
// Uses better-sqlite3 (synchronous, ideal for route handlers).
// Schema is idempotent (IF NOT EXISTS) per the project rule.
// ============================================================

import Database from 'better-sqlite3'

export type AuthzDb = Database.Database

export const AUTHZ_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS students (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  issued_at  TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_student ON auth_tokens(student_id);

-- One reserved calendar day per student per date.
CREATE TABLE IF NOT EXISTS bookings (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  slot_date  TEXT NOT NULL,            -- YYYY-MM-DD in the configured time zone
  created_at TEXT NOT NULL,
  UNIQUE (student_id, slot_date)
);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id, slot_date);

-- A usage session counts against the day's quota once started,
-- even if it is ended early or left to expire.
CREATE TABLE IF NOT EXISTS usage_sessions (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,            -- ISO 8601 UTC
  expires_at TEXT NOT NULL,            -- ISO 8601 UTC
  ended_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_usage_sessions_booking ON usage_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_usage_sessions_student ON usage_sessions(student_id);
`

/** Open (creating if needed) an authz database and apply the schema. */
export function openAuthzDb(filePath: string): AuthzDb {
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(AUTHZ_SCHEMA_SQL)
  return db
}
