// ── Curriculum index ─────────────────────────────────────────────
// content/curriculum/index.json is the single source of truth for:
//   • the pattern sequence and its fixed order
//   • tier grouping and tier order
//   • roadmap metadata (icons, free/paid, prerequisites, summaries)
//   • the binding link between each pattern and its lesson + games files
//
// PATTERN_SEQUENCE, TIER_ORDER and FREE_PATTERNS are derived here and
// re-exported from lib/constants.ts so existing call sites keep working.

// This module is imported by both server and client code (e.g. the
// roadmap's client-side RoadmapTrail needs TIER_ORDER), so it must stay
// free of node:fs-backed helpers. Anything that reads content off disk
// lives in lib/curriculum-server.ts instead — see loadLessonContent there.
import curriculumJson from '@/content/curriculum/index.json'

// ── Literal types (compile-time safety; kept in sync with the index
//    by __tests__/curriculum.test.ts) ────────────────────────────
export type PatternKey =
  | 'fork'
  | 'pin'
  | 'back_rank_mate'
  | 'skewer'
  | 'discovered_attack'
  | 'double_check'
  | 'deflection'
  | 'decoy'
  | 'smothered_mate'
  | 'overloading'
  | 'x_ray_attack'
  | 'zwischenzug'

export type Tier = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'

export type UnitStatus = 'published' | 'planned'

// ── Index shape ──────────────────────────────────────────────────
export interface CurriculumTier {
  key:   Tier
  label: string
  order: number
}

export interface CurriculumUnit {
  id:            string
  order:         number
  pattern:       PatternKey
  route_key:     string
  display_name:  string
  tier:          Tier
  icon:          string
  tabler_icon:   string
  is_free:       boolean
  status:        UnitStatus
  prerequisites: string[]
  summary:       string
  xp_on_mastery: number
  lesson_ref:    string
  games_ref:     string
}

export interface AuxRoute {
  route_key: string
  pattern:   PatternKey
  games_ref: string
  note?:     string
}

export interface Curriculum {
  schema_version: string
  curriculum_id:  string
  title:          string
  description:    string
  updated_on:     string
  tiers:          CurriculumTier[]
  units:          CurriculumUnit[]
  aux_routes:     AuxRoute[]
}

// ── Lesson content shape (content/lessons/<pattern>.json) ─────────
export interface LessonFeedbackStrings {
  correct: string
  hint:    string
  reveal:  string
}

export interface LessonContent {
  schema_version:         string
  lesson_id:              string
  pattern:                string
  title:                  string
  content_status:         string
  concept:                string
  tip:                    string
  animation_pgn:          string | null
  confirmation_fen:       string | null
  confirmation_best_move: string | null
  feedback:               LessonFeedbackStrings
}

// PatternValidator's LessonFeedback shape — duplicated here to avoid a
// runtime import cycle (curriculum → constants → PatternValidator → constants).
export interface LessonFeedback {
  feedback_correct: string
  feedback_hint:    string
  feedback_reveal:  string
}

// ── Loaded curriculum ────────────────────────────────────────────
export const CURRICULUM = curriculumJson as unknown as Curriculum

/** Units in fixed roadmap order. */
export const CURRICULUM_UNITS: CurriculumUnit[] =
  [...CURRICULUM.units].sort((a, b) => a.order - b.order)

export function getCurriculum(): Curriculum {
  return CURRICULUM
}

// O(1) lookup maps, built once at module load. A `.find()` over
// CURRICULUM_UNITS is cheap even at a few thousand units, but every
// render of the roadmap looks up many units by key — a Map avoids
// re-scanning the array on each call as the curriculum grows.
const unitsByPattern  = new Map<string, CurriculumUnit>(CURRICULUM_UNITS.map(u => [u.pattern, u]))
const unitsByRouteKey = new Map<string, CurriculumUnit>(CURRICULUM_UNITS.map(u => [u.route_key, u]))

/** Look up a unit by its chess pattern key. */
export function getUnit(pattern: string): CurriculumUnit | undefined {
  return unitsByPattern.get(pattern)
}

/** Look up a unit by its roadmap/URL route key. */
export function getUnitByRoute(routeKey: string): CurriculumUnit | undefined {
  return unitsByRouteKey.get(routeKey)
}

/** All route keys the /play/[pattern] route should accept, mapped to a
 *  { gamesRef, pattern } pair. Includes aux (non-roadmap) routes.
 *  gamesRef is the repo-relative path passed straight to loadJson —
 *  no webpack import() involved, so adding units never touches this file. */
export interface RouteBinding {
  gamesRef:  string   // repo-relative path, e.g. "scripts/games/fork.json"
  pattern:   string
  onRoadmap: boolean
}

export const PLAY_ROUTES: Record<string, RouteBinding> = (() => {
  const out: Record<string, RouteBinding> = {}
  for (const u of CURRICULUM_UNITS) {
    out[u.route_key] = { gamesRef: u.games_ref, pattern: u.pattern, onRoadmap: true }
  }
  for (const a of CURRICULUM.aux_routes) {
    out[a.route_key] = { gamesRef: a.games_ref, pattern: a.pattern, onRoadmap: false }
  }
  return out
})()

// Lesson *loading* (reads content/lessons/<pattern>.json off disk) lives in
// lib/curriculum-server.ts — see loadLessonContent/toLessonFeedback there.

// ── Derived legacy exports (re-exported by lib/constants.ts) ──────
export interface PatternDef {
  key:         PatternKey
  displayName: string
  tier:        Tier
  icon:        string
  isFree:      boolean
}

export const PATTERN_SEQUENCE: PatternDef[] = CURRICULUM_UNITS.map(u => ({
  key:         u.pattern,
  displayName: u.display_name,
  tier:        u.tier,
  icon:        u.icon,
  isFree:      u.is_free,
}))

export const TIER_ORDER: Tier[] =
  [...CURRICULUM.tiers].sort((a, b) => a.order - b.order).map(t => t.key)

export const FREE_PATTERNS: PatternKey[] =
  CURRICULUM_UNITS.filter(u => u.is_free).map(u => u.pattern)
