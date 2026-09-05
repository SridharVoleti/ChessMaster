import { PATTERN_SEQUENCE, PatternKey, Tier } from './constants'
import { getModulesByPattern } from './modules'

export type NodeStatus = 'done' | 'active' | 'locked'

export interface NodeState {
  pattern:        PatternKey
  displayName:    string
  icon:           string
  status:         NodeStatus
  gamesCompleted: number   // 0–5
  isFree:         boolean
  tier:           Tier
}

export interface StudentProgressInput {
  current_pattern:     string
  current_game_number: number
  patterns_mastered:   string[]
}

// ── deriveNodeStates ─────────────────────────────────────────────
// Pure function — converts raw DB progress into display-ready node states.
// Used by the roadmap page and tested independently of the DB.
export function deriveNodeStates(progress: StudentProgressInput): NodeState[] {
  const mastered = new Set(progress.patterns_mastered)

  return PATTERN_SEQUENCE.map(p => {
    if (mastered.has(p.key)) {
      return {
        pattern:        p.key,
        displayName:    p.displayName,
        icon:           p.icon,
        status:         'done',
        gamesCompleted: 5,
        isFree:         p.isFree,
        tier:           p.tier as Tier,
      }
    }

    if (p.key === progress.current_pattern) {
      return {
        pattern:        p.key,
        displayName:    p.displayName,
        icon:           p.icon,
        status:         'active',
        gamesCompleted: Math.max(0, progress.current_game_number - 1),
        isFree:         p.isFree,
        tier:           p.tier as Tier,
      }
    }

    return {
      pattern:        p.key,
      displayName:    p.displayName,
      icon:           p.icon,
      status:         'locked',
      gamesCompleted: 0,
      isFree:         p.isFree,
      tier:           p.tier as Tier,
    }
  })
}

// ── buildTrailEntries ──────────────────────────────────────────────
// The candy-trail roadmap's actual data source. A pattern with no
// modules yet renders as one node (today's behaviour, unchanged); a
// pattern with modules (content/curriculum/modules.json) expands into
// one node per module instead, each pointing at
// /play/<pattern>?module=<id> — see lib/modules-server.resolveRouteGames
// for how that query param is turned into the module's actual games.
//
// Module-level lock state is derived from the pattern's own node status
// only (no per-module progress is persisted yet): a locked/done pattern
// locks/completes every one of its modules; an active pattern unlocks
// just its first module, leaving later modules locked until real
// per-module progress tracking exists.
export type TrailEntryKind = 'pattern' | 'module'

export interface TrailEntry {
  tier:            Tier
  kind:            TrailEntryKind
  key:             string   // pattern key, or `${pattern}:${moduleId}`
  pattern:         PatternKey
  displayName:     string
  icon:            string
  status:          NodeStatus
  href:            string | null  // null when locked — not clickable
  isFree:          boolean
  gamesCompleted?: number
}

export function buildTrailEntries(progress: StudentProgressInput): TrailEntry[] {
  const entries: TrailEntry[] = []

  for (const node of deriveNodeStates(progress)) {
    const modules = getModulesByPattern(node.pattern)

    if (modules.length === 0) {
      entries.push({
        tier:           node.tier,
        kind:           'pattern',
        key:            node.pattern,
        pattern:        node.pattern,
        displayName:    node.displayName,
        icon:           node.icon,
        status:         node.status,
        href:           node.status === 'locked' ? null : `/play/${node.pattern}`,
        isFree:         node.isFree,
        gamesCompleted: node.gamesCompleted,
      })
      continue
    }

    modules.forEach((mod, i) => {
      const status: NodeStatus =
        node.status === 'locked' ? 'locked' :
        node.status === 'done'   ? 'done' :
        i === 0                  ? 'active' : 'locked'

      entries.push({
        tier:        node.tier,
        kind:        'module',
        key:         `${node.pattern}:${mod.id}`,
        pattern:     node.pattern,
        displayName: mod.title,
        icon:        node.icon,
        status,
        href:        status === 'locked' ? null : `/play/${node.pattern}?module=${mod.id}`,
        isFree:      node.isFree,
      })
    })
  }

  return entries
}

// ── groupByTier ──────────────────────────────────────────────────
// Groups nodes into rows for the zigzag roadmap layout
export function groupByTier(nodes: NodeState[]): Record<Tier, NodeState[]> {
  return nodes.reduce((acc, node) => {
    if (!acc[node.tier]) acc[node.tier] = []
    acc[node.tier].push(node)
    return acc
  }, {} as Record<Tier, NodeState[]>)
}
