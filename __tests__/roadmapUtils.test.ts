import { deriveNodeStates, groupByTier } from '../lib/roadmapUtils'
import { computeNewXP, xpBarPercent } from '../lib/xpUtils'
import { PATTERN_SEQUENCE } from '../lib/constants'

const BASE_PROGRESS = {
  current_pattern:     'fork',
  current_game_number: 1,
  patterns_mastered:   [] as string[],
}

// ── deriveNodeStates ──────────────────────────────────────────────
describe('deriveNodeStates', () => {
  it('returns 12 nodes for all 12 patterns', () => {
    const nodes = deriveNodeStates(BASE_PROGRESS)
    expect(nodes).toHaveLength(12)
  })

  it('first node is active when current_pattern is fork and nothing mastered', () => {
    const nodes = deriveNodeStates(BASE_PROGRESS)
    expect(nodes[0].pattern).toBe('fork')
    expect(nodes[0].status).toBe('active')
    expect(nodes[0].gamesCompleted).toBe(0) // current_game_number 1 → 0 completed
  })

  it('all patterns after current are locked', () => {
    const nodes = deriveNodeStates(BASE_PROGRESS)
    nodes.slice(1).forEach(n => {
      expect(n.status).toBe('locked')
    })
  })

  it('mastered patterns show done status with 5 gamesCompleted', () => {
    const progress = {
      ...BASE_PROGRESS,
      patterns_mastered: ['fork', 'pin'],
      current_pattern: 'back_rank_mate',
      current_game_number: 3,
    }
    const nodes = deriveNodeStates(progress)

    const fork = nodes.find(n => n.pattern === 'fork')!
    expect(fork.status).toBe('done')
    expect(fork.gamesCompleted).toBe(5)

    const pin = nodes.find(n => n.pattern === 'pin')!
    expect(pin.status).toBe('done')
    expect(pin.gamesCompleted).toBe(5)

    const backRank = nodes.find(n => n.pattern === 'back_rank_mate')!
    expect(backRank.status).toBe('active')
    expect(backRank.gamesCompleted).toBe(2) // game 3 → 2 completed
  })

  it('fork and pin nodes are marked isFree, others are not', () => {
    const nodes = deriveNodeStates(BASE_PROGRESS)
    expect(nodes.find(n => n.pattern === 'fork')!.isFree).toBe(true)
    expect(nodes.find(n => n.pattern === 'pin')!.isFree).toBe(true)
    expect(nodes.find(n => n.pattern === 'skewer')!.isFree).toBe(false)
  })

  it('active node gamesCompleted is current_game_number - 1', () => {
    const progress = { ...BASE_PROGRESS, current_game_number: 4 }
    const nodes = deriveNodeStates(progress)
    const active = nodes.find(n => n.status === 'active')!
    expect(active.gamesCompleted).toBe(3)
  })
})

// ── groupByTier ───────────────────────────────────────────────────
describe('groupByTier', () => {
  it('groups patterns into 4 tiers', () => {
    const nodes  = deriveNodeStates(BASE_PROGRESS)
    const groups = groupByTier(nodes)
    expect(Object.keys(groups)).toHaveLength(4)
    expect(groups['Beginner']).toHaveLength(3)
    expect(groups['Intermediate']).toHaveLength(3)
    expect(groups['Advanced']).toHaveLength(3)
    expect(groups['Expert']).toHaveLength(3)
  })
})

// ── computeNewXP ─────────────────────────────────────────────────
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

// ── xpBarPercent ─────────────────────────────────────────────────
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
