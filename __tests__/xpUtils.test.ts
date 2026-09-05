import { computeNewXP, xpBarPercent } from '../lib/xpUtils'

describe('computeNewXP', () => {
  it('adds XP correctly', () => {
    const result = computeNewXP(300, 50)
    expect(result.newXP).toBe(350)
    expect(result.levelledUp).toBe(false)
  })

  it('detects level up when crossing threshold', () => {
    const result = computeNewXP(480, 50) // crosses 500 threshold
    expect(result.newXP).toBe(530)
    expect(result.newLevel).toBe(2)
    expect(result.levelledUp).toBe(true)
  })

  it('includes streak bonus in total XP', () => {
    const result = computeNewXP(100, 20, 50)
    expect(result.newXP).toBe(170)
    expect(result.streakBonus).toBe(50)
  })
})

describe('xpBarPercent', () => {
  it('returns 0 at level 1 start (0 XP)', () => {
    expect(xpBarPercent(0)).toBe(0)
  })

  it('returns 50 at halfway through level 1 (250 XP)', () => {
    expect(xpBarPercent(250)).toBe(50)
  })

  it('returns 100 at max level', () => {
    expect(xpBarPercent(9999)).toBe(100)
  })
})
