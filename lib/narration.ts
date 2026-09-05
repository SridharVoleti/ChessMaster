// ── Lesson narration ─────────────────────────────────────────────
// Turns a scripted game's story + per-ply commentary into an ordered
// list of short text segments. The left-side lesson panel renders these
// and the read-aloud control (components/NarrationPlayer) speaks them
// one utterance at a time — short segments also sidestep the ~15s
// Chromium/Edge speechSynthesis cutoff that bites long single utterances.

import type { ScriptedGame } from '@/app/play/[pattern]/GamePage'

export function buildNarrationSegments(game: Pick<ScriptedGame, 'story' | 'commentary'>): string[] {
  const segments: string[] = []

  if (game.story && game.story.trim()) segments.push(game.story.trim())

  const commentary = [...(game.commentary ?? [])].sort((a, b) => a.ply - b.ply)
  for (const line of commentary) {
    if (line.text && line.text.trim()) segments.push(line.text.trim())
  }

  return segments
}

// ── Guided replay steps ──────────────────────────────────────────
// The ordered sequence GuidedNarrator walks: the story first (if any),
// then one step per commentary line. A move step carries the `ply` it
// narrates so the board can be advanced to exactly that half-move
// before the line is spoken — this is what keeps the move and its
// commentary in lock-step. Blank commentary lines are kept as move
// steps (the move must still be played) but with empty text, so the
// narrator advances the board and moves on without speaking.

export type GuidedStep =
  | { kind: 'story'; text: string }
  | { kind: 'move'; ply: number; text: string }

export function buildGuidedSteps(game: Pick<ScriptedGame, 'story' | 'commentary'>): GuidedStep[] {
  const steps: GuidedStep[] = []

  if (game.story && game.story.trim()) steps.push({ kind: 'story', text: game.story.trim() })

  const commentary = [...(game.commentary ?? [])].sort((a, b) => a.ply - b.ply)
  for (const line of commentary) {
    steps.push({ kind: 'move', ply: line.ply, text: (line.text ?? '').trim() })
  }

  return steps
}
