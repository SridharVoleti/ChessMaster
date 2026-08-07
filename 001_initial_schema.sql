-- ============================================================
-- ChessQuest — Initial Schema
-- Run in Supabase SQL Editor or via supabase db push
-- ============================================================

-- ── positions ────────────────────────────────────────────────────
-- Populated by offline Python pipeline (1_download_games.py etc.)
CREATE TABLE IF NOT EXISTS positions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fen          text NOT NULL UNIQUE,
  best_move    text NOT NULL,
  pattern      text NOT NULL,
  difficulty   smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
  eval_swing   integer  NOT NULL,
  source_game  text,
  white_elo    smallint,
  black_elo    smallint,
  move_number  smallint,
  side_to_move text CHECK (side_to_move IN ('white','black')),
  opening      text,
  description  text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_positions_pattern    ON positions(pattern);
CREATE INDEX IF NOT EXISTS idx_positions_difficulty ON positions(difficulty);

-- ── scripted_games ───────────────────────────────────────────────
-- 60 rows total: 12 patterns × 5 games each
-- pattern_fen = board state student must find the winning move in
-- best_move   = correct UCI move (e.g. "d3e5")
CREATE TABLE IF NOT EXISTS scripted_games (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern      text     NOT NULL,
  game_number  smallint NOT NULL CHECK (game_number BETWEEN 1 AND 5),
  pgn          text     NOT NULL,
  pattern_fen  text     NOT NULL,
  best_move    text     NOT NULL,
  difficulty   smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  side_to_play text     NOT NULL CHECK (side_to_play IN ('white','black')),
  title        text     NOT NULL,
  UNIQUE (pattern, game_number)
);
CREATE INDEX IF NOT EXISTS idx_scripted_games_pattern ON scripted_games(pattern, game_number);

-- ── lessons ──────────────────────────────────────────────────────
-- One row per pattern — lesson card content + confirmation puzzle
CREATE TABLE IF NOT EXISTS lessons (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern                text NOT NULL UNIQUE,
  title                  text NOT NULL,
  concept                text NOT NULL,
  tip                    text NOT NULL,
  animation_pgn          text NOT NULL,
  confirmation_fen       text NOT NULL,
  confirmation_best_move text NOT NULL,
  feedback_correct       text NOT NULL,
  feedback_hint          text NOT NULL,
  feedback_reveal        text NOT NULL
);

-- ── student_progress ─────────────────────────────────────────────
-- One row per user — single source of truth for all progress state
CREATE TABLE IF NOT EXISTS student_progress (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_pattern         text     NOT NULL DEFAULT 'fork',
  current_game_number     smallint NOT NULL DEFAULT 1,
  patterns_mastered       text[]   NOT NULL DEFAULT '{}',
  total_games_played      integer  NOT NULL DEFAULT 0,
  current_streak          smallint NOT NULL DEFAULT 0,
  last_active             timestamptz,
  subscription_tier       text     NOT NULL DEFAULT 'free'
                          CHECK (subscription_tier IN ('free','paid')),
  subscription_expires_at timestamptz,
  current_xp              integer  NOT NULL DEFAULT 0,
  xp_level                smallint NOT NULL DEFAULT 1,
  next_level_xp           integer  NOT NULL DEFAULT 500,
  parent_user_id          uuid     REFERENCES auth.users(id),
  created_at              timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_progress_user   ON student_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_parent ON student_progress(parent_user_id);

-- ── game_attempts ─────────────────────────────────────────────────
-- Every move attempt logged — drives analytics and hint system
CREATE TABLE IF NOT EXISTS game_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  scripted_game_id uuid REFERENCES scripted_games(id),
  attempt_number   smallint NOT NULL,
  move_played      text     NOT NULL,
  correct          boolean  NOT NULL,
  hint_shown       boolean  NOT NULL DEFAULT false,
  completed_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_attempts_user ON game_attempts(user_id, scripted_game_id);

-- ── RLS Policies ─────────────────────────────────────────────────
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_attempts    ENABLE ROW LEVEL SECURITY;

-- Students: full access to own row
CREATE POLICY "student_progress_select_own"
  ON student_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "student_progress_insert_own"
  ON student_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "student_progress_update_own"
  ON student_progress FOR UPDATE USING (auth.uid() = user_id);

-- Parents: can read their linked child's progress row
CREATE POLICY "parent_can_read_child_progress"
  ON student_progress FOR SELECT
  USING (auth.uid() = parent_user_id);

-- Game attempts: own rows only
CREATE POLICY "game_attempts_select_own"
  ON game_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "game_attempts_insert_own"
  ON game_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Scripted games: fork and pin free, rest require paid subscription
CREATE POLICY "scripted_games_free_patterns"
  ON scripted_games FOR SELECT
  USING (pattern IN ('fork', 'pin'));

CREATE POLICY "scripted_games_paid_patterns"
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

-- Lessons: publicly readable (lesson cards visible to all)
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons_public_read"
  ON lessons FOR SELECT USING (true);

-- Positions: publicly readable
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_public_read"
  ON positions FOR SELECT USING (true);

-- ── Seed: Fork pattern lesson + 2 scripted games ─────────────────
-- (Full 60 games seeded via scripts/seed_scripted_games.ts)
INSERT INTO lessons (
  pattern, title, concept, tip,
  animation_pgn, confirmation_fen, confirmation_best_move,
  feedback_correct, feedback_hint, feedback_reveal
) VALUES (
  'fork',
  'The Fork',
  'A fork is when one of your pieces attacks two enemy pieces at the same time. Your opponent can only save one — so you win the other!',
  'Knights are the best forkers because their L-shaped move is hard to see coming. Always look for squares where your knight can jump to hit two valuable pieces at once.',
  '4k3/8/4q3/8/8/8/2r5/3NK2K w - - 0 1|d1f2|f2d3|d3e5',
  '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1',
  'd3e5',
  'Yes! Your knight on e5 attacks the queen AND the rook at the same time — that is a fork! They can only save one.',
  'Hint: look at your knight. Where can it jump to attack two of their pieces at the same time?',
  'The answer is Nd3-e5! From e5, the knight attacks the queen on c4 AND the rook on f7. That is a perfect fork!'
) ON CONFLICT (pattern) DO NOTHING;

INSERT INTO scripted_games (
  pattern, game_number, pgn, pattern_fen, best_move,
  difficulty, side_to_play, title
) VALUES
-- Game 1: Crystal clear fork, 8 pieces, obvious setup
(
  'fork', 1,
  '[Event "ChessQuest Fork Game 1"][White "You"][Black "CPU"][Result "*"] 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 *',
  '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1',
  'd3e5',
  1, 'white',
  'Fork — Game 1: Spot the knight fork!'
),
-- Game 2: Same pattern, one extra piece to navigate around
(
  'fork', 2,
  '[Event "ChessQuest Fork Game 2"][White "You"][Black "CPU"][Result "*"] 1. e4 e5 2. Nf3 d6 3. d4 exd4 4. Nxd4 *',
  '4k3/5r2/8/8/2q1p3/3N4/8/4K3 w - - 0 1',
  'd3e5',
  2, 'white',
  'Fork — Game 2: More pieces, same idea'
),
-- Game 3: Student must play preparatory move first
(
  'fork', 3,
  '[Event "ChessQuest Fork Game 3"][White "You"][Black "CPU"][Result "*"] 1. e4 e5 2. Nc3 Nf6 3. d4 exd4 4. Nd5 *',
  '1r2k3/8/8/8/2q5/2N5/8/4K3 w - - 0 1',
  'c3e4',
  3, 'white',
  'Fork — Game 3: Set it up first'
),
-- Game 4: Two-move sequence
(
  'fork', 4,
  '[Event "ChessQuest Fork Game 4"][White "You"][Black "CPU"][Result "*"] 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. c3 *',
  '2k5/2r5/8/8/3q4/5N2/8/4K3 w - - 0 1',
  'f3d4',
  4, 'white',
  'Fork — Game 4: Two moves to win'
),
-- Game 5: Full game feel, pattern at move 18
(
  'fork', 5,
  '[Event "ChessQuest Fork Game 5"][White "You"][Black "CPU"][Result "*"] 1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 *',
  '5rk1/2r5/8/8/1q6/5N2/8/3K4 w - - 0 1',
  'f3d4',
  5, 'white',
  'Fork — Game 5: Real game challenge'
)
ON CONFLICT (pattern, game_number) DO NOTHING;

-- Pin pattern lesson seed
INSERT INTO lessons (
  pattern, title, concept, tip,
  animation_pgn, confirmation_fen, confirmation_best_move,
  feedback_correct, feedback_hint, feedback_reveal
) VALUES (
  'pin',
  'The Pin',
  'A pin stops an enemy piece from moving because something more valuable is hiding behind it. If the pinned piece moves, you capture the bigger piece!',
  'Bishops and rooks create the best pins. An absolute pin is when the king is behind the pinned piece — that piece cannot legally move at all!',
  '4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1|e2b5|b5e8',
  'r1bqk2r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
  'b5c6',
  'Great! You pinned the knight against the king — now it cannot move without putting the king in check!',
  'Hint: can your bishop land on a square where it aims at both an enemy piece AND their king behind it?',
  'The answer is Bb5-c6! The bishop pins the knight on c6 against the black king. The knight is stuck!'
) ON CONFLICT (pattern) DO NOTHING;
