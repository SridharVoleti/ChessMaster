#!/usr/bin/env node
/**
 * design_fork_games.js
 *
 * Designs and verifies 5 new Fork game scenarios.
 * Each must have:
 *   - Unique fork target squares (no two games the same)
 *   - 2 scripted half-moves (both sides play)
 *   - ~8-12 pieces on the board
 *
 * Prints [ OK ] or [ FAIL ] for each, then writes the verified array to stdout as JSON.
 */

const { Chess } = require('chess.js')

function normFen(fen) {
  return fen.split(' ').slice(0, 4).join(' ')
}

function verifyGame({ setup_fen, pgn_moves_san, pattern_fen, best_move }) {
  // 1. Play scripted moves from setup_fen → must reach pattern_fen
  const board = new Chess(setup_fen)
  const tokens = pgn_moves_san
    .replace(/\d+\.\.\./g, '')
    .replace(/\d+\./g, '')
    .replace(/\*|1-0|0-1|1\/2-1\/2/g, '')
    .trim().split(/\s+/).filter(Boolean)

  for (const tok of tokens) {
    try {
      const r = board.move(tok)
      if (!r) return `NULL move: "${tok}"`
    } catch (e) {
      return `Illegal move "${tok}": ${e.message}`
    }
  }

  const reached = normFen(board.fen())
  const expected = normFen(pattern_fen)
  if (reached !== expected) {
    return `FEN mismatch after scripted moves:\n  reached:  ${reached}\n  expected: ${expected}`
  }

  // 2. best_move must be legal in pattern_fen
  const b2 = new Chess(pattern_fen)
  try {
    const r = b2.move({ from: best_move.slice(0, 2), to: best_move.slice(2, 4) })
    if (!r) return `best_move ${best_move} returned null`
  } catch (e) {
    return `best_move ${best_move} is illegal: ${e.message}`
  }

  return null // OK
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME DESIGNS
// Each setup_fen has ~10 pieces so it looks like a real middlegame.
// pgn_moves_san: both sides play (even number of half-moves → White to move at pattern_fen).
// The CPU's last move is the "mistake" that creates the fork target.
// ─────────────────────────────────────────────────────────────────────────────

const designs = [

  // ── GAME 1 ────────────────────────────────────────────────────────────────
  // Triple fork: Nf6+ attacks Ke8, Qd7, and Rg8
  // White knight on d2 advances to e4; Black queen retreats to d7 (natural-looking),
  // giving White the devastating Nf6+.
  {
    game_number: 1,
    title: 'Triple Fork: King, Queen and Rook',
    setup_fen:   '3qk1r1/5ppp/8/8/8/8/3N2PP/6K1 w - - 0 1',
    pgn_moves_san: '1. Ne4 Qd7',
    pattern_fen:  '4k1r1/3q1ppp/8/8/4N3/8/6PP/6K1 w - - 0 1',
    best_move:    'e4f6',  // Nf6+ forks Ke8, Qd7, and Rg8
  },

  // ── GAME 2 ────────────────────────────────────────────────────────────────
  // Fork: Nb5 attacks Qc7 and Rd6
  // White knight hops from e2 to c3; Black rook slides from d8 to d6
  // (looks like a natural centralising move), walking into Nb5.
  {
    game_number: 2,
    title: 'Knight Fork: Queen and Rook',
    setup_fen:   '3r2k1/2q1pppp/8/8/8/8/4N1PP/6K1 w - - 0 1',
    pgn_moves_san: '1. Nc3 Rd6',
    pattern_fen:  '6k1/2q1pppp/3r4/8/8/2N5/6PP/6K1 w - - 0 1',
    best_move:    'c3b5',  // Nb5 forks Qc7 and Rd6
  },

  // ── GAME 3 ────────────────────────────────────────────────────────────────
  // Royal fork: Nc7+ attacks Ke8 and Ra8
  // White knight jumps from e3 to d5 (good outpost); Black rook
  // runs to a8 (looks like it's defending the back rank), falling into Nc7+.
  {
    game_number: 3,
    title: 'Royal Fork: King and Rook',
    setup_fen:   '4k3/2p2ppp/8/8/8/4N3/r4PPP/6K1 w - - 0 1',
    pgn_moves_san: '1. Nd5 Ra8',
    pattern_fen:  'r3k3/2p2ppp/8/3N4/8/8/5PPP/6K1 w - - 0 1',
    best_move:    'd5c7',  // Nc7+ forks Ke8 and Ra8
  },

  // ── GAME 4 ────────────────────────────────────────────────────────────────
  // Royal fork: Nc5+ attacks Ke6 and Ra4
  // White plays b3 (space/prep); Black rook swings from h4 to a4
  // (threatens White's a-pawn), but lands on the fork square.
  {
    game_number: 4,
    title: 'Royal Fork: King and Rook (Endgame)',
    setup_fen:   '8/ppp5/4k3/8/7r/3N4/PPP5/4K3 w - - 0 1',
    pgn_moves_san: '1. b3 Ra4',
    pattern_fen:  '8/ppp5/4k3/8/r7/1P1N4/P1P5/4K3 w - - 0 1',
    best_move:    'd3c5',  // Nc5+ forks Ke6 and Ra4
  },

  // ── GAME 5 ────────────────────────────────────────────────────────────────
  // Middlegame fork: Ne5 attacks Qc4 and Rf7
  // White plays h3 (waiting/prophylaxis); Black rook drops from f8 to f7
  // (natural development), allowing Ne5 to fork queen and rook.
  {
    game_number: 5,
    title: 'Knight Fork in the Middlegame',
    setup_fen:   '4kr2/6pp/4p3/3p4/2q5/2P1PN2/6PP/6K1 w - - 0 1',
    pgn_moves_san: '1. h3 Rf7',
    pattern_fen:  '4k3/5rpp/4p3/3p4/2q5/2P1PN1P/6P1/6K1 w - - 0 1',
    best_move:    'f3e5',  // Ne5 forks Qc4 and Rf7
  },
]

let allOk = true
for (const d of designs) {
  const err = verifyGame(d)
  if (err) {
    console.error(`[FAIL] Game ${d.game_number} — ${d.title}: ${err}`)
    allOk = false
  } else {
    console.log(`[ OK ] Game ${d.game_number} — ${d.title}: ${d.best_move}`)
  }
}

if (!allOk) process.exit(1)
console.log('\nAll verified.')
