#!/usr/bin/env node
/**
 * add_setup_fields.js
 *
 * Adds setup_fen, pgn, and side to every entry in scripted_games_data.json.
 * Fork games 1-5 get a real 1-move scripted intro.
 * All other patterns use setup_fen = pattern_fen, pgn = "" (instant puzzle).
 *
 * Usage: node scripts/add_setup_fields.js
 */

const { Chess } = require('chess.js')
const fs = require('fs')
const path = require('path')

const DATA_PATH = path.join(__dirname, 'scripted_games_data.json')
const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))

// Fork scripted intros: one Black move leads to the pattern_fen
const FORK_SETUPS = {
  1: {
    setup_fen: '4k3/5r2/8/8/q7/3N4/8/4K3 b - - 0 1',
    pgn_moves: '1... Qc4',   // Qa4→c4; now White knight on d3 can fork Qc4 and Rf7
  },
  2: {
    setup_fen: '4k3/5r2/8/8/q3p3/3N4/8/4K3 b - - 0 1',
    pgn_moves: '1... Qc4',   // Same fork, extra pawn on e4 as distractor
  },
  3: {
    setup_fen: '4k3/5r2/8/8/q7/5N2/8/4K3 b - - 0 1',
    pgn_moves: '1... Qc4',   // Knight now on f3 instead of d3
  },
  4: {
    setup_fen: '8/8/4k3/8/6r1/3N4/8/4K3 b - - 0 1',
    pgn_moves: '1... Ra4',   // Rg4→a4; White knight on d3 can royal-fork Ka6 and Ra4
  },
  5: {
    setup_fen: '4kr2/6pp/4p3/3p4/2q5/2P1PN2/6PP/6K1 b - - 0 1',
    pgn_moves: '1... Rf7',   // Rf8→f7; now Nf3-e5 forks Qc4 and Rf7
  },
}

// Build PGN string from a setup_fen and SAN move text
function buildPgn(setup_fen, pgn_moves) {
  return `[SetUp "1"]\n[FEN "${setup_fen}"]\n\n${pgn_moves} *`
}

// Verify: play the scripted moves from setup_fen and confirm we reach pattern_fen
function verifySetup(setup_fen, pgn_moves_san, pattern_fen) {
  const board = new Chess(setup_fen)
  const tokens = pgn_moves_san.replace(/\d+\.\.\./g, '').replace(/\d+\./g, '').trim().split(/\s+/).filter(Boolean)
  for (const tok of tokens) {
    try { board.move(tok) } catch (e) { return `INVALID MOVE "${tok}": ${e.message}` }
  }
  const reached = board.fen().split(' ').slice(0, 4).join(' ')
  const expected = pattern_fen.split(' ').slice(0, 4).join(' ')
  if (reached !== expected) return `FEN MISMATCH:\n  reached:  ${reached}\n  expected: ${expected}`
  return null
}

let errors = 0

for (const game of data) {
  const { side } = (() => {
    const turnChar = game.pattern_fen.split(' ')[1]
    return { side: turnChar === 'b' ? 'black' : 'white' }
  })()

  if (game.pattern === 'fork' && FORK_SETUPS[game.game_number]) {
    const { setup_fen, pgn_moves } = FORK_SETUPS[game.game_number]
    const err = verifySetup(setup_fen, pgn_moves, game.pattern_fen)
    if (err) {
      console.error(`[FAIL] fork #${game.game_number}: ${err}`)
      errors++
    } else {
      console.log(`[ OK ] fork #${game.game_number}: setup verified`)
    }
    game.setup_fen = setup_fen
    game.pgn       = buildPgn(setup_fen, pgn_moves)
  } else {
    // No scripted intro: board starts directly at the pattern moment
    game.setup_fen = game.pattern_fen
    game.pgn       = ''
  }

  game.side = side
}

if (errors) {
  console.error(`\n${errors} verification error(s). File NOT written.`)
  process.exit(1)
}

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
console.log(`\nWrote ${data.length} games with setup_fen + pgn + side.`)
