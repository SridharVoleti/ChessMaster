import type { SupabaseClient }  from '@supabase/supabase-js'
import { computeNewXP }         from '@/lib/xpUtils'
import { PATTERN_SEQUENCE }     from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────

export interface GameAttemptRow {
  user_id:          string
  scripted_game_id: string | null
  attempt_number:   number
  move_played:      string
  correct:          boolean
  hint_shown:       boolean
}

export interface ProgressSnapshot {
  current_xp:          number
  xp_level:            number
  next_level_xp:       number
  current_game_number: number
  current_pattern:     string
  patterns_mastered:   string[]
  current_streak:      number
  last_active:         string | null
}

// ── getProgressSnapshot ───────────────────────────────────────────
// Reads a student's current progress row. Returns the "not started" default
// (first pattern, 0 XP) when no row exists yet — e.g. a student who has
// never submitted a move. Used by the roadmap ("candy trail") page to
// derive lock/done/active node state; see lib/roadmapUtils.deriveNodeStates.
export async function getProgressSnapshot(
  client: SupabaseClient,
  userId: string,
): Promise<ProgressSnapshot> {
  const { data, error } = await client
    .from('student_progress')
    .select(
      'current_xp, xp_level, next_level_xp, current_game_number, current_pattern, patterns_mastered, current_streak, last_active',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`student_progress read failed: ${error.message}`)

  return (
    (data as ProgressSnapshot | null) ?? {
      current_xp:          0,
      xp_level:             1,
      next_level_xp:        500,
      current_game_number:  1,
      current_pattern:      PATTERN_SEQUENCE[0].key,
      patterns_mastered:    [],
      current_streak:       0,
      last_active:          null,
    }
  )
}

// ── writeGameAttempt ──────────────────────────────────────────────
export async function writeGameAttempt(
  client: SupabaseClient,
  row:    GameAttemptRow,
): Promise<void> {
  const { error } = await client.from('game_attempts').insert(row)
  if (error) throw new Error(`game_attempts insert failed: ${error.message}`)
}

// ── awardXpAndProgress ────────────────────────────────────────────
// Updates student_progress after a completed attempt.
// Called only when correct === true OR showAnswer === true (attempt 3).
export async function awardXpAndProgress(
  client:     SupabaseClient,
  userId:     string,
  xpToAdd:    number,
  progress:   ProgressSnapshot,
  patternKey: string,
  gameNumber: number,
): Promise<void> {
  const xpResult    = computeNewXP(progress.current_xp, xpToAdd)
  const isMastered  = gameNumber === 5
  const patternIdx  = PATTERN_SEQUENCE.findIndex(p => p.key === patternKey)

  const nextPattern = isMastered && patternIdx < PATTERN_SEQUENCE.length - 1
    ? PATTERN_SEQUENCE[patternIdx + 1].key
    : patternKey

  const nextGameNumber = isMastered ? 1 : gameNumber + 1

  const newMastered = isMastered
    ? [...new Set([...progress.patterns_mastered, patternKey])]
    : progress.patterns_mastered

  const { error } = await client
    .from('student_progress')
    .update({
      current_xp:          xpResult.newXP,
      xp_level:            xpResult.newLevel,
      next_level_xp:       xpResult.nextLevelXP,
      current_game_number: nextGameNumber,
      current_pattern:     nextPattern,
      patterns_mastered:   newMastered,
      last_active:         new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw new Error(`student_progress update failed: ${error.message}`)
}
