// ── Curriculum content loading (server-only) ─────────────────────
// Split out from lib/curriculum.ts because this file touches the
// filesystem (via lib/content-fs's node:fs/promises import) — bundling
// that into a client component would break the browser build. Import
// this module only from Server Components / route handlers; import
// lib/curriculum.ts directly for pure metadata (TIER_ORDER,
// PATTERN_SEQUENCE, getUnit, PLAY_ROUTES, ...) that's safe on the client.

import { loadJson } from './content-fs'
import { getUnit, type LessonContent, type LessonFeedback } from './curriculum'

/** Load a pattern's lesson content from disk (content/lessons/<pattern>.json).
 *  Returns null if the pattern is unknown or its lesson file cannot be
 *  resolved — callers fall back to inline defaults in that case. */
export async function loadLessonContent(pattern: string): Promise<LessonContent | null> {
  const unit = getUnit(pattern)
  if (!unit) return null
  try {
    return await loadJson<LessonContent>(unit.lesson_ref)
  } catch {
    return null
  }
}

/** Adapt a LessonContent into the LessonFeedback shape the validator uses. */
export function toLessonFeedback(lesson: LessonContent): LessonFeedback {
  return {
    feedback_correct: lesson.feedback.correct,
    feedback_hint:    lesson.feedback.hint,
    feedback_reveal:  lesson.feedback.reveal,
  }
}
