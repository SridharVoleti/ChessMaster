// ── Module content loading (server-only) ─────────────────────────
// Loads a module's self-contained source file
// (content/modules/<pattern>/<id>.module.json — roadmap metadata at the
// top, then a `lessons` array with per-ply commentary) and turns each
// lesson into a playable ScriptedGame.
//
// Server-only: import it from Server Components / route handlers only.
// Every *.module.json under content/modules/ is bundled at build time
// via webpack's require.context (statically traceable — works on Vercel,
// unlike a runtime fs.readFile of a computed path); Jest falls back to a
// plain directory walk. Either way the content is resolved with zero
// runtime file lookups.
//
// A lesson file carries title/story/pgn/commentary/hints but never
// states pattern_fen/best_move/side — those are derived from the pgn:
//   • setup_fen   — the standard start position
//   • pattern_fen — the position after replaying the lesson's pgn
//   • side        — whoever is on move there
//   • best_move   — first legal move the pattern detector confirms
//                   (lib/patternDetectors) — same check the content
//                   pipeline validates puzzles against.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chess.js'
import { loadJson } from './content-fs'
import { getModule } from './modules'
import { patternMoves } from './patternDetectors'
import type { RouteBinding } from './curriculum'
import type { ScriptedGame } from '@/app/play/[pattern]/GamePage'

const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface ModuleLesson {
  id:          string
  game_id?:    string
  pattern_id?: string
  title:       string
  story?:      string
  pgn:         string
  commentary?: { ply: number; text: string }[]
  hints?:      string[]
  mistakes?:   string[]
  takeaway?:   string
}

interface ModuleFile {
  id:       string
  pattern:  string
  lessons?: ModuleLesson[]
}

// ── Discover every *.module.json in the drop folder ──────────────
type WebpackContext = { keys(): string[] } & ((k: string) => unknown)
declare const require: NodeJS.Require & {
  context?: (dir: string, recursive: boolean, regExp: RegExp) => WebpackContext
}

function loadModuleFiles(): Map<string, ModuleFile> {
  const byId = new Map<string, ModuleFile>()

  // In the Next.js/webpack build (incl. Vercel serverless) require.context
  // is a literal call webpack extracts statically, bundling every
  // content/modules/**/*.module.json. In Jest / plain Node it is not a
  // function, so we fall through to a directory walk.
  try {
    const ctx = require.context!('../content/modules', true, /\.module\.json$/)
    for (const key of ctx.keys()) {
      const raw = ctx(key) as { default?: ModuleFile } & ModuleFile
      const data = (raw.default ?? raw) as ModuleFile
      if (data?.id) byId.set(data.id, data)
    }
    if (byId.size > 0) return byId
  } catch {
    /* not a webpack bundle — walk the folder instead */
  }

  const root = join(process.cwd(), 'content', 'modules')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
      const full = join(dir, name)
      return statSync(full).isDirectory()
        ? walk(full)
        : name.endsWith('.module.json')
          ? [full]
          : []
    })
  if (existsSync(root)) {
    for (const file of walk(root)) {
      const data = JSON.parse(readFileSync(file, 'utf8')) as ModuleFile
      if (data?.id) byId.set(data.id, data)
    }
  }
  return byId
}

let _moduleFiles: Map<string, ModuleFile> | null = null
function getModuleFile(id: string): ModuleFile | undefined {
  if (!_moduleFiles) _moduleFiles = loadModuleFiles()
  return _moduleFiles.get(id)
}

/** Build the playable games for a module. Returns null if the module id
 *  is unknown or the module has no lessons yet (a planned placeholder).
 *
 *  A single bad lesson (its pgn doesn't reach a position the pattern
 *  detector confirms — a content authoring error) is skipped with a
 *  warning rather than failing the whole module. */
export async function loadModuleGames(moduleId: string): Promise<ScriptedGame[] | null> {
  const mod = getModule(moduleId)
  if (!mod) return null

  const file = getModuleFile(moduleId)
  const lessons = file?.lessons ?? []
  if (lessons.length === 0) return null

  const games: ScriptedGame[] = []
  for (const lesson of lessons) {
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
 *  GamePage. `?module=<id>` is used only when it names a real module for
 *  this route's pattern that yields at least one playable game; anything
 *  else falls back to the route's default games file. */
export async function resolveRouteGames(
  route:    Pick<RouteBinding, 'gamesRef' | 'pattern'>,
  moduleId: string | null | undefined,
): Promise<ScriptedGame[]> {
  if (moduleId) {
    const mod = getModule(moduleId)
    if (mod && mod.pattern === route.pattern) {
      const games = await loadModuleGames(moduleId)
      if (games && games.length > 0) return games
    }
  }
  return loadJson<ScriptedGame[]>(route.gamesRef)
}

/** Test-only: forget the discovered module files so a rewritten fixture
 *  is re-read. */
export function __resetModuleFileCache(): void {
  _moduleFiles = null
}
