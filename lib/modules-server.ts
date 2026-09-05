// ── Module content loading (server-only) ─────────────────────────
// Reads a module's lesson file off disk (via lib/content-fs) and turns
// each lesson into a playable ScriptedGame. Server-only for the same
// reason as lib/curriculum-server.ts: it depends on content-fs's
// node:fs/promises import, so it must never be pulled into a client
// bundle — import it only from Server Components / route handlers.
//
// A module lesson (content/modules/<pattern>/<module_id>.json) carries
// the narrative (title/story/hints/takeaway) and the game's PGN, but
// deliberately never states pattern_fen/best_move/side in engine form —
// those are mechanically derivable from the PGN, so authoring a lesson
// never requires hand-computing FEN strings:
//   • setup_fen  — always the standard start position (lessons always
//                  replay a full game from move 1)
//   • pattern_fen — the position after replaying the lesson's pgn: the
//                  tactic is the *next* move, one move description
//                  narrates the position right up to that point
//   • side       - whoever is on move at pattern_fen
//   • best_move  — the first legal move at pattern_fen that satisfies
//                  the pattern's detector (lib/patternDetectors) — the
//                  same detector the content pipeline already validates
//                  puzzles against, so this stays consistent with how
//                  scripts/games/*.json's best_move values were chosen.

import { Chess } from 'chess.js'
import { loadJson } from './content-fs'
import { getModule } from './modules'
import { patternMoves } from './patternDetectors'
import type { RouteBinding } from './curriculum'
import type { ScriptedGame } from '@/app/play/[pattern]/GamePage'

const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface ModuleLesson {
  id:         string
  game_id?:   string
  pattern_id?: string
  title:      string
  story?:     string
  pgn:        string
  commentary?: { ply: number; text: string }[]
  hints?:     string[]
  mistakes?:  string[]
  takeaway?:  string
}

interface ModuleLessonFile {
  schema_version?: string
  module_id:       string
  lessons:         ModuleLesson[]
}

/** Build the playable games for a module. Returns null if the module id
 *  is unknown; throws if its lessons_ref file itself is missing/malformed.
 *
 *  A single bad lesson (its pgn doesn't actually reach a position the
 *  pattern detector confirms — content authoring error, not a code bug)
 *  is skipped with a warning rather than failing the whole module: one
 *  broken puzzle out of a dozen shouldn't take the other eleven offline. */
export async function loadModuleGames(moduleId: string): Promise<ScriptedGame[] | null> {
  const mod = getModule(moduleId)
  if (!mod || !mod.lessons_ref) return null // unknown, or a planned module with no lessons yet

  const file = await loadJson<ModuleLessonFile>(mod.lessons_ref)

  const games: ScriptedGame[] = []
  for (const lesson of file.lessons) {
    const chess = new Chess()
    chess.loadPgn(lesson.pgn)
    const patternFen = chess.fen()
    const side: 'white' | 'black' = chess.turn() === 'w' ? 'white' : 'black'
    const bestMove = patternMoves(patternFen, mod.pattern)[0] ?? null

    if (!bestMove) {
      console.warn(
        `[modules] skipping ${moduleId}/${lesson.id}: no ${mod.pattern} move found at ` +
        `${patternFen} — the lesson's pgn does not stop at a valid tactic. Fix the content ` +
        `(or the pattern it's tagged under) rather than the app.`,
      )
      continue
    }

    games.push({
      pattern:      mod.pattern,
      game_number:  games.length + 1,
      game_type:    'practice',
      title:        lesson.title,
      story:        lesson.story,
      commentary:   lesson.commentary ?? [],
      hints:        lesson.hints ?? [],
      setup_fen:    STANDARD_START_FEN,
      pgn:          `${lesson.pgn} *`,
      pattern_fen:  patternFen,
      best_move:    bestMove,
      side,
      lesson_id:    lesson.id,
      takeaway:     lesson.takeaway,
    })
  }
  return games
}

/** The play route's single decision point: which games array to hand
 *  GamePage. A `moduleId` (from ?module=<id> on /play/[pattern]) is used
 *  only when it names a real module belonging to this route's pattern and
 *  that module actually yields at least one playable game; anything else
 *  (no moduleId, unknown id, wrong pattern, every lesson skipped) falls
 *  back to the route's default games file — a bad query param should
 *  degrade to the normal game list, never to a blank/broken page. */
export async function resolveRouteGames(
  route:    Pick<RouteBinding, 'gamesRef' | 'pattern'>,
  moduleId: string | null | undefined,
): Promise<ScriptedGame[]> {
  if (moduleId) {
    const mod = getModule(moduleId)
    if (mod && mod.pattern === route.pattern && mod.lessons_ref) {
      const games = await loadModuleGames(moduleId)
      if (games && games.length > 0) return games
    }
  }
  return loadJson<ScriptedGame[]>(route.gamesRef)
}
