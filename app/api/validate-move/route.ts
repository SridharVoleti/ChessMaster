import { NextRequest, NextResponse } from 'next/server'
import { validateMove }               from '@/lib/PatternValidator'
import {
  writeGameAttempt,
  awardXpAndProgress,
  type ProgressSnapshot,
} from '@/lib/supabase/gameAttempts'
import { createServiceClient }        from '@/lib/supabase/server'

// ── POST /api/validate-move ───────────────────────────────────────
// Pure validation + best-effort DB writes.
// DB writes are skipped when Supabase env vars are absent or userId is null.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    playerMove,
    bestMove,
    attemptNumber,
    lesson,
    scriptedGameId = null,
    userId         = null,
    progress       = null,
    patternKey     = 'fork',
    gameNumber     = 1,
    patternFen     = null,
  } = body

  // ── Core validation (pure — no I/O) ─────────────────────────
  // patternFen enables detector-based validation: any move that forms
  // the pattern is accepted, not only the canonical bestMove.
  const result = validateMove(playerMove, bestMove, attemptNumber, lesson, {
    patternFen,
    patternKey,
  })

  // ── DB writes — best-effort only ─────────────────────────────
  if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = createServiceClient()

      await writeGameAttempt(supabase, {
        user_id:          userId,
        scripted_game_id: scriptedGameId,
        attempt_number:   attemptNumber,
        move_played:      playerMove,
        correct:          result.correct,
        hint_shown:       result.hint !== null,
      })

      if ((result.correct || result.showAnswer) && progress) {
        await awardXpAndProgress(
          supabase,
          userId,
          result.xpAwarded,
          progress as ProgressSnapshot,
          patternKey,
          gameNumber,
        )
      }
    } catch (e) {
      console.error('[validate-move] DB write error:', e)
      // Do NOT surface DB errors to the student — game continues
    }
  }

  return NextResponse.json(result)
}
