'use client'

import { useMemo } from 'react'
import { NarrationPlayer } from './NarrationPlayer'
import { buildNarrationSegments } from '@/lib/narration'

interface Props {
  title:      string
  story?:     string
  commentary?: { ply: number; text: string }[]
}

// Left-side lesson rail: the read-aloud control, the story, and the
// move-by-move commentary. Renders nothing when a game carries no
// narrative content (the plain practice games), so those screens are
// unchanged.
export function LessonPanel({ title, story, commentary }: Props) {
  const lines = useMemo(
    () => [...(commentary ?? [])].sort((a, b) => a.ply - b.ply).filter(c => c.text?.trim()),
    [commentary],
  )
  const segments = useMemo(() => buildNarrationSegments({ story, commentary }), [story, commentary])

  if (!story?.trim() && lines.length === 0) return null

  return (
    <aside className="w-full lg:w-80 lg:shrink-0 rounded-2xl bg-gray-800/60 p-4 text-white">
      <h2 className="text-lg font-bold">{title}</h2>

      <div className="mt-3">
        <NarrationPlayer segments={segments} />
      </div>

      {story?.trim() && (
        <p className="mt-4 text-sm leading-relaxed text-gray-200">{story}</p>
      )}

      {lines.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Commentary</h3>
          <ol className="mt-2 space-y-2">
            {lines.map(line => (
              <li key={line.ply} className="flex gap-2 text-sm leading-snug text-gray-300">
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
