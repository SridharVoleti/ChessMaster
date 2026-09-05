'use client'

import Link from 'next/link'
import { forwardRef, useEffect, useRef } from 'react'
import {
  deriveNodeStates,
  groupByTier,
  type NodeState,
  type StudentProgressInput,
} from '@/lib/roadmapUtils'
import { TIER_ORDER } from '@/lib/curriculum'

// ── Candy-trail roadmap ───────────────────────────────────────────
// Renders the curriculum as a winding path of "worlds" (tiers), each
// holding a zigzag chain of pattern nodes — done / active / locked,
// driven entirely by lib/roadmapUtils (which itself reads the
// curriculum index via lib/curriculum + lib/contentIndex).
//
// Rendering is capped regardless of how many tiers the curriculum
// eventually grows to over a multi-year program: only the world
// containing the active node (plus every completed world before it)
// renders its nodes in full. The very next world renders as a locked
// teaser card. Anything further out isn't rendered at all — a student
// on unit 4 of 40 never forces the browser to lay out the other 36.

interface Props {
  progress: StudentProgressInput
}

export function RoadmapTrail({ progress }: Props) {
  const nodes   = deriveNodeStates(progress)
  const grouped = groupByTier(nodes)

  const activeTier          = nodes.find(n => n.status === 'active')?.tier
  const revealThroughIndex  = Math.max(0, TIER_ORDER.findIndex(t => t === activeTier))

  const activeRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      {TIER_ORDER.map((tier, tierIdx) => {
        if (tierIdx > revealThroughIndex + 1) return null // future worlds: not rendered at all

        const tierNodes = grouped[tier] ?? []
        if (tierNodes.length === 0) return null

        if (tierIdx > revealThroughIndex) {
          return <LockedWorldTeaser key={tier} tier={tier} unitCount={tierNodes.length} />
        }

        return (
          <section key={tier} className="mb-16">
            <WorldBanner tier={tier} worldNumber={tierIdx + 1} />
            <div className="relative mt-10 flex flex-col items-center gap-12">
              {/* dashed spine connecting every node in this world */}
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 border-l-4 border-dashed border-blue-200"
              />
              {tierNodes.map((node, i) => (
                <TrailNode
                  key={node.pattern}
                  node={node}
                  side={i % 2 === 0 ? 'left' : 'right'}
                  ref={node.status === 'active' ? activeRef : undefined}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ── World banner ───────────────────────────────────────────────────
function WorldBanner({ tier, worldNumber }: { tier: string; worldNumber: number }) {
  return (
    <div className="clay mx-auto flex w-fit items-center gap-3 bg-blue-600 px-6 py-3 text-white">
      <span className="font-display text-sm font-bold uppercase tracking-wide text-blue-100">
        World {worldNumber}
      </span>
      <span className="font-display text-lg font-extrabold">{tier}</span>
    </div>
  )
}

// ── One node on the trail ────────────────────────────────────────
const SIDE_OFFSET: Record<'left' | 'right', string> = {
  left:  '-translate-x-16 sm:-translate-x-24',
  right: 'translate-x-16 sm:translate-x-24',
}

const TrailNode = forwardRef<HTMLAnchorElement, { node: NodeState; side: 'left' | 'right' }>(
  function TrailNode({ node, side }, ref) {
    const stars = Math.round((node.gamesCompleted / 5) * 3)

    const bubble = (
      <span
        className={[
          'clay flex h-20 w-20 items-center justify-center text-3xl',
          node.status === 'done'   && 'bg-emerald-500 text-white',
          node.status === 'active' && 'trail-node-pulse bg-orange-500 text-white',
          node.status === 'locked' && 'bg-slate-200 text-slate-400',
        ].filter(Boolean).join(' ')}
      >
        {node.status === 'locked' ? '🔒' : node.status === 'done' ? '✓' : node.icon}
      </span>
    )

    const label = (
      <span
        className={[
          'font-display mt-2 block text-center text-sm font-bold',
          node.status === 'locked' ? 'text-slate-400' : 'text-slate-800',
        ].join(' ')}
      >
        {node.displayName}
        {node.isFree && node.status !== 'done' ? (
          <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            FREE
          </span>
        ) : null}
      </span>
    )

    const stats =
      node.status === 'active' ? (
        <div className="mt-1 flex justify-center gap-1" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map(i => (
            <span key={i} className={i < stars ? 'text-amber-400' : 'text-slate-300'}>
              ★
            </span>
          ))}
        </div>
      ) : null

    const wrapperClass = `relative z-10 flex w-40 flex-col items-center ${SIDE_OFFSET[side]}`

    if (node.status === 'locked') {
      return (
        <div className={wrapperClass} aria-disabled="true">
          {bubble}
          {label}
        </div>
      )
    }

    return (
      <Link href={`/play/${node.pattern}`} ref={ref} className={`${wrapperClass} clay-press`}>
        {bubble}
        {label}
        {stats}
      </Link>
    )
  },
)

// ── Locked world teaser (next world, not yet reached) ──────────────
function LockedWorldTeaser({ tier, unitCount }: { tier: string; unitCount: number }) {
  return (
    <div className="clay mb-8 flex items-center justify-center gap-3 bg-slate-100 px-6 py-8 text-slate-500">
      <span className="trail-lock-bob text-3xl">🔒</span>
      <div className="text-center">
        <p className="font-display text-base font-bold">{tier} world</p>
        <p className="text-sm">
          {unitCount} pattern{unitCount === 1 ? '' : 's'} — finish the world above to unlock
        </p>
      </div>
    </div>
  )
}
