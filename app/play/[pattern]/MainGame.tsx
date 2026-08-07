'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess } from 'chess.js'
import { GameBoard } from '@/components/GameBoard'
import { Celebration } from '@/components/Celebration'
import { MainGameOpponent } from '@/lib/MainGameOpponent'
import { DETECTORS, patternMoves } from '@/lib/patternDetectors'
import { PATTERN_SEQUENCE, XP_REWARDS } from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────
export interface MainGameData {
  pattern: string
  title: string
  story?: string
  pgn: string
  side: 'white' | 'black'
  target_patterns?: string[]
}

interface Props {
  game: MainGameData
  displayName: string
  moveDelayMs?: number
}

// Appreciation banner copy per pattern (generic fallback below)
const APPRECIATION: Record<string, string> = {
  fork: 'A fork! Two targets with one move!',
  pin: 'A pin! That piece is frozen in place!',
  skewer: 'A skewer! When the big piece runs, the loot behind falls!',
  discovered_attack: 'A discovered attack! You unleashed the piece behind!',
  double_check: 'Double check! The king must run!',
  back_rank_mate: 'Back-rank mate! The king was trapped behind its own pawns!',
}

function patternDisplayName(key: string): string {
  return PATTERN_SEQUENCE.find(p => p.key === key)?.displayName ?? key
}

// ── Component ─────────────────────────────────────────────────────
export function MainGame({ game, displayName, moveDelayMs = 600 }: Props) {
  const studentColor = game.side === 'white' ? 'w' : 'b'
  const targets = game.target_patterns ?? [game.pattern]

  const [instanceKey, setInstanceKey] = useState(0)
  const gameRef = useRef<Chess>(null!)
  const opponentRef = useRef<MainGameOpponent>(null!)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [fen, setFen] = useState(() => new Chess().fen())
  const [banner, setBanner] = useState<string | null>(null)
  const [hintPattern, setHintPattern] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const computeHint = useCallback((board: Chess): string | null => {
    if (board.turn() !== studentColor || board.isGameOver()) return null
    for (const p of targets) {
      if (patternMoves(board.fen(), p).length > 0) return p
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentColor, targets.join(',')])

  const checkGameOver = useCallback((board: Chess): boolean => {
    if (!board.isGameOver()) return false
    if (board.isCheckmate()) {
      setResult(board.turn() === studentColor
        ? 'Checkmate — the CPU wins this one. Try again!'
        : 'Checkmate — you win! 🎉')
    } else {
      setResult('The game is a draw.')
    }
    return true
  }, [studentColor])

  const playCpuMove = useCallback(() => {
    const board = gameRef.current
    if (board.isGameOver() || board.turn() === studentColor) return
    setThinking(true)
    timerRef.current = setTimeout(() => {
      const uci = opponentRef.current.getMove(board)
      if (uci) {
        try {
          board.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
          })
        } catch {}
        setFen(board.fen())
      }
      setThinking(false)
      if (!checkGameOver(board)) setHintPattern(computeHint(board))
    }, moveDelayMs)
  }, [studentColor, moveDelayMs, checkGameOver, computeHint])

  // ── Init / reset ──────────────────────────────────────────────
  useEffect(() => {
    const board = new Chess()
    gameRef.current = board
    opponentRef.current = new MainGameOpponent({
      scriptedPgn: game.pgn,
      side: game.side,
    })
    setFen(board.fen())
    setBanner(null)
    setResult(null)
    setThinking(false)
    if (board.turn() === studentColor) setHintPattern(computeHint(board))
    else playCpuMove()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey])

  // ── Student move ──────────────────────────────────────────────
  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const board = gameRef.current
    if (result || thinking || board.turn() !== studentColor) return false

    const fenBefore = board.fen()
    try {
      board.move({ from, to, ...(promotion ? { promotion } : {}) })
    } catch {
      return false
    }

    // Live appreciation: did the student just play a target pattern?
    const uci = `${from}${to}${promotion ?? ''}`
    const spotted = targets.find(p => DETECTORS[p]?.(fenBefore, uci))
    setBanner(spotted
      ? `🎉 ${APPRECIATION[spotted] ?? `You found a ${patternDisplayName(spotted)}!`} ` +
        `+${XP_REWARDS.PATTERN_SPOTTED} XP`
      : null)

    setFen(board.fen())
    setHintPattern(null)
    if (!checkGameOver(board)) playCpuMove()
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, thinking, studentColor, targets.join(','), checkGameOver, playCpuMove])

  const isStudentTurn = !result && !thinking &&
    fen.split(' ')[1] === studentColor

  const won = Boolean(result && result.includes('you win'))

  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">{displayName} — Main Game</h1>

      <p className="text-gray-400 text-sm">{game.title}</p>

      <p className="text-gray-300 text-sm h-5" data-testid="main-game-status">
        {result ?? (isStudentTurn ? 'Your move — play like a champion!' : 'CPU is thinking…')}
      </p>

      {hintPattern && !result && (
        <span
          data-testid="hint-chip"
          className="px-3 py-1 bg-yellow-600/30 border border-yellow-500 rounded-full text-yellow-200 text-xs"
        >
          💡 A {patternDisplayName(hintPattern).toLowerCase()} is possible here…
        </span>
      )}

      <GameBoard
        fen={fen}
        onMove={handleMove}
        orientation={game.side}
        interactive={!result}
        boardWidth={520}
      />

      {banner && (
        <div
          data-testid="appreciation-banner"
          className="panel-pop px-6 py-3 bg-green-600/20 border border-green-500 rounded-xl text-green-200 text-sm font-semibold"
        >
          {banner}
        </div>
      )}

      <Celebration
        show={Boolean(banner) || won}
        message={won ? 'You win!' : 'Pattern spotted!'}
      />

      {result && (
        <button
          onClick={() => setInstanceKey(k => k + 1)}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-colors"
        >
          Play Again
        </button>
      )}
    </main>
  )
}
