// ============================================================
// authz — storage layer
// A minimal async query surface (`Sql`) plus a lazily-created,
// connection-pooled Postgres implementation for production.
//
// Why an interface and not `pg.Pool` directly: the AuthzService is
// storage-agnostic, and the tests drive it against an in-process
// SQLite engine through this same shape (see __tests__/helpers).
// ============================================================

import { Pool } from 'pg'

/** The one method AuthzService needs from its store. `$1..$n` placeholders. */
export interface Sql {
  query<Row = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>
}

/**
 * DDL for the authz tables, in the dedicated `chessmaster` schema.
 * Kept here (not only in supabase/migrations) so a fresh environment
 * — and every test — can self-bootstrap.
 */
export const AUTHZ_SCHEMA_SQL = `
create schema if not exists chessmaster;

create table if not exists chessmaster.students (
  id            text primary key,
  email         text not null unique,
  display_name  text not null,
  password_hash text not null,
  created_at    text not null
);

create table if not exists chessmaster.auth_tokens (
  token_hash text primary key,
  student_id text not null references chessmaster.students(id) on delete cascade,
  issued_at  text not null,
  expires_at text not null
);
create index if not exists idx_authz_tokens_student on chessmaster.auth_tokens(student_id);

create table if not exists chessmaster.bookings (
  id         text primary key,
  student_id text not null references chessmaster.students(id) on delete cascade,
  slot_date  text not null,
  created_at text not null,
  unique (student_id, slot_date)
);
create index if not exists idx_authz_bookings_student on chessmaster.bookings(student_id, slot_date);

create table if not exists chessmaster.usage_sessions (
  id         text primary key,
  student_id text not null references chessmaster.students(id) on delete cascade,
  booking_id text not null references chessmaster.bookings(id) on delete cascade,
  started_at text not null,
  expires_at text not null,
  ended_at   text
);
create index if not exists idx_authz_usage_booking on chessmaster.usage_sessions(booking_id);
create index if not exists idx_authz_usage_student on chessmaster.usage_sessions(student_id);
`

// One pool per warm serverless instance. `max` is deliberately small:
// a single request rarely holds more than one connection, and several
// concurrently-warm Lambdas each with a large pool is how you exhaust
// Supabase's connection cap. Point AUTHZ_DATABASE_URL at the Supabase
// *transaction* pooler (port 6543) for serverless.
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.AUTHZ_DATABASE_URL ?? process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error(
        'AUTHZ_DATABASE_URL (or DATABASE_URL) is required — the authz store is Postgres now.',
      )
    }
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
      application_name: 'chessmaster-authz',
    })
  }
  return pool
}

/** Production `Sql`: a pooled Postgres connection. */
export function createPgSql(): Sql {
  return {
    async query<Row = Record<string, unknown>>(text: string, params?: readonly unknown[]) {
      const result = await getPool().query(text, params ? [...params] : undefined)
      return { rows: result.rows as Row[] }
    },
  }
}
