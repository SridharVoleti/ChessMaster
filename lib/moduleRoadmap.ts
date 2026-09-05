// ── Module roadmap ────────────────────────────────────────────────
// Turns content/curriculum/modules.json + a student's progress into the
// candy-trail roadmap model: worlds, each holding an ordered chain of
// module nodes with a lock/active/done/coming-soon status.
//
// Pure — no DB, no fs — so it is unit-tested directly and safe to run in
// the client component that renders the trail.

import {
  MODULES,
  MODULE_WORLDS,
  type ModuleDef,
} from './modules'

export interface RoadmapProgress {
  /** chess pattern keys the student has mastered (student_progress.patterns_mastered) */
  patterns_mastered: string[]
}

export type RoadmapNodeStatus = 'done' | 'active' | 'locked' | 'coming-soon'

export interface RoadmapNode {
  id:        string
  order:     number
  world:     string
  pattern:   string
  title:     string
  subtitle?: string
  icon:      string
  isFree:    boolean
  status:    RoadmapNodeStatus
  /** where a tap goes — null when the node is not playable */
  href:      string | null
}

export interface RoadmapWorld {
  id:    string
  title: string
  order: number
  nodes: RoadmapNode[]
}

function isPlayable(m: ModuleDef): boolean {
  return m.status === 'published' && m.lesson_count > 0
}

/** Build the full roadmap for a student. Modules are walked in global
 *  `order`: a published module the student has mastered is `done`; the
 *  first not-yet-done playable module is `active`; everything after the
 *  frontier is `locked`; a `planned` module (no lessons yet) is
 *  `coming-soon` and also acts as a gate — you cannot pass content that
 *  does not exist. */
export function buildModuleRoadmap(progress: RoadmapProgress): RoadmapWorld[] {
  const mastered = new Set(progress.patterns_mastered)
  let frontierPassed = false

  const nodes: RoadmapNode[] = MODULES.map(m => {
    let status: RoadmapNodeStatus

    if (!isPlayable(m)) {
      status = 'coming-soon'
      frontierPassed = true
    } else if (mastered.has(m.pattern)) {
      status = 'done'
    } else if (!frontierPassed) {
      status = 'active'
      frontierPassed = true
    } else {
      status = 'locked'
    }

    const playable = status === 'done' || status === 'active'

    return {
      id:       m.id,
      order:    m.order,
      world:    m.world,
      pattern:  m.pattern,
      title:    m.title,
      subtitle: m.subtitle,
      icon:     m.icon,
      isFree:   m.is_free,
      status,
      href:     playable ? `/play/${m.pattern}?module=${m.id}` : null,
    }
  })

  return MODULE_WORLDS.map(w => ({
    id:    w.id,
    title: w.title,
    order: w.order,
    nodes: nodes.filter(n => n.world === w.id),
  })).filter(w => w.nodes.length > 0)
}
