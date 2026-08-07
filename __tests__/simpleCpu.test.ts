/**
 * Tests for lib/simpleCpu.ts — deterministic fallback CPU.
 * Behavioural cases plus a data-driven legality sweep over every
 * shipped game position.
 */

import { Chess } from 'chess.js'
import { chooseSimpleCpuMove } from '@/lib/simpleCpu'
import gamesData from '@/scripts/scripted_games_data.json'

interface GameRow {
  pattern: string
  game_number: number
  game_type?: string
  pattern_fen?: string
}

const PRACTICE_FENS = (gamesData as GameRow[])
  .filter(g => g.pattern_fen)
  .map(g => [`${g.pattern} #${g.game_number}`, g.pattern_fen!] as const)

describe('chooseSimpleCpuMove', () => {
  test('is deterministic for the same position', () => {
    const fen = new Chess().fen()
    expect(chooseSimpleCpuMove(fen)).toBe(chooseSimpleCpuMove(fen))
  })

  test('returns null when the game is over', () => {
    // Fool's mate: black has just mated; white to move with no moves.
    const game = new Chess()
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) game.move(san)
    expect(chooseSimpleCpuMove(game.fen())).toBeNull()
  })

  test('plays checkmate when available', () => {
    expect(chooseSimpleCpuMove('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1')).toBe('a1a8')
  })

  test('captures a hanging queen', () => {
    expect(chooseSimpleCpuMove('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1')).toBe('e4d5')
  })

  test('declines a defended pawn grab that loses the queen', () => {
    expect(chooseSimpleCpuMove('4k3/8/4p3/3p4/8/8/3Q4/4K3 w - - 0 1')).not.toBe('d2d5')
  })

  test.each(PRACTICE_FENS)('returns a legal move in %s position', (_label, fen) => {
    const uci = chooseSimpleCpuMove(fen)
    expect(uci).not.toBeNull()
    const game = new Chess(fen)
    expect(() =>
      game.move({
        from: uci!.slice(0, 2),
        to: uci!.slice(2, 4),
        ...(uci!.length > 4 ? { promotion: uci!.slice(4) } : {}),
      })
    ).not.toThrow()
  })
})
