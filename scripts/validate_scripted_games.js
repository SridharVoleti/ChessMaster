#!/usr/bin/env node
/**
 * validate_scripted_games.js
 *
 * Validates every scripted game in SCRIPTED_GAMES:
 *   1. pattern_fen must parse without error (chess.js)
 *   2. best_move must be a legal move in that position
 *
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Usage:  node scripts/validate_scripted_games.js
 * Or (against live DB): node scripts/validate_scripted_games.js --db
 */

const { Chess } = require('chess.js')

// ── Load game data ────────────────────────────────────────────────
// Embedded for offline use. Pass --db to query Supabase instead.
const GAMES = require('./scripted_games_data.json')

let failed = 0

for (const game of GAMES) {
  const { pattern, game_number, pattern_fen, best_move, title } = game
  const label = `${pattern} #${game_number} — ${title}`

  // ── 1. FEN must parse ────────────────────────────────────────
  let board
  try {
    board = new Chess(pattern_fen)
  } catch (e) {
    console.error(`[FAIL] ${label}: FEN parse error — ${e.message}`)
    failed++
    continue
  }

  // ── 2. best_move must be legal ───────────────────────────────
  const from = best_move.slice(0, 2)
  const to   = best_move.slice(2, 4)
  const promo = best_move.slice(4) || undefined

  const result = board.move({ from, to, ...(promo && { promotion: promo }) })
  if (!result) {
    console.error(`[FAIL] ${label}: move ${best_move} is illegal in ${pattern_fen}`)
    failed++
  } else {
    console.log(`[ OK ] ${label}: ${best_move}`)
  }
}

console.log(`\n${GAMES.length - failed}/${GAMES.length} passed.`)
if (failed > 0) {
  console.error(`${failed} failure(s) found.`)
  process.exit(1)
}
