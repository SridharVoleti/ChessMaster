// ── Content index ─────────────────────────────────────────────────
// Derived, precomputed indices over content/curriculum/index.json's units,
// built once at module load. lib/curriculum.ts already gives O(1) lookup
// by pattern/route_key; this module adds the lookups the roadmap ("candy
// trail") screen needs on every render — tier buckets and the
// prerequisite graph — so rendering it stays cheap however many hundreds
// or thousands of units the curriculum eventually holds.

import { CURRICULUM_UNITS, type CurriculumUnit, type Tier } from './curriculum'

// ── Tier buckets ─────────────────────────────────────────────────
const unitsByTier = new Map<Tier, CurriculumUnit[]>()
for (const u of CURRICULUM_UNITS) {
  const bucket = unitsByTier.get(u.tier)
  if (bucket) bucket.push(u)
  else unitsByTier.set(u.tier, [u])
}

/** Units in a tier, in roadmap order. Empty array for an unknown tier. */
export function getUnitsByTier(tier: Tier): CurriculumUnit[] {
  return unitsByTier.get(tier) ?? []
}

// ── Prerequisite graph ───────────────────────────────────────────
// Prerequisites are unit ids (see content/curriculum/index.json), so the
// caller's "completed" set must also be unit ids — see unitIdsForPatterns
// below to convert from the DB's pattern-key list.

/** True once every one of a unit's prerequisite ids is in `completedIds`. */
export function prerequisitesMet(unit: CurriculumUnit, completedIds: ReadonlySet<string>): boolean {
  return unit.prerequisites.every(id => completedIds.has(id))
}

/** The next unit a student should attempt: first unit in roadmap order
 *  that isn't complete yet but has every prerequisite satisfied.
 *  Undefined once every unit is complete. O(n) but only ever computed
 *  once per page render, over an in-memory metadata array. */
export function nextUnit(completedIds: ReadonlySet<string>): CurriculumUnit | undefined {
  return CURRICULUM_UNITS.find(u => !completedIds.has(u.id) && prerequisitesMet(u, completedIds))
}

const unitIdByPattern = new Map<string, string>(CURRICULUM_UNITS.map(u => [u.pattern, u.id]))

/** Convert the DB's `patterns_mastered` (pattern keys) into the unit-id
 *  set the prerequisite graph is keyed on. Unknown patterns are dropped. */
export function unitIdsForPatterns(patterns: readonly string[]): Set<string> {
  const ids = new Set<string>()
  for (const p of patterns) {
    const id = unitIdByPattern.get(p)
    if (id) ids.add(id)
  }
  return ids
}
