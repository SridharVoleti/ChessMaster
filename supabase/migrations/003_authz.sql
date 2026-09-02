-- ============================================================
-- ChessMaster — authz schema (students / bookings / usage sessions)
-- Was better-sqlite3 (local file); moved to Postgres so it survives
-- Vercel's read-only serverless filesystem.
--
-- Lives in a dedicated `chessmaster` schema because this Supabase
-- project is shared with BabySteps — keep these table names out of
-- `public`.
--
-- Timestamps are stored as text (ISO-8601 UTC), matching the app's
-- own string comparisons — no timestamptz-as-Date surprises.
-- Run in the Supabase SQL editor or via `supabase db push`.
-- ============================================================

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

-- One reserved calendar day per student per date.
create table if not exists chessmaster.bookings (
  id         text primary key,
  student_id text not null references chessmaster.students(id) on delete cascade,
  slot_date  text not null,            -- YYYY-MM-DD in the configured time zone
  created_at text not null,
  unique (student_id, slot_date)
);
create index if not exists idx_authz_bookings_student on chessmaster.bookings(student_id, slot_date);

-- A usage session counts against the day's quota once started,
-- even if it is ended early or left to expire.
create table if not exists chessmaster.usage_sessions (
  id         text primary key,
  student_id text not null references chessmaster.students(id) on delete cascade,
  booking_id text not null references chessmaster.bookings(id) on delete cascade,
  started_at text not null,            -- ISO-8601 UTC
  expires_at text not null,            -- ISO-8601 UTC
  ended_at   text
);
create index if not exists idx_authz_usage_booking on chessmaster.usage_sessions(booking_id);
create index if not exists idx_authz_usage_student on chessmaster.usage_sessions(student_id);
