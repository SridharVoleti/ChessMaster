import { XP_LEVELS, getNextLevelXP, getLevelFromXP } from './constants'

export interface XPResult {
  newXP:         number
  newLevel:      number
  nextLevelXP:   number
  levelledUp:    boolean
  streakBonus:   number
}

// ── awardXP ───────────────────────────────────────────────────────
// Pure computation — returns new XP state. DB write done by caller.
export function computeNewXP(
  currentXP:   number,
  xpToAdd:     number,
  streakBonus: number = 0
): XPResult {
  const totalAdd    = xpToAdd + streakBonus
  const newXP       = currentXP + totalAdd
  const oldLevel    = getLevelFromXP(currentXP)
  const newLevel    = getLevelFromXP(newXP)
  const nextLevelXP = getNextLevelXP(newXP)
  const levelledUp  = newLevel.level > oldLevel.level

  return {
    newXP,
    newLevel:    newLevel.level,
    nextLevelXP,
    levelledUp,
    streakBonus,
  }
}

// ── XP bar width percentage ───────────────────────────────────────
export function xpBarPercent(currentXP: number): number {
  const level       = getLevelFromXP(currentXP)
  const nextLvl     = XP_LEVELS.find(l => l.level === level.level + 1)
  if (!nextLvl) return 100

  const rangeStart  = level.xpRequired
  const rangeEnd    = nextLvl.xpRequired
  const progress    = currentXP - rangeStart
  const total       = rangeEnd - rangeStart
  return Math.round((progress / total) * 100)
}
