/**
 * Deterministic fallback CPU move chooser.
 *
 * Priority: 1) checkmate if available, 2) best materially-winning
 * capture, 3) rescue the most valuable hanging piece, 4) a sensible
 * quiet move (castle / develop / push). Fully deterministic: ties are
 * broken by UCI string order so tests are reproducible.
 *
 * Reusable across projects: pure function of a FEN, no app imports.
 */

import { Chess, Color, PieceSymbol, Square } from 'chess.js'
import { PIECE_VALUES, isMoveSafe } from './patternDetectors'

interface ScoredMove {
  uci: string
  score: number
}

function uciOf(m: { from: string; to: string; promotion?: string }): string {
  return `${m.from}${m.to}${m.promotion ?? ''}`
}

function other(color: Color): Color { return color === 'w' ? 'b' : 'w' }

/** Static check: the piece on `square` is attacked at a profit. */
function isHanging(game: Chess, square: Square): boolean {
  const piece = game.get(square)
  if (!piece || piece.type === 'k') return false
  const attackers = game.attackers(square, other(piece.color))
  if (attackers.length === 0) return false
  const defenders = game.attackers(square, piece.color)
  if (defenders.length === 0) return true
  const minAttacker = Math.min(...attackers.map(s => PIECE_VALUES[game.get(s)!.type]))
  return minAttacker < PIECE_VALUES[piece.type]
}

/** Most valuable hanging piece of `color`, or 0. */
function hangingLoss(game: Chess, color: Color): number {
  let worst = 0
  for (let r = 1; r <= 8; r++) {
    for (const f of 'abcdefgh') {
      const s = (f + r) as Square
      const p = game.get(s)
      if (p && p.color === color && isHanging(game, s)) {
        worst = Math.max(worst, PIECE_VALUES[p.type])
      }
    }
  }
  return worst
}

/**
 * Choose a move for the side to move in `fen`.
 * Returns a UCI string, or null if the game is over.
 */
export function chooseSimpleCpuMove(fen: string): string | null {
  const game = new Chess(fen)
  const moves = game.moves({ verbose: true })
  if (moves.length === 0) return null

  const color = game.turn()
  const scored: ScoredMove[] = []

  for (const m of moves) {
    const after = new Chess(fen)
    after.move({ from: m.from, to: m.to, promotion: m.promotion })

    if (after.isCheckmate()) return uciOf(m)

    let score = 0
    // capture gain: victim value, minus the capturer if it can be recaptured
    if (m.captured) {
      let gain = PIECE_VALUES[m.captured]
      if (!isMoveSafe(after, m.to)) gain -= PIECE_VALUES[m.piece]
      score += gain * 100
    } else if (!isMoveSafe(after, m.to)) {
      score -= PIECE_VALUES[m.piece] * 100 // don't hang the mover
    }
    // rescue / avoid leaving material en prise
    score -= hangingLoss(after, color) * 90
    // mild development preferences
    if (m.flags.includes('k') || m.flags.includes('q')) score += 6 // castling
    else if (m.piece === 'n' || m.piece === 'b') score += 3
    else if (m.piece === 'p') score += 1
    else if (m.piece === 'k') score -= 5

    scored.push({ uci: uciOf(m), score })
  }

  scored.sort((a, b) => b.score - a.score || a.uci.localeCompare(b.uci))
  return scored[0].uci
}
