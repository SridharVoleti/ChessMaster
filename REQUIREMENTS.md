# Chess Pattern Trainer — Full Product Requirements

> **Purpose of this document:** Every requirement below is written to give Claude Code complete context to build, test, and deploy each feature independently. Each requirement includes: what to build, how to measure success, exact tech stack, database schema, file structure, and test criteria.

---

## Product Vision

A web application that teaches children chess by having them play scripted games against a CPU opponent that deliberately sets up a specific tactical pattern. The student learns the pattern first via an animated lesson, then plays 5 games where the CPU engineers that exact pattern — the student must spot and apply it to win. Progress is visualised as a Candy Crush-style roadmap showing the full journey from beginner to grandmaster across 12 patterns.

---

## Platform Stack

All code must be built within this stack. No substitutions without explicit approval.

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 14 (App Router) |
| Hosting | Vercel |
| Database + Auth | Supabase (Postgres + Supabase Auth + Supabase Storage) |
| Chess move logic | chess.js |
| Chess board UI | chessboard.js |
| CPU engine (browser) | Stockfish.js (WASM — runs in browser, no server compute per move) |
| Payments | Razorpay (INR, India) |
| Email | Resend API |
| Offline data pipeline | Python 3.12 + python-chess + Stockfish binary (local machine only, not deployed) |
| Testing | Jest (unit), Cypress (e2e) |
| Load testing | k6 (open source) |

---

## Supabase Database — Master Schema

All tables listed here. Individual requirements reference these tables. Run all as a single migration file `supabase/migrations/001_initial_schema.sql`.

```sql
-- Positions extracted from GM games (populated by offline Python pipeline)
CREATE TABLE positions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fen           text NOT NULL UNIQUE,
  best_move     text NOT NULL,
  pattern       text NOT NULL,
  difficulty    smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
  eval_swing    integer NOT NULL,
  source_game   text,
  white_elo     smallint,
  black_elo     smallint,
  move_number   smallint,
  side_to_move  text CHECK (side_to_move IN ('white','black')),
  opening       text,
  description   text,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX ON positions(pattern);
CREATE INDEX ON positions(difficulty);

-- Scripted games authored per pattern (5 per pattern = 60 total)
CREATE TABLE scripted_games (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern       text NOT NULL,
  game_number   smallint NOT NULL CHECK (game_number BETWEEN 1 AND 5),
  pgn           text NOT NULL,
  pattern_fen   text NOT NULL,
  best_move     text NOT NULL,
  difficulty    smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  side_to_play  text NOT NULL CHECK (side_to_play IN ('white','black')),
  title         text NOT NULL,
  UNIQUE (pattern, game_number)
);
CREATE INDEX ON scripted_games(pattern, game_number);

-- Lesson content (one row per pattern)
CREATE TABLE lessons (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern                 text NOT NULL UNIQUE,
  title                   text NOT NULL,
  concept                 text NOT NULL,
  tip                     text NOT NULL,
  animation_pgn           text NOT NULL,
  confirmation_fen        text NOT NULL,
  confirmation_best_move  text NOT NULL,
  feedback_correct        text NOT NULL,
  feedback_hint           text NOT NULL,
  feedback_reveal         text NOT NULL
);

-- Student progress (one row per user)
CREATE TABLE student_progress (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_pattern     text NOT NULL DEFAULT 'fork',
  current_game_number smallint NOT NULL DEFAULT 1,
  patterns_mastered   text[] NOT NULL DEFAULT '{}',
  total_games_played  integer NOT NULL DEFAULT 0,
  current_streak      smallint NOT NULL DEFAULT 0,
  last_active         timestamptz,
  subscription_tier   text NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','paid')),
  subscription_expires_at timestamptz,
  current_xp          integer NOT NULL DEFAULT 0,
  xp_level            smallint NOT NULL DEFAULT 1,
  next_level_xp       integer NOT NULL DEFAULT 500,
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX ON student_progress(user_id);

-- Individual game attempt log
CREATE TABLE game_attempts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  scripted_game_id  uuid REFERENCES scripted_games(id),
  attempt_number    smallint NOT NULL,
  move_played       text NOT NULL,
  correct           boolean NOT NULL,
  hint_shown        boolean NOT NULL DEFAULT false,
  completed_at      timestamptz DEFAULT now()
);
CREATE INDEX ON game_attempts(user_id, scripted_game_id);

-- RLS Policies
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own progress" ON student_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON student_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own progress" ON student_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own attempts" ON game_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own attempts" ON game_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## Pattern Sequence and Tier Structure

This is the fixed order. Do not reorder. All code that references patterns must use these exact string keys.

| # | Pattern key | Display name | Tier | Icon (Tabler) | Free |
|---|---|---|---|---|---|
| 1 | `fork` | Fork | Beginner | `ti-tournament` | Yes |
| 2 | `pin` | Pin | Beginner | `ti-pin` | Yes |
| 3 | `back_rank_mate` | Back rank mate | Beginner | `ti-chess-rook` | No |
| 4 | `skewer` | Skewer | Intermediate | `ti-arrow-narrow-right` | No |
| 5 | `discovered_attack` | Discovered attack | Intermediate | `ti-eye` | No |
| 6 | `double_check` | Double check | Intermediate | `ti-check` | No |
| 7 | `deflection` | Deflection | Advanced | `ti-arrows-shuffle` | No |
| 8 | `decoy` | Decoy | Advanced | `ti-fish` | No |
| 9 | `smothered_mate` | Smothered mate | Advanced | `ti-chess-knight` | No |
| 10 | `overloading` | Overloading | Expert | `ti-barbell` | No |
| 11 | `x_ray_attack` | X-Ray attack | Expert | `ti-scan` | No |
| 12 | `zwischenzug` | Zwischenzug | Expert | `ti-bolt` | No |

**Tier dividers shown on roadmap:**
- After pattern 3: separator "Intermediate"
- After pattern 6: separator "Advanced"
- After pattern 9: separator "Expert"

---

## XP and Level System

Store `current_xp`, `xp_level`, `next_level_xp` in `student_progress`. Compute level thresholds in `/lib/xpUtils.ts` as constants — do not store thresholds in the database.

| Action | XP awarded |
|---|---|
| Complete any game (win or lose) | +20 XP |
| Correct pattern move on attempt 1 | +30 XP bonus |
| Correct pattern move on attempt 2 | +15 XP bonus |
| Correct pattern move on attempt 3+ | +5 XP bonus |
| Pattern mastered (all 5 games done) | +100 XP bonus |
| Streak milestone: 7, 14, or 30 days | +50 XP bonus |

**Level thresholds (constants in `/lib/xpUtils.ts`):**

```typescript
export const XP_LEVELS = [
  { level: 1, label: 'Beginner',            xpRequired: 0    },
  { level: 2, label: 'Improver',            xpRequired: 500  },
  { level: 3, label: 'Intermediate',        xpRequired: 1200 },
  { level: 4, label: 'Advanced',            xpRequired: 2200 },
  { level: 5, label: 'Grandmaster candidate', xpRequired: 3500 },
];
```

Streak rule: `current_streak` increments if student completes at least 1 game today AND completed at least 1 game yesterday. Resets to 0 if no game played in the last 24 hours. Check `last_active` timestamp on game completion.

---

## REQ-01 — Build the Supabase position bank from GM games

**Priority:** Critical — no other requirement can begin until this is verified complete.

### What to build
This is an **offline Python pipeline** (not deployed). Run on local machine only.

Scripts (already built in `/chess_pipeline/`):
- `1_download_games.py` — downloads GM games from Lichess API
- `2_extract_patterns.py` — runs Stockfish analysis and classifies 12 patterns
- `3_build_curriculum.py` — sequences positions into difficulty order
- New script needed: `4_upload_to_supabase.py` — bulk inserts extracted positions into Supabase `positions` table using `supabase-py`

**`4_upload_to_supabase.py` spec:**
- Read SQLite `data/db/positions.db`
- Bulk insert into Supabase `positions` table in batches of 500 rows
- Skip rows where `fen` already exists (use `upsert` with `on_conflict='fen'`)
- Print progress: rows inserted, rows skipped, errors
- Requires env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

**Pipeline run parameters:**
```bash
python 1_download_games.py --games 10000 --min-elo 2400
python 2_extract_patterns.py --depth 18 --threshold 150 --max-games 5000
python 3_build_curriculum.py
python 4_upload_to_supabase.py
```

### Completion criteria (must all pass before REQ-02 begins)
Run this SQL in Supabase SQL editor. All 12 rows must show count ≥ 500:

```sql
SELECT pattern, COUNT(*) as cnt
FROM positions
GROUP BY pattern
ORDER BY cnt DESC;
-- Expected: 12 rows, each with cnt >= 500
```

### Timeline
Week 4 — pipeline complete and SQL verification passes.

---

## REQ-02 — Validate pattern extraction accuracy

**Priority:** High — must pass before scripted games are authored.

### What to build
Script `5_validate_patterns.py`:
- Query Supabase: `SELECT id, fen, best_move, pattern FROM positions ORDER BY RANDOM() LIMIT 50` per pattern (600 total)
- Render each position as ASCII board using `chess.Board(fen).unicode()`
- Print: position number, FEN, ASCII board, pattern label, best move in SAN
- Write to `validation/sample_{pattern}.txt` — one file per pattern
- After manual review, read `validation/results.csv` (columns: `id, pattern, correct`) and compute per-pattern accuracy

**`validation/results.csv` format:**
```
id,pattern,correct
uuid-here,fork,true
uuid-here,fork,false
```

### Completion criteria
- Per-pattern accuracy ≥ 85% (≥ 43 of 50 correct per pattern)
- Any pattern below 85%: fix the relevant detector in `2_extract_patterns.py`, re-run extraction for that pattern only, re-upload
- Commit `validation/results.csv` to repo as audit trail

### Timeline
Week 6 — all 12 patterns verified ≥ 85% before REQ-03 begins.

---

## REQ-03 — Didactic opponent engine (CPU as choreographer)

**Priority:** Critical — the core mechanic the entire product depends on.

### What to build

File: `/lib/DidacticOpponent.ts`

```typescript
interface DidacticOpponentConfig {
  scriptedPgn: string;      // Full PGN of scripted game
  patternFen: string;       // FEN of the position where student must apply pattern
  bestMove: string;         // Correct move in UCI notation (e.g. "e2e4")
  stockfishDepth?: number;  // Depth for post-pattern Stockfish play (default: 8)
}

class DidacticOpponent {
  constructor(config: DidacticOpponentConfig)

  // Returns UCI move string if following script, null if pattern moment reached
  getMove(board: Chess): string | null

  // True when board FEN matches patternFen (normalised, ignoring move clocks)
  isPatternMoment(board: Chess): boolean

  // Returns Stockfish move at configured depth — called after pattern moment
  getStockfishMove(board: Chess): Promise<string>

  // Resets script position to start (for game restart)
  reset(): void
}
```

**FEN normalisation for `isPatternMoment`:** Strip halfmove clock and fullmove counter before comparing (compare only first 4 FEN fields split by space).

**Stockfish.js integration:** Load via `public/stockfish.js` (WASM). Initialise once per session in a Web Worker. Do not re-initialise on every move.

### Jest tests (`__tests__/DidacticOpponent.test.ts`)
All 5 must pass:
1. `getMove` returns scripted moves in correct sequence for moves 1 through N-1
2. `isPatternMoment` returns `false` before pattern position is reached
3. `isPatternMoment` returns `true` when board FEN matches `patternFen` (normalised)
4. `getMove` returns `null` at pattern moment
5. After `reset()`, `getMove` returns first scripted move again

### Timeline
Week 8 — all 5 Jest tests passing. Fork pattern game playable end-to-end in browser.

**Depends on:** REQ-02 complete, Fork scripted games authored (first 5 rows of REQ-04).

---

## REQ-04 — 60 scripted games authored (12 patterns × 5 games)

**Priority:** High — MVP has no playable content without this.

### What to build

Insert 60 rows into Supabase `scripted_games` table. 5 rows per pattern. Each row contains a PGN that ends exactly 1 move before the `pattern_fen` position — the student plays the final move.

**Difficulty ramp per pattern (apply to all 12 patterns):**

| game_number | difficulty | Spec |
|---|---|---|
| 1 | 1 | ≤12 pieces on board. Pattern visible within ≤10 CPU moves. No distractors. |
| 2 | 2 | ≤16 pieces. 1 extra piece added that doesn't change the correct answer. |
| 3 | 3 | Student must play 1 preparatory move before pattern position arises. |
| 4 | 4 | 2-move sequence: student plays a forcing move, CPU responds, then pattern fires. |
| 5 | 5 | ≥20 pieces. Full game feel. Pattern emerges at move 15–25. |

**Source:** Trace back 10–15 moves in source GM game from position extracted in REQ-01. Trim PGN at the move before `pattern_fen`.

### Completion criteria (automated SQL check)
```sql
-- Must return exactly 60 rows
SELECT pattern, game_number, title
FROM scripted_games
ORDER BY pattern, game_number;

-- Validate every best_move is legal in its pattern_fen
-- (run validation script: node scripts/validate_scripted_games.js)
```

**Validation script** (`scripts/validate_scripted_games.js`):
```javascript
// For each row in scripted_games:
// 1. new Chess(pattern_fen) — must not throw
// 2. chess.move({ from: bestMove.slice(0,2), to: bestMove.slice(2,4) }) — must return non-null
// Log any failures. Exit code 1 if any failure found.
```

### Timeline
- Week 8: Fork pattern (5 games) complete — used as REQ-03 proof of concept
- Week 12: All 60 scripted games complete and validation script passes

**Depends on:** REQ-02 complete.

---

## REQ-05 — Pattern validation with 3-attempt limit and progressive hints

**Priority:** Critical — enforces the learning mechanic.

### What to build

File: `/lib/PatternValidator.ts`

```typescript
interface ValidationResult {
  correct: boolean;
  feedback: string;       // Message shown to student
  hint: string | null;    // Non-null on attempt 2
  showAnswer: boolean;    // True on attempt 3 — auto-play best move
  xpAwarded: number;      // XP to add to student_progress
}

function validateMove(
  playerMove: string,     // UCI notation
  bestMove: string,       // UCI notation from scripted_games
  attemptNumber: number,  // 1, 2, or 3
  pattern: string,        // e.g. 'fork' — used to fetch feedback strings
  userId: string          // For writing to game_attempts table
): Promise<ValidationResult>
```

**Logic:**
- Attempt 1 correct → `{ correct: true, feedback: lessons.feedback_correct, hint: null, showAnswer: false, xpAwarded: 50 }` (20 base + 30 bonus)
- Attempt 1 wrong → `{ correct: false, feedback: "Not quite — look again", hint: null, showAnswer: false, xpAwarded: 0 }`
- Attempt 2 correct → `{ correct: true, feedback: lessons.feedback_correct, hint: null, showAnswer: false, xpAwarded: 35 }` (20 base + 15 bonus)
- Attempt 2 wrong → `{ correct: false, feedback: lessons.feedback_hint, hint: lessons.feedback_hint, showAnswer: false, xpAwarded: 0 }`
- Attempt 3 correct → `{ correct: true, feedback: lessons.feedback_correct, hint: null, showAnswer: false, xpAwarded: 25 }` (20 base + 5 bonus)
- Attempt 3 wrong → `{ correct: false, feedback: lessons.feedback_reveal, hint: null, showAnswer: true, xpAwarded: 20 }` (base only — still gets XP for completing)

**After any validation call:** Write row to `game_attempts` table regardless of outcome.

**After correct or attempt 3:** Call `awardXp(userId, xpAwarded)` from `/lib/xpUtils.ts`, then update `student_progress.current_game_number` and check if pattern is mastered (game_number was 5).

### Jest tests (`__tests__/PatternValidator.test.ts`)
All 6 must pass:
1. Correct move on attempt 1 → `correct: true`, `xpAwarded: 50`, `showAnswer: false`
2. Wrong move on attempt 1 → `correct: false`, `hint: null`, `showAnswer: false`
3. Wrong move on attempt 2 → `correct: false`, `hint` is non-null string
4. Wrong move on attempt 3 → `correct: false`, `showAnswer: true`, `xpAwarded: 20`
5. `game_attempts` row written to Supabase after every call (mock Supabase client)
6. `student_progress.current_game_number` incremented after correct move (mock Supabase client)

### Timeline
Week 8 — built and all 6 Jest tests passing.

---

## REQ-06 — Animated lesson card with confirmation puzzle

**Priority:** High — students must understand the pattern before Game 1 unlocks.

### What to build

File: `/components/LessonCard.tsx`

**Props:**
```typescript
interface LessonCardProps {
  lesson: {
    pattern: string;
    title: string;
    concept: string;         // ≤50 words, Flesch-Kincaid ≤70
    tip: string;
    animation_pgn: string;   // PGN with 3 moves showing pattern
    confirmation_fen: string;
    confirmation_best_move: string;
  };
  onComplete: () => void;    // Called when confirmation puzzle solved — unlocks Game 1 button
}
```

**Render sequence:**
1. Pattern name + concept text
2. Animated chessboard: auto-plays `animation_pgn` move by move, 1000ms delay between moves, loops once
3. "Watch for this" tip text
4. Static puzzle board at `confirmation_fen` — student must find and play `confirmation_best_move`
5. "Play Game 1" button — disabled until puzzle solved, enabled after `onComplete` fires

**Animation implementation:** Use `chessboard.js` `position()` method called via `setTimeout` chain. Do not use external animation libraries.

### Cypress tests (`cypress/e2e/lessonCard.cy.ts`)
All 5 must pass:
1. Lesson card renders title and concept text for each of 12 patterns
2. Animation plays: board position changes at least once within 5 seconds of mount
3. "Play Game 1" button has `disabled` attribute on initial render
4. Submitting wrong move on confirmation puzzle keeps button disabled
5. Submitting correct move on confirmation puzzle enables "Play Game 1" button

**Content requirement:** All 12 lesson `concept` and `tip` fields must score Flesch-Kincaid ≤ 70 (Grade 5 reading level). Verify free at: https://www.webfx.com/tools/read-able/

### Timeline
Week 14 — all 12 lesson cards built and 5 Cypress tests passing.

**Depends on:** REQ-03, REQ-04.

---

## REQ-07 — Age-appropriate feedback copy (36 strings)

**Priority:** Medium.

### What to build

Populate `feedback_correct`, `feedback_hint`, `feedback_reveal` columns in the `lessons` table for all 12 patterns (36 strings total).

**Rules for all strings:**
- Maximum 40 words per string
- No chess jargon without immediate plain-language explanation
- Flesch-Kincaid score ≤ 70 (Grade 5)
- Reviewed and approved by one non-developer (teacher, parent, or child aged 10+)

**State spec:**
- `feedback_correct` — celebrates the correct move, names the pattern, explains why it works in one sentence
- `feedback_hint` — directional hint naming which piece to think about, does not give away the answer
- `feedback_reveal` — explains the correct move after 3 failed attempts, names the pattern, shows what to watch for next time

**Example (Fork pattern):**
```
feedback_correct: "Yes! That's a fork — your knight attacked two pieces at once! They can only save one."
feedback_hint:    "Hint: look at where your knight could jump to attack two of their pieces at the same time."
feedback_reveal:  "The winning move was Nf7 — a fork! The knight attacked both the queen and rook. Watch for squares where your knight hits two targets."
```

### Completion criteria
```sql
-- All 36 strings must be non-null and non-empty
SELECT pattern,
  length(feedback_correct) > 0 AS has_correct,
  length(feedback_hint) > 0    AS has_hint,
  length(feedback_reveal) > 0  AS has_reveal
FROM lessons;
-- Expected: 12 rows, all three boolean columns TRUE
```

### Timeline
Week 14 — alongside REQ-06.

---

## REQ-08 — Supabase Auth with persistent progress

**Priority:** High — must be in place before any pilot testing.

### What to build

**Auth flow:**
- Use `@supabase/ssr` package for Next.js App Router session handling
- Sign up: email + password via `supabase.auth.signUp()`
- After successful signup: insert row into `student_progress` with defaults (`current_pattern: 'fork'`, `current_game_number: 1`)
- Login: `supabase.auth.signInWithPassword()`
- After login: fetch `student_progress` row for `auth.uid()`, redirect to `/play/[current_pattern]/[current_game_number]`
- Session persisted via `@supabase/ssr` cookie management in `middleware.ts`

**Files to create:**
```
/app/auth/signup/page.tsx        — signup form
/app/auth/login/page.tsx         — login form
/app/auth/callback/route.ts      — Supabase auth callback handler
/middleware.ts                   — protects /play/* and /roadmap routes; redirects unauthenticated to /auth/login
/lib/supabase/server.ts          — createServerClient helper
/lib/supabase/client.ts          — createBrowserClient helper
```

### Cypress tests (`cypress/e2e/auth.cy.ts`)
All 5 must pass:
1. New user signup creates a `student_progress` row with `current_pattern = 'fork'`
2. Completing a game updates `current_game_number` in `student_progress`
3. Logout then login redirects to correct `/play/fork/2` (if game 1 was completed)
4. `student_progress` row values unchanged after logout/login cycle
5. Unauthenticated GET to `/play/fork/1` redirects to `/auth/login`

### Timeline
Week 10 — auth and progress working before pilot testing.

---

## REQ-09 — Student dashboard and weekly parent email

**Priority:** Medium.

### What to build

**Student dashboard** (`/app/dashboard/page.tsx`):
- Pattern badge wall: 12 badges in pattern order, green if in `patterns_mastered[]`, gray otherwise
- Current XP bar: `current_xp / next_level_xp` with level label
- Streak counter with flame icon
- Games played this week (count `game_attempts` where `completed_at >= now() - interval '7 days'`)
- "Continue learning" button → navigates to `/play/[current_pattern]/[current_game_number]`

**Parent account:**
- Parent signs up separately, links to child via child's email at `/parent/link`
- Supabase: add `parent_user_id uuid` column to `student_progress`
- Parent dashboard (`/app/parent/page.tsx`): shows child's name, patterns mastered count, daily play time (minutes) for last 7 days, last active date
- RLS policy: parent can SELECT their linked child's `student_progress` row only

**Weekly email (Supabase Edge Function `send-weekly-summary`):**
- Trigger: Supabase cron every Sunday at 8:00 AM IST (`0 2 * * 0` UTC)
- For each `student_progress` row where `parent_user_id` is not null and `last_active >= now() - interval '7 days'`
- Send via Resend API: subject "Your child's chess progress this week", body includes patterns mastered, games played, current streak
- Requires env var: `RESEND_API_KEY` in Supabase Edge Function secrets

### Completion criteria
1. Dashboard loads in < 2s (Vercel Analytics)
2. Parent attempting to access child's dashboard with child JWT gets 403 (RLS enforced)
3. Weekly email delivered to test address on 2 consecutive Sundays before launch
4. `RESEND_API_KEY` documented in `README.md` env var list

### Timeline
Week 16.

**Depends on:** REQ-08.

---

## REQ-10 — Freemium gate at Pattern 3

**Priority:** High — required before launch.

### What to build

**Two-layer enforcement (both required — middleware alone is bypassable):**

**Layer 1 — Next.js middleware (`/middleware.ts`):**
```typescript
// In middleware, after auth check:
const FREE_PATTERNS = ['fork', 'pin'];
const pattern = pathname.split('/')[2]; // e.g. /play/skewer/1 → 'skewer'
if (!FREE_PATTERNS.includes(pattern)) {
  const { data } = await supabase.from('student_progress')
    .select('subscription_tier')
    .eq('user_id', userId)
    .single();
  if (data?.subscription_tier !== 'paid') {
    return NextResponse.redirect(new URL('/subscribe', request.url));
  }
}
```

**Layer 2 — Supabase RLS:**
```sql
-- Allow reading scripted_games freely for fork and pin
-- For all other patterns, require paid tier check via function
CREATE POLICY "Free patterns open" ON scripted_games
  FOR SELECT USING (pattern IN ('fork', 'pin'));

CREATE POLICY "Paid patterns require subscription" ON scripted_games
  FOR SELECT USING (
    pattern NOT IN ('fork', 'pin') AND
    EXISTS (
      SELECT 1 FROM student_progress
      WHERE user_id = auth.uid()
      AND subscription_tier = 'paid'
      AND (subscription_expires_at IS NULL OR subscription_expires_at > now())
    )
  );
```

**Subscription page (`/app/subscribe/page.tsx`):**
- Monthly plan: ₹299/month
- Annual plan: ₹2,499/year (saves ₹1,089)
- Razorpay checkout integration
- On Razorpay webhook `payment.captured`: call Supabase to set `subscription_tier = 'paid'`, set `subscription_expires_at = now() + interval '1 month'` (or 1 year)
- Webhook handler: `/app/api/razorpay-webhook/route.ts`

**Expiry cron (Supabase Edge Function `expire-subscriptions`):**
- Trigger: daily at midnight IST (`18 30 * * *` UTC — accounts for IST offset)
- Sets `subscription_tier = 'free'` where `subscription_expires_at < now()`

### Cypress tests (`cypress/e2e/paywall.cy.ts`)
All 4 must pass:
1. Free user GET `/play/skewer/1` → redirected to `/subscribe`
2. Free user GET `/play/fork/1` → not redirected (loads successfully)
3. Razorpay test-mode payment → `subscription_tier` = 'paid' in Supabase within 10 seconds
4. Simulate expired subscription → `subscription_tier` downgrades to 'free' on next cron run

### Timeline
- Week 16: Payment flow live in test mode
- Week 18 (launch): Production Razorpay credentials added

**Depends on:** REQ-08.

---

## REQ-11 — MVP launch checklist (12 patterns, 60 games, quality verified)

**Priority:** Medium — gates production deploy.

### Launch checklist (all must pass and be logged in `LAUNCH_CHECKLIST.md`)

Create file `LAUNCH_CHECKLIST.md` in repo root. Each item: checked by (name), date, result.

```markdown
## Launch checklist

| # | Check | How | Status |
|---|---|---|---|
| 1 | scripted_games has exactly 60 rows, 5 per pattern | SQL: SELECT pattern, COUNT(*) FROM scripted_games GROUP BY pattern | [ ] |
| 2 | All 60 pattern_fen values parse in chess.js | node scripts/validate_scripted_games.js — exit 0 | [ ] |
| 3 | All 60 best_move values are legal in their pattern_fen | Same script above | [ ] |
| 4 | All 12 lesson cards render in Cypress | npx cypress run --spec lesson*.cy.ts — all pass | [ ] |
| 5 | All 36 feedback strings non-null in lessons table | SQL check (REQ-07) | [ ] |
| 6 | Full Fork playthrough by non-developer tester | Child aged 8–14 or parent, no docs, unaided | [ ] |
| 7 | Tester completes Fork Games 1–2 without hints | Observed or screen-recorded | [ ] |
| 8 | Tester uses ≤2 hints across Fork Games 3–4 | Observed or screen-recorded | [ ] |
| 9 | Roadmap shows correct state for tester's progress | Visual QA | [ ] |
| 10 | Payment flow completes in test mode | Razorpay test card 4111111111111111 | [ ] |
```

### Timeline
Week 17 — checklist complete and committed. Production deploy Week 18.

**Depends on:** REQ-04, REQ-06, REQ-07, REQ-09, REQ-10 all complete.

---

## REQ-12 — Performance: 500 concurrent students, p95 < 300ms

**Priority:** Medium — must pass before production deploy.

### What to build

No application code changes — this is a load test and infrastructure validation.

**Architecture note that enables this target:**
- Stockfish runs in browser (WASM) — zero server compute per chess move
- Scripted games are static PGN lookups from Supabase — lightweight reads
- Static assets (chessboard.js, piece images) served from Vercel CDN

**Load test script** (`load_test/chess_k6.js`):
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 500,           // Virtual users
  duration: '5m',     // 5 minute test
  thresholds: {
    http_req_duration: ['p(95)<300'],   // p95 under 300ms
    http_req_failed:   ['rate<0.001'],  // Error rate under 0.1%
  },
};

export default function () {
  // Simulate: login → load lesson → make 3 game moves → submit pattern move
  const login = http.post(`${__ENV.BASE_URL}/api/auth`, { email: 'test@test.com', password: 'test' });
  check(login, { 'login 200': (r) => r.status === 200 });
  sleep(1);

  const lesson = http.get(`${__ENV.BASE_URL}/api/lessons/fork`);
  check(lesson, { 'lesson 200': (r) => r.status === 200 });
  sleep(2);

  const move = http.post(`${__ENV.BASE_URL}/api/validate`, { move: 'e2e4', pattern: 'fork' });
  check(move, { 'validate 200': (r) => r.status === 200 });
  sleep(1);
}
```

**Run against Vercel preview URL (not production):**
```bash
k6 run --out json=load_test/results.json \
  -e BASE_URL=https://chess-trainer-preview.vercel.app \
  load_test/chess_k6.js

k6 report load_test/results.json  # generates HTML report
```

### Completion criteria
- k6 HTML report committed to `load_test/report.html`
- p95 latency < 300ms ✓
- Error rate < 0.1% ✓
- Supabase dashboard shows active connections < 80% of plan limit during test ✓ (screenshot committed)

### Required Supabase indexes (add to migration if not already present)
```sql
CREATE INDEX IF NOT EXISTS idx_positions_pattern ON positions(pattern);
CREATE INDEX IF NOT EXISTS idx_scripted_games_pattern ON scripted_games(pattern, game_number);
CREATE INDEX IF NOT EXISTS idx_student_progress_user ON student_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_game_attempts_user ON game_attempts(user_id, scripted_game_id);
```

### Timeline
Week 17 — load test run and report committed before production deploy.

---

## REQ-13 — Candy Crush-style visual learning roadmap

**Priority:** High — primary retention and motivation mechanic.

### What to build

**Page:** `/app/roadmap/page.tsx` (server component — fetches `student_progress` for `auth.uid()`)

**Component tree:**
```
/app/roadmap/page.tsx           — server component, fetches progress
/components/RoadmapPath.tsx     — full path, receives NodeState[] as props
/components/PatternNode.tsx     — single node: circle, icon, dots, tooltip
/components/XpBar.tsx           — XP fill bar with level label
/components/StreakBadge.tsx     — flame icon + streak count
/lib/roadmapUtils.ts            — deriveNodeStates(progress) → NodeState[]
/lib/xpUtils.ts                 — awardXp(userId, action), XP_LEVELS constant
```

**`NodeState` type (`/lib/roadmapUtils.ts`):**
```typescript
type NodeStatus = 'done' | 'active' | 'locked';

interface NodeState {
  pattern: string;          // e.g. 'fork'
  displayName: string;      // e.g. 'Fork'
  icon: string;             // Tabler icon name e.g. 'ti-tournament'
  status: NodeStatus;
  gamesCompleted: number;   // 0–5
  isFree: boolean;
  tier: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
}
```

**`deriveNodeStates` logic:**
```typescript
// patterns_mastered = ['fork', 'pin', 'back_rank_mate']
// current_pattern = 'skewer'
// current_game_number = 3

// For each pattern in PATTERN_SEQUENCE (the fixed order table above):
//   if pattern is in patterns_mastered → status: 'done', gamesCompleted: 5
//   if pattern === current_pattern → status: 'active', gamesCompleted: current_game_number - 1
//   else → status: 'locked', gamesCompleted: 0
```

**Visual layout — zigzag path:**
- 12 nodes arranged in 4 rows of 3
- Row 1 (patterns 1–3): left → right
- Row 2 (patterns 4–6): right → left (flex-direction: row-reverse)
- Row 3 (patterns 7–9): left → right
- Row 4 (patterns 10–12): right → left
- Horizontal connectors between nodes in same row (green if both endpoints done, dashed gray if not)
- Vertical connector between row ends (green if preceding pattern done, dashed gray if not)
- Tier divider labels between rows: "Intermediate" after row 1, "Advanced" after row 2, "Expert" after row 3

**Node visual states:**
```
done:   background #1D9E75, white icon, 5 filled green dots
active: background #534AB7, white icon, N filled purple dots + (5-N) gray dots,
        CSS pulse animation: @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(83,74,183,.4) } 50% { box-shadow: 0 0 0 8px rgba(83,74,183,0) } }
locked: background var(--color-background-secondary), ti-lock icon (gray), dimmed label, no interaction
free:   amber pill badge "FREE" positioned top-right of circle (fork and pin only)
```

**Tooltip (shown on click for done/active nodes):**
- Pattern name + mastery status
- One-sentence skill summary (from `lessons.tip`)
- 5 game chips: green "Game N" if done, purple "Game N — current" if active, gray if locked
- Tapping active node chip or a "Continue" button navigates to `/play/[pattern]/[game_number]`

**XP bar:**
- Fill width: `Math.round((current_xp / next_level_xp) * 100)`%
- Label left: current level label (e.g. "Level 2 — Improver")
- Label right: `{current_xp} / {next_level_xp} XP`

**Streak badge:**
- `ti-flame` icon (amber colour: #BA7517)
- Number: `current_streak`
- Text: "day streak"
- If `current_streak === 0`: display "Start your streak today!" instead

### Cypress tests (`cypress/e2e/roadmap.cy.ts`)
All 10 must pass:
1. Roadmap renders exactly 12 pattern nodes
2. Patterns in `patterns_mastered` render with green background
3. `current_pattern` node renders with purple background and pulse animation class
4. Patterns after `current_pattern` render with lock icon
5. Fork and Pin nodes have "FREE" badge element present in DOM
6. Clicking a done node shows tooltip with all 5 game chips having green class
7. Clicking active node shows tooltip with correct number of filled dots
8. Tooltip "Continue" button navigates to `/play/[current_pattern]/[current_game_number]`
9. XP bar width equals correct percentage (within 1px tolerance)
10. Page server-renders in < 1.5s (Vercel Analytics — measure on 3 consecutive loads, all must pass)

### Supabase migration addition
```sql
-- Add XP columns to student_progress (if not already added)
ALTER TABLE student_progress
  ADD COLUMN IF NOT EXISTS current_xp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xp_level smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_level_xp integer NOT NULL DEFAULT 500;
```

### Timeline
Week 15 — all 10 Cypress tests passing. One child tester (aged 8–14) can identify their current position and name one upcoming locked pattern without prompting.

**Depends on:** REQ-08 (`student_progress` table exists with auth).

---

## Delivery Sequence

```
REQ-01 (pipeline)
    ↓
REQ-02 (validate accuracy)
    ↓
REQ-03 + REQ-05 (opponent engine + pattern validator) ← parallel
    ↓
REQ-04 (60 scripted games)
    ↓
REQ-06 + REQ-07 (lesson cards + feedback copy) ← parallel
    ↓
REQ-08 (auth + progress)
    ↓
REQ-09 + REQ-10 + REQ-13 (dashboard + payments + roadmap) ← parallel
    ↓
REQ-11 (launch checklist)
    ↓
REQ-12 (load test)
    ↓
PRODUCTION DEPLOY (Week 18)
```

---

## Environment Variables

All must be documented in `.env.local.example` committed to repo (values redacted).

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=           # Server-side only, never expose to client

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=

# Python pipeline (local only, never deployed)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

---

## File Structure for Claude Code

```
chess-pattern-trainer/
├── app/
│   ├── auth/
│   │   ├── signup/page.tsx
│   │   ├── login/page.tsx
│   │   └── callback/route.ts
│   ├── roadmap/page.tsx
│   ├── play/[pattern]/[game]/page.tsx
│   ├── dashboard/page.tsx
│   ├── parent/
│   │   ├── page.tsx
│   │   └── link/page.tsx
│   ├── subscribe/page.tsx
│   └── api/
│       ├── razorpay-webhook/route.ts
│       └── lessons/[pattern]/route.ts
├── components/
│   ├── RoadmapPath.tsx
│   ├── PatternNode.tsx
│   ├── XpBar.tsx
│   ├── StreakBadge.tsx
│   ├── LessonCard.tsx
│   ├── GameBoard.tsx          ← chessboard.js wrapper
│   └── FeedbackPanel.tsx
├── lib/
│   ├── DidacticOpponent.ts
│   ├── PatternValidator.ts
│   ├── roadmapUtils.ts
│   ├── xpUtils.ts
│   └── supabase/
│       ├── server.ts
│       └── client.ts
├── __tests__/
│   ├── DidacticOpponent.test.ts
│   └── PatternValidator.test.ts
├── cypress/
│   └── e2e/
│       ├── auth.cy.ts
│       ├── lessonCard.cy.ts
│       ├── roadmap.cy.ts
│       └── paywall.cy.ts
├── scripts/
│   └── validate_scripted_games.js
├── load_test/
│   └── chess_k6.js
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── public/
│   └── stockfish.js           ← Stockfish WASM binary
├── chess_pipeline/            ← Python offline pipeline (not deployed)
│   ├── 1_download_games.py
│   ├── 2_extract_patterns.py
│   ├── 3_build_curriculum.py
│   ├── 4_upload_to_supabase.py
│   └── 5_validate_patterns.py
├── REQUIREMENTS.md            ← this file
├── LAUNCH_CHECKLIST.md
├── .env.local.example
└── README.md
```

---

## Notes for Claude Code

1. Always check whether a Supabase table already exists before running `CREATE TABLE` — use `CREATE TABLE IF NOT EXISTS`
2. Always use `@supabase/ssr` (not `@supabase/auth-helpers-nextjs`) — the auth-helpers package is deprecated
3. Stockfish.js must load as a Web Worker from `public/stockfish.js` — do not import it as an ES module
4. All Supabase queries from server components use the service key via `createServerClient` — never expose service key to client
5. chess.js FEN comparison: always normalise by splitting on space and comparing only the first 4 fields (position, turn, castling, en passant) — ignore halfmove clock and fullmove number
6. The `patterns_mastered` column is a Postgres `text[]` array — query with `@>` operator: `WHERE patterns_mastered @> ARRAY['fork']`
7. Razorpay webhooks must verify signature using `RAZORPAY_WEBHOOK_SECRET` before processing — do not trust unverified webhooks
