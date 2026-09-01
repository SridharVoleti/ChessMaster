// ── Pattern sequence — derived from the curriculum index ─────────
// content/curriculum/index.json is the single source of truth for the
// pattern order, tiers and roadmap metadata. These re-exports keep the
// historical `@/lib/constants` import path working.
export {
  PATTERN_SEQUENCE,
  TIER_ORDER,
  FREE_PATTERNS,
} from './curriculum'
export type { PatternKey, Tier, PatternDef } from './curriculum'

import { PATTERN_SEQUENCE } from './curriculum'
import type { PatternKey } from './curriculum'

// ── XP system ─────────────────────────────────────────────────────
export const XP_LEVELS = [
  { level: 1, label: 'Beginner',              xpRequired: 0    },
  { level: 2, label: 'Improver',              xpRequired: 500  },
  { level: 3, label: 'Intermediate',          xpRequired: 1200 },
  { level: 4, label: 'Advanced',              xpRequired: 2200 },
  { level: 5, label: 'Grandmaster candidate', xpRequired: 3500 },
]

export const XP_REWARDS = {
  COMPLETE_GAME:       20,
  CORRECT_ATTEMPT_1:   30,  // bonus on top of COMPLETE_GAME
  CORRECT_ATTEMPT_2:   15,
  CORRECT_ATTEMPT_3:    5,
  PATTERN_MASTERED:   100,
  STREAK_MILESTONE:    50,
  PATTERN_SPOTTED:     15,  // live pattern found during a main game
} as const

export const STREAK_MILESTONES = [7, 14, 30]

// ── Attempt config ────────────────────────────────────────────────
export const MAX_ATTEMPTS = 3

// ── Helper: get pattern index ──────────────────────────────────────
export function getPatternIndex(key: PatternKey): number {
  return PATTERN_SEQUENCE.findIndex(p => p.key === key)
}

// ── Helper: get next pattern ───────────────────────────────────────
export function getNextPattern(current: PatternKey): PatternKey | null {
  const idx = getPatternIndex(current)
  if (idx === -1 || idx >= PATTERN_SEQUENCE.length - 1) return null
  return PATTERN_SEQUENCE[idx + 1].key
}

// ── Helper: XP level from total XP ────────────────────────────────
export function getLevelFromXP(xp: number): typeof XP_LEVELS[number] {
  let current = XP_LEVELS[0]
  for (const lvl of XP_LEVELS) {
    if (xp >= lvl.xpRequired) current = lvl
  }
  return current
}

export function getNextLevelXP(xp: number): number {
  const currentLevel = getLevelFromXP(xp)
  const nextLevel = XP_LEVELS.find(l => l.level === currentLevel.level + 1)
  return nextLevel?.xpRequired ?? currentLevel.xpRequired + 500
}
