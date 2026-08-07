import { PATTERN_SEQUENCE, PatternKey, Tier } from './constants'

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

// ── groupByTier ──────────────────────────────────────────────────
// Groups nodes into rows for the zigzag roadmap layout
export function groupByTier(nodes: NodeState[]): Record<Tier, NodeState[]> {
  return nodes.reduce((acc, node) => {
    if (!acc[node.tier]) acc[node.tier] = []
    acc[node.tier].push(node)
    return acc
  }, {} as Record<Tier, NodeState[]>)
}
