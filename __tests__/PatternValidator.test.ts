import {
  validateMove,
  shouldIncrementStreak,
  shouldResetStreak,
  computeStreakBonus,
} from '../lib/PatternValidator'
import { XP_REWARDS } from '../lib/constants'

const LESSON = {
  feedback_correct: 'Yes! That is a fork!',
  feedback_hint:    'Hint: look at your knight.',
  feedback_reveal:  'The answer was Nd3-e5, a fork!',
}

// ── REQ-05 Test 1: Correct on attempt 1 ──────────────────────────
describe('validateMove — correct moves', () => {
  it('TEST 1: attempt 1 correct → correct:true, xpAwarded:50, showAnswer:false', () => {
    const result = validateMove('d3e5', 'd3e5', 1, LESSON)
    expect(result.correct).toBe(true)
    expect(result.xpAwarded).toBe(XP_REWARDS.COMPLETE_GAME + XP_REWARDS.CORRECT_ATTEMPT_1) // 50
    expect(result.showAnswer).toBe(false)
    expect(result.hint).toBeNull()
  })

  it('attempt 2 correct → xpAwarded:35', () => {
    const result = validateMove('d3e5', 'd3e5', 2, LESSON)
    expect(result.correct).toBe(true)
    expect(result.xpAwarded).toBe(XP_REWARDS.COMPLETE_GAME + XP_REWARDS.CORRECT_ATTEMPT_2) // 35
  })

  it('attempt 3 correct → xpAwarded:25', () => {
    const result = validateMove('d3e5', 'd3e5', 3, LESSON)
    expect(result.correct).toBe(true)
    expect(result.xpAwarded).toBe(XP_REWARDS.COMPLETE_GAME + XP_REWARDS.CORRECT_ATTEMPT_3) // 25
  })
})

// ── REQ-05 Test 2: Wrong on attempt 1 ────────────────────────────
describe('validateMove — wrong attempt 1', () => {
  it('TEST 2: attempt 1 wrong → correct:false, hint:null, showAnswer:false', () => {
    const result = validateMove('e2e4', 'd3e5', 1, LESSON)
    expect(result.correct).toBe(false)
    expect(result.hint).toBeNull()
    expect(result.showAnswer).toBe(false)
    expect(result.xpAwarded).toBe(0)
  })
})

// ── REQ-05 Test 3: Wrong on attempt 2 → hint non-null ────────────
describe('validateMove — wrong attempt 2', () => {
  it('TEST 3: attempt 2 wrong → hint is non-null string', () => {
    const result = validateMove('e2e4', 'd3e5', 2, LESSON)
    expect(result.correct).toBe(false)
    expect(result.hint).not.toBeNull()
    expect(typeof result.hint).toBe('string')
    expect(result.hint!.length).toBeGreaterThan(0)
    expect(result.showAnswer).toBe(false)
  })
})

// ── REQ-05 Test 4: Wrong on attempt 3 → showAnswer:true ──────────
describe('validateMove — wrong attempt 3', () => {
  it('TEST 4: attempt 3 wrong → showAnswer:true, xpAwarded:20 (base only)', () => {
    const result = validateMove('e2e4', 'd3e5', 3, LESSON)
    expect(result.correct).toBe(false)
    expect(result.showAnswer).toBe(true)
    expect(result.xpAwarded).toBe(XP_REWARDS.COMPLETE_GAME) // 20
    expect(result.feedback).toBe(LESSON.feedback_reveal)
  })
})

// ── Streak logic ─────────────────────────────────────────────────
describe('shouldIncrementStreak', () => {
  it('TEST 5a: returns true when lastActive is null (first ever game)', () => {
    expect(shouldIncrementStreak(null)).toBe(true)
  })

  it('returns true when last played yesterday (24h ago)', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    expect(shouldIncrementStreak(yesterday)).toBe(true)
  })

  it('returns false when last played today (2h ago)', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    expect(shouldIncrementStreak(twoHoursAgo)).toBe(false)
  })

  it('returns true (reset to 1) when last played 3 days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000)
    expect(shouldIncrementStreak(threeDaysAgo)).toBe(true)
  })
})

describe('shouldResetStreak', () => {
  it('TEST 5b: returns true when last active > 48h ago', () => {
    const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000)
    expect(shouldResetStreak(oldDate)).toBe(true)
  })

  it('returns false when last active < 48h ago', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000)
    expect(shouldResetStreak(recent)).toBe(false)
  })
})

describe('computeStreakBonus', () => {
  it('TEST 6: returns 50 XP on day 7 milestone', () => {
    expect(computeStreakBonus(7)).toBe(XP_REWARDS.STREAK_MILESTONE)
  })

  it('returns 0 for non-milestone streaks', () => {
    expect(computeStreakBonus(5)).toBe(0)
    expect(computeStreakBonus(10)).toBe(0)
  })

  it('returns 50 XP on day 14 and 30 milestones', () => {
    expect(computeStreakBonus(14)).toBe(XP_REWARDS.STREAK_MILESTONE)
    expect(computeStreakBonus(30)).toBe(XP_REWARDS.STREAK_MILESTONE)
  })
})
