import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  CURRICULUM,
  CURRICULUM_UNITS,
  PLAY_ROUTES,
  PATTERN_SEQUENCE,
  TIER_ORDER,
  FREE_PATTERNS,
  getUnit,
  getUnitByRoute,
  loadLessonContent,
} from '../lib/curriculum'

const REPO_ROOT = join(__dirname, '..')
const readJson = (rel: string) => JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'))

// The canonical pattern order. If this list changes, the index and the
// PatternKey union in lib/curriculum.ts must change with it.
const EXPECTED_ORDER = [
  'fork', 'pin', 'back_rank_mate',
  'skewer', 'discovered_attack', 'double_check',
  'deflection', 'decoy', 'smothered_mate',
  'overloading', 'x_ray_attack', 'zwischenzug',
]

// ── Index shape ──────────────────────────────────────────────────
describe('curriculum index', () => {
  it('has 12 units in a contiguous 1..12 order', () => {
    expect(CURRICULUM_UNITS).toHaveLength(12)
    expect(CURRICULUM_UNITS.map(u => u.order)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    )
  })

  it('units follow the canonical pattern sequence', () => {
    expect(CURRICULUM_UNITS.map(u => u.pattern)).toEqual(EXPECTED_ORDER)
  })

  it('unit ids are unique', () => {
    const ids = CURRICULUM_UNITS.map(u => u.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every unit has a valid tier', () => {
    for (const u of CURRICULUM_UNITS) {
      expect(TIER_ORDER).toContain(u.tier)
    }
  })

  it('tiers are declared in order and cover all units 3 per tier', () => {
    expect(TIER_ORDER).toEqual(['Beginner', 'Intermediate', 'Advanced', 'Expert'])
    for (const tier of TIER_ORDER) {
      expect(CURRICULUM_UNITS.filter(u => u.tier === tier)).toHaveLength(3)
    }
  })

  it('status is published or planned', () => {
    for (const u of CURRICULUM_UNITS) {
      expect(['published', 'planned']).toContain(u.status)
    }
  })
})

// ── Derived exports ──────────────────────────────────────────────
describe('derived exports', () => {
  it('PATTERN_SEQUENCE mirrors the units', () => {
    expect(PATTERN_SEQUENCE.map(p => p.key)).toEqual(EXPECTED_ORDER)
    for (const p of PATTERN_SEQUENCE) {
      const u = getUnit(p.key)!
      expect(p.displayName).toBe(u.display_name)
      expect(p.tier).toBe(u.tier)
      expect(p.icon).toBe(u.icon)
      expect(p.isFree).toBe(u.is_free)
    }
  })

  it('FREE_PATTERNS is exactly fork and pin', () => {
    expect([...FREE_PATTERNS].sort()).toEqual(['fork', 'pin'])
  })
})

// ── Prerequisites form a valid DAG ───────────────────────────────
describe('prerequisites', () => {
  it('reference existing units and never point forward', () => {
    const orderById = new Map(CURRICULUM_UNITS.map(u => [u.id, u.order]))
    for (const u of CURRICULUM_UNITS) {
      for (const pre of u.prerequisites) {
        expect(orderById.has(pre)).toBe(true)
        expect(orderById.get(pre)!).toBeLessThan(u.order)
      }
    }
  })

  it('the first unit has no prerequisites', () => {
    expect(CURRICULUM_UNITS[0].prerequisites).toEqual([])
  })
})

// ── Route bindings ───────────────────────────────────────────────
describe('play routes', () => {
  it('every unit route_key resolves back to that unit', () => {
    for (const u of CURRICULUM_UNITS) {
      expect(getUnitByRoute(u.route_key)).toBe(u)
    }
  })

  it('route keys are unique across units and aux routes', () => {
    const keys = Object.keys(PLAY_ROUTES)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual(expect.arrayContaining([...EXPECTED_ORDER, 'forks_extended']))
  })

  it('aux routes map to a real pattern', () => {
    for (const a of CURRICULUM.aux_routes) {
      expect(EXPECTED_ORDER).toContain(a.pattern)
    }
  })
})

// ── Referenced files exist and are consistent ────────────────────
describe('referenced files', () => {
  it('every games_ref and lesson_ref file exists', () => {
    for (const u of CURRICULUM_UNITS) {
      expect(existsSync(join(REPO_ROOT, u.games_ref))).toBe(true)
      expect(existsSync(join(REPO_ROOT, u.lesson_ref))).toBe(true)
    }
    for (const a of CURRICULUM.aux_routes) {
      expect(existsSync(join(REPO_ROOT, a.games_ref))).toBe(true)
    }
  })

  it('lesson files declare the matching pattern and non-empty feedback', () => {
    for (const u of CURRICULUM_UNITS) {
      const lesson = readJson(u.lesson_ref)
      expect(lesson.pattern).toBe(u.pattern)
      expect(lesson.concept.length).toBeGreaterThan(0)
      expect(lesson.tip.length).toBeGreaterThan(0)
      for (const key of ['correct', 'hint', 'reveal'] as const) {
        expect(typeof lesson.feedback[key]).toBe('string')
        expect(lesson.feedback[key].length).toBeGreaterThan(0)
      }
    }
  })

  it('published units have a non-empty games file whose rows match the pattern', () => {
    for (const u of CURRICULUM_UNITS.filter(u => u.status === 'published')) {
      const games = readJson(u.games_ref)
      expect(Array.isArray(games)).toBe(true)
      expect(games.length).toBeGreaterThan(0)
      for (const g of games) {
        expect(g.pattern).toBe(u.pattern)
      }
    }
  })

  it('published units carry a confirmation puzzle', () => {
    for (const u of CURRICULUM_UNITS.filter(u => u.status === 'published')) {
      const lesson = readJson(u.lesson_ref)
      expect(lesson.content_status).toBe('published')
      expect(typeof lesson.confirmation_fen).toBe('string')
      expect(typeof lesson.confirmation_best_move).toBe('string')
    }
  })
})

// ── Loader ───────────────────────────────────────────────────────
describe('loadLessonContent', () => {
  it('loads every pattern lesson', async () => {
    for (const u of CURRICULUM_UNITS) {
      const lesson = await loadLessonContent(u.pattern)
      expect(lesson).not.toBeNull()
      expect(lesson!.pattern).toBe(u.pattern)
    }
  })

  it('returns null for an unknown pattern', async () => {
    expect(await loadLessonContent('not_a_pattern')).toBeNull()
  })
})
