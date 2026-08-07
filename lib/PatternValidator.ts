import { XP_REWARDS, MAX_ATTEMPTS } from './constants'
import { DETECTORS } from './patternDetectors'

export interface ValidationResult {
  correct:     boolean
  feedback:    string
  hint:        string | null
  showAnswer:  boolean
  xpAwarded:   number
  attemptNumber: number
}

export interface LessonFeedback {
  feedback_correct: string
  feedback_hint:    string
  feedback_reveal:  string
}

// Optional pattern context: when provided, ANY move that passes the
// pattern's detector in the given position counts as correct — several
// positions have more than one equally valid pattern move. bestMove
// stays canonical for hints, reveal and auto-play.
export interface PatternContext {
  patternFen?: string | null
  patternKey?: string | null
}

// ── validateMove ─────────────────────────────────────────────────
// Pure function — no DB side effects here.
// DB writes (game_attempts, xp award) handled by the API route.
export function validateMove(
  playerMove:    string,
  bestMove:      string,
  attemptNumber: number,
  lesson:        LessonFeedback,
  context:       PatternContext = {},
): ValidationResult {
  const exact = playerMove.trim().toLowerCase() === bestMove.trim().toLowerCase()

  const detector = context.patternKey ? DETECTORS[context.patternKey] : undefined
  const detectorValid = Boolean(
    !exact && detector && context.patternFen &&
    detector(context.patternFen, playerMove.trim().toLowerCase())
  )
  const correct = exact || detectorValid

  if (correct) {
    let xpBonus: number = XP_REWARDS.CORRECT_ATTEMPT_3
    if (attemptNumber === 1) xpBonus = XP_REWARDS.CORRECT_ATTEMPT_1
    if (attemptNumber === 2) xpBonus = XP_REWARDS.CORRECT_ATTEMPT_2

    return {
      correct:       true,
      feedback:      lesson.feedback_correct,
      hint:          null,
      showAnswer:    false,
      xpAwarded:     XP_REWARDS.COMPLETE_GAME + xpBonus,
      attemptNumber,
    }
  }

  // ── Wrong move handling ───────────────────────────────────────
  if (attemptNumber === 1) {
    return {
      correct:       false,
      feedback:      'Not quite! Take another look at the board.',
      hint:          null,
      showAnswer:    false,
      xpAwarded:     0,
      attemptNumber,
    }
  }

  if (attemptNumber === 2) {
    return {
      correct:       false,
      feedback:      lesson.feedback_hint,
      hint:          lesson.feedback_hint,
      showAnswer:    false,
      xpAwarded:     0,
      attemptNumber,
    }
  }

  // Attempt 3+ — reveal answer, still award base XP for completing
  return {
    correct:       false,
    feedback:      lesson.feedback_reveal,
    hint:          null,
    showAnswer:    true,
    xpAwarded:     XP_REWARDS.COMPLETE_GAME, // base XP even on reveal
    attemptNumber,
  }
}

// ── computeStreakXP ────────────────────────────────────────────────
// Returns streak milestone bonus XP if applicable
import { STREAK_MILESTONES } from './constants'

export function computeStreakBonus(newStreak: number): number {
  return STREAK_MILESTONES.includes(newStreak) ? XP_REWARDS.STREAK_MILESTONE : 0
}

// ── shouldIncrementStreak ────────────────────────────────────────
// Returns true if today's first game should increment the streak
export function shouldIncrementStreak(
  lastActive: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastActive) return true // first ever game

  const msSince = now.getTime() - lastActive.getTime()
  const hoursSince = msSince / (1000 * 60 * 60)

  // Played yesterday (between 18h and 48h ago) → extend streak
  if (hoursSince >= 18 && hoursSince <= 48) return true

  // Played today (< 18h ago) → don't double-count
  if (hoursSince < 18) return false

  // More than 48h → streak broken, but we still count today as day 1
  return true
}

// ── shouldResetStreak ────────────────────────────────────────────
export function shouldResetStreak(
  lastActive: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastActive) return false
  const hoursSince = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60)
  return hoursSince > 48
}
