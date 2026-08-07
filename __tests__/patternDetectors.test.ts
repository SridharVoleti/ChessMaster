/**
 * Parametrised tests for lib/patternDetectors.ts — the TS port of
 * chess_pipeline/pattern_detectors.py. Driven by the generated game
 * data so every shipped position is covered without hardcoding.
 */

import { Chess } from 'chess.js'
import { DETECTORS, patternMoves, squaresBetween } from '@/lib/patternDetectors'
import { parsePgnToMoves } from '@/lib/DidacticOpponent'
import gamesData from '@/scripts/scripted_games_data.json'

interface GameRow {
  pattern: string
  game_number: number
  game_type?: string
  title: string
  pattern_fen?: string
  best_move?: string
  pgn: string
  side: 'white' | 'black'
  checkpoints?: Array<{ ply: number; pattern: string }>
}

const GAMES = gamesData as GameRow[]
const PRACTICE = GAMES.filter(g => (g.game_type ?? 'practice') === 'practice')
const MAINS = GAMES.filter(g => g.game_type === 'main')

describe('practice games: best_move passes its pattern detector', () => {
  test.each(PRACTICE.map(g => [`${g.pattern} #${g.game_number} (${g.title})`, g] as const))(
    '%s',
    (_label, g) => {
      const detector = DETECTORS[g.pattern]
      expect(detector).toBeDefined()
      expect(detector(g.pattern_fen!, g.best_move!)).toBe(true)
    }
  )

  test.each(PRACTICE.map(g => [`${g.pattern} #${g.game_number}`, g] as const))(
    '%s: best_move is listed by patternMoves',
    (_label, g) => {
      expect(patternMoves(g.pattern_fen!, g.pattern)).toContain(g.best_move)
    }
  )
})

describe('main games: every checkpoint move passes its detector', () => {
  const cases = MAINS.flatMap(g =>
    (g.checkpoints ?? []).map(cp => [`${g.pattern} MAIN ply ${cp.ply} (${cp.pattern})`, g, cp] as const)
  )

  test.each(cases)('%s', (_label, g, cp) => {
    const moves = parsePgnToMoves(g.pgn)
    expect(moves.length).toBeGreaterThan(cp.ply)

    const board = new Chess()
    for (let i = 0; i < cp.ply; i++) {
      board.move({
        from: moves[i].slice(0, 2),
        to: moves[i].slice(2, 4),
        ...(moves[i].length > 4 ? { promotion: moves[i].slice(4) } : {}),
      })
    }
    const studentColor = g.side === 'white' ? 'w' : 'b'
    expect(board.turn()).toBe(studentColor)
    expect(DETECTORS[cp.pattern](board.fen(), moves[cp.ply])).toBe(true)
  })
})

describe('negative and edge cases', () => {
  const START = new Chess().fen()

  test.each(Object.keys(DETECTORS))('%s: quiet opening move is not a pattern', pattern => {
    expect(DETECTORS[pattern](START, 'e2e4')).toBe(false)
  })

  test.each(Object.keys(DETECTORS))('%s: illegal move returns false', pattern => {
    expect(DETECTORS[pattern](START, 'e2e5')).toBe(false)
  })

  test.each(Object.keys(DETECTORS))('%s: garbage FEN returns false', pattern => {
    expect(DETECTORS[pattern]('not a fen', 'e2e4')).toBe(false)
  })

  test('double_check: knight discovery gives double check', () => {
    // Re1 + Ne4 vs Ke8: Nd6+ checks and unveils the rook check.
    const fen = '4k3/8/8/8/4N3/8/8/4RK2 w - - 0 1'
    expect(DETECTORS.double_check(fen, 'e4d6')).toBe(true)
    // The same knight stepping aside without checking is not.
    expect(DETECTORS.double_check(fen, 'e4c3')).toBe(false)
  })

  test('squaresBetween: aligned, unaligned and adjacent squares', () => {
    expect(squaresBetween('a1', 'a4')).toEqual(['a2', 'a3'])
    expect(squaresBetween('c1', 'f4')).toEqual(['d2', 'e3'])
    expect(squaresBetween('a1', 'b3')).toEqual([])
    expect(squaresBetween('a1', 'a2')).toEqual([])
  })
})
