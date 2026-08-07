/**
 * Detector-based validation: with a PatternContext, validateMove
 * accepts ANY move that forms the pattern, not only the canonical
 * best_move. Parametrised over every shipped practice position.
 */

import { validateMove } from '@/lib/PatternValidator'
import { patternMoves } from '@/lib/patternDetectors'
import gamesData from '@/scripts/scripted_games_data.json'

const LESSON = {
  feedback_correct: 'Correct!',
  feedback_hint:    'Hint.',
  feedback_reveal:  'Reveal.',
}

interface GameRow {
  pattern: string
  game_number: number
  game_type?: string
  pattern_fen?: string
  best_move?: string
}

const PRACTICE = (gamesData as GameRow[]).filter(
  g => (g.game_type ?? 'practice') === 'practice'
)

describe('validateMove with pattern context', () => {
  test.each(PRACTICE.map(g => [`${g.pattern} #${g.game_number}`, g] as const))(
    '%s: every detector-valid move is accepted',
    (_label, g) => {
      const context = { patternFen: g.pattern_fen, patternKey: g.pattern }
      const hits = patternMoves(g.pattern_fen!, g.pattern)
      expect(hits).toContain(g.best_move)
      for (const uci of hits) {
        const result = validateMove(uci, g.best_move!, 1, LESSON, context)
        expect(result.correct).toBe(true)
      }
    }
  )

  test.each(PRACTICE.slice(0, 5).map(g => [`${g.pattern} #${g.game_number}`, g] as const))(
    '%s: a non-pattern move is still rejected',
    (_label, g) => {
      const context = { patternFen: g.pattern_fen, patternKey: g.pattern }
      // An obviously meaningless "move" never passes the detector.
      const result = validateMove('a1a1', g.best_move!, 1, LESSON, context)
      expect(result.correct).toBe(false)
    }
  )

  test('without context, only the exact move is accepted (legacy behaviour)', () => {
    expect(validateMove('d3e5', 'd3e5', 1, LESSON).correct).toBe(true)
    expect(validateMove('e2e4', 'd3e5', 1, LESSON).correct).toBe(false)
  })

  test('unknown pattern key falls back to exact-match', () => {
    const context = { patternFen: PRACTICE[0].pattern_fen, patternKey: 'no_such_pattern' }
    expect(validateMove('e2e4', 'd3e5', 1, LESSON, context).correct).toBe(false)
  })
})
