import { Chess } from 'chess.js'
import { loadModuleGames, resolveRouteGames } from '../lib/modules-server'
import { DETECTORS } from '../lib/patternDetectors'
import { PLAY_ROUTES } from '../lib/curriculum'

describe('loadModuleGames', () => {
  it('returns null for an unknown module id', async () => {
    expect(await loadModuleGames('NOT-A-MODULE')).toBeNull()
  })

  it('loads FK-B-01\'s lessons as playable ScriptedGames, skipping any lesson ' +
     'whose pgn does not actually reach a detector-valid fork position', async () => {
    const games = await loadModuleGames('FK-B-01')
    expect(games).not.toBeNull()
    // FK-B-01.json has 6 authored lessons; lesson FK-B-01-006 ("The Weakest
    // Square") castles the rook off h8 before the knight reaches f7, so the
    // classic Nxf7 fork it narrates is no longer on the board — no detector
    // fires at that position (verified directly against DETECTORS below).
    // A content bug in one lesson must not take down the other five.
    expect(games!.length).toBe(5)
    expect(games!.some(g => g.lesson_id === 'FK-B-01-006')).toBe(false)

    games!.forEach((g, i) => {
      // Required ScriptedGame fields GamePage.tsx will not run without —
      // see the pattern_fen/best_move guard in getScriptedMove/getMainGameData.
      expect(g.pattern).toBe('fork')
      expect(g.game_number).toBe(i + 1)
      expect(typeof g.title).toBe('string')
      expect(g.title.length).toBeGreaterThan(0)
      expect(typeof g.setup_fen).toBe('string')
      expect(typeof g.pgn).toBe('string')
      expect(['white', 'black']).toContain(g.side)
      expect(typeof g.pattern_fen).toBe('string')
      expect(g.pattern_fen!.length).toBeGreaterThan(0)

      // best_move is load-bearing (GamePage throws without it) — it must be
      // a real, legal, detector-positive move, not just "any string".
      expect(typeof g.best_move).toBe('string')
      expect(g.best_move!.length).toBeGreaterThanOrEqual(4)
      expect(DETECTORS.fork(g.pattern_fen!, g.best_move!.toLowerCase())).toBe(true)

      // The derived pattern_fen must actually be reachable by replaying pgn
      // from the standard start position (setup_fen) — i.e. the game record
      // is internally consistent, not just individually well-typed.
      const replay = new Chess()
      replay.loadPgn(g.pgn.replace(/\s*\*\s*$/, ''))
      expect(replay.fen()).toBe(g.pattern_fen)
    })
  })

  it('documents why FK-B-01-006 is excluded: no detector fires at its final position', () => {
    // 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O Be7 5. Ng5 O-O — after Black
    // castles, the rook leaves h8, so a knight landing on f7 no longer
    // forks queen + rook (only the queen is attacked). If this ever
    // starts failing, the content was fixed upstream — update
    // FK-B-01.json's excluded-lesson expectations above.
    const fenAfterCastling = 'r1bq1rk1/ppppbppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQ1RK1 w - - 8 6'
    expect(DETECTORS.fork(fenAfterCastling, 'g5f7')).toBe(false)
  })

  it('preserves lesson narrative content (story / takeaway) for the UI', async () => {
    const games = await loadModuleGames('FK-B-01')
    for (const g of games!) {
      expect(typeof g.story).toBe('string')
      expect(g.story!.length).toBeGreaterThan(0)
      expect(typeof g.takeaway).toBe('string')
      expect(g.takeaway!.length).toBeGreaterThan(0)
    }
  })
})

// ── resolveRouteGames ─────────────────────────────────────────────
// The play route's single decision point: which games array to hand
// GamePage — a module's derived games, or the pattern's default file.
describe('resolveRouteGames', () => {
  const forkRoute = PLAY_ROUTES['fork']

  it('falls back to the route\'s default games file when no module is requested', async () => {
    const games = await resolveRouteGames(forkRoute, undefined)
    expect(games.length).toBe(6) // scripts/games/fork.json's 6 entries
    expect(games.every(g => g.pattern === 'fork')).toBe(true)
  })

  it('loads the module\'s games when a valid module for this route is requested', async () => {
    const games = await resolveRouteGames(forkRoute, 'FK-B-01')
    expect(games.length).toBe(5) // one lesson skipped — see loadModuleGames tests
    expect(games.every(g => g.pattern === 'fork')).toBe(true)
  })

  it('falls back to default games for an unknown module id', async () => {
    const games = await resolveRouteGames(forkRoute, 'NOT-A-MODULE')
    expect(games.length).toBe(6)
  })

  it('falls back to default games when the module belongs to a different pattern', async () => {
    const games = await resolveRouteGames(PLAY_ROUTES['pin'], 'FK-B-01')
    expect(games.every(g => g.pattern === 'pin')).toBe(true)
  })
})
