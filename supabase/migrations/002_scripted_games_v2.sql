-- ============================================================
-- ChessQuest — Migration 002: scripted_games v2
--
-- Replaces the placeholder scripted_games table from 001 with a
-- schema that matches scripted_games_data.json exactly.
--
-- Run in Supabase SQL Editor AFTER 001_initial_schema.sql.
-- ============================================================

-- Drop FK on game_attempts so we can recreate the parent table
ALTER TABLE IF EXISTS game_attempts
  DROP CONSTRAINT IF EXISTS game_attempts_scripted_game_id_fkey;

-- Drop old table (had wrong columns and placeholder seed data)
DROP TABLE IF EXISTS scripted_games CASCADE;

-- ── scripted_games ────────────────────────────────────────────────
-- One row per entry in scripted_games_data.json.
--
-- practice games (game_type = 'practice', game_number 1-5):
--   pattern_fen and best_move are required.
--   target_patterns and checkpoints are empty.
--
-- main games (game_type = 'main', game_number = 6):
--   pattern_fen and best_move are NULL (student plays freely).
--   target_patterns lists cumulative patterns for live detection.
--   checkpoints records the ply and pattern of the scripted moment.
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE scripted_games (
  id              uuid     PRIMARY KEY DEFAULT gen_random_uuid(),

  -- identity
  pattern         text     NOT NULL,
  game_number     smallint NOT NULL CHECK (game_number BETWEEN 1 AND 10),
  game_type       text     NOT NULL DEFAULT 'practice'
                           CHECK (game_type IN ('practice', 'main')),

  -- display
  title           text     NOT NULL,
  opening         text     NOT NULL,
  story           text     NOT NULL,

  -- chess data
  pgn             text     NOT NULL,
  setup_fen       text     NOT NULL
                           DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  side            text     NOT NULL CHECK (side IN ('white', 'black')),

  -- practice-game fields (NULL for main games)
  pattern_fen     text,
  best_move       text,

  -- main-game fields (empty for practice games)
  target_patterns text[]   NOT NULL DEFAULT '{}',
  checkpoints     jsonb    NOT NULL DEFAULT '[]',

  created_at      timestamptz DEFAULT now(),

  UNIQUE (pattern, game_number)
);

CREATE INDEX idx_scripted_games_pattern ON scripted_games(pattern, game_number);
CREATE INDEX idx_scripted_games_type    ON scripted_games(game_type);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE scripted_games ENABLE ROW LEVEL SECURITY;

-- fork and pin are free; all other patterns require a paid subscription
CREATE POLICY "scripted_games_free"
  ON scripted_games FOR SELECT
  USING (pattern IN ('fork', 'pin'));

CREATE POLICY "scripted_games_paid"
  ON scripted_games FOR SELECT
  USING (
    pattern NOT IN ('fork', 'pin') AND
    EXISTS (
      SELECT 1 FROM student_progress sp
      WHERE sp.user_id = auth.uid()
        AND sp.subscription_tier = 'paid'
        AND (sp.subscription_expires_at IS NULL
             OR sp.subscription_expires_at > now())
    )
  );

-- ── Restore FK on game_attempts ───────────────────────────────────
-- ON DELETE SET NULL so deleting a game row does not wipe attempt history
ALTER TABLE game_attempts
  ADD CONSTRAINT game_attempts_scripted_game_id_fkey
  FOREIGN KEY (scripted_game_id)
  REFERENCES scripted_games(id)
  ON DELETE SET NULL;
