'use client'

import { useMemo } from 'react'
import { NarrationPlayer } from './NarrationPlayer'
import { GuidedNarrator } from './GuidedNarrator'
import { buildNarrationSegments, type GuidedStep } from '@/lib/narration'

export interface GuidedControls {
  steps:              GuidedStep[]
  activeStep:         number | null
  onApplyThroughPly:  (ply: number) => void
  onReset:            () => void
  onFinished:         () => void
  onActiveStepChange: (index: number | null) => void
  resetKey:           number
}

interface Props {
  title:       string
  story?:      string
  commentary?: { ply: number; text: string }[]
  /** When present, the panel drives a move-by-move guided replay
   *  instead of a plain story monologue. */
  guided?:     GuidedControls
}

// Left-side lesson rail: the read-aloud control, the story, and the
// move-by-move commentary. Renders nothing when a game carries no
// narrative content (the plain practice games with no story).
export function LessonPanel({ title, story, commentary, guided }: Props) {
  const lines = useMemo(
    () => [...(commentary ?? [])].sort((a, b) => a.ply - b.ply).filter(c => c.text?.trim()),
    [commentary],
  )
  const segments = useMemo(() => buildNarrationSegments({ story, commentary }), [story, commentary])

  const activePly =
    guided && guided.activeStep != null && guided.steps[guided.activeStep]?.kind === 'move'
      ? (guided.steps[guided.activeStep] as Extract<GuidedStep, { kind: 'move' }>).ply
      : null

  if (!story?.trim() && lines.length === 0) return null

  return (
    <aside className="w-full lg:w-80 lg:shrink-0 rounded-2xl bg-gray-800/60 p-4 text-white">
      <h2 className="text-lg font-bold">{title}</h2>

      <div className="mt-3">
        {guided ? (
          <GuidedNarrator
            steps={guided.steps}
            onApplyThroughPly={guided.onApplyThroughPly}
            onReset={guided.onReset}
            onFinished={guided.onFinished}
            onActiveStepChange={guided.onActiveStepChange}
            resetKey={guided.resetKey}
          />
        ) : (
          <NarrationPlayer segments={segments} />
        )}
      </div>

      {story?.trim() && (
        <p className="mt-4 text-sm leading-relaxed text-gray-200">{story}</p>
      )}

      {lines.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Commentary</h3>
          <ol className="mt-2 space-y-1">
            {lines.map(line => (
              <li
                key={line.ply}
                className={[
                  'flex gap-2 rounded-md px-2 py-1 text-sm leading-snug transition-colors',
                  line.ply === activePly
                    ? 'bg-emerald-600/25 text-white'
                    : 'text-gray-300',
                ].join(' ')}
              >
                <span className="shrink-0 font-mono text-xs text-gray-500">{line.ply}.</span>
                <span>{line.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  )
}
