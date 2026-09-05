'use client'

import Link from 'next/link'
import { forwardRef, useEffect, useMemo, useRef } from 'react'
import {
  buildModuleRoadmap,
  type RoadmapNode,
  type RoadmapProgress,
  type RoadmapWorld,
} from '@/lib/moduleRoadmap'

// ── Candy-trail roadmap ───────────────────────────────────────────
// A Candy-Crush-Saga-style world map built entirely from
// content/curriculum/modules.json (see lib/moduleRoadmap): worlds are
// episodes, each a winding zigzag chain of module nodes. Tapping a
// playable node goes straight to /play/<pattern>?module=<id>.
//
// Rendering is capped so the map stays cheap as modules.json grows over
// a multi-year program: the world holding the active node (and every
// completed world before it) renders in full, the next world renders as
// a locked teaser, and anything further out is not rendered at all.

interface Props {
  progress: RoadmapProgress
}

export function ModuleRoadmap({ progress }: Props) {
  const worlds = useMemo(() => buildModuleRoadmap(progress), [progress])

  const activeWorldIdx = worlds.findIndex(w => w.nodes.some(n => n.status === 'active'))
  // no active node (fresh start hidden behind coming-soon, or all done):
  // fall back to the last world that has any progress, else the first.
  const revealThroughIdx =
    activeWorldIdx >= 0
      ? activeWorldIdx
      : Math.max(
          0,
          worlds.map(w => w.nodes.some(n => n.status === 'done')).lastIndexOf(true),
        )

  const activeRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      {worlds.map((world, idx) => {
        if (idx > revealThroughIdx + 1) return null

        if (idx > revealThroughIdx) {
          return <LockedWorldTeaser key={world.id} world={world} number={idx + 1} />
        }

        return (
          <section key={world.id} className="mb-16">
            <WorldBanner title={world.title} number={idx + 1} />
            <div className="relative mt-10 flex flex-col items-center gap-12">
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 border-l-4 border-dashed border-blue-200"
              />
              {world.nodes.map((node, i) => (
                <TrailNode
                  key={node.id}
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
function WorldBanner({ title, number }: { title: string; number: number }) {
  return (
    <div className="clay mx-auto flex w-fit items-center gap-3 bg-blue-600 px-6 py-3 text-white">
      <span className="font-display text-sm font-bold uppercase tracking-wide text-blue-100">
        World {number}
      </span>
      <span className="font-display text-lg font-extrabold">{title}</span>
    </div>
  )
}

// ── One node on the trail ────────────────────────────────────────
const SIDE_OFFSET: Record<'left' | 'right', string> = {
  left:  '-translate-x-16 sm:-translate-x-24',
  right: 'translate-x-16 sm:translate-x-24',
}

const BUBBLE: Record<RoadmapNode['status'], string> = {
  done:          'bg-emerald-500 text-white',
  active:        'trail-node-pulse bg-orange-500 text-white',
  locked:        'bg-slate-200 text-slate-400',
  'coming-soon': 'border-2 border-dashed border-slate-300 bg-slate-100 text-slate-400',
}

const TrailNode = forwardRef<HTMLAnchorElement, { node: RoadmapNode; side: 'left' | 'right' }>(
  function TrailNode({ node, side }, ref) {
    const glyph =
      node.status === 'done'        ? '✓' :
      node.status === 'locked'      ? '🔒' :
      node.status === 'coming-soon' ? '🔒' :
      node.icon

    const bubble = (
      <span className={`clay flex h-20 w-20 items-center justify-center text-3xl ${BUBBLE[node.status]}`}>
        {glyph}
      </span>
    )

    const label = (
      <span className="mt-2 block w-40 text-center">
        <span
          className={[
            'font-display block text-sm font-bold',
            node.status === 'locked' || node.status === 'coming-soon' ? 'text-slate-400' : 'text-slate-800',
          ].join(' ')}
        >
          {node.title}
          {node.isFree && node.status !== 'done' && (
            <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              FREE
            </span>
          )}
        </span>
        {node.status === 'coming-soon' ? (
          <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Coming soon
          </span>
        ) : node.subtitle ? (
          <span className="mt-0.5 block text-[11px] text-slate-500">{node.subtitle}</span>
        ) : null}
      </span>
    )

    const wrap = `relative z-10 flex flex-col items-center ${SIDE_OFFSET[side]}`

    if (!node.href) {
      return (
        <div className={wrap} aria-disabled="true">
          {bubble}
          {label}
        </div>
      )
    }

    return (
      <Link href={node.href} ref={ref} className={`${wrap} clay-press`}>
        {bubble}
        {label}
        {node.status === 'active' && (
          <span className="font-display mt-1 rounded-full bg-orange-500 px-3 py-0.5 text-xs font-bold text-white">
            PLAY
          </span>
        )}
      </Link>
    )
  },
)

// ── Locked world teaser (next world, not yet reached) ──────────────
function LockedWorldTeaser({ world, number }: { world: RoadmapWorld; number: number }) {
  return (
    <div className="clay mb-8 flex items-center justify-center gap-3 bg-slate-100 px-6 py-8 text-slate-500">
      <span className="trail-lock-bob text-3xl">🔒</span>
      <div className="text-center">
        <p className="font-display text-base font-bold">World {number} — {world.title}</p>
        <p className="text-sm">
          {world.nodes.length} module{world.nodes.length === 1 ? '' : 's'} — finish the world above to unlock
        </p>
      </div>
    </div>
  )
}
