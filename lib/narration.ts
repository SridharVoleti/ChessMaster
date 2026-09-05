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
