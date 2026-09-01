'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess }            from 'chess.js'
import { GameBoard }        from '@/components/GameBoard'
import { FeedbackPanel }    from '@/components/FeedbackPanel'
import { Celebration }      from '@/components/Celebration'
import { DidacticOpponent } from '@/lib/DidacticOpponent'
import { PATTERN_SEQUENCE } from '@/lib/constants'
import type { LessonFeedback, ValidationResult } from '@/lib/PatternValidator'
import { MainGame, type MainGameData } from './MainGame'

// ── Types ─────────────────────────────────────────────────────────
export interface ScriptedGame {
  // core (required)
  pattern:      string
  game_number:  number
  game_type?:   string
  title:        string
  setup_fen:    string
  pgn:          string
  side:         'white' | 'black'

  // practice games
  pattern_fen?: string | null
  best_move?:   string | null

  // main games
  target_patterns?: string[]
  checkpoints?:     { ply: number; pattern: string; description?: string }[]

  // v2 schema fields (all optional for back-compat)
  schema_version?:     string
  lesson_id?:          string
  sub_pattern?:        string
  story?:              string
  secondary_lesson?:   string
  difficulty?:         string
  source_type?:        string
  learning_stage?:     string
  best_move_san?:      string
  concepts?:           string[]
  takeaway?:           string
  minimum_plies?:      number
  verification_status?: string
  publication_status?: string
  metadata?:           Record<string, unknown>
}

type Status = 'scripted' | 'pattern_moment' | 'correct' | 'wrong' | 'revealed'

const MAIN_GAME_NUMBER = 6

function getPracticeGames(games: ScriptedGame[]): ScriptedGame[] {
  return games.filter(g => (g.game_type ?? 'practice') === 'practice')
}

function getGame(games: ScriptedGame[], pattern: string, gameNumber: number): ScriptedGame {
  const practice = getPracticeGames(games)
  return (
    practice.find(g => g.game_number === gameNumber) ??
    practice.find(g => g.pattern === pattern && g.game_number === gameNumber) ??
    practice[0]!
  )
}

function getMainGame(games: ScriptedGame[]): ScriptedGame | undefined {
  return games.find(g => g.game_type === 'main')
}

// Fallback feedback — used only when the server did not supply a
// lessonFeedback prop (content/lessons/<pattern>.json missing or unresolved).
const LESSON_FEEDBACK: Record<string, LessonFeedback> = {
  fork: {
    feedback_correct: 'Perfect! Your knight attacks two enemy pieces at the same time — that is a fork!',
    feedback_hint:    'Look for a square where your knight attacks two enemy pieces at once.',
    feedback_reveal:  'The knight move attacks two pieces simultaneously. The opponent can only save one!',
  },
  pin: {
    feedback_correct: 'Correct! The piece is pinned — it cannot move without exposing something more valuable behind it!',
    feedback_hint:    'Line up your piece so an enemy piece is stuck in front of something more valuable.',
    feedback_reveal:  'The pin places a piece on the line between an enemy piece and something valuable behind it.',
  },
  skewer: {
    feedback_correct: 'Nice skewer! The valuable piece must move, and you win what is behind it!',
    feedback_hint:    'Attack the most valuable piece. When it escapes, the piece behind it is yours!',
    feedback_reveal:  'Attack the big piece first — when it runs, capture what was hiding behind it.',
  },
  discovered_attack: {
    feedback_correct: 'Excellent! Moving that piece revealed a hidden attack — a discovered attack!',
    feedback_hint:    'Move a piece out of the way to uncover a powerful attack by the piece behind it.',
    feedback_reveal:  'Move one piece to unleash the attack of another piece that was behind it.',
  },
  double_check: {
    feedback_correct: 'Brilliant! Two pieces give check at once — a double check! The king must move.',
    feedback_hint:    'Can you move a piece so it gives check AND uncovers a check from another piece?',
    feedback_reveal:  'When two pieces check the king simultaneously, the king cannot block either attack.',
  },
  back_rank_mate: {
    feedback_correct: 'Checkmate! The king was trapped behind its own pawns on the back rank!',
    feedback_hint:    'The king has no escape — its own pawns trap it. Land your heavy piece on the back rank!',
    feedback_reveal:  'The king trapped behind its own pawns cannot escape a rook or queen on the back rank.',
  },
}

function getLessonFeedback(pattern: string, supplied?: LessonFeedback | null): LessonFeedback {
  return supplied ?? LESSON_FEEDBACK[pattern] ?? LESSON_FEEDBACK.fork
}

// ── Component ─────────────────────────────────────────────────────
interface Props {
  pattern:            string
  games:              ScriptedGame[]
  lessonFeedback?:    LessonFeedback | null
  initialGameNumber?: number
  moveDelayMs?:       number
}

export function GamePage({ pattern, games, lessonFeedback = null, initialGameNumber = 1, moveDelayMs = 600 }: Props) {
  const patDef       = PATTERN_SEQUENCE.find(p => p.key === pattern)
  const mainGame     = getMainGame(games)
  const gamesPerPattern = getPracticeGames(games).length || 5

  const [gameNumber, setGameNumber] = useState(() =>
    Math.min(Math.max(initialGameNumber, 1), mainGame ? MAIN_GAME_NUMBER : gamesPerPattern)
  )
  // instanceKey bumped on reset or next-game; drives the combined init+advance effect
  const [instanceKey, setInstanceKey] = useState(0)

  // Mirror gameNumber in a ref so the effect closure always reads the current value
  const gameNumberRef = useRef(gameNumber)
  gameNumberRef.current = gameNumber

  // Live refs — recreated inside the effect on every instanceKey bump
  const gameRef     = useRef<Chess>(null!)
  const opponentRef = useRef<DidacticOpponent>(null!)
  const attemptRef  = useRef(1)

  const [fen,      setFen]      = useState(() => getGame(games, pattern, 1).setup_fen)
  const [status,   setStatus]   = useState<Status>('scripted')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [hint,     setHint]     = useState<string | null>(null)

  const isMainMode = gameNumber === MAIN_GAME_NUMBER && Boolean(mainGame)

  // ── Combined init + scripted-move advance ────────────────────
  useEffect(() => {
    if (gameNumberRef.current === MAIN_GAME_NUMBER) return // MainGame manages itself

    const g = getGame(games, pattern, gameNumberRef.current)
    if (!g.pattern_fen || !g.best_move) {
      throw new Error(`Practice game ${pattern} #${g.game_number} is missing pattern_fen/best_move`)
    }

    const game     = new Chess(g.setup_fen)
    const opponent = new DidacticOpponent({
      scriptedPgn: g.pgn,
      patternFen:  g.pattern_fen,
      bestMove:    g.best_move,
    })

    gameRef.current     = game
    opponentRef.current = opponent
    attemptRef.current  = 1

    setFen(game.fen())
    setStatus('scripted')
    setFeedback(null)
    setHint(null)

    let cancelled = false

    async function advance() {
      while (!cancelled) {
        const move = opponent.getMove(game)
        if (move === null) {
          if (!cancelled) setStatus('pattern_moment')
          return
        }
        game.move({ from: move.slice(0, 2), to: move.slice(2, 4) })
        if (!cancelled) setFen(game.fen())
        await new Promise(r => setTimeout(r, moveDelayMs))
      }
    }

    advance()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey])   // pattern is stable per page mount; gameNumber read via ref

  // ── Reset (same game) ────────────────────────────────────────
  function handleReset() {
    setInstanceKey(k => k + 1)
  }

  // ── Next game ────────────────────────────────────────────────
  function handleNextGame() {
    // Both updates batch into one render; effect sees the new gameNumber via ref
    setGameNumber(n => Math.min(n + 1, gamesPerPattern))
    setInstanceKey(k => k + 1)
  }

  // ── Enter the main game (game 6) ─────────────────────────────
  function handleMainGame() {
    setGameNumber(MAIN_GAME_NUMBER)
  }

  // ── Student move ─────────────────────────────────────────────
  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (status !== 'pattern_moment' && status !== 'wrong') return false

    const g = getGame(games, pattern, gameNumberRef.current)
    if (!g.pattern_fen || !g.best_move) {
      throw new Error(`Practice game ${pattern} #${g.game_number} is missing pattern_fen/best_move`)
    }
    const patternFen = g.pattern_fen
    const bestMove    = g.best_move
    const lesson = getLessonFeedback(pattern, lessonFeedback)
    const uci    = `${from}${to}${promotion ?? ''}`

    fetch('/api/validate-move', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        playerMove:    uci,
        bestMove,
        attemptNumber: attemptRef.current,
        lesson,
        patternKey:    pattern,
        gameNumber:    gameNumberRef.current,
        patternFen, // any detector-valid move is accepted
      }),
    })
      .then(r => r.json() as Promise<ValidationResult>)
      .then(result => {
        if (result.correct) {
          try { gameRef.current.move({ from, to, ...(promotion ? { promotion } : {}) }) } catch {}
          setFen(gameRef.current.fen())
          setStatus('correct')
          setFeedback(result.feedback)
          setHint(null)
        } else if (result.showAnswer) {
          const bf = bestMove.slice(0, 2)
          const bt = bestMove.slice(2, 4)
          try { gameRef.current.move({ from: bf, to: bt }) } catch {}
          setFen(gameRef.current.fen())
          setStatus('revealed')
          setFeedback(result.feedback)
          setHint(null)
        } else {
          setStatus('wrong')
          setFeedback(result.feedback)
          setHint(result.hint)
        }
        attemptRef.current += 1
      })
      .catch(() => setStatus('pattern_moment'))

    return false
  }, [status, pattern, lessonFeedback])

  // ── Main-game mode delegates to its own component ─────────────
  if (isMainMode && mainGame) {
    return (
      <MainGame
        game={mainGame as MainGameData}
        displayName={patDef?.displayName ?? pattern}
        moveDelayMs={moveDelayMs}
      />
    )
  }

  const isFinished  = status === 'correct' || status === 'revealed'
  const interactive = status === 'pattern_moment' || status === 'wrong'
  const hasNextGame = gameNumber < gamesPerPattern
  const isLastGame  = gameNumber === gamesPerPattern
  const currentGame = getGame(games, pattern, gameNumber)

  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">
        {patDef?.displayName ?? pattern} — Game {gameNumber} of {gamesPerPattern}
      </h1>

      <p className="text-gray-400 text-sm">{currentGame.title}</p>

      <p className="text-gray-300 text-sm h-5">
        {status === 'scripted'       && 'Watch the position unfold…'}
        {status === 'pattern_moment' && 'Your turn — find the best move!'}
        {status === 'wrong'          && (hint ?? 'Not quite — try again!')}
      </p>

      <GameBoard
        fen={fen}
        onMove={handleMove}
        orientation={currentGame.side}
        interactive={interactive}
        boardWidth={520}
      />

      <FeedbackPanel
        key={`${status}:${feedback ?? ''}`}
        feedback={feedback}
        hint={hint}
        status={status === 'scripted' || status === 'pattern_moment' ? null : status}
      />

      <Celebration show={status === 'correct'} message="Brilliant!" />

      {isFinished && (
        <div className="flex gap-4">
          {hasNextGame && (
            <button
              onClick={handleNextGame}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold transition-colors"
            >
              Next Game →
            </button>
          )}
          {isLastGame && mainGame && (
            <button
              onClick={handleMainGame}
              data-testid="main-game-button"
              className="px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold transition-colors"
            >
              Main Game ♛
            </button>
          )}
          <button
            onClick={handleReset}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-colors"
          >
            Play Again
          </button>
        </div>
      )}
    </main>
  )
}
