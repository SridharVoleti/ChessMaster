/**
 * Opponent for "main" games (game 6 of a level).
 *
 * Plays a scripted drive-line (the full mainline, including the
 * student's expected moves) for as long as the actual game history
 * follows it. The moment the game deviates, it permanently falls back
 * to the injected move chooser (default: simpleCpu).
 *
 * Reusable: pure of app state; everything arrives via config.
 */

import { Chess } from 'chess.js'
import { parsePgnToMoves } from './DidacticOpponent'
import { chooseSimpleCpuMove } from './simpleCpu'

export interface MainGameOpponentConfig {
  scriptedPgn: string                              // full mainline incl. student moves
  side: 'white' | 'black'                          // the STUDENT's side
  chooseFallback?: (fen: string) => string | null  // CPU move source off-script
}

export interface Checkpoint {
  ply: number      // 0-based ply index into the mainline
  pattern: string
}

export class MainGameOpponent {
  private readonly mainline: string[]
  private readonly chooseFallback: (fen: string) => string | null
  readonly studentColor: 'w' | 'b'
  private deviated = false

  constructor(private config: MainGameOpponentConfig) {
    this.mainline = parsePgnToMoves(config.scriptedPgn)
    this.chooseFallback = config.chooseFallback ?? chooseSimpleCpuMove
    this.studentColor = config.side === 'white' ? 'w' : 'b'
  }

  /** UCI history of the given game. */
  private static historyUci(board: Chess): string[] {
    return board.history({ verbose: true }).map(m => `${m.from}${m.to}${m.promotion ?? ''}`)
  }

  /** True while the game history is a prefix of the scripted mainline. */
  isOnScript(board: Chess): boolean {
    if (this.deviated) return false
    const history = MainGameOpponent.historyUci(board)
    if (history.length > this.mainline.length) {
      this.deviated = true
      return false
    }
    for (let i = 0; i < history.length; i++) {
      if (history[i] !== this.mainline[i]) {
        this.deviated = true
        return false
      }
    }
    return true
  }

  /** The next mainline move from this position, if still on script.
   *  Works for both sides — use it for CPU moves and student hints. */
  nextScriptMove(board: Chess): string | null {
    if (!this.isOnScript(board)) return null
    const history = MainGameOpponent.historyUci(board)
    return history.length < this.mainline.length ? this.mainline[history.length] : null
  }

  /** CPU move for the current position: scripted while the game follows
   *  the drive-line, fallback chooser afterwards. Null if game over or
   *  it is the student's turn. */
  getMove(board: Chess): string | null {
    if (board.isGameOver()) return null
    if (board.turn() === this.studentColor) return null
    return this.nextScriptMove(board) ?? this.chooseFallback(board.fen())
  }

  /** True when the scripted mainline is exhausted (and was followed). */
  isScriptComplete(board: Chess): boolean {
    return this.isOnScript(board) &&
      MainGameOpponent.historyUci(board).length >= this.mainline.length
  }

  get totalScriptedMoves(): number {
    return this.mainline.length
  }

  reset(): void {
    this.deviated = false
  }
}
