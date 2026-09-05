import { CURRICULUM_UNITS, TIER_ORDER } from '../lib/curriculum'
import {
  getUnitsByTier,
  prerequisitesMet,
  nextUnit,
  unitIdsForPatterns,
} from '../lib/contentIndex'

describe('getUnitsByTier', () => {
  it('returns every unit tagged with that tier, in roadmap order', () => {
    for (const tier of TIER_ORDER) {
      const units = getUnitsByTier(tier)
      expect(units.length).toBeGreaterThan(0)
      for (const u of units) expect(u.tier).toBe(tier)
      expect(units.map(u => u.order)).toEqual([...units.map(u => u.order)].sort((a, b) => a - b))
    }
  })

  it('returns an empty array for an unknown tier', () => {
    // @ts-expect-error deliberately passing a non-Tier string
    expect(getUnitsByTier('Nonexistent')).toEqual([])
  })
})

describe('prerequisitesMet', () => {
  it('is true for a unit with no prerequisites, given an empty completed set', () => {
    const first = CURRICULUM_UNITS[0]
    expect(first.prerequisites).toEqual([])
    expect(prerequisitesMet(first, new Set())).toBe(true)
  })

  it('is false until every prerequisite id is present', () => {
    const withPrereq = CURRICULUM_UNITS.find(u => u.prerequisites.length > 0)!
    expect(prerequisitesMet(withPrereq, new Set())).toBe(false)
    expect(prerequisitesMet(withPrereq, new Set(withPrereq.prerequisites))).toBe(true)
  })
})

describe('nextUnit', () => {
  it('is the first unit when nothing is completed', () => {
    expect(nextUnit(new Set())?.id).toBe(CURRICULUM_UNITS[0].id)
  })

  it('advances to the next unit once its prerequisites are completed', () => {
    const first  = CURRICULUM_UNITS[0]
    const second = CURRICULUM_UNITS[1]
    expect(nextUnit(new Set([first.id]))?.id).toBe(second.id)
  })

  it('is undefined once every unit is completed', () => {
    const allIds = new Set(CURRICULUM_UNITS.map(u => u.id))
    expect(nextUnit(allIds)).toBeUndefined()
  })
})

describe('unitIdsForPatterns', () => {
  it('maps pattern keys to their unit ids', () => {
    const first = CURRICULUM_UNITS[0]
    const ids = unitIdsForPatterns([first.pattern])
    expect(ids.has(first.id)).toBe(true)
    expect(ids.size).toBe(1)
  })

  it('silently drops unknown pattern keys', () => {
    expect(unitIdsForPatterns(['not_a_real_pattern']).size).toBe(0)
  })
})
