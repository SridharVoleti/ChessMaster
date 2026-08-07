/**
 * Tests for lib/MainGameOpponent.ts — drive-line opponent with
 * fallback. Parametrised over every shipped main game.
 */

import { Chess } from 'chess.js'
import { MainGameOpponent } from '@/lib/MainGameOpponent'
import { parsePgnToMoves } from '@/lib/DidacticOpponent'
import gamesData from '@/scripts/scripted_games_data.json'

interface GameRow {
  pattern: string
  game_type?: string
  title: string
  pgn: string
  side: 'white' | 'black'
}

const MAINS = (gamesData as GameRow[]).filter(g => g.game_type === 'main')

function push(board: Chess, uci: string) {
  board.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
  })
}

describe.each(MAINS.map(g => [`${g.pattern} MAIN (${g.title})`, g] as const))(
  '%s',
  (_label, g) => {
    test('replays the full drive-line: scripted CPU moves, hinted student moves', () => {
      const opponent = new MainGameOpponent({ scriptedPgn: g.pgn, side: g.side })
      const mainline = parsePgnToMoves(g.pgn)
      expect(mainline.length).toBeGreaterThanOrEqual(15)

      const board = new Chess()
      const studentColor = g.side === 'white' ? 'w' : 'b'

      for (const expected of mainline) {
        expect(opponent.isOnScript(board)).toBe(true)
        if (board.turn() === studentColor) {
          expect(opponent.getMove(board)).toBeNull() // never moves for the student
          expect(opponent.nextScriptMove(board)).toBe(expected)
        } else {
          expect(opponent.getMove(board)).toBe(expected)
        }
        push(board, expected)
      }
      expect(opponent.isScriptComplete(board)).toBe(true)
    })

    test('falls back to a legal move after deviation and stays off script', () => {
      const opponent = new MainGameOpponent({ scriptedPgn: g.pgn, side: g.side })
      const mainline = parsePgnToMoves(g.pgn)
      const board = new Chess()

      // Deviate immediately: play any legal first move that is NOT the mainline.
      const offScript = board
        .moves({ verbose: true })
        .map(m => `${m.from}${m.to}${m.promotion ?? ''}`)
        .find(uci => uci !== mainline[0])!
      push(board, offScript)

      expect(opponent.isOnScript(board)).toBe(false)
      expect(opponent.nextScriptMove(board)).toBeNull()

      if (board.turn() !== (g.side === 'white' ? 'w' : 'b')) {
        const reply = opponent.getMove(board)
        expect(reply).not.toBeNull()
        expect(() => push(board, reply!)).not.toThrow()
      }
      expect(opponent.isScriptComplete(board)).toBe(false)
    })

    test('reset restores script tracking', () => {
      const opponent = new MainGameOpponent({ scriptedPgn: g.pgn, side: g.side })
      const board = new Chess()
      const offScript = board
        .moves({ verbose: true })
        .map(m => `${m.from}${m.to}${m.promotion ?? ''}`)
        .find(uci => uci !== parsePgnToMoves(g.pgn)[0])!
      push(board, offScript)
      expect(opponent.isOnScript(board)).toBe(false)

      opponent.reset()
      expect(opponent.isOnScript(new Chess())).toBe(true)
    })
  }
)
