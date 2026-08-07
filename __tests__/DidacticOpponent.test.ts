import { Chess } from 'chess.js'
import { DidacticOpponent, parsePgnToMoves, normaliseFen } from '../lib/DidacticOpponent'

// ── Test data ─────────────────────────────────────────────────────
const FORK_GAME_PGN = `
[Event "ChessQuest Fork Game 1"]
[White "You"]
[Black "CPU"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. d4 exd4 *
`

// Pattern position: White Ke1 Nd3, Black Ke8 Qc4 Rf7
// Student must play Nd3-e5 to fork queen and rook
const PATTERN_FEN = '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1'
const BEST_MOVE   = 'd3e5'

function makeOpponent() {
  return new DidacticOpponent({
    scriptedPgn:  FORK_GAME_PGN,
    patternFen:   PATTERN_FEN,
    bestMove:     BEST_MOVE,
  })
}

// ── parsePgnToMoves ───────────────────────────────────────────────
describe('parsePgnToMoves', () => {
  it('extracts UCI moves from PGN in correct sequence', () => {
    const moves = parsePgnToMoves(FORK_GAME_PGN)
    expect(moves).toEqual(['e2e4','e7e5','g1f3','b8c6','d2d4','e5d4'])
  })

  it('handles PGN with headers only, no moves', () => {
    const moves = parsePgnToMoves('[Event "Test"]\n*')
    expect(moves).toEqual([])
  })
})

// ── normaliseFen ─────────────────────────────────────────────────
describe('normaliseFen', () => {
  it('strips halfmove clock and fullmove number', () => {
    const full   = '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 10 25'
    const simple = '4k3/5r2/8/8/2q5/3N4/8/4K3 w - -'
    expect(normaliseFen(full)).toBe(simple)
    expect(normaliseFen(PATTERN_FEN)).toBe(simple)
  })
})

// ── DidacticOpponent ─────────────────────────────────────────────
// REQ-03 Test 1: getMove returns scripted moves in sequence
describe('DidacticOpponent.getMove', () => {
  it('TEST 1: returns scripted moves in correct sequence before pattern position', () => {
    const opp   = makeOpponent()
    const board = new Chess() // starting position

    const scriptedMoves = parsePgnToMoves(FORK_GAME_PGN)
    expect(scriptedMoves.length).toBeGreaterThan(0)

    // First move should be the first scripted move
    const first = opp.getMove(board)
    expect(first).toBe(scriptedMoves[0])

    // Apply move and get second
    board.move({ from: first!.slice(0,2), to: first!.slice(2,4) })
    const second = opp.getMove(board)
    expect(second).toBe(scriptedMoves[1])
  })
})

// REQ-03 Test 2: isPatternMoment returns false before pattern position
describe('DidacticOpponent.isPatternMoment', () => {
  it('TEST 2: returns false at starting position', () => {
    const opp   = makeOpponent()
    const board = new Chess()
    expect(opp.isPatternMoment(board)).toBe(false)
  })

  // REQ-03 Test 3: returns true when board matches patternFen
  it('TEST 3: returns true when board exactly matches patternFen', () => {
    const opp   = makeOpponent()
    const board = new Chess(PATTERN_FEN)
    expect(opp.isPatternMoment(board)).toBe(true)
  })

  it('TEST 3b: FEN comparison ignores halfmove and fullmove clocks', () => {
    const opp           = makeOpponent()
    const variantFen    = '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 5 42'
    const board         = new Chess(variantFen)
    expect(opp.isPatternMoment(board)).toBe(true)
  })
})

// REQ-03 Test 4: getMove returns null at pattern moment
describe('DidacticOpponent.getMove at pattern moment', () => {
  it('TEST 4: returns null when board is at pattern position', () => {
    const opp   = makeOpponent()
    const board = new Chess(PATTERN_FEN)
    expect(opp.getMove(board)).toBeNull()
  })
})

// REQ-03 Test 5: reset() returns opponent to initial state
describe('DidacticOpponent.reset', () => {
  it('TEST 5: after reset, getMove returns first scripted move again', () => {
    const opp         = makeOpponent()
    const board       = new Chess()
    const scriptMoves = parsePgnToMoves(FORK_GAME_PGN)

    // Advance a couple moves
    opp.getMove(board)
    opp.getMove(board)

    // Reset
    opp.reset()

    // Should be back to first move
    const afterReset = opp.getMove(board)
    expect(afterReset).toBe(scriptMoves[0])
  })
})

// ── validateStudentMove ───────────────────────────────────────────
describe('DidacticOpponent.validateStudentMove', () => {
  it('returns true for exact correct move', () => {
    const opp = makeOpponent()
    expect(opp.validateStudentMove('d3e5')).toBe(true)
  })

  it('is case-insensitive', () => {
    const opp = makeOpponent()
    expect(opp.validateStudentMove('D3E5')).toBe(true)
  })

  it('returns false for incorrect move', () => {
    const opp = makeOpponent()
    expect(opp.validateStudentMove('e2e4')).toBe(false)
  })
})
